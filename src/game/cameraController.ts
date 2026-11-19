import * as THREE from 'three';
import { AppMode } from '../types/machine';

export interface MachineCameraTarget {
  /** 機台遊戲艙中心點（世界座標） */
  playCenterWorld: THREE.Vector3;
  /** 機台正面朝向之水平角度（世界 Y 軸旋轉） */
  machineForwardYaw: number;
  /** 預設觀察距離（依標準台／巨無霸台／小台自動調整） */
  defaultDistance: number;
}

/**
 * 鏡頭控制器：
 * - SHOP_WALK：第一人稱走動視角（眼高 1.56 m）
 * - MACHINE_PLAY：以機台遊戲艙為中心的 360° 軌道觀察鏡頭（僅移動 Camera，絕不旋轉物理世界）
 * - 進出機台具備平滑過渡動畫
 */
export class CameraController {
  public readonly camera: THREE.PerspectiveCamera;

  // 店內走動視角狀態
  private walkPos = new THREE.Vector3(0, 1.56, 2.15);
  private walkYaw = 0; // 0 = 朝向 -Z（走進店內）
  private walkPitch = -0.05;

  // 機台觀察軌道視角狀態（相對於機台正面）
  private orbitAzimuth = 0; // 0 = 機台正前方，可 ±Math.PI 旋轉觀察側面與背面
  private orbitElevation = 0.24; // 仰角（rad）
  private orbitDistance = 1.38;
  private minDistance = 0.72;
  private maxDistance = 2.35;

  private activeTarget: MachineCameraTarget | null = null;
  private transitionAlpha = 0;
  private startPos = new THREE.Vector3();
  private startLookAt = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3(0, 1.45, 0);

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.05, 45);
    this.camera.position.copy(this.walkPos);
    this.camera.lookAt(this.currentLookAt);
  }

  public setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public getWalkYaw(): number {
    return this.walkYaw;
  }

  public getWalkPosition(): THREE.Vector3 {
    return this.walkPos;
  }

  public setWalkPosition(x: number, z: number): void {
    this.walkPos.x = x;
    this.walkPos.z = z;
  }

  public adjustWalkLook(deltaX: number, deltaY: number): void {
    this.walkYaw -= deltaX * 0.0045;
    this.walkPitch = THREE.MathUtils.clamp(this.walkPitch - deltaY * 0.0038, -0.62, 0.55);
  }

  public adjustOrbit(deltaX: number, deltaY: number): void {
    this.orbitAzimuth -= deltaX * 0.0062;
    // 允許大範圍左右繞台觀察（正前、左側看洞口、右側看深度、甚至斜後方）
    this.orbitAzimuth = THREE.MathUtils.clamp(this.orbitAzimuth, -Math.PI * 0.78, Math.PI * 0.78);
    this.orbitElevation = THREE.MathUtils.clamp(this.orbitElevation + deltaY * 0.0052, -0.18, 1.05);
  }

  public adjustZoom(delta: number): void {
    this.orbitDistance = THREE.MathUtils.clamp(
      this.orbitDistance + delta * 0.0012,
      this.minDistance,
      this.maxDistance
    );
  }

  public resetOrbitFront(): void {
    this.orbitAzimuth = 0;
    this.orbitElevation = 0.22;
    if (this.activeTarget) {
      this.orbitDistance = this.activeTarget.defaultDistance;
    }
  }

  public startEnterMachine(target: MachineCameraTarget): void {
    this.activeTarget = target;
    this.startPos.copy(this.camera.position);
    this.startLookAt.copy(this.currentLookAt);
    this.orbitAzimuth = 0;
    this.orbitElevation = 0.22;
    this.orbitDistance = target.defaultDistance;
    this.minDistance = target.defaultDistance * 0.52;
    this.maxDistance = target.defaultDistance * 1.65;
    this.transitionAlpha = 0;
  }

  public startExitMachine(): void {
    this.startPos.copy(this.camera.position);
    this.startLookAt.copy(this.currentLookAt);
    this.transitionAlpha = 0;
  }

  private computeOrbitPose(outPos: THREE.Vector3, outLook: THREE.Vector3): void {
    if (!this.activeTarget) return;
    const { playCenterWorld, machineForwardYaw } = this.activeTarget;
    // 機台正面朝向向量在世界 XZ 平面為 (sin(forwardYaw), cos(forwardYaw))
    const worldAngle = machineForwardYaw + this.orbitAzimuth;
    const horiz = Math.cos(this.orbitElevation) * this.orbitDistance;
    const vert = Math.sin(this.orbitElevation) * this.orbitDistance;

    outPos.set(
      playCenterWorld.x + Math.sin(worldAngle) * horiz,
      Math.max(0.55, playCenterWorld.y + vert),
      playCenterWorld.z + Math.cos(worldAngle) * horiz
    );
    outLook.copy(playCenterWorld);
  }

  private computeWalkPose(outPos: THREE.Vector3, outLook: THREE.Vector3): void {
    outPos.copy(this.walkPos);
    const dir = new THREE.Vector3(
      -Math.sin(this.walkYaw) * Math.cos(this.walkPitch),
      Math.sin(this.walkPitch),
      -Math.cos(this.walkYaw) * Math.cos(this.walkPitch)
    );
    outLook.copy(this.walkPos).add(dir);
  }

  /**
   * 回傳 true 代表過場動畫已完成
   */
  public update(dt: number, mode: AppMode): boolean {
    const targetPos = new THREE.Vector3();
    const targetLook = new THREE.Vector3();

    if (mode === 'SHOP_WALK') {
      this.computeWalkPose(targetPos, targetLook);
      this.camera.position.lerp(targetPos, Math.min(1, dt * 16));
      this.currentLookAt.lerp(targetLook, Math.min(1, dt * 18));
      this.camera.lookAt(this.currentLookAt);
      return true;
    }

    if (mode === 'MACHINE_PLAY') {
      this.computeOrbitPose(targetPos, targetLook);
      this.camera.position.lerp(targetPos, Math.min(1, dt * 14));
      this.currentLookAt.lerp(targetLook, Math.min(1, dt * 16));
      this.camera.lookAt(this.currentLookAt);
      return true;
    }

    // 過場平滑縮放
    this.transitionAlpha = Math.min(1, this.transitionAlpha + dt * 2.35);
    const ease = 1 - Math.pow(1 - this.transitionAlpha, 3);

    if (mode === 'TRANSITION_IN') {
      this.computeOrbitPose(targetPos, targetLook);
    } else {
      this.computeWalkPose(targetPos, targetLook);
    }

    this.camera.position.lerpVectors(this.startPos, targetPos, ease);
    this.currentLookAt.lerpVectors(this.startLookAt, targetLook, ease);
    this.camera.lookAt(this.currentLookAt);

    return this.transitionAlpha >= 1;
  }
}
