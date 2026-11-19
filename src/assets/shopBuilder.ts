import * as THREE from 'three';
import { createShopPosterTexture, createTileFloorTexture } from './textureFactory';

export interface ShopEnvironment {
  group: THREE.Group;
  walkBounds: { xMin: number; xMax: number; zMin: number; zMax: number };
}

/**
 * 建構真實台灣街邊夾娃娃店室內空間（明亮、擁擠、功能性白光，非暗黑日系霓虹風）：
 * - 長方形店面（寬 5.4 m × 深 6.8 m × 高 2.85 m）
 * - 白灰拋光磁磚地＋白牆＋台灣常見店內公告海報
 * - 輕鋼架天花＋多盞平板 LED 白光燈
 * - 街邊玻璃入口門＋店外明亮自然街景暗示
 * - 維修收納角落（紅色台灣塑膠椅、補貨紙箱、小折梯、兌幣機外觀）
 */
export function buildTaiwanClawShop(): ShopEnvironment {
  const group = new THREE.Group();

  const shopW = 5.4;
  const shopD = 6.8;
  const shopH = 2.85;

  // 1. 白灰磁磚地板
  const floorTex = createTileFloorTexture(9, 11);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.34,
    metalness: 0.06,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(shopW, shopD), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // 2. 四面牆體（明亮油漆白牆＋踢腳板）
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.85 });
  const baseboardMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.6 });

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(shopD, shopH), wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-shopW / 2, shopH / 2, 0);
  leftWall.receiveShadow = true;

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(shopD, shopH), wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(shopW / 2, shopH / 2, 0);
  rightWall.receiveShadow = true;

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(shopW, shopH), wallMat);
  backWall.position.set(0, shopH / 2, -shopD / 2);
  backWall.receiveShadow = true;

  group.add(leftWall, rightWall, backWall);

  // 踢腳板
  const baseL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, shopD), baseboardMat);
  baseL.position.set(-shopW / 2 + 0.01, 0.05, 0);
  const baseR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, shopD), baseboardMat);
  baseR.position.set(shopW / 2 - 0.01, 0.05, 0);
  const baseB = new THREE.Mesh(new THREE.BoxGeometry(shopW, 0.1, 0.02), baseboardMat);
  baseB.position.set(0, 0.05, -shopD / 2 + 0.01);
  group.add(baseL, baseR, baseB);

  // 3. 輕鋼架天花板＋平板 LED 燈組
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(shopW, shopD),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = shopH;
  group.add(ceiling);

  const ledPanelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ledFrameMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.4 });
  for (const lz of [-2.1, -0.5, 1.1, 2.5]) {
    for (const lx of [-1.15, 1.15]) {
      const panelFrame = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.025, 0.64), ledFrameMat);
      panelFrame.position.set(lx, shopH - 0.015, lz);
      const panelGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.58), ledPanelMat);
      panelGlow.rotation.x = Math.PI / 2;
      panelGlow.position.set(lx, shopH - 0.03, lz);
      group.add(panelFrame, panelGlow);
    }
  }

  // 4. 台灣街邊店面玻璃入口（前方 +Z = shopD/2）
  const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 });
  const storefrontGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.24,
    roughness: 0.1,
    depthWrite: false,
  });

  // 上橫樑＋左右門框柱
  const headerBeam = new THREE.Mesh(new THREE.BoxGeometry(shopW, 0.45, 0.08), doorFrameMat);
  headerBeam.position.set(0, shopH - 0.225, shopD / 2 - 0.04);
  group.add(headerBeam);

  for (const px of [-shopW / 2 + 0.05, -0.95, 0.95, shopW / 2 - 0.05]) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, shopH, 0.08), doorFrameMat);
    mullion.position.set(px, shopH / 2, shopD / 2 - 0.04);
    group.add(mullion);
  }

  const frontWindow = new THREE.Mesh(new THREE.PlaneGeometry(shopW - 0.16, shopH - 0.45), storefrontGlassMat);
  frontWindow.rotation.y = Math.PI;
  frontWindow.position.set(0, (shopH - 0.45) / 2, shopD / 2 - 0.04);
  group.add(frontWindow);

  // 店門外騎樓地面延伸（讓轉頭看門口時像真實街邊店）
  const sidewalk = new THREE.Mesh(
    new THREE.PlaneGeometry(8.0, 2.8),
    new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.9 })
  );
  sidewalk.rotation.x = -Math.PI / 2;
  sidewalk.position.set(0, -0.01, shopD / 2 + 1.4);
  group.add(sidewalk);

  // 5. 牆面台灣夾娃娃店海報與公告（後牆）
  const poster1Tex = createShopPosterTexture(
    '24H 無人自助夾娃娃',
    [
      '• 全店免費練習・不限時間',
      '• 支援真實甩爪・二收捏薄',
      '• 靠近機台點擊或按 E 開玩',
      '• 拖曳畫面 360° 觀察洞口',
      '• 獎品位移永久保留不重置',
    ],
    '#e63946'
  );
  const poster1 = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 1.02),
    new THREE.MeshStandardMaterial({ map: poster1Tex, roughness: 0.5 })
  );
  poster1.position.set(-0.62, 1.62, -shopD / 2 + 0.015);
  group.add(poster1);

  const poster2Tex = createShopPosterTexture(
    '本場機台配置一覽',
    [
      '01 鼎莉標準台：3C 彩盒原廠',
      '02 鼎莉技術台：薄盒二收捏薄',
      '03 透明公仔台：弱爪防甩內丟',
      '04 鼎莉巨無霸：大爪偏心長盒',
      '05 飛絡力小台：潮流迷你盲盒',
      '06 綜合人氣台：二樓硬盒布偶',
    ],
    '#0284c7'
  );
  const poster2 = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 1.02),
    new THREE.MeshStandardMaterial({ map: poster2Tex, roughness: 0.5 })
  );
  poster2.position.set(0.62, 1.62, -shopD / 2 + 0.015);
  group.add(poster2);

  // 6. 台灣夾娃娃店經典道具：後牆兌幣機＋紅色塑膠凳＋補貨紙箱角落
  // 兌幣機外觀（後牆中央偏右）
  const changerGroup = new THREE.Group();
  changerGroup.position.set(0, 0, -shopD / 2 + 0.24);
  const changerBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 1.38, 0.36),
    new THREE.MeshStandardMaterial({ color: 0x0f4c81, roughness: 0.38, metalness: 0.25 })
  );
  changerBody.position.y = 0.69;
  changerBody.castShadow = true;
  const changerFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.56, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
  );
  changerFace.position.set(0, 0.94, 0.18);
  const changerTray = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.16, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 })
  );
  changerTray.position.set(0, 0.46, 0.18);
  changerGroup.add(changerBody, changerFace, changerTray);
  group.add(changerGroup);

  // 補貨紙箱（左後角落收納區）
  const cardboardMat = new THREE.MeshStandardMaterial({ color: 0xc29563, roughness: 0.92 });
  const box1 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 0.42), cardboardMat);
  box1.position.set(-1.95, 0.19, -2.85);
  box1.rotation.y = 0.18;
  box1.castShadow = true;
  const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.38), cardboardMat);
  box2.position.set(-1.92, 0.54, -2.88);
  box2.rotation.y = -0.12;
  box2.castShadow = true;
  group.add(box1, box2);

  // 台灣經典紅色塑膠凳（右前收納角）
  const stoolGroup = new THREE.Group();
  stoolGroup.position.set(1.95, 0, 2.38);
  const redPlasticMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.42 });
  const stoolTop = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.28), redPlasticMat);
  stoolTop.position.y = 0.44;
  stoolGroup.add(stoolTop);
  for (const sx of [-0.1, 0.1]) {
    for (const sz of [-0.1, 0.1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.44, 8), redPlasticMat);
      leg.position.set(sx, 0.22, sz);
      leg.rotation.z = -sx * 0.6;
      leg.rotation.x = sz * 0.6;
      stoolGroup.add(leg);
    }
  }
  group.add(stoolGroup);

  // 藍色塑膠整理籃（放補貨用品）
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.26, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.55 })
  );
  crate.position.set(-1.85, 0.13, 2.45);
  crate.rotation.y = -0.22;
  group.add(crate);

  // 7. 走道明亮均勻照明（台灣店面特色：高亮度白光）
  const ambient = new THREE.AmbientLight(0xf8fafc, 0.95);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xdbe2ea, 0.65);

  const mainDir = new THREE.DirectionalLight(0xffffff, 0.85);
  mainDir.position.set(0.8, 3.8, 1.5);
  mainDir.castShadow = true;
  mainDir.shadow.mapSize.set(1024, 1024);
  mainDir.shadow.camera.near = 0.5;
  mainDir.shadow.camera.far = 11;
  mainDir.shadow.camera.left = -4.0;
  mainDir.shadow.camera.right = 4.0;
  mainDir.shadow.camera.top = 4.5;
  mainDir.shadow.camera.bottom = -4.5;
  mainDir.shadow.bias = -0.0005;

  const aisleLight1 = new THREE.PointLight(0xffffff, 1.25, 8.5, 1.5);
  aisleLight1.position.set(0, 2.65, -1.2);
  const aisleLight2 = new THREE.PointLight(0xffffff, 1.25, 8.5, 1.5);
  aisleLight2.position.set(0, 2.65, 1.2);

  group.add(ambient, hemi, mainDir, aisleLight1, aisleLight2);

  return {
    group,
    walkBounds: {
      xMin: -1.18,
      xMax: 1.18,
      zMin: -2.45,
      zMax: 2.65,
    },
  };
}
