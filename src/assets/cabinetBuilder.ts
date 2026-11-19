import * as THREE from 'three';
import { MachineProfile } from '../types/machine';
import { createLowerDoorDecalTexture, createMarqueeTexture } from './textureFactory';

export interface CabinetVisual {
  group: THREE.Group;
  joystickPivot: THREE.Group;
  redButtonMesh: THREE.Mesh;
  statusLedMesh: THREE.Mesh;
  setControlAnimation: (moveX: number, moveZ: number, buttonPressed: boolean, active: boolean) => void;
}

/**
 * 依原廠尺寸高精度建構台灣夾娃娃機機櫃（鼎莉標準台／鼎莉巨無霸台／飛絡力精品小台）：
 * - 四角鋁擠型金屬邊框＋烤漆面板
 * - 真實深度出貨口＋透明壓克力擋板＋防甩片＋可選橫桿
 * - 台灣式控制檯（球頭搖桿、紅色大按鈕、投幣口、退幣口、數位顯示屏、取物門與鑰匙鎖）
 * - 上方發光燈箱＋艙內白光 LED 燈條
 */
export function buildCabinetVisual(profile: MachineProfile, machineIndex: number): CabinetVisual {
  const group = new THREE.Group();
  const ext = profile.cabinet.externalSize.value;
  const play = profile.cabinet.playAreaSize.value;
  const chute = profile.cabinet.chuteOpening.value;
  const barrierH = profile.cabinet.barrierHeight.value;

  const W = ext.width;
  const D = ext.depth;
  const H = ext.height;
  const playW = play.width;
  const playD = play.depth;
  const floorY = play.floorY;
  const railY = play.railY;
  const halfW = playW / 2;
  const halfD = playD / 2;

  // 材質集合
  const frameMat = new THREE.MeshStandardMaterial({
    color: profile.cabinet.themeColor,
    roughness: 0.35,
    metalness: 0.18,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: profile.cabinet.accentColor,
    roughness: 0.32,
    metalness: 0.2,
  });
  const aluminumMat = new THREE.MeshStandardMaterial({
    color: 0xdbe2ea,
    metalness: 0.78,
    roughness: 0.28,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.55,
    roughness: 0.45,
  });
  const interiorDeckMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.5,
    metalness: 0.08,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xeef8ff,
    transparent: true,
    opacity: 0.14,
    roughness: 0.08,
    metalness: 0.05,
    reflectivity: 0.85,
    depthWrite: false,
  });
  const acrylicBarrierMat = new THREE.MeshPhysicalMaterial({
    color: 0xdff6ff,
    transparent: true,
    opacity: 0.36,
    roughness: 0.12,
    metalness: 0.05,
    depthWrite: false,
  });
  const antiSwingMat = new THREE.MeshPhysicalMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.38,
    roughness: 0.18,
    metalness: 0.05,
    depthWrite: false,
  });

  // =========================================================
  // 1. 下半部機櫃本體（0 ~ floorY，保留出貨口凹槽與底部腳輪）
  // =========================================================
  const baseH = floorY - 0.04;
  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(W, baseH, D), frameMat);
  lowerBody.position.set(0, 0.04 + baseH / 2, 0);
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  group.add(lowerBody);

  // 底部四個腳座／滾輪
  const casterMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.04, 12), casterMat);
      foot.position.set(sx * (W / 2 - 0.07), 0.02, sz * (D / 2 - 0.07));
      group.add(foot);
    }
  }

  // 下方前門貼圖面板（右半側）
  const decalTex = createLowerDoorDecalTexture(profile.cabinet.accentColor, profile.manufacturer);
  const decalPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.44, baseH * 0.74),
    new THREE.MeshStandardMaterial({ map: decalTex, roughness: 0.4 })
  );
  decalPanel.position.set(W * 0.22, 0.04 + baseH * 0.46, D / 2 + 0.002);
  group.add(decalPanel);

  // 左下方取物門（出貨口前方透明翻門）
  const chuteW = chute.width;
  const chuteD = chute.depth;
  const chuteXMax = -halfW + chuteW;
  const chuteZMin = halfD - chuteD;
  const chuteCx = -halfW + chuteW / 2;
  const chuteCz = chuteZMin + chuteD / 2;

  const pickupFrame = new THREE.Mesh(new THREE.BoxGeometry(chuteW + 0.03, 0.30, 0.025), darkMetalMat);
  pickupFrame.position.set(chuteCx, 0.28, D / 2 + 0.004);
  const pickupFlap = new THREE.Mesh(
    new THREE.BoxGeometry(chuteW - 0.02, 0.24, 0.012),
    new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.48, roughness: 0.15 })
  );
  pickupFlap.position.set(chuteCx, 0.27, D / 2 + 0.012);
  group.add(pickupFrame, pickupFlap);

  // 維修鎖與鑰匙孔
  const lockCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 14), aluminumMat);
  lockCylinder.rotation.x = Math.PI / 2;
  lockCylinder.position.set(W * 0.42, 0.48, D / 2 + 0.006);
  group.add(lockCylinder);

  // =========================================================
  // 2. 遊戲艙檯面（留出真實貫穿洞口與出貨道內部）
  // =========================================================
  const deckT = 0.024;
  // 右側底板
  const rightDeckW = halfW - chuteXMax;
  const rightDeck = new THREE.Mesh(new THREE.BoxGeometry(rightDeckW, deckT, playD), interiorDeckMat);
  rightDeck.position.set(chuteXMax + rightDeckW / 2, floorY - deckT / 2, 0);
  rightDeck.receiveShadow = true;
  group.add(rightDeck);

  // 左後方底板
  const backLeftD = chuteZMin - -halfD;
  const backLeftDeck = new THREE.Mesh(new THREE.BoxGeometry(chuteW, deckT, backLeftD), interiorDeckMat);
  backLeftDeck.position.set(chuteCx, floorY - deckT / 2, -halfD + backLeftD / 2);
  backLeftDeck.receiveShadow = true;
  group.add(backLeftDeck);

  // 洞口金屬壓邊框
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.65, roughness: 0.32 });
  const rimR = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, chuteD), rimMat);
  rimR.position.set(chuteXMax, floorY + 0.002, chuteCz);
  const rimB = new THREE.Mesh(new THREE.BoxGeometry(chuteW, 0.012, 0.012), rimMat);
  rimB.position.set(chuteCx, floorY + 0.002, chuteZMin);
  group.add(rimR, rimB);

  // 洞口內部深槽（深灰色內襯，清楚看出洞口深度）
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });
  const shaftH = chute.wallHeight;
  const shaftBack = new THREE.Mesh(new THREE.PlaneGeometry(chuteW, shaftH), shaftMat);
  shaftBack.position.set(chuteCx, floorY - shaftH / 2, chuteZMin + 0.002);
  const shaftRight = new THREE.Mesh(new THREE.PlaneGeometry(chuteD, shaftH), shaftMat);
  shaftRight.rotation.y = -Math.PI / 2;
  shaftRight.position.set(chuteXMax - 0.002, floorY - shaftH / 2, chuteCz);
  const shaftLeft = new THREE.Mesh(new THREE.PlaneGeometry(chuteD, shaftH), shaftMat);
  shaftLeft.rotation.y = Math.PI / 2;
  shaftLeft.position.set(-halfW + 0.002, floorY - shaftH / 2, chuteCz);
  const shaftBottom = new THREE.Mesh(new THREE.PlaneGeometry(chuteW, chuteD), shaftMat);
  shaftBottom.rotation.x = -Math.PI / 2;
  shaftBottom.position.set(chuteCx, floorY - shaftH + 0.02, chuteCz);
  group.add(shaftBack, shaftRight, shaftLeft, shaftBottom);

  // 透明壓克力洞口擋板（對齊物理厚度 8mm 與高度）
  const barT = 0.008;
  const barRight = new THREE.Mesh(new THREE.BoxGeometry(barT, barrierH, chuteD), acrylicBarrierMat);
  barRight.position.set(chuteXMax + barT / 2, floorY + barrierH / 2, chuteCz);
  const barBack = new THREE.Mesh(new THREE.BoxGeometry(chuteW, barrierH, barT), acrylicBarrierMat);
  barBack.position.set(chuteCx, floorY + barrierH / 2, chuteZMin - barT / 2);
  // 擋板上緣亮條讓玩家好判斷高度
  const barEdgeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 });
  const edgeR = new THREE.Mesh(new THREE.BoxGeometry(barT + 0.001, 0.003, chuteD), barEdgeMat);
  edgeR.position.set(chuteXMax + barT / 2, floorY + barrierH, chuteCz);
  const edgeB = new THREE.Mesh(new THREE.BoxGeometry(chuteW, 0.003, barT + 0.001), barEdgeMat);
  edgeB.position.set(chuteCx, floorY + barrierH, chuteZMin - barT / 2);
  group.add(barRight, barBack, edgeR, edgeB);

  // 防甩片視覺件（微黃透明強化壓克力，與台灣現場極像）
  const anti = profile.cabinet.antiSwingPlate;
  if (anti.enabled) {
    const plateY = floorY + barrierH + anti.height * 0.5 + 0.04;
    if (anti.side === 'chute_right' || anti.side === 'both') {
      const pR = new THREE.Mesh(new THREE.BoxGeometry(0.006, anti.height, anti.width), antiSwingMat);
      pR.position.set(chuteXMax + 0.004, plateY, chuteZMin + anti.width * 0.55);
      group.add(pR);
    }
    if (anti.side === 'chute_back' || anti.side === 'both') {
      const pB = new THREE.Mesh(new THREE.BoxGeometry(anti.width, anti.height, 0.006), antiSwingMat);
      pB.position.set(-halfW + anti.width * 0.55, plateY, chuteZMin - 0.004);
      group.add(pB);
    }
  }

  // 可選橫桿視覺件（6 號機）
  if (profile.cabinet.crossBar?.enabled) {
    const cb = profile.cabinet.crossBar;
    const barLen = halfW - chuteXMax;
    const barMesh = new THREE.Mesh(new THREE.CylinderGeometry(cb.radius, cb.radius, barLen, 12), aluminumMat);
    barMesh.rotation.z = Math.PI / 2;
    barMesh.position.set(chuteXMax + barLen / 2, floorY + cb.yOffsetFromFloor, cb.zLocal);
    group.add(barMesh);
  }

  // =========================================================
  // 3. 上半部玻璃櫥窗框架、背板、LED 燈條與頂部燈箱
  // =========================================================
  const glassTopY = railY + 0.07;
  const glassH = glassTopY - floorY;
  const pillarW = (W - playW) / 2;

  // 四角鋁柱
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(pillarW, glassH, (D - playD) / 2), aluminumMat);
      pillar.position.set(sx * (W / 2 - pillarW / 2), floorY + glassH / 2, sz * (D / 2 - (D - playD) / 4));
      pillar.castShadow = true;
      group.add(pillar);

      // 內側垂直白光 LED 燈條（台灣機台靈魂！）
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, glassH - 0.06, 0.012),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      strip.position.set(sx * (halfW - 0.008), floorY + glassH / 2, sz * (halfD - 0.008));
      group.add(strip);
    }
  }

  // 後方背板（明亮珍珠白＋微鏡面感）
  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.02, glassH, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.1 })
  );
  backPanel.position.set(0, floorY + glassH / 2, -D / 2 + 0.01);
  backPanel.receiveShadow = true;
  group.add(backPanel);

  // 前、左、右三面大片透明玻璃
  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(playW, glassH), glassMat);
  frontGlass.position.set(0, floorY + glassH / 2, D / 2 - 0.015);
  const leftGlass = new THREE.Mesh(new THREE.PlaneGeometry(playD, glassH), glassMat);
  leftGlass.rotation.y = -Math.PI / 2;
  leftGlass.position.set(-W / 2 + 0.015, floorY + glassH / 2, 0);
  const rightGlass = new THREE.Mesh(new THREE.PlaneGeometry(playD, glassH), glassMat);
  rightGlass.rotation.y = Math.PI / 2;
  rightGlass.position.set(W / 2 - 0.015, floorY + glassH / 2, 0);
  group.add(frontGlass, leftGlass, rightGlass);

  // 頂部燈箱冠座（glassTopY ~ H）
  const crownH = H - glassTopY;
  const crownBox = new THREE.Mesh(new THREE.BoxGeometry(W + 0.01, crownH, D + 0.01), accentMat);
  crownBox.position.set(0, glassTopY + crownH / 2, 0);
  crownBox.castShadow = true;
  group.add(crownBox);

  // 正面發光招牌燈箱
  const marqueeTex = createMarqueeTexture(
    profile.cabinet.marqueeTitle,
    profile.cabinet.marqueeSubtitle,
    profile.cabinet.accentColor,
    machineIndex + 1
  );
  const marqueeMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.06, crownH - 0.045),
    new THREE.MeshStandardMaterial({
      map: marqueeTex,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: marqueeTex,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    })
  );
  marqueeMesh.position.set(0, glassTopY + crownH / 2, D / 2 + 0.008);
  group.add(marqueeMesh);

  // 機台內頂部區域燈（模擬艙內強白光，不投射昂貴陰影以保手機流暢）
  const cabinLight = new THREE.PointLight(0xfffdf8, 1.05, 2.4, 1.8);
  cabinLight.position.set(0, railY - 0.02, 0.04);
  group.add(cabinLight);

  // =========================================================
  // 4. 台灣式控制檯（外凸平台、球頭搖桿、紅色大鈕、投幣器、數位屏）
  // =========================================================
  const consoleDepth = 0.16;
  const consoleH = 0.09;
  const consoleY = floorY - 0.02;
  const consoleZ = D / 2 + consoleDepth / 2;

  const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, consoleH, consoleDepth), accentMat);
  consoleBox.position.set(0, consoleY, consoleZ);
  consoleBox.castShadow = true;
  group.add(consoleBox);

  const consoleTopPlate = new THREE.Mesh(new THREE.BoxGeometry(W - 0.08, 0.008, consoleDepth - 0.02), darkMetalMat);
  consoleTopPlate.position.set(0, consoleY + consoleH / 2 + 0.003, consoleZ);
  group.add(consoleTopPlate);

  // 球頭搖桿（左側）
  const joystickPivot = new THREE.Group();
  joystickPivot.position.set(-W * 0.22, consoleY + consoleH / 2 + 0.008, consoleZ + 0.01);
  const joyDustCover = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.008, 16), darkMetalMat);
  const joyShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.055, 10), aluminumMat);
  joyShaft.position.y = 0.028;
  const joyBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.019, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.2, metalness: 0.1 })
  );
  joyBall.position.y = 0.062;
  joystickPivot.add(joyShaft, joyBall);
  const joyBase = new THREE.Group();
  joyBase.position.copy(joystickPivot.position);
  joyBase.add(joyDustCover);
  group.add(joyBase, joystickPivot);

  // 紅色大下爪按鈕（中偏右）
  const btnRim = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.031, 0.012, 18), darkMetalMat);
  btnRim.position.set(0.02, consoleY + consoleH / 2 + 0.01, consoleZ + 0.01);
  const redButtonMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.024, 0.018, 18),
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.35,
      roughness: 0.25,
    })
  );
  const btnRestY = consoleY + consoleH / 2 + 0.017;
  redButtonMesh.position.set(0.02, btnRestY, consoleZ + 0.01);
  group.add(btnRim, redButtonMesh);

  // 投幣口與退幣口外觀（右側）
  const coinPanel = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.018), darkMetalMat);
  coinPanel.position.set(W * 0.28, consoleY - 0.02, D / 2 + consoleDepth + 0.002);
  const coinSlot = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.032, 0.008), aluminumMat);
  coinSlot.position.set(W * 0.28, consoleY, D / 2 + consoleDepth + 0.012);
  const coinReturn = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.028, 0.008), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
  coinReturn.position.set(W * 0.28, consoleY - 0.045, D / 2 + consoleDepth + 0.012);
  group.add(coinPanel, coinSlot, coinReturn);

  // 數位顯示屏與狀態指示燈
  const lcdDisplay = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.03, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x090d16, emissive: 0x0f766e, emissiveIntensity: 0.5 })
  );
  lcdDisplay.position.set(W * 0.24, consoleY + consoleH / 2 + 0.01, consoleZ - 0.015);
  const statusLedMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.3 })
  );
  statusLedMesh.position.set(W * 0.34, consoleY + consoleH / 2 + 0.012, consoleZ - 0.015);
  group.add(lcdDisplay, statusLedMesh);

  const setControlAnimation = (moveX: number, moveZ: number, buttonPressed: boolean, active: boolean) => {
    // 搖桿真實傾斜反應玩家操作
    const targetRotZ = -moveX * 0.32;
    const targetRotX = moveZ * 0.32;
    joystickPivot.rotation.z = THREE.MathUtils.lerp(joystickPivot.rotation.z, targetRotZ, 0.35);
    joystickPivot.rotation.x = THREE.MathUtils.lerp(joystickPivot.rotation.x, targetRotX, 0.35);

    // 紅按鈕下壓動畫
    const targetBtnY = buttonPressed ? btnRestY - 0.007 : btnRestY;
    redButtonMesh.position.y = THREE.MathUtils.lerp(redButtonMesh.position.y, targetBtnY, 0.45);

    const ledMat = statusLedMesh.material as THREE.MeshStandardMaterial;
    ledMat.emissiveIntensity = active ? 1.4 : 0.25;
  };

  return {
    group,
    joystickPivot,
    redButtonMesh,
    statusLedMesh,
    setControlAnimation,
  };
}
