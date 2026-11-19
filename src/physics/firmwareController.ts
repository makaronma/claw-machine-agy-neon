import { ControllerSpec, MachinePhase } from '../types/machine';

export interface FirmwareInput {
  /** Digital switch X direction: -1 (left), 0, +1 (right) */
  moveX: number;
  /** Digital switch Z direction: -1 (back), 0, +1 (front) */
  moveZ: number;
  /** Rising-edge press of the red drop / mid-air-close button */
  dropPressed: boolean;
}

export interface FirmwareTelemetry {
  cableLength: number;
  minCableLength: number;
  maxCableLength: number;
  isCableSlack: boolean;
  trolleyX: number;
  trolleyZ: number;
  homeX: number;
  homeZ: number;
  prongsMostlyClosed: boolean;
}

export interface FirmwareCommand {
  phase: MachinePhase;
  trolleyDirX: number;
  trolleyDirZ: number;
  winchCommand: 'STOP' | 'DOWN' | 'UP';
  clawPowerCmd: number; // 0..255
  solenoidEnergized: boolean;
  midAirTriggered: boolean;
  event?: 'DROP_START' | 'MID_AIR_CLOSE' | 'GRAB_START' | 'LIFT_START' | 'TOP_REACHED' | 'RELEASE' | 'CYCLE_DONE';
}

interface DelayedDirEntry {
  timeRemaining: number;
  x: number;
  z: number;
}

/**
 * 台灣夾娃娃機機板時序控制器（對應鼎莉二代 P1~P4、T1/T3、下爪限時與二收邏輯）
 * 嚴格不介入結果機率，僅輸出馬達方向、卷線機命令與 0..255 電磁控制值。
 */
export class FirmwareController {
  private phase: MachinePhase = 'AIM';
  private phaseTimer = 0;
  private slackConfirmTimer = 0;
  private midAirPendingTimer = -1;
  private midAirTriggered = false;
  private settleTimer = 0;

  // 模擬真實機板馬達繼電器／驅動延遲
  private delayedQueue: DelayedDirEntry[] = [];
  private activeDirX = 0;
  private activeDirZ = 0;
  private lastQueuedX = 0;
  private lastQueuedZ = 0;

  constructor(
    private readonly spec: ControllerSpec,
    private readonly driveLatencySeconds: number
  ) {}

  public getPhase(): MachinePhase {
    return this.phase;
  }

  public isBusy(): boolean {
    return this.phase !== 'AIM';
  }

  public reset(): void {
    this.phase = 'AIM';
    this.phaseTimer = 0;
    this.slackConfirmTimer = 0;
    this.midAirPendingTimer = -1;
    this.midAirTriggered = false;
    this.settleTimer = 0;
    this.delayedQueue = [];
    this.activeDirX = 0;
    this.activeDirZ = 0;
    this.lastQueuedX = 0;
    this.lastQueuedZ = 0;
  }

  private updateDelayedDirection(dt: number, rawX: number, rawZ: number): void {
    const qx = rawX === 0 ? 0 : Math.sign(rawX);
    const qz = rawZ === 0 ? 0 : Math.sign(rawZ);

    if (qx !== this.lastQueuedX || qz !== this.lastQueuedZ) {
      this.lastQueuedX = qx;
      this.lastQueuedZ = qz;
      if (this.driveLatencySeconds <= 0.0001) {
        this.activeDirX = qx;
        this.activeDirZ = qz;
      } else {
        this.delayedQueue.push({
          timeRemaining: this.driveLatencySeconds,
          x: qx,
          z: qz,
        });
      }
    }

    for (let i = this.delayedQueue.length - 1; i >= 0; i--) {
      this.delayedQueue[i].timeRemaining -= dt;
      if (this.delayedQueue[i].timeRemaining <= 0) {
        this.activeDirX = this.delayedQueue[i].x;
        this.activeDirZ = this.delayedQueue[i].z;
        this.delayedQueue.splice(0, i + 1);
        break;
      }
    }
  }

