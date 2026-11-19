import * as THREE from 'three';
import { MachineProfile, MachinePhase } from '../types/machine';
import { COLLISION_GROUP, getRapier, RAPIER } from './physicsEngine';
import { FirmwareCommand, FirmwareController, FirmwareInput } from './firmwareController';

export interface ProngRigState {
  azimuth: number;
  body: RAPIER.RigidBody;
  joint: RAPIER.RevoluteImpulseJoint;
  hingeAxisLocal: THREE.Vector3;
  angle: number;
  angularVel: number;
}

export interface ClawRigTelemetry {
  phase: MachinePhase;
  trolleyPos: THREE.Vector3;
  clawHeadPos: THREE.Vector3;
  clawHeadQuat: THREE.Quaternion;
  cableAnchorTop: THREE.Vector3;
  cableAnchorBottom: THREE.Vector3;
  cableLength: number;
  cableTensionN: number;
  isCableSlack: boolean;
  solenoidCurrentA: number;
  plungerNormalized: number; // 0 = open, 1 = closed
  clawPowerCmd: number;
  prongAngles: [number, number, number];
  prongStates: Array<{ pos: THREE.Vector3; quat: THREE.Quaternion }>;
}

/**
 * 單台台灣夾娃娃機的完整機械與電磁物理總成（在獨立的機台本地座標系中運行）
 * 包含：
 * 1. 遊戲艙實體碰撞（含真實深度洞口、可調擋板、防甩片、橫桿與出貨口 Sensor）
 * 2. 具真實加減速與急停煞車的天車（Trolley）
 * 3. 可變長度只受拉鋼索約束（T >= 0, d <= L，鬆弛時無任何推力）＋ 黑色螺旋線扭轉回復力
 * 4. 中央電磁鐵芯 RL 電流模型（P1~P4 控制值 -> 電流 -> 非線性磁力）耦合三根彎曲爪腳
 */
export class ClawRig {
  public readonly firmware: FirmwareController;
  public readonly chuteSensorHandle: number;

  public readonly trolleyBody: RAPIER.RigidBody;
  public readonly clawHeadBody: RAPIER.RigidBody;
  public readonly prongs: ProngRigState[] = [];

  // 天車狀態
  public readonly trackBounds: { xMin: number; xMax: number; zMin: number; zMax: number };
  public readonly homePos: { x: number; z: number };
  private trolleyPos = new THREE.Vector3();
  private trolleyVel = new THREE.Vector3();

  // 卷線機與鋼索狀態
  private cableLength: number;
  private readonly minCableLength: number;
  private readonly maxCableLength: number;
  private readonly headEyeletOffsetY: number;
  private cableTensionN = 0;
  private isCableSlack = false;

  // 電磁線圈與鐵芯狀態
  private solenoidCurrentA = 0;
  private plungerPos = 0; // 0 = fully open, 1 = fully closed
  private lastPowerCmd = 0;

  // 暫存向量避免每步 GC
  private readonly tmpVecA = new THREE.Vector3();
  private readonly tmpVecB = new THREE.Vector3();
  private readonly tmpVecC = new THREE.Vector3();
  private readonly tmpQuatA = new THREE.Quaternion();
  private readonly tmpQuatB = new THREE.Quaternion();

