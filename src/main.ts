import './style.css';
import * as THREE from 'three';
import { AppMode } from './types/machine';
import { MACHINE_PROFILES } from './data/machineProfiles';
import { FIXED_DT, initRapier } from './physics/physicsEngine';
import { buildTaiwanClawShop } from './assets/shopBuilder';
import { MachineUnit } from './game/machineUnit';
import { CameraController } from './game/cameraController';
import { InputManager } from './game/inputManager';
import { AudioManager } from './game/audioManager';
import { HudManager } from './ui/hudManager';

async function bootstrap(): Promise<void> {
  const appEl = document.getElementById('app')!;
  const loading = document.createElement('div');
  loading.className = 'loading-overlay';
  loading.textContent = '正在載入 3D 台灣夾娃娃店與 Rapier 物理引擎...';
  appEl.appendChild(loading);

  await initRapier();

  // 1. 建立 Three.js 場景與渲染器（明亮白光街邊店基調）
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdce6f2);
  scene.fog = new THREE.Fog(0xdce6f2, 12, 26);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  appEl.appendChild(renderer.domElement);

  const cameraCtrl = new CameraController(window.innerWidth / window.innerHeight);
  const input = new InputManager(renderer.domElement);
  const audio = new AudioManager();

  // 2. 建置台灣街邊夾娃娃店空間與 6 台獨立物理機台
  const shop = buildTaiwanClawShop();
  scene.add(shop.group);

  const machines: MachineUnit[] = MACHINE_PROFILES.map((profile, idx) => {
    const unit = new MachineUnit(profile, idx);
    scene.add(unit.root);
    return unit;
  });
  const clickTargets = machines.map((m) => m.clickHitbox);

  // 3. 遊戲狀態管理
  let mode: AppMode = 'SHOP_WALK';
  let activeMachineIdx: number | null = null;
  let nearestMachineIdx: number | null = null;

  const enterMachine = (index: number) => {
    audio.unlock();
    audio.playClick(580, 0.04, 0.08);

    if (activeMachineIdx !== null && activeMachineIdx !== index) {
      machines[activeMachineIdx].setActive(false);
    }

    activeMachineIdx = index;
    const unit = machines[index];
    unit.setActive(true);

    // 將走動位置也移到該台正前方，退出時自然站在機台前
    const standPos = unit.getFrontStandWorldPos();
    cameraCtrl.setWalkPosition(
      THREE.MathUtils.clamp(standPos.x, shop.walkBounds.xMin, shop.walkBounds.xMax),
      THREE.MathUtils.clamp(standPos.z, shop.walkBounds.zMin, shop.walkBounds.zMax)
    );

    cameraCtrl.startEnterMachine(unit.getCameraTarget());
    mode = 'TRANSITION_IN';
    hud.setMode(mode, unit.profile);
  };

  const exitMachine = () => {
    if (activeMachineIdx === null) return;
    audio.playClick(420, 0.04, 0.07);
    machines[activeMachineIdx].setActive(false);
    cameraCtrl.startExitMachine();
    mode = 'TRANSITION_OUT';
    hud.setMode(mode);
  };

  const hud = new HudManager(appEl, MACHINE_PROFILES, input, {
    onSelectMachine: (idx) => enterMachine(idx),
    onExitMachine: () => exitMachine(),
    onResetMachine: () => {
      if (activeMachineIdx === null) return;
      audio.playClick(640, 0.05, 0.09);
      machines[activeMachineIdx].resetMachine();
    },
    onResetCamera: () => {
      cameraCtrl.resetOrbitFront();
    },
  });
  hud.setMode('SHOP_WALK');

  // 視窗尺寸更新
  window.addEventListener('resize', () => {
    cameraCtrl.setAspect(window.innerWidth / window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // 4. 固定 120 Hz 物理更新＋獨立螢幕更新率渲染迴圈
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  let lastTime = performance.now();
  let accumulator = 0;
  let prevMoveX = 0;
  let prevMoveZ = 0;

  const animate = (now: number) => {
    requestAnimationFrame(animate);

    const frameDt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    // 處理視角拖曳與滾輪
    const { dx, dy, wheel } = input.consumeLookDelta();
    if (mode === 'SHOP_WALK') {
      if (dx !== 0 || dy !== 0) {
        cameraCtrl.adjustWalkLook(dx, dy);
      }
    } else if (mode === 'MACHINE_PLAY') {
      if (dx !== 0 || dy !== 0) {
        cameraCtrl.adjustOrbit(dx, dy);
      }
      if (wheel !== 0) {
        cameraCtrl.adjustZoom(wheel);
      }
    }

    // 處理點擊 3D 機台直接開玩
    const click = input.consumeCanvasClick();
    if (click && mode === 'SHOP_WALK') {
      audio.unlock();
      pointerNdc.x = (click.x / window.innerWidth) * 2 - 1;
      pointerNdc.y = -(click.y / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, cameraCtrl.camera);
      const hits = raycaster.intersectObjects(clickTargets, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.machineIndex as number;
        enterMachine(idx);
      }
    }

    const move = input.getDigitalMove();
    const interactPressed = input.consumeInteractPressed();
    const exitPressed = input.consumeExitPressed();

    // 模式邏輯更新
    if (mode === 'SHOP_WALK') {
      if (move.x !== 0 || move.z !== 0) {
        const yaw = cameraCtrl.getWalkYaw();
        const forwardX = -Math.sin(yaw);
        const forwardZ = -Math.cos(yaw);
        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);

        const speed = 2.15;
        const stepX = (rightX * move.x - forwardX * move.z) * speed * frameDt;
        const stepZ = (rightZ * move.x - forwardZ * move.z) * speed * frameDt;
        const cur = cameraCtrl.getWalkPosition();
        cameraCtrl.setWalkPosition(
          THREE.MathUtils.clamp(cur.x + stepX, shop.walkBounds.xMin, shop.walkBounds.xMax),
          THREE.MathUtils.clamp(cur.z + stepZ, shop.walkBounds.zMin, shop.walkBounds.zMax)
        );
      }

      // 偵測玩家最靠近哪一台機台
      const pPos = cameraCtrl.getWalkPosition();
      let bestIdx: number | null = null;
      let bestDist = 1.65;
      for (const m of machines) {
        const stand = m.getFrontStandWorldPos();
        const d = Math.hypot(pPos.x - stand.x, pPos.z - stand.z);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = m.index;
        }
      }
      if (bestIdx !== nearestMachineIdx) {
        nearestMachineIdx = bestIdx;
        hud.setNearestMachine(bestIdx !== null ? machines[bestIdx].profile : null, bestIdx);
      }

      if (interactPressed && nearestMachineIdx !== null) {
        enterMachine(nearestMachineIdx);
      }
    } else if (mode === 'MACHINE_PLAY') {
      if (exitPressed || interactPressed) {
        exitMachine();
      }

      // 搖桿微動開關音效回饋
      if (move.x !== prevMoveX || move.z !== prevMoveZ) {
        if (move.x !== 0 || move.z !== 0) {
          audio.unlock();
          audio.playClick(460, 0.025, 0.045);
        }
        prevMoveX = move.x;
        prevMoveZ = move.z;
      }
    }

    // 取得本幀下爪按鍵（僅供使用中的機台消費一次）
    let pendingDrop = mode === 'MACHINE_PLAY' ? input.consumeDropPressed() : false;
    if (pendingDrop) {
      audio.unlock();
      audio.playDropButton();
    }

    // 固定 120 Hz 物理步進（與螢幕更新率完全解耦）
    accumulator += frameDt;
    const maxSubsteps = 8;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < maxSubsteps) {
      for (const m of machines) {
        if (!m.needsPhysicsStep()) continue;
        const isCurrent = mode === 'MACHINE_PLAY' && m.index === activeMachineIdx;
        const fwInput = isCurrent
          ? { moveX: move.x, moveZ: move.z, dropPressed: pendingDrop }
          : { moveX: 0, moveZ: 0, dropPressed: false };
        if (isCurrent) pendingDrop = false;

        const { cmd, wonPrizes } = m.stepPhysics(FIXED_DT, fwInput);

        if (isCurrent && cmd.event === 'GRAB_START') {
          audio.playSolenoidClack();
        } else if (isCurrent && cmd.event === 'RELEASE') {
          audio.playClick(280, 0.045, 0.08);
        }

        for (const prize of wonPrizes) {
          audio.playPrizeWon();
          hud.notifyPrizeWon(prize);
        }
      }
      accumulator -= FIXED_DT;
      steps += 1;
    }

    // 同步活躍或穩定中機台的 3D 視覺姿勢
    for (const m of machines) {
      if (!m.needsPhysicsStep()) continue;
      const isCurrent = mode === 'MACHINE_PLAY' && m.index === activeMachineIdx;
      m.syncVisuals(
        isCurrent ? move.x : 0,
        isCurrent ? move.z : 0,
        isCurrent ? input.isDropHeld() : false
      );
      if (isCurrent) {
        hud.updateMachinePhase(m.rig.firmware.getPhase(), m.profile.controller.midAirClawEnabled);
      }
    }

    // 鏡頭平滑更新與狀態轉換
    const transitionDone = cameraCtrl.update(frameDt, mode);
    if (transitionDone) {
      if (mode === 'TRANSITION_IN' && activeMachineIdx !== null) {
        mode = 'MACHINE_PLAY';
        hud.setMode(mode, machines[activeMachineIdx].profile);
      } else if (mode === 'TRANSITION_OUT') {
        activeMachineIdx = null;
        mode = 'SHOP_WALK';
        hud.setMode(mode);
      }
    }

    renderer.render(scene, cameraCtrl.camera);
  };

  loading.style.opacity = '0';
  window.setTimeout(() => loading.remove(), 320);
  requestAnimationFrame(animate);
}

void bootstrap();