  public step(dt: number, input: FirmwareInput, telemetry: FirmwareTelemetry): FirmwareCommand {
    this.phaseTimer += dt;
    let event: FirmwareCommand['event'];

    let trolleyDirX = 0;
    let trolleyDirZ = 0;
    let winchCommand: FirmwareCommand['winchCommand'] = 'STOP';
    let clawPowerCmd = 0;
    let solenoidEnergized = false;

    switch (this.phase) {
      case 'AIM': {
        this.updateDelayedDirection(dt, input.moveX, input.moveZ);
        trolleyDirX = this.activeDirX;
        trolleyDirZ = this.activeDirZ;
        winchCommand = 'STOP';
        clawPowerCmd = 0;
        solenoidEnergized = false;

        if (input.dropPressed) {
          this.phase = 'DESCENT';
          this.phaseTimer = 0;
          this.slackConfirmTimer = 0;
          this.midAirPendingTimer = -1;
          this.midAirTriggered = false;
          this.delayedQueue = [];
          this.activeDirX = 0;
          this.activeDirZ = 0;
          this.lastQueuedX = 0;
          this.lastQueuedZ = 0;
          trolleyDirX = 0;
          trolleyDirZ = 0;
          event = 'DROP_START';
        }
        break;
      }

      case 'DESCENT': {
        winchCommand = 'DOWN';
        clawPowerCmd = 0;
        solenoidEnergized = false;

        // 二收（空中按紅鈕提前收爪）
        if (
          input.dropPressed &&
          this.spec.midAirClawEnabled &&
          this.midAirPendingTimer < 0 &&
          this.phaseTimer > 0.14
        ) {
          this.midAirPendingTimer = Math.max(0, this.spec.midAirCloseDelaySeconds);
          this.midAirTriggered = true;
          event = 'MID_AIR_CLOSE';
        }

        if (this.midAirPendingTimer >= 0) {
          this.midAirPendingTimer -= dt;
          if (this.midAirPendingTimer <= 0) {
            this.phase = 'BOTTOM_DWELL';
            this.phaseTimer = 0;
            this.midAirPendingTimer = -1;
            event = 'GRAB_START';
            break;
          }
        }

        // 偵測鋼索鬆弛（爪頭碰到獎品或底板）或到達最大下爪長度/限時
        if (telemetry.isCableSlack && this.phaseTimer > 0.16) {
          this.slackConfirmTimer += dt;
        } else {
          this.slackConfirmTimer = Math.max(0, this.slackConfirmTimer - dt * 2);
        }

        const hitBottom =
          telemetry.cableLength >= telemetry.maxCableLength - 0.002 ||
          this.phaseTimer >= this.spec.descentMaxSeconds.value ||
          this.slackConfirmTimer >= 0.075;

        if (hitBottom) {
          this.phase = 'BOTTOM_DWELL';
          this.phaseTimer = 0;
          event = 'GRAB_START';
        }
        break;
      }

      case 'BOTTOM_DWELL': {
        winchCommand = 'STOP';
        clawPowerCmd = this.spec.clawPower.P1.value;
        solenoidEnergized = true;

        if (this.phaseTimer >= this.spec.bottomDwellSeconds.value) {
          this.phase = 'LIFT';
          this.phaseTimer = 0;
          event = 'LIFT_START';
        }
        break;
      }

      case 'LIFT': {
        winchCommand = 'UP';
        clawPowerCmd = this.spec.clawPower.P2.value;
        solenoidEnergized = true;

        if (telemetry.cableLength <= telemetry.minCableLength + 0.003) {
          this.phase = 'TOP_DWELL';
          this.phaseTimer = 0;
          event = 'TOP_REACHED';
        }
        break;
      }

      case 'TOP_DWELL': {
        winchCommand = 'STOP';
        clawPowerCmd = this.spec.clawPower.P3.value;
        solenoidEnergized = true;

        if (this.phaseTimer >= this.spec.topDwellSeconds.value) {
          this.phase = 'RETURN';
          this.phaseTimer = 0;
        }
        break;
      }

      case 'RETURN': {
        winchCommand = 'STOP';
        clawPowerCmd = this.spec.clawPower.P4.value;
        solenoidEnergized = true;

        const dx = telemetry.homeX - telemetry.trolleyX;
        const dz = telemetry.homeZ - telemetry.trolleyZ;
        const tol = 0.012;

        // 先回 X 或同時歸位（台灣機台多為雙軸同步回洞口）
        trolleyDirX = Math.abs(dx) > tol ? Math.sign(dx) : 0;
        trolleyDirZ = Math.abs(dz) > tol ? Math.sign(dz) : 0;

        if (trolleyDirX === 0 && trolleyDirZ === 0) {
          this.phase = 'RELEASE';
          this.phaseTimer = 0;
          event = 'RELEASE';
        }
        break;
      }

      case 'RELEASE': {
        winchCommand = 'STOP';
        clawPowerCmd = 0;
        solenoidEnergized = false;

        if (this.phaseTimer >= 0.72) {
          this.phase = 'SETTLE';
          this.phaseTimer = 0;
          this.settleTimer = 0;
        }
        break;
      }

      case 'SETTLE': {
        winchCommand = 'STOP';
        clawPowerCmd = 0;
        solenoidEnergized = false;
        this.settleTimer += dt;

        if (this.settleTimer >= 0.45) {
          this.phase = 'AIM';
          this.phaseTimer = 0;
          this.midAirTriggered = false;
          event = 'CYCLE_DONE';
        }
        break;
      }
    }

    return {
      phase: this.phase,
      trolleyDirX,
      trolleyDirZ,
      winchCommand,
      clawPowerCmd,
      solenoidEnergized,
      midAirTriggered: this.midAirTriggered,
      event,
    };
  }
}
