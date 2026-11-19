import * as THREE from 'three';
import { PRIZE_CATALOG } from '../data/prizeCatalog';
import { MachineProfile, PrizeArchetype, PrizeCatalogItem, PrizePlacement } from '../types/machine';
import { COLLISION_GROUP, getRapier, RAPIER } from './physicsEngine';

export interface RigidPrizeInstance {
  id: string;
  kind: 'rigid';
  archetype: PrizeArchetype;
  catalog: PrizeCatalogItem;
  body: RAPIER.RigidBody;
  colliderHandles: number[];
  won: boolean;
  wonTimer: number;
  variantSeed: number;
}

export interface ArticulatedPlushPart {
  partName: 'torso' | 'head' | 'armL' | 'armR' | 'legL' | 'legR';
  body: RAPIER.RigidBody;
  colliderHandle: number;
}

export interface ArticulatedPlushInstance {
  id: string;
  kind: 'plush';
  archetype: PrizeArchetype;
  catalog: PrizeCatalogItem;
  parts: ArticulatedPlushPart[];
  colliderHandles: number[];
  won: boolean;
  wonTimer: number;
  variantSeed: number;
}

export type PrizePhysicsInstance = RigidPrizeInstance | ArticulatedPlushInstance;

/**
 * 負責在機台的獨立物理世界中生成真實重量與偏心重心的硬盒獎品、多段關節布偶，
 * 進行初始化靜置穩定（Pre-settle），並透過出貨口 Sensor 判定真實出貨。
 */
export class PrizeSpawner {
  public prizes: PrizePhysicsInstance[] = [];
  private nextId = 1;

  constructor(
    private readonly profile: MachineProfile,
    private readonly world: RAPIER.World,
    private readonly chuteSensorHandle: number
  ) {}

