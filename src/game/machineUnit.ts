import * as THREE from 'three';
import { MachineProfile, PrizeCatalogItem } from '../types/machine';
import { createMachineWorld, RAPIER } from '../physics/physicsEngine';
import { ClawRig } from '../physics/clawRig';
import { FirmwareCommand, FirmwareInput } from '../physics/firmwareController';
import { PrizeSpawner } from '../physics/prizeSpawner';
import { buildCabinetVisual, CabinetVisual } from '../assets/cabinetBuilder';
import { buildClawVisualRig, ClawVisualRig } from '../assets/clawBuilder';
import { buildPrizeVisual, PrizeVisualBinding } from '../assets/prizeBuilder';
import { MachineCameraTarget } from './cameraController';

/**
 * 單台完整可玩機台單元：
 * - 各自擁有獨立 Rapier 3D 物理世界，互不干擾
 * - 玩家離開後先讓獎品自然落地穩定再休眠，完整保留所有獎品位置與倒伏狀態
 */
export class MachineUnit {
  public readonly world: RAPIER.World;
  public readonly rig: ClawRig;
  public readonly spawner: PrizeSpawner;
  public readonly root: THREE.Group;
  public readonly cabinetVisual: CabinetVisual;
  public readonly clawVisual: ClawVisualRig;
  public readonly clickHitbox: THREE.Mesh;

  private prizeContainer = new THREE.Group();
  private prizeBindings: PrizeVisualBinding[] = [];

  private isActive = false;
  private pendingSettleTime = 0;

  constructor(
    public readonly profile: MachineProfile,
    public readonly index: number
  ) {
    this.world = createMachineWorld();
    this.rig = new ClawRig(profile, this.world);
    this.spawner = new PrizeSpawner(profile, this.world, this.rig.chuteSensorHandle);

    this.root = new THREE.Group();
    this.root.position.set(profile.shopPosition.x, profile.shopPosition.y, profile.shopPosition.z);
    this.root.rotation.y = profile.shopRotationY;

    this.cabinetVisual = buildCabinetVisual(profile, index);
    this.root.add(this.cabinetVisual.group);

    const play = profile.cabinet.playAreaSize.value;
    this.clawVisual = buildClawVisualRig(profile.physics, play.width, play.depth, play.railY);
    this.root.add(this.clawVisual.group);

    this.root.add(this.prizeContainer);

    // 隱形點擊偵測盒，方便玩家在店內直接點擊機台進入遊玩
    const ext = profile.cabinet.externalSize.value;
    this.clickHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(ext.width, ext.height, ext.depth + 0.16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.clickHitbox.position.set(0, ext.height / 2, 0.08);
    this.clickHitbox.userData.machineIndex = index;
    this.root.add(this.clickHitbox);

    this.spawnPrizesAndSync();
    this.syncVisuals(0, 0, false);
  }

  private spawnPrizesAndSync(): void {
    this.prizeContainer.clear();
    this.prizeBindings = [];

    const instances = this.spawner.spawnAll();
    // 獎品靜置完成後將天車與爪頭平穩重置於歸位點
    this.rig.resetToHome();
    for (const p of instances) {
      const binding = buildPrizeVisual(p);
      this.prizeContainer.add(binding.root);
      this.prizeBindings.push(binding);
    }
  }

  public setActive(active: boolean): void {
    if (this.isActive && !active) {
      // 玩家離開時保留最多 2.5 秒背景穩定時間，確保半空獎品確實落地不懸空
      this.pendingSettleTime = 2.5;
    }
    this.isActive = active;
  }

  public needsPhysicsStep(): boolean {
    return this.isActive || this.rig.firmware.isBusy() || this.pendingSettleTime > 0;
  }

  /**
   * 執行單步 120 Hz 物理更新，回傳機板指令與本步出貨獎品
   */
  public stepPhysics(
    dt: number,
    input: FirmwareInput
  ): { cmd: FirmwareCommand; wonPrizes: PrizeCatalogItem[] } {
    const cmd = this.rig.stepPrePhysics(dt, input);
    this.world.step();

    const wonInstances = this.spawner.checkChuteSensor(dt);
    const wonPrizes: PrizeCatalogItem[] = [];
    for (const inst of wonInstances) {
      this.spawner.removePrizeBodies(inst);
      wonPrizes.push(inst.catalog);
    }

    if (!this.isActive && !this.rig.firmware.isBusy() && this.pendingSettleTime > 0) {
      this.pendingSettleTime -= dt;
      if (this.spawner.isSettled()) {
        this.pendingSettleTime = 0;
      }
    }

    return { cmd, wonPrizes };
  }

  public syncVisuals(moveX: number, moveZ: number, buttonPressed: boolean): void {
    const telemetry = this.rig.getTelemetry();
    this.clawVisual.updateFromTelemetry(telemetry);
    for (const b of this.prizeBindings) {
      b.syncFromPhysics();
    }
    this.cabinetVisual.setControlAnimation(moveX, moveZ, buttonPressed, this.isActive);
  }

  public resetMachine(): void {
    this.rig.resetToHome();
    this.spawnPrizesAndSync();
    this.syncVisuals(0, 0, false);
  }

  public getFrontStandWorldPos(): THREE.Vector3 {
    const ext = this.profile.cabinet.externalSize.value;
    const localStand = new THREE.Vector3(0, 0, ext.depth / 2 + 0.85);
    return localStand.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.profile.shopRotationY).add(this.root.position);
  }

  public getCameraTarget(): MachineCameraTarget {
    const play = this.profile.cabinet.playAreaSize.value;
    const centerY = play.floorY + (play.railY - play.floorY) * 0.42;
    const playCenterWorld = new THREE.Vector3(0, centerY, 0.02)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.profile.shopRotationY)
      .add(this.root.position);

    const ext = this.profile.cabinet.externalSize.value;
    const defaultDistance = Math.max(1.05, ext.width * 1.58 + 0.14);

    return {
      playCenterWorld,
      machineForwardYaw: this.profile.shopRotationY,
      defaultDistance,
    };
  }
}
