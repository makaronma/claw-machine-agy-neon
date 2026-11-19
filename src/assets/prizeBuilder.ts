import * as THREE from 'three';
import { PrizePhysicsInstance } from '../physics/prizeSpawner';
import { createPrizeBoxTexture } from './textureFactory';
import { sharedAssetLoader } from './assetLoader';

export interface PrizeVisualBinding {
  prizeId: string;
  root: THREE.Group;
  syncFromPhysics: () => void;
}

/**
 * 依台灣獎品圖鑑建構實體感 3D 模型（嚴禁 random 3D shapes）：
 * - 3C 彩盒：六面差異化台灣包裝印刷貼圖＋盒蓋邊緣細節＋視窗反光
 * - 透明公仔展示盒：透明 PVC 外殼＋彩印底座與頂蓋＋盒內真實立體公仔造型
 * - 多關節布偶：頭、耳/喙、鈕扣眼、圍巾/蝴蝶結、身體與四肢獨立追蹤物理剛體
 * 同時支援若 catalog.glbPath 存在則自動熱替換為外部 GLB。
 */
export function buildPrizeVisual(prize: PrizePhysicsInstance): PrizeVisualBinding {
  const root = new THREE.Group();
  const cat = prize.catalog;

  if (prize.kind === 'rigid') {
    const { width, height, depth } = cat.dimensions;

    if (cat.isTransparentShell) {
      buildTransparentFigureBoxMesh(root, prize);
    } else {
      const frontTex = createPrizeBoxTexture(cat, 'front');
      const sideTex = createPrizeBoxTexture(cat, 'side');
      const topTex = createPrizeBoxTexture(cat, 'top');

      const frontMat = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.38, metalness: 0.05 });
      const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.42, metalness: 0.04 });
      const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.42, metalness: 0.04 });

      // BoxGeometry 6 面順序：+X, -X, +Y, -Y, +Z, -Z
      const boxMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        [sideMat, sideMat, topMat, topMat, frontMat, frontMat]
      );
      boxMesh.castShadow = true;
      boxMesh.receiveShadow = true;
      root.add(boxMesh);

      // 台灣盒裝常見上方塑膠掛耳或封口膠帶反光條
      const tapeMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.34,
        roughness: 0.1,
      });
      const tape = new THREE.Mesh(new THREE.BoxGeometry(width * 0.24, 0.0018, depth * 0.35), tapeMat);
      tape.position.set(0, height / 2 + 0.0008, depth * 0.32);
      root.add(tape);
    }

    // 預留 .glb 熱替換（若將來有提供 .glb 檔案則自動取代內建 mesh）
    if (cat.glbPath) {
      void sharedAssetLoader.tryLoadGlb(cat.glbPath).then((glb) => {
        if (glb) {
          root.clear();
          root.add(glb);
        }
      });
    }

    const syncFromPhysics = () => {
      if (prize.won) {
        root.visible = false;
        return;
      }
      const t = prize.body.translation();
      const r = prize.body.rotation();
      root.position.set(t.x, t.y, t.z);
      root.quaternion.set(r.x, r.y, r.z, r.w);
    };

    syncFromPhysics();
    return { prizeId: prize.id, root, syncFromPhysics };
  }

  // 多關節布偶視覺綁定（每個肢體追蹤各自的 Rapier 剛體）
  const partMeshes: Array<{ mesh: THREE.Object3D; body: typeof prize.parts[number]['body'] }> = [];
  const isDuck = prize.archetype === 'plush_round_duck';
  const fabricMat = new THREE.MeshStandardMaterial({
    color: cat.primaryColor,
    roughness: 0.92,
    metalness: 0.0,
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: cat.secondaryColor,
    roughness: 0.9,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: cat.accentColor,
    roughness: 0.65,
  });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.15, metalness: 0.1 });

  const { width, height } = cat.dimensions;
  const torsoR = width * 0.34;
  const torsoHH = height * 0.14;
  const headR = width * 0.31;
  const limbR = width * 0.13;

  for (const part of prize.parts) {
    const pGroup = new THREE.Group();

    if (part.partName === 'torso') {
      const bodyGeo = new THREE.CapsuleGeometry(torsoR, torsoHH * 2, 10, 14);
      const bodyMesh = new THREE.Mesh(bodyGeo, fabricMat);
      bodyMesh.castShadow = true;
      pGroup.add(bodyMesh);

      // 肚皮色塊與可愛蝴蝶結／圍巾
      const belly = new THREE.Mesh(new THREE.SphereGeometry(torsoR * 0.72, 12, 10), bellyMat);
      belly.position.set(0, -0.004, torsoR * 0.42);
      belly.scale.set(0.9, 1.05, 0.55);
      pGroup.add(belly);

      const bow = new THREE.Mesh(new THREE.BoxGeometry(torsoR * 0.9, 0.014, 0.018), accentMat);
      bow.position.set(0, torsoHH + torsoR * 0.45, torsoR * 0.62);
      pGroup.add(bow);
    } else if (part.partName === 'head') {
      const headMesh = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 12), fabricMat);
      headMesh.castShadow = true;
      pGroup.add(headMesh);

      // 雙眼
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.14, 8, 8), eyeMat);
        eye.position.set(sx * headR * 0.36, headR * 0.12, headR * 0.86);
        pGroup.add(eye);
      }

      if (isDuck) {
        // 圓圓鴨橘色扁嘴
        const beak = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.36, 10, 8), bellyMat);
        beak.scale.set(1.1, 0.5, 0.9);
        beak.position.set(0, -headR * 0.14, headR * 0.92);
        pGroup.add(beak);
      } else {
        // 小熊圓耳與鼻吻
        for (const sx of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.34, 10, 8), fabricMat);
          ear.position.set(sx * headR * 0.72, headR * 0.72, 0);
          pGroup.add(ear);
        }
        const snout = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.34, 10, 8), bellyMat);
        snout.scale.set(1.05, 0.85, 0.8);
        snout.position.set(0, -headR * 0.16, headR * 0.85);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.12, 8, 8), eyeMat);
        nose.position.set(0, -headR * 0.05, headR * 1.12);
        pGroup.add(snout, nose);
      }
    } else {
      const isLeg = part.partName === 'legL' || part.partName === 'legR';
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(isLeg ? limbR * 1.1 : limbR, isLeg ? 0.036 : 0.032, 8, 10),
        isDuck && isLeg ? bellyMat : fabricMat
      );
      mesh.castShadow = true;
      pGroup.add(mesh);
    }

    root.add(pGroup);
    partMeshes.push({ mesh: pGroup, body: part.body });
  }

  const syncFromPhysics = () => {
    if (prize.won) {
      root.visible = false;
      return;
    }
    for (const pm of partMeshes) {
      const t = pm.body.translation();
      const r = pm.body.rotation();
      pm.mesh.position.set(t.x, t.y, t.z);
      pm.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  };

  syncFromPhysics();
  return { prizeId: prize.id, root, syncFromPhysics };
}