  constructor(
    public readonly profile: MachineProfile,
    public readonly world: RAPIER.World
  ) {
    const rapier = getRapier();
    const play = profile.cabinet.playAreaSize.value;
    const chute = profile.cabinet.chuteOpening.value;
    const phys = profile.physics;

    const halfW = play.width / 2;
    const halfD = play.depth / 2;

    // 1. 建立場內靜態碰撞幾何（含真實深度出貨洞口、擋板、防甩片、四面玻璃牆）
    this.chuteSensorHandle = this.buildCabinetColliders();

    // 2. 計算天車移動邊界與洞口歸位點（洞口在左前角落）
    const marginX = Math.max(0.085, phys.maxOpenSpread.value * 0.48);
    const marginZ = Math.max(0.085, phys.maxOpenSpread.value * 0.48);
    this.trackBounds = {
      xMin: -halfW + marginX,
      xMax: halfW - marginX,
      zMin: -halfD + marginZ,
      zMax: halfD - marginZ,
    };

    // 歸位點位於出貨洞口正上方中心
    this.homePos = {
      x: Math.max(this.trackBounds.xMin, -halfW + chute.width * 0.48),
      z: Math.min(this.trackBounds.zMax, halfD - chute.depth * 0.48),
    };

    this.trolleyPos.set(this.homePos.x, play.railY, this.homePos.z);

    // 3. 建立天車剛體（KinematicPositionBased）
    const trolleyDesc = rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(
      this.trolleyPos.x,
      this.trolleyPos.y,
      this.trolleyPos.z
    );
    this.trolleyBody = world.createRigidBody(trolleyDesc);

    // 4. 建立鋼索參數與爪頭剛體
    this.minCableLength = phys.minCableLength.value;
    const scale = phys.prongLength.value / 0.145;
    this.headEyeletOffsetY = 0.068 * scale;
    const pivotYLocal = 0.026 * scale;
    const openTipReachY = phys.prongLength.value * Math.cos(phys.openAngleRad);
    // 確保張開狀態下爪尖能下探貼近檯面，同時避免高盒過度放線導致爪頭傾倒
    const floorDropLen = play.railY - play.floorY - this.headEyeletOffsetY - pivotYLocal - openTipReachY + 0.022;
    this.maxCableLength = Math.min(
      profile.controller.dropHeightLimit,
      Math.max(0.32, floorDropLen)
    );
    this.cableLength = this.minCableLength;

    const headStartY = play.railY - this.cableLength - this.headEyeletOffsetY;
    const headDesc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(this.trolleyPos.x, headStartY, this.trolleyPos.z)
      .setLinearDamping(0.58)
      .setAngularDamping(0.95)
      .setCanSleep(false);
    this.clawHeadBody = world.createRigidBody(headDesc);

    // 爪頭本體圓柱碰撞器（含電磁筒外殼）
    const headRadius = 0.036 * scale;
    const headHalfH = 0.044 * scale;
    const headCol = rapier.ColliderDesc.cylinder(headHalfH, headRadius)
      .setMass(phys.clawHeadMass.value)
      .setFriction(0.35)
      .setRestitution(0.15)
      .setCollisionGroups(COLLISION_GROUP.CLAW_HEAD);
    world.createCollider(headCol, this.clawHeadBody);

    // 5. 建立三根彎曲爪腳剛體與 RevoluteJoint
    const pivotRadius = 0.026 * scale;
    const pivotY = -0.026 * scale;
    const L = phys.prongLength.value;
    const tubeR = 0.0052 * scale;
    const tipR = 0.0072 * scale; // 含爪套厚度

    for (let i = 0; i < 3; i++) {
      const azimuth = (i * Math.PI * 2) / 3 + Math.PI / 6; // 30°, 150°, 270°（正前方一爪朝內或兩爪對稱）
      const cosA = Math.cos(azimuth);
      const sinA = Math.sin(azimuth);

      // 樞軸切線方向 u_i = (-sinA, 0, cosA)，正角 +theta 為張開，負角 -theta 為閉合
      const axisLocal = new THREE.Vector3(-sinA, 0, cosA);

      const anchorHead = { x: pivotRadius * cosA, y: pivotY, z: pivotRadius * sinA };
      const initAngle = phys.openAngleRad;

      // 以四元數將爪腳初始擺在張開角度
      const initQuat = new THREE.Quaternion().setFromAxisAngle(axisLocal, initAngle);
      const prongWorldPos = new THREE.Vector3(
        this.trolleyPos.x + anchorHead.x,
        headStartY + anchorHead.y,
        this.trolleyPos.z + anchorHead.z
      );

      const prongDesc = rapier.RigidBodyDesc.dynamic()
        .setTranslation(prongWorldPos.x, prongWorldPos.y, prongWorldPos.z)
        .setRotation({ x: initQuat.x, y: initQuat.y, z: initQuat.z, w: initQuat.w })
        .setLinearDamping(0.45)
        .setAngularDamping(0.75)
        .setCanSleep(false);
      const prongBody = world.createRigidBody(prongDesc);

      // 三段彎曲爪腳複合碰撞器（上臂 -> 中膝 -> 台灣三號爪近水平內勾防滑爪套尖端）
      // 座標定義在爪腳本地 (r, y) 平面，r 沿 (cosA, 0, sinA)
      const pts: Array<[number, number]> = [
        [0.0, 0.0],
        [0.36 * L, -0.34 * L],
        [0.46 * L, -0.86 * L],
        [0.06 * L, -0.97 * L], // 近水平內勾爪尖，夾住盒身時提供垂直承托與真實摩擦力
      ];

      for (let s = 0; s < 3; s++) {
        const [r0, y0] = pts[s];
        const [r1, y1] = pts[s + 1];
        const p0 = new THREE.Vector3(r0 * cosA, y0, r0 * sinA);
        const p1 = new THREE.Vector3(r1 * cosA, y1, r1 * sinA);
        const segVec = p1.clone().sub(p0);
        const segLen = segVec.length();
        const mid = p0.clone().add(p1).multiplyScalar(0.5);

        const segQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          segVec.clone().normalize()
        );

        const isTip = s === 2;
        const radius = isTip ? tipR : tubeR;
        const friction = isTip ? phys.sleeveFriction.value : 0.35;
        const segMass = phys.prongMass.value * (isTip ? 0.40 : 0.30);

        const colDesc = rapier.ColliderDesc.capsule(Math.max(0.004, segLen * 0.5 - radius * 0.3), radius)
          .setTranslation(mid.x, mid.y, mid.z)
          .setRotation({ x: segQuat.x, y: segQuat.y, z: segQuat.z, w: segQuat.w })
          .setMass(segMass)
          .setFriction(friction)
          .setFrictionCombineRule(rapier.CoefficientCombineRule.Average)
          .setRestitution(0.06)
          .setCollisionGroups(COLLISION_GROUP.CLAW_PRONG);
        world.createCollider(colDesc, prongBody);
      }

      // RevoluteJoint 連接爪頭與爪腳（純機械樞軸與張合極限）
      const jointData = rapier.JointData.revolute(
        anchorHead,
        { x: 0, y: 0, z: 0 },
        { x: axisLocal.x, y: axisLocal.y, z: axisLocal.z }
      );
      const joint = world.createImpulseJoint(jointData, this.clawHeadBody, prongBody, true) as RAPIER.RevoluteImpulseJoint;
      joint.setContactsEnabled(false);
      // 允許稍微閉過 0 度 (-0.04 rad) 以實現捏薄，最大張開到 openAngleRad
      joint.setLimits(-0.04, phys.openAngleRad);

      this.prongs.push({
        azimuth,
        body: prongBody,
        joint,
        hingeAxisLocal: axisLocal,
        angle: initAngle,
        angularVel: 0,
      });
    }