  public spawnAll(): PrizePhysicsInstance[] {
    this.clearAll();
    const floorY = this.profile.cabinet.playAreaSize.value.floorY;

    this.profile.prizes.forEach((placement, idx) => {
      const item = PRIZE_CATALOG[placement.archetype];
      const seed = placement.variantSeed ?? idx * 17 + 3;
      if (item.isArticulatedPlush) {
        this.prizes.push(this.spawnPlush(placement, item, floorY, seed));
      } else {
        this.prizes.push(this.spawnRigidBox(placement, item, floorY, seed));
      }
    });

    // 初始化預先穩定（Pre-settle）：確保堆疊盒裝與布偶自然落地受力，絕不在開場穿模爆開
    for (let i = 0; i < 110; i++) {
      this.world.step();
    }

    // 清除預先穩定後的殘留速度，避免微微滑動
    for (const p of this.prizes) {
      if (p.kind === 'rigid') {
        p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      } else {
        for (const part of p.parts) {
          part.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          part.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
      }
    }

    return this.prizes;
  }

  private spawnRigidBox(
    placement: PrizePlacement,
    catalog: PrizeCatalogItem,
    floorY: number,
    seed: number
  ): RigidPrizeInstance {
    const rapier = getRapier();
    const { width, height, depth } = catalog.dimensions;
    const euler = placement.rotationEuler ?? { x: 0, y: 0, z: 0 };
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(euler.x, euler.y, euler.z));

    const bodyDesc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(placement.position.x, floorY + placement.position.y + 0.008, placement.position.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setLinearDamping(0.32)
      .setAngularDamping(0.45);
    const body = this.world.createRigidBody(bodyDesc);

    // 外殼剛體碰撞（含圓角 bevel 以提升滑動與翻盒自然度）
    const shellMass = catalog.massKg * 0.45;
    const ballastMass = catalog.massKg * 0.55;

    const shellCol = rapier.ColliderDesc.roundCuboid(
      Math.max(0.005, width / 2 - 0.003),
      Math.max(0.005, height / 2 - 0.003),
      Math.max(0.005, depth / 2 - 0.003),
      0.003
    )
      .setMass(shellMass)
      .setFriction(catalog.friction)
      .setFrictionCombineRule(rapier.CoefficientCombineRule.Average)
      .setRestitution(catalog.restitution)
      .setCollisionGroups(COLLISION_GROUP.PRIZE);
    const c1 = this.world.createCollider(shellCol, body);

    // 內部商品配重（真實產生偏心重心 comOffset，決定捏邊翻轉與斜靠傾覆方向）
    const com = catalog.comOffset;
    const ballastR = Math.min(width, height, depth) * 0.22;
    const ballastCol = rapier.ColliderDesc.ball(Math.max(0.006, ballastR))
      .setTranslation(com.x, com.y, com.z)
      .setMass(ballastMass)
      .setFriction(catalog.friction)
      .setCollisionGroups(COLLISION_GROUP.PRIZE);
    const c2 = this.world.createCollider(ballastCol, body);

    return {
      id: `${this.profile.id}-prize-${this.nextId++}`,
      kind: 'rigid',
      archetype: placement.archetype,
      catalog,
      body,
      colliderHandles: [c1.handle, c2.handle],
      won: false,
      wonTimer: 0,
      variantSeed: seed,
    };
  }

  /**
   * 多段關節布偶（頭、軀幹、雙手、雙腳皆具獨立剛體與阻尼球形關節，可真實彎折掛在擋板上）
   */
  private spawnPlush(
    placement: PrizePlacement,
    catalog: PrizeCatalogItem,
    floorY: number,
    seed: number
  ): ArticulatedPlushInstance {
    const rapier = getRapier();
    const { width, height, depth } = catalog.dimensions;
    const basePos = new THREE.Vector3(placement.position.x, floorY + placement.position.y + 0.015, placement.position.z);
    const yaw = placement.rotationEuler?.y ?? 0;
    const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    const toWorld = (lx: number, ly: number, lz: number) =>
      new THREE.Vector3(lx, ly, lz).applyQuaternion(rotY).add(basePos);

    const makePart = (
      partName: ArticulatedPlushPart['partName'],
      lx: number,
      ly: number,
      lz: number,
      radius: number,
      halfHeight: number,
      mass: number
    ): ArticulatedPlushPart => {
      const wp = toWorld(lx, ly, lz);
      const bd = rapier.RigidBodyDesc.dynamic()
        .setTranslation(wp.x, wp.y, wp.z)
        .setRotation({ x: rotY.x, y: rotY.y, z: rotY.z, w: rotY.w })
        .setLinearDamping(0.85)
        .setAngularDamping(1.35);
      const body = this.world.createRigidBody(bd);
      const cd = (halfHeight > 0.004
        ? rapier.ColliderDesc.capsule(halfHeight, radius)
        : rapier.ColliderDesc.ball(radius))
        .setMass(mass)
        .setFriction(catalog.friction)
        .setRestitution(catalog.restitution)
        .setCollisionGroups(COLLISION_GROUP.PRIZE);
      const col = this.world.createCollider(cd, body);
      return { partName, body, colliderHandle: col.handle };
    };

    const torsoR = width * 0.34;
    const torsoHH = height * 0.14;
    const headR = width * 0.31;
    const limbR = width * 0.13;

    const torso = makePart('torso', 0, 0, 0, torsoR, torsoHH, catalog.massKg * 0.42);
    const head = makePart('head', 0, torsoHH + torsoR + headR * 0.65, 0, headR, 0, catalog.massKg * 0.26);
    const armL = makePart('armL', -(torsoR + limbR * 0.85), torsoHH * 0.4, 0.01, limbR, 0.016, catalog.massKg * 0.08);
    const armR = makePart('armR', torsoR + limbR * 0.85, torsoHH * 0.4, 0.01, limbR, 0.016, catalog.massKg * 0.08);
    const legL = makePart('legL', -torsoR * 0.55, -(torsoHH + torsoR * 0.45), depth * 0.32, limbR * 1.1, 0.018, catalog.massKg * 0.08);
    const legR = makePart('legR', torsoR * 0.55, -(torsoHH + torsoR * 0.45), depth * 0.32, limbR * 1.1, 0.018, catalog.massKg * 0.08);

    const link = (parent: RAPIER.RigidBody, child: RAPIER.RigidBody, a1: { x: number; y: number; z: number }, a2: { x: number; y: number; z: number }) => {
      const jd = rapier.JointData.spherical(a1, a2);
      const j = this.world.createImpulseJoint(jd, parent, child, true);
      j.setContactsEnabled(false);
    };

    link(torso.body, head.body, { x: 0, y: torsoHH + torsoR * 0.85, z: 0 }, { x: 0, y: -headR * 0.78, z: 0 });
    link(torso.body, armL.body, { x: -torsoR * 0.9, y: torsoHH * 0.5, z: 0 }, { x: limbR * 0.8, y: 0.012, z: 0 });
    link(torso.body, armR.body, { x: torsoR * 0.9, y: torsoHH * 0.5, z: 0 }, { x: -limbR * 0.8, y: 0.012, z: 0 });
    link(torso.body, legL.body, { x: -torsoR * 0.5, y: -torsoHH * 0.8, z: torsoR * 0.5 }, { x: 0, y: 0.01, z: -0.024 });
    link(torso.body, legR.body, { x: torsoR * 0.5, y: -torsoHH * 0.8, z: torsoR * 0.5 }, { x: 0, y: 0.01, z: -0.024 });

    const parts = [torso, head, armL, armR, legL, legR];
    return {
      id: `${this.profile.id}-plush-${this.nextId++}`,
      kind: 'plush',
      archetype: placement.archetype,
      catalog,
      parts,
      colliderHandles: parts.map((p) => p.colliderHandle),
      won: false,
      wonTimer: 0,
      variantSeed: seed,
    };
  }

  /**
   * 透過 Rapier Sensor 交集判定獎品是否真正掉入出貨口（不靠作弊機率）
   */
  public checkChuteSensor(dt: number): PrizePhysicsInstance[] {
    const newlyWon: PrizePhysicsInstance[] = [];
    const sensorCollider = this.world.getCollider(this.chuteSensorHandle);
    if (!sensorCollider) return newlyWon;

    const floorY = this.profile.cabinet.playAreaSize.value.floorY;

    for (const prize of this.prizes) {
      if (prize.won) continue;

      let intersecting = false;
      for (const h of prize.colliderHandles) {
        const col = this.world.getCollider(h);
        if (col && this.world.intersectionPair(sensorCollider, col)) {
          intersecting = true;
          break;
        }
      }

      // 額外保護：若獎品重心低於出貨口深處（防止超高速穿過感應層）
      if (!intersecting) {
        const mainBody = prize.kind === 'rigid' ? prize.body : prize.parts[0].body;
        const pos = mainBody.translation();
        if (pos.y < floorY - 0.24) {
          intersecting = true;
        }
      }

      if (intersecting) {
        prize.wonTimer += dt;
        if (prize.wonTimer >= 0.08) {
          prize.won = true;
          newlyWon.push(prize);
        }
      } else {
        prize.wonTimer = 0;
      }
    }

    return newlyWon;
  }

  public removePrizeBodies(prize: PrizePhysicsInstance): void {
    if (prize.kind === 'rigid') {
      if (this.world.getRigidBody(prize.body.handle)) {
        this.world.removeRigidBody(prize.body);
      }
    } else {
      for (const part of prize.parts) {
        if (this.world.getRigidBody(part.body.handle)) {
          this.world.removeRigidBody(part.body);
        }
      }
    }
  }

  public clearAll(): void {
    for (const prize of this.prizes) {
      this.removePrizeBodies(prize);
    }
    this.prizes = [];
  }

  public isSettled(): boolean {
    const linThresh = 0.025;
    const angThresh = 0.08;
    for (const p of this.prizes) {
      if (p.won) continue;
      const bodies = p.kind === 'rigid' ? [p.body] : p.parts.map((pt) => pt.body);
      for (const b of bodies) {
        const lv = b.linvel();
        const av = b.angvel();
        if (lv.x * lv.x + lv.y * lv.y + lv.z * lv.z > linThresh * linThresh) return false;
        if (av.x * av.x + av.y * av.y + av.z * av.z > angThresh * angThresh) return false;
      }
    }
    return true;
  }
}