/**
 * 台灣娃娃機經典「標準透明公仔盒」：外層透明 PVC 硬盒＋底盒座＋盒內原創公仔造型
 */
function buildTransparentFigureBoxMesh(root: THREE.Group, prize: PrizePhysicsInstance): void {
  const cat = prize.catalog;
  const { width, height, depth } = cat.dimensions;

  // 底部與頂部印刷紙卡插片
  const basePlate = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.004, 0.022, depth - 0.004),
    new THREE.MeshStandardMaterial({ color: cat.secondaryColor, roughness: 0.45 })
  );
  basePlate.position.y = -height / 2 + 0.012;
  root.add(basePlate);

  const topStrip = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.004, 0.016, depth - 0.004),
    new THREE.MeshStandardMaterial({ color: cat.accentColor, roughness: 0.4 })
  );
  topStrip.position.y = height / 2 - 0.009;
  root.add(topStrip);

  // 盒內精緻原創小公仔（依 variantSeed 變化配色，避免任何未授權 IP）
  const palette = [0x38bdf8, 0xfb7185, 0xa78bfa, 0x34d399, 0xfbbf24];
  const suitColor = palette[prize.variantSeed % palette.length];
  const figGroup = new THREE.Group();
  figGroup.position.y = -height / 2 + 0.024;

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(width * 0.34, width * 0.36, 0.014, 16),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35 })
  );
  pedestal.position.y = 0.007;

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(width * 0.22, height * 0.38, 12),
    new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.35 })
  );
  body.position.y = 0.014 + height * 0.19;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(width * 0.23, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xfde6d2, roughness: 0.45 })
  );
  head.position.y = 0.014 + height * 0.46;

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(width * 0.245, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.3 })
  );
  cap.position.y = head.position.y + 0.004;

  figGroup.add(pedestal, body, head, cap);
  root.add(figGroup);

  // 外層透明 PVC 硬盒殼體與白色折線邊框
  const pvcShell = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.26,
      roughness: 0.08,
      metalness: 0.02,
      depthWrite: false,
    })
  );
  pvcShell.castShadow = true;
  root.add(pvcShell);

  const edgeLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 })
  );
  root.add(edgeLines);
}