    // 6. 建立機板控制器
    this.firmware = new FirmwareController(profile.controller, phys.driveLatencySeconds.value);
  }

  private buildCabinetColliders(): number {
    const rapier = getRapier();
    const play = this.profile.cabinet.playAreaSize.value;
    const chute = this.profile.cabinet.chuteOpening.value;
    const barrierH = this.profile.cabinet.barrierHeight.value;
    const halfW = play.width / 2;
    const halfD = play.depth / 2;
    const floorY = play.floorY;
    const ceilingY = play.railY + 0.08;
    const wallH = ceilingY - floorY;
    const wallT = 0.02;

    const staticBody = this.world.createRigidBody(rapier.RigidBodyDesc.fixed());

    const addBox = (
      hx: number,
      hy: number,
      hz: number,
      x: number,
      y: number,
      z: number,
      friction = 0.45,
      restitution = 0.1
    ) => {
      const col = rapier.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(x, y, z)
        .setFriction(friction)
        .setRestitution(restitution)
        .setCollisionGroups(COLLISION_GROUP.CABINET);
      this.world.createCollider(col, staticBody);
    };

    // 洞口區域定義（左前角落）：x ∈ [-halfW, chuteXMax], z ∈ [chuteZMin, halfD]
    const chuteXMax = -halfW + chute.width;
    const chuteZMin = halfD - chute.depth;
    const floorT = 0.025;

    // A. 檯面底板分成兩塊矩形，留出真實貫穿的洞口（不覆蓋洞口區域！）
    // 區塊 1：右側全深區域 x ∈ [chuteXMax, halfW], z ∈ [-halfD, halfD]
    const rightW = halfW - chuteXMax;
    addBox(rightW / 2, floorT / 2, halfD, chuteXMax + rightW / 2, floorY - floorT / 2, 0, 0.52, 0.08);

    // 區塊 2：左後方區域 x ∈ [-halfW, chuteXMax], z ∈ [-halfD, chuteZMin]
    const backLeftD = chuteZMin - -halfD;
    addBox(chute.width / 2, floorT / 2, backLeftD / 2, -halfW + chute.width / 2, floorY - floorT / 2, -halfD + backLeftD / 2, 0.52, 0.08);

    // B. 四面玻璃牆壁與頂板
    addBox(wallT / 2, wallH / 2, halfD, -halfW - wallT / 2, floorY + wallH / 2, 0, 0.25, 0.12); // 左牆
    addBox(wallT / 2, wallH / 2, halfD, halfW + wallT / 2, floorY + wallH / 2, 0, 0.25, 0.12); // 右牆
    addBox(halfW, wallH / 2, wallT / 2, 0, floorY + wallH / 2, -halfD - wallT / 2, 0.25, 0.12); // 後牆
    addBox(halfW, wallH / 2, wallT / 2, 0, floorY + wallH / 2, halfD + wallT / 2, 0.25, 0.12); // 前玻璃

    // C. 出貨口壓克力擋板（具有真實 8mm 厚度與高度，包圍洞口內側兩邊）
    const barT = 0.008;
    // 右側擋板（沿 Z 軸）
    addBox(barT / 2, barrierH / 2, chute.depth / 2, chuteXMax + barT / 2, floorY + barrierH / 2, chuteZMin + chute.depth / 2, 0.32, 0.12);
    // 後側擋板（沿 X 軸）
    addBox(chute.width / 2, barrierH / 2, barT / 2, -halfW + chute.width / 2, floorY + barrierH / 2, chuteZMin - barT / 2, 0.32, 0.12);

    // D. 真實深度出貨道（Chute Shaft）四面內壁與底部接承面
    const chuteH = chute.wallHeight;
    const chuteCenterY = floorY - chuteH / 2;
    const chuteCx = -halfW + chute.width / 2;
    const chuteCz = chuteZMin + chute.depth / 2;
    addBox(wallT / 2, chuteH / 2, chute.depth / 2, -halfW - wallT / 2, chuteCenterY, chuteCz, 0.3, 0.1);
    addBox(wallT / 2, chuteH / 2, chute.depth / 2, chuteXMax + wallT / 2, chuteCenterY, chuteCz, 0.3, 0.1);
    addBox(chute.width / 2, chuteH / 2, wallT / 2, chuteCx, chuteCenterY, chuteZMin - wallT / 2, 0.3, 0.1);
    addBox(chute.width / 2, chuteH / 2, wallT / 2, chuteCx, chuteCenterY, halfD + wallT / 2, 0.3, 0.1);
    // 出貨道底板
    addBox(chute.width / 2, 0.02, chute.depth / 2, chuteCx, floorY - chuteH, chuteCz, 0.5, 0.05);

    // E. 防甩片（Anti-swing plate）：真實物理障礙，會與擺盪中的爪頭及爪腳碰撞
    const anti = this.profile.cabinet.antiSwingPlate;
    if (anti.enabled) {
      const plateT = 0.006;
      const plateY = floorY + barrierH + anti.height * 0.5 + 0.04;
      if (anti.side === 'chute_right' || anti.side === 'both') {
        addBox(plateT / 2, anti.height / 2, anti.width / 2, chuteXMax + 0.004, plateY, chuteZMin + anti.width * 0.55, 0.25, 0.28);
      }
      if (anti.side === 'chute_back' || anti.side === 'both') {
        addBox(anti.width / 2, anti.height / 2, plateT / 2, -halfW + anti.width * 0.55, plateY, chuteZMin - 0.004, 0.25, 0.28);
      }
    }

    // F. 可選橫桿障礙件（如 6 號機前橫桿）
    if (this.profile.cabinet.crossBar?.enabled) {
      const cb = this.profile.cabinet.crossBar;
      const barLen = halfW - chuteXMax;
      const col = rapier.ColliderDesc.cylinder(barLen / 2, cb.radius)
        .setTranslation(chuteXMax + barLen / 2, floorY + cb.yOffsetFromFloor, cb.zLocal)
        .setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 })
        .setFriction(0.32)
        .setRestitution(0.15)
        .setCollisionGroups(COLLISION_GROUP.CABINET);
      this.world.createCollider(col, staticBody);
    }

    // G. 出貨口紅外線感應器（Rapier Sensor：僅偵測獎品掉入洞口深處，不施加碰撞力）
    const sensorCol = rapier.ColliderDesc.cuboid(chute.width * 0.46, 0.06, chute.depth * 0.46)
      .setTranslation(chuteCx, floorY - chuteH * 0.62, chuteCz)
      .setSensor(true)
      .setCollisionGroups(COLLISION_GROUP.SENSOR);
    const sensor = this.world.createCollider(sensorCol, staticBody);

    return sensor.handle;
  }

  public resetToHome(): void {
    this.firmware.reset();
    this.cableLength = this.minCableLength;
    this.solenoidCurrentA = 0;
    this.plungerPos = 0;
    this.cableTensionN = 0;
    this.isCableSlack = false;

    const play = this.profile.cabinet.playAreaSize.value;
    this.trolleyPos.set(this.homePos.x, play.railY, this.homePos.z);
    this.trolleyVel.set(0, 0, 0);
    this.trolleyBody.setNextKinematicTranslation({
      x: this.trolleyPos.x,
      y: this.trolleyPos.y,
      z: this.trolleyPos.z,
    });

    const headY = play.railY - this.cableLength - this.headEyeletOffsetY;
    this.clawHeadBody.setTranslation({ x: this.trolleyPos.x, y: headY, z: this.trolleyPos.z }, true);
    this.clawHeadBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.clawHeadBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.clawHeadBody.setAngvel({ x: 0, y: 0, z: 0 }, true);

    const scale = this.profile.physics.prongLength.value / 0.145;
    const pivotRadius = 0.026 * scale;
    const pivotY = -0.026 * scale;
    const initAngle = this.profile.physics.openAngleRad;

    for (const p of this.prongs) {
      const cosA = Math.cos(p.azimuth);
      const sinA = Math.sin(p.azimuth);
      const q = new THREE.Quaternion().setFromAxisAngle(p.hingeAxisLocal, initAngle);
      p.body.setTranslation(
        {
          x: this.trolleyPos.x + pivotRadius * cosA,
          y: headY + pivotY,
          z: this.trolleyPos.z + pivotRadius * sinA,
        },
        true
      );
      p.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      p.angle = initAngle;
      p.angularVel = 0;
    }
  }

  /**
   * 固定 120 Hz 物理步進前呼叫：更新機板、天車速度曲線、卷線機、鋼索單向張力與電磁三爪力矩
   */
  public stepPrePhysics(dt: number, input: FirmwareInput): FirmwareCommand {
    const cmd = this.firmware.step(dt, input, {
      cableLength: this.cableLength,
      minCableLength: this.minCableLength,
      maxCableLength: this.maxCableLength,
      isCableSlack: this.isCableSlack,
      trolleyX: this.trolleyPos.x,
      trolleyZ: this.trolleyPos.z,
      homeX: this.homePos.x,
      homeZ: this.homePos.z,
      prongsMostlyClosed: this.plungerPos > 0.65,
    });

    this.lastPowerCmd = cmd.clawPowerCmd;

    // 1. 天車加減速與急停運動
    this.stepTrolley(dt, cmd.trolleyDirX, cmd.trolleyDirZ);

    // 2. 卷線機放線／收線
    this.stepWinch(dt, cmd.winchCommand);

    // 3. 可變長度只受拉鋼索（T >= 0, d <= L）與螺旋電線扭力
    this.stepCableAndWire(dt);

    // 4. 電磁線圈電流響應與三爪耦合力矩
    this.stepSolenoidAndProngs(dt, cmd.clawPowerCmd, cmd.solenoidEnergized);

    return cmd;
  }

  private stepTrolley(dt: number, dirX: number, dirZ: number): void {
    const m = this.profile.controller.motorSettings;
    const phys = this.profile.physics;
    const speedScale = phys.trolleyMaxSpeedScale.value;

    const maxSpeedX = (dirX < 0 ? m.left.value : m.right.value) * speedScale;
    const maxSpeedZ = (dirZ < 0 ? m.backward.value : m.forward.value) * speedScale;

    const targetVx = dirX * maxSpeedX;
    const targetVz = dirZ * maxSpeedZ;

    const accel = phys.trolleyAcceleration.value;
    const brake = phys.trolleyBraking.value;

    this.trolleyVel.x = this.approachVelocity(this.trolleyVel.x, targetVx, accel, brake, dt);
    this.trolleyVel.z = this.approachVelocity(this.trolleyVel.z, targetVz, accel, brake, dt);

    this.trolleyPos.x += this.trolleyVel.x * dt;
    this.trolleyPos.z += this.trolleyVel.z * dt;

    // 限位開關硬邊界
    if (this.trolleyPos.x <= this.trackBounds.xMin) {
      this.trolleyPos.x = this.trackBounds.xMin;
      if (this.trolleyVel.x < 0) this.trolleyVel.x = 0;
    } else if (this.trolleyPos.x >= this.trackBounds.xMax) {
      this.trolleyPos.x = this.trackBounds.xMax;
      if (this.trolleyVel.x > 0) this.trolleyVel.x = 0;
    }

    if (this.trolleyPos.z <= this.trackBounds.zMin) {
      this.trolleyPos.z = this.trackBounds.zMin;
      if (this.trolleyVel.z < 0) this.trolleyVel.z = 0;
    } else if (this.trolleyPos.z >= this.trackBounds.zMax) {
      this.trolleyPos.z = this.trackBounds.zMax;
      if (this.trolleyVel.z > 0) this.trolleyVel.z = 0;
    }

    this.trolleyBody.setNextKinematicTranslation({
      x: this.trolleyPos.x,
      y: this.trolleyPos.y,
      z: this.trolleyPos.z,
    });
  }

  private approachVelocity(current: number, target: number, accel: number, brake: number, dt: number): number {
    const diff = target - current;
    if (Math.abs(diff) < 1e-5) return target;
    // 煞車或反向時使用急停煞車減速度
    const isBraking = target === 0 || Math.sign(target) !== Math.sign(current);
    const rate = isBraking ? brake : accel;
    const maxDelta = rate * dt;
    if (Math.abs(diff) <= maxDelta) return target;
    return current + Math.sign(diff) * maxDelta;
  }

  private stepWinch(dt: number, winchCmd: FirmwareCommand['winchCommand']): void {
    const m = this.profile.controller.motorSettings;
    const phys = this.profile.physics;

    if (winchCmd === 'DOWN') {
      const speed = phys.winchDownSpeed.value * (m.down.value / 255);
      this.cableLength = Math.min(this.maxCableLength, this.cableLength + speed * dt);
    } else if (winchCmd === 'UP') {
      const speed = phys.winchUpSpeed.value * (m.up.value / 255);
      this.cableLength = Math.max(this.minCableLength, this.cableLength - speed * dt);
    }
  }

  /**
   * 單向只受拉鋼索（Unilateral Tension-Only Cable）：
   * - d <= L：完全鬆弛，張力 T = 0，絕不產生非物理推力
   * - d > L：施加臨界阻尼單向張力，掛點位於爪頭重心上方以自然形成複擺力矩
   */
  private stepCableAndWire(dt: number): void {
    const headT = this.clawHeadBody.translation();
    const headR = this.clawHeadBody.rotation();
    const headLv = this.clawHeadBody.linvel();
    const headAv = this.clawHeadBody.angvel();

    this.tmpQuatA.set(headR.x, headR.y, headR.z, headR.w);

    // 爪頭頂部吊環在世界座標中的位置 p_c = headPos + R * (0, headEyeletOffsetY, 0)
    const armWorld = this.tmpVecA.set(0, this.headEyeletOffsetY, 0).applyQuaternion(this.tmpQuatA);
    const eyeletWorld = this.tmpVecB.set(headT.x, headT.y, headT.z).add(armWorld);

    // r = p_c - p_a（從天車指向爪頭吊環）
    const r = this.tmpVecC.copy(eyeletWorld).sub(this.trolleyPos);
    const dist = r.length();

    if (dist > this.cableLength && dist > 1e-5) {
      this.isCableSlack = false;
      const n = r.divideScalar(dist); // 單位方向向量（天車 -> 吊環）
      const stretch = dist - this.cableLength;

      // 吊環點速度 v_c = v_cm + omega × r_arm
      const vx = headLv.x + (headAv.y * armWorld.z - headAv.z * armWorld.y);
      const vy = headLv.y + (headAv.z * armWorld.x - headAv.x * armWorld.z);
      const vz = headLv.z + (headAv.x * armWorld.y - headAv.y * armWorld.x);

      // 相對速度沿鋼索方向（正值表示正在拉長）
      const relVn = (vx - this.trolleyVel.x) * n.x + (vy - this.trolleyVel.y) * n.y + (vz - this.trolleyVel.z) * n.z;

      // 依爪頭＋三爪總質量動態計算安全高剛性（omega_n * dt ≈ 0.38 < 2，極度穩定）
      const totalClawMass = this.profile.physics.clawHeadMass.value + 3 * this.profile.physics.prongMass.value;
      const k = 1550 * (totalClawMass / 0.62);
      const c = 2 * 0.82 * Math.sqrt(k * totalClawMass);

      // 只受拉（T >= 0），不可施加向下推力
      const tension = Math.max(0, k * stretch + c * relVn);
      const maxSafeTension = 95 * (totalClawMass / 0.62);
      const clampedT = Math.min(tension, maxSafeTension);
      this.cableTensionN = clampedT;

      if (clampedT > 0) {
        // 以衝量施加在爪頭吊環點（自然產生複擺回復力矩）
        const j = clampedT * dt;
        this.clawHeadBody.applyImpulseAtPoint(
          { x: -n.x * j, y: -n.y * j, z: -n.z * j },
          { x: eyeletWorld.x, y: eyeletWorld.y, z: eyeletWorld.z },
          true
        );
      }
    } else {
      // 鋼索鬆弛：張力必為 0；僅在鋼索明顯鬆弛且爪頭下降已受物理阻擋（非自由下落加速中）時回報觸底鬆弛
      const slackGap = this.cableLength - dist;
      const headStoppedFalling = headLv.y > -0.14;
      this.isCableSlack = slackGap > 0.016 && headStoppedFalling;
      this.cableTensionN = 0;
    }

    // 黑色螺旋伸縮電線扭轉回復力與擺盪微阻尼
    const euler = new THREE.Euler().setFromQuaternion(this.tmpQuatA, 'YXZ');
    const yawTorque =
      -this.profile.physics.coiledWireYawStiffness.value * euler.y -
      this.profile.physics.coiledWireYawDamping.value * headAv.y;
    const tiltDampX = -0.014 * headAv.x;
    const tiltDampZ = -0.014 * headAv.z;
    this.clawHeadBody.applyTorqueImpulse({ x: tiltDampX * dt, y: yawTorque * dt, z: tiltDampZ * dt }, true);
  }

  /**
   * 中央電磁鐵芯 RL 動態模型與三爪耦合力矩分配：
   * - 電壓 V_drive = 48 * (powerCmd / 255)
   * - L(x) * dI/dt = V_drive - R * I
   * - 磁力 F_mag(x, I) ~ I^2 * phi(x)
   * - 透過三爪實際角度反推鐵芯位置 x，任一爪頂到硬盒時會回饋阻力並影響整體閉合姿態
   */
  private stepSolenoidAndProngs(dt: number, powerCmd: number, energized: boolean): void {
    const phys = this.profile.physics;
    const headR = this.clawHeadBody.rotation();
    const headAv = this.clawHeadBody.angvel();
    this.tmpQuatA.set(headR.x, headR.y, headR.z, headR.w);
    const headQuatInv = this.tmpQuatA.clone().invert();

    const angleSpan = phys.openAngleRad - phys.closedAngleRad;

    // 1. 讀取三根爪腳的實際相對角度與角速度
    let minNormalizedClose = 1;
    let avgNormalizedClose = 0;

    for (const p of this.prongs) {
      const pr = p.body.rotation();
      const pav = p.body.angvel();
      this.tmpQuatB.set(pr.x, pr.y, pr.z, pr.w);

      // 相對四元數 q_rel = q_head^-1 * q_prong
      const qRel = headQuatInv.clone().multiply(this.tmpQuatB);
      // 投影到樞軸 u_i 取得精確有號轉角
      const sinHalf = qRel.x * p.hingeAxisLocal.x + qRel.y * p.hingeAxisLocal.y + qRel.z * p.hingeAxisLocal.z;
      const cosHalf = qRel.w;
      p.angle = 2 * Math.atan2(sinHalf, cosHalf);

      // 相對角速度沿世界樞軸
      const worldAxis = this.tmpVecA.copy(p.hingeAxisLocal).applyQuaternion(this.tmpQuatA);
      p.angularVel =
        (pav.x - headAv.x) * worldAxis.x +
        (pav.y - headAv.y) * worldAxis.y +
        (pav.z - headAv.z) * worldAxis.z;

      const normClose = THREE.MathUtils.clamp((phys.openAngleRad - p.angle) / angleSpan, 0, 1);
      minNormalizedClose = Math.min(minNormalizedClose, normClose);
      avgNormalizedClose += normClose / 3;
    }

    // 鐵芯位置受最受阻的爪腳與整體平均耦合限制（模擬連桿間隙與共用致動器）
    this.plungerPos = THREE.MathUtils.lerp(minNormalizedClose, avgNormalizedClose, 0.45);

    // 2. 電磁線圈 RL 電流微分方程（鐵芯越深入線圈，電感 L(x) 越大）
    const R = phys.solenoidResistanceOhm.value;
    const L0 = phys.solenoidInductanceH.value;
    const Lx = L0 * (1 + 0.55 * this.plungerPos);
    const vDrive = energized ? 48.0 * (powerCmd / 255) : 0;
    const dIdt = (vDrive - R * this.solenoidCurrentA) / Lx;
    this.solenoidCurrentA = Math.max(0, this.solenoidCurrentA + dIdt * dt);

    const iMax = 48.0 / R;
    const iNorm = Math.min(1.05, this.solenoidCurrentA / iMax);

    // 非線性磁力特性（I^2 與鐵芯氣隙導磁率 phi(x)：接近半閉合～閉合時磁力較強，張最開時較弱）
    const permeanceFactor = 0.62 + 0.38 * this.plungerPos;
    const peakTorque = phys.solenoidPeakTorquePerProng.value;

    // 3. 計算每根爪腳的實際施力扭矩並滿足牛頓第三定律（對爪頭施加反作用力矩）
    const openGravityTorque = peakTorque * 0.16; // 鐵芯重力下拉張爪回復力矩
    const dampingCoeff = 0.022 * (phys.prongLength.value / 0.145);

    for (const p of this.prongs) {
      const worldAxis = this.tmpVecA.copy(p.hingeAxisLocal).applyQuaternion(this.tmpQuatA);
      const normClose = THREE.MathUtils.clamp((phys.openAngleRad - p.angle) / angleSpan, 0, 1);

      let netTorque = 0;
      if (energized) {
        // 負方向 (-axis) 為閉合！
        const magneticCloseTorque = peakTorque * (iNorm * iNorm) * permeanceFactor;

        // 共用鐵芯連桿耦合：若此爪比其他爪領先太多（其他爪頂住硬盒），連桿會減少此爪的額外前進，產生真實不對稱夾持
        const leadExcess = Math.max(0, normClose - (minNormalizedClose + 0.26));
        const linkageCouplingPenalty = Math.max(0.45, 1 - leadExcess * 1.1);

        netTorque = -magneticCloseTorque * linkageCouplingPenalty + openGravityTorque * 0.08 - dampingCoeff * p.angularVel;
      } else {
        // 斷電時中央重鐵芯落回下限位，克服爪腳自重並穩定撐開至 openAngleRad
        const angleErr = phys.openAngleRad - p.angle;
        const holdOpenTorque = 0.065 + Math.max(0, angleErr) * 0.34;
        netTorque = holdOpenTorque - dampingCoeff * 1.6 * p.angularVel;
      }

      const j = netTorque * dt;
      p.body.applyTorqueImpulse({ x: worldAxis.x * j, y: worldAxis.y * j, z: worldAxis.z * j }, true);
      // 反作用力矩施加於爪頭
      this.clawHeadBody.applyTorqueImpulse({ x: -worldAxis.x * j, y: -worldAxis.y * j, z: -worldAxis.z * j }, true);
    }
  }

  public getTelemetry(): ClawRigTelemetry {
    const ht = this.clawHeadBody.translation();
    const hr = this.clawHeadBody.rotation();
    const headPos = new THREE.Vector3(ht.x, ht.y, ht.z);
    const headQuat = new THREE.Quaternion(hr.x, hr.y, hr.z, hr.w);

    const eyelet = new THREE.Vector3(0, this.headEyeletOffsetY, 0).applyQuaternion(headQuat).add(headPos);

    return {
      phase: this.firmware.getPhase(),
      trolleyPos: this.trolleyPos.clone(),
      clawHeadPos: headPos,
      clawHeadQuat: headQuat,
      cableAnchorTop: this.trolleyPos.clone(),
      cableAnchorBottom: eyelet,
      cableLength: this.cableLength,
      cableTensionN: this.cableTensionN,
      isCableSlack: this.isCableSlack,
      solenoidCurrentA: this.solenoidCurrentA,
      plungerNormalized: this.plungerPos,
      clawPowerCmd: this.lastPowerCmd,
      prongAngles: [this.prongs[0].angle, this.prongs[1].angle, this.prongs[2].angle],
      prongStates: this.prongs.map((p) => {
        const pt = p.body.translation();
        const pr = p.body.rotation();
        return {
          pos: new THREE.Vector3(pt.x, pt.y, pt.z),
          quat: new THREE.Quaternion(pr.x, pr.y, pr.z, pr.w),
        };
      }),
    };
  }
}
