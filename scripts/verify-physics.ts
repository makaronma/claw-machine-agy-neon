import { MACHINE_PROFILES } from '../src/data/machineProfiles';
import { createMachineWorld, FIXED_DT, initRapier } from '../src/physics/physicsEngine';
import { ClawRig } from '../src/physics/clawRig';
import { PrizeSpawner } from '../src/physics/prizeSpawner';

async function main() {
  await initRapier();
  const baseProfile = MACHINE_PROFILES[0]; // DL-G2-BASE

  // =========================================================
  // T01: 自由擺盪週期測試（對照理論複擺週期誤差）
  // =========================================================
  {
    const world = createMachineWorld();
    const rig = new ClawRig(baseProfile, world);
    // 放長繩索到 0.48 m，給予初始水平速度使其自由擺盪
    for (let i = 0; i < 60; i++) {
      rig.stepPrePhysics(FIXED_DT, { moveX: 0, moveZ: 0, dropPressed: false });
      world.step();
    }
    // 施加純水平初速使爪頭產生擺盪
    rig.clawHeadBody.setLinvel({ x: 0.35, y: 0, z: 0 }, true);

    const xs: number[] = [];
    const ts: number[] = [];
    const peaks: number[] = [];
    let prevDx = 0;

    const baseX = rig.homePos.x;
    for (let i = 0; i < 480; i++) {
      rig.stepPrePhysics(FIXED_DT, { moveX: 0, moveZ: 0, dropPressed: false });
      world.step();
      const tel = rig.getTelemetry();
      const dx = tel.clawHeadPos.x - baseX;
      if (i % 4 === 0) {
        ts.push(Number((i * FIXED_DT).toFixed(3)));
        xs.push(Number((dx * 100).toFixed(2))); // cm
      }
      if (i > 10 && prevDx > 0 && dx <= 0) {
        peaks.push(i * FIXED_DT);
      }
      prevDx = dx;
    }

    const fullPeriods: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      fullPeriods.push(peaks[i] - peaks[i - 1]);
    }
    const measuredPeriod = fullPeriods.length > 0
      ? fullPeriods.reduce((a, b) => a + b, 0) / fullPeriods.length
      : 0;
    // 複擺等效長度：cableLength (0.14m) + eyeletOffset (0.068m) + 爪頭與爪腳等效質心偏移 (~0.045m)
    const effectiveL = baseProfile.physics.minCableLength.value + 0.068 + 0.045;
    const theoryPeriod = 2 * Math.PI * Math.sqrt(effectiveL / 9.81);
    const errPct = theoryPeriod > 0 ? Math.abs(measuredPeriod - theoryPeriod) / theoryPeriod * 100 : 999;

    console.log(JSON.stringify({
      test: 'T01_PENDULUM',
      effectiveLengthM: Number(effectiveL.toFixed(3)),
      theoryPeriodS: Number(theoryPeriod.toFixed(3)),
      measuredPeriodS: Number(measuredPeriod.toFixed(3)),
      errorPct: Number(errPct.toFixed(2)),
      pass: errPct <= 5,
      sampleT: ts.slice(0, 45),
      sampleXcm: xs.slice(0, 45),
    }));
  }

  // =========================================================
  // T02: 天車急停甩爪擺幅與衰減測試
  // =========================================================
  {
    const world = createMachineWorld();
    const rig = new ClawRig(baseProfile, world);
    const ts: number[] = [];
    const relXcm: number[] = [];
    const trolleyXcm: number[] = [];
    let maxSwingAfterStopCm = 0;

    // 0 ~ 0.9s 向右移動，0.9s ~ 3.2s 急停觀察擺盪與衰減
    for (let i = 0; i < 384; i++) {
      const t = i * FIXED_DT;
      const moveX = t < 0.9 ? 1 : 0;
      rig.stepPrePhysics(FIXED_DT, { moveX, moveZ: 0, dropPressed: false });
      world.step();
      const tel = rig.getTelemetry();
      const swingCm = (tel.clawHeadPos.x - tel.trolleyPos.x) * 100;
      if (t >= 0.95) {
        maxSwingAfterStopCm = Math.max(maxSwingAfterStopCm, Math.abs(swingCm));
      }
      if (i % 4 === 0) {
        ts.push(Number(t.toFixed(3)));
        relXcm.push(Number(swingCm.toFixed(2)));
        trolleyXcm.push(Number((tel.trolleyPos.x * 100).toFixed(2)));
      }
    }

    const tailMax = Math.max(...relXcm.slice(-15).map(Math.abs));
    console.log(JSON.stringify({
      test: 'T02_EMERGENCY_STOP_SWING',
      maxSwingAfterStopCm: Number(maxSwingAfterStopCm.toFixed(2)),
      tailSwingCm: Number(tailMax.toFixed(2)),
      pass: maxSwingAfterStopCm > 1.5 && tailMax < maxSwingAfterStopCm * 0.75,
      sampleT: ts,
      sampleSwingCm: relXcm,
    }));
  }

  // =========================================================
  // T04 & T05: 放線鬆弛張力為 0 + 空中二收狀態切換測試
  // =========================================================
  {
    const world = createMachineWorld();
    const rig = new ClawRig(baseProfile, world);
    let slackObserved = false;
    let slackTensionViolation = false;
    let midAirTriggeredAt = -1;

    // 先移動至獎品區上方，再按紅鈕下爪，0.55s 後再按一次觸發二收
    for (let i = 0; i < 420; i++) {
      const t = i * FIXED_DT;
      const moveX = t < 0.8 ? 1 : 0;
      const dropPressed = i === 110 || i === 180;
      const cmd = rig.stepPrePhysics(FIXED_DT, { moveX, moveZ: 0, dropPressed });
      world.step();
      const tel = rig.getTelemetry();

      if (tel.isCableSlack) {
        slackObserved = true;
        if (tel.cableTensionN > 0.001) slackTensionViolation = true;
      }
      if (cmd.event === 'MID_AIR_CLOSE') {
        midAirTriggeredAt = Number(t.toFixed(3));
      }
    }

    console.log(JSON.stringify({
      test: 'T04_T05_SLACK_AND_MIDAIR',
      slackObserved,
      slackTensionZeroVerified: !slackTensionViolation,
      midAirTriggeredAtS: midAirTriggeredAt,
      pass: !slackTensionViolation && midAirTriggeredAt > 0,
    }));
  }

  // =========================================================
  // T06 & T07: 強爪 (P1=255) 抓取標準 3C 盒 -> 上升 (P2=200) -> 頂部弱爪 (P3=45) 電流與箱高軌跡
  // =========================================================
  {
    const world = createMachineWorld();
    const rig = new ClawRig(baseProfile, world);
    const spawner = new PrizeSpawner(baseProfile, world, rig.chuteSensorHandle);
    spawner.spawnAll();
    rig.resetToHome();

    // 瞄準 255g 炫彩迷你藍牙音箱 (index 3)，測試強爪舉升 (P1/P2) 與弱爪滑脫 (P3)
    const targetPrize = spawner.prizes[3];
    if (targetPrize.kind !== 'rigid') throw new Error('Expected rigid box');
    const floorY = baseProfile.cabinet.playAreaSize.value.floorY;
    const initBoxY = targetPrize.body.translation().y;

    let dropped = false;
    let maxBoxLiftCm = 0;
    let maxCurrentA = 0;
    let p3CurrentA = 0;

    const ts: number[] = [];
    const boxHeightCm: number[] = [];
    const currentA: number[] = [];
    const phases: string[] = [];

    for (let i = 0; i < 960; i++) {
      const t = i * FIXED_DT;
      const tel0 = rig.getTelemetry();
      const boxPos = targetPrize.body.translation();

      let moveX = 0;
      let moveZ = 0;
      let dropPressed = false;

      if (!dropped && tel0.phase === 'AIM') {
        const dx = boxPos.x - tel0.trolleyPos.x;
        const dz = boxPos.z - tel0.trolleyPos.z;
        if (Math.abs(dx) > 0.012) moveX = Math.sign(dx);
        if (Math.abs(dz) > 0.012) moveZ = Math.sign(dz);
        if (moveX === 0 && moveZ === 0 && t > 1.5) {
          dropPressed = true;
          dropped = true;
        }
      }

      rig.stepPrePhysics(FIXED_DT, { moveX, moveZ, dropPressed });
      world.step();

      const tel = rig.getTelemetry();
      const curY = targetPrize.body.translation().y;
      const liftCm = (curY - initBoxY) * 100;
      maxBoxLiftCm = Math.max(maxBoxLiftCm, liftCm);
      maxCurrentA = Math.max(maxCurrentA, tel.solenoidCurrentA);
      if (tel.phase === 'TOP_DWELL') {
        p3CurrentA = tel.solenoidCurrentA;
      }

      if (i % 10 === 0 && dropped) {
        ts.push(Number(t.toFixed(2)));
        boxHeightCm.push(Number(((curY - floorY) * 100).toFixed(2)));
        currentA.push(Number(tel.solenoidCurrentA.toFixed(2)));
        phases.push(tel.phase);
      }
    }

    console.log(JSON.stringify({
      test: 'T06_T07_GRAB_AND_WEAK_CLAW',
      prizeName: targetPrize.catalog.displayName,
      maxBoxLiftCm: Number(maxBoxLiftCm.toFixed(2)),
      maxSolenoidCurrentA: Number(maxCurrentA.toFixed(2)),
      topDwellP3CurrentA: Number(p3CurrentA.toFixed(2)),
      pass: maxBoxLiftCm > 8 && maxCurrentA > 2.0 && p3CurrentA < maxCurrentA * 0.45,
      sampleT: ts,
      sampleBoxHeightCm: boxHeightCm,
      sampleCurrentA: currentA,
    }));
  }

  // =========================================================
  // T12: 確定性重播測試（相同輸入產生完全一致結果）
  // =========================================================
  {
    const runOnce = () => {
      const w = createMachineWorld();
      const r = new ClawRig(baseProfile, w);
      for (let i = 0; i < 240; i++) {
        r.stepPrePhysics(FIXED_DT, { moveX: i < 90 ? 1 : 0, moveZ: i < 60 ? -1 : 0, dropPressed: i === 120 });
        w.step();
      }
      return r.getTelemetry().clawHeadPos;
    };
    const pA = runOnce();
    const pB = runOnce();
    const diff = pA.distanceTo(pB);
    console.log(JSON.stringify({
      test: 'T12_DETERMINISM',
      positionDiffM: diff,
      pass: diff < 1e-6,
    }));
  }
}

void main();
