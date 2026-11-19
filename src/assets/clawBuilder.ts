import * as THREE from 'three';
import { ClawPhysicsSpec } from '../types/machine';
import { ClawRigTelemetry } from '../physics/clawRig';

export interface ClawVisualRig {
  group: THREE.Group;
  trolleyGroup: THREE.Group;
  crossBeamX: THREE.Mesh;
  clawHeadGroup: THREE.Group;
  plungerMesh: THREE.Mesh;
  prongGroups: THREE.Group[];
  cableMesh: THREE.Mesh;
  coiledWireMesh: THREE.Mesh;
  updateFromTelemetry: (t: ClawRigTelemetry) => void;
}

/**
 * 建立符合台灣真實夾娃娃機構造的 3D 天車、卷線輪、可伸長鋼索、黑色螺旋電線、
 * 中央電磁筒／活動鐵芯與三根彎曲金屬爪（含白／黑／磨損／裸金屬爪套）。
 */
export function buildClawVisualRig(
  physics: ClawPhysicsSpec,
  playWidth: number,
  playDepth: number,
  railY: number
): ClawVisualRig {
  const group = new THREE.Group();
  const scale = physics.prongLength.value / 0.145;

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    metalness: 0.78,
    roughness: 0.28,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.65,
    roughness: 0.42,
  });
  const coilHousingMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.55,
    roughness: 0.35,
  });

  const sleeveColorMap = {
    white_silicone: 0xf8fafc,
    black_rubber: 0x18181b,
    bare_metal: 0xcbd5e1,
    worn_sleeve: 0xd6d3d1,
  };
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: sleeveColorMap[physics.sleeveType],
    metalness: physics.sleeveType === 'bare_metal' ? 0.8 : 0.05,
    roughness: physics.sleeveType === 'bare_metal' ? 0.25 : 0.85,
  });

  // 1. 固定前後縱向滑軌（左右兩側）
  const sideRailGeo = new THREE.BoxGeometry(0.022, 0.024, playDepth - 0.04);
  const leftRail = new THREE.Mesh(sideRailGeo, steelMat);
  leftRail.position.set(-playWidth / 2 + 0.02, railY + 0.036, 0);
  const rightRail = new THREE.Mesh(sideRailGeo, steelMat);
  rightRail.position.set(playWidth / 2 - 0.02, railY + 0.036, 0);
  group.add(leftRail, rightRail);

  // 2. 隨 Z 軸移動的橫向橋架（X 軌道）
  const crossBeamX = new THREE.Mesh(
    new THREE.BoxGeometry(playWidth - 0.04, 0.026, 0.038),
    steelMat
  );
  crossBeamX.position.set(0, railY + 0.02, 0);
  group.add(crossBeamX);

  // 3. 天車小車（Trolley）＋ 卷線輪與馬達箱
  const trolleyGroup = new THREE.Group();
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.115 * scale, 0.052, 0.115 * scale), darkMetalMat);
  carriage.position.y = 0.012;
  const motorBox = new THREE.Mesh(new THREE.CylinderGeometry(0.022 * scale, 0.022 * scale, 0.065 * scale, 12), coilHousingMat);
  motorBox.rotation.z = Math.PI / 2;
  motorBox.position.set(0.038 * scale, 0.022, 0);
  const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * scale, 0.018 * scale, 0.016, 16), steelMat);
  pulley.rotation.z = Math.PI / 2;
  pulley.position.set(0, -0.01, 0);
  trolleyGroup.add(carriage, motorBox, pulley);
  group.add(trolleyGroup);

  // 4. 可變長度鋼索（垂直圓柱即時縮放定位）
  const cableMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.3 });
  const cableMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 1, 8), cableMat);
  group.add(cableMesh);

  // 5. 黑色螺旋伸縮電源線（緊隨鋼索伸縮）
  const helixPts: THREE.Vector3[] = [];
  const turns = 12;
  const segs = 72;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const ang = t * Math.PI * 2 * turns;
    const r = 0.011 * scale;
    helixPts.push(new THREE.Vector3(Math.cos(ang) * r + 0.018 * scale, 0.5 - t, Math.sin(ang) * r));
  }
  const helixCurve = new THREE.CatmullRomCurve3(helixPts);
  const coiledWireMesh = new THREE.Mesh(
    new THREE.TubeGeometry(helixCurve, 64, 0.0022, 6, false),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.65, metalness: 0.1 })
  );
  group.add(coiledWireMesh);

  // 6. 爪頭本體（中央電磁鐵筒、上吊環、下圓盤樞軸座、活動鐵芯）
  const clawHeadGroup = new THREE.Group();
  const housing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.031 * scale, 0.034 * scale, 0.072 * scale, 20),
    coilHousingMat
  );
  housing.castShadow = true;

  const topCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018 * scale, 0.031 * scale, 0.022 * scale, 20),
    steelMat
  );
  topCap.position.y = 0.046 * scale;

  const eyelet = new THREE.Mesh(
    new THREE.TorusGeometry(0.01 * scale, 0.003 * scale, 8, 16),
    steelMat
  );
  eyelet.position.y = 0.064 * scale;

  const hubPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036 * scale, 0.032 * scale, 0.016 * scale, 18),
    steelMat
  );
  hubPlate.position.y = -0.032 * scale;

  // 活動鐵芯推桿（隨電磁通電上下移動）
  const plungerMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011 * scale, 0.011 * scale, 0.045 * scale, 12),
    steelMat
  );
  plungerMesh.position.y = -0.052 * scale;

  clawHeadGroup.add(housing, topCap, eyelet, hubPlate, plungerMesh);
  group.add(clawHeadGroup);

  // 7. 三根精細彎曲金屬爪腳（完全對齊物理碰撞段座標）
  const L = physics.prongLength.value;
  const prongGroups: THREE.Group[] = [];

  for (let i = 0; i < 3; i++) {
    const azimuth = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const cosA = Math.cos(azimuth);
    const sinA = Math.sin(azimuth);

    const pGroup = new THREE.Group();

    // 完整對應物理碰撞曲線的四個節點
    const p0 = new THREE.Vector3(0, 0, 0);
    const p1 = new THREE.Vector3(0.36 * L * cosA, -0.34 * L, 0.36 * L * sinA);
    const p2 = new THREE.Vector3(0.46 * L * cosA, -0.86 * L, 0.46 * L * sinA);
    const p3 = new THREE.Vector3(0.06 * L * cosA, -0.97 * L, 0.06 * L * sinA);

    // 金屬爪臂（p0 -> p1 -> p2）
    const metalCurve = new THREE.CatmullRomCurve3([p0, p1, p2]);
    const metalGeo = new THREE.TubeGeometry(metalCurve, 14, 0.0046 * scale, 8, false);
    const metalMesh = new THREE.Mesh(metalGeo, steelMat);
    metalMesh.castShadow = true;
    pGroup.add(metalMesh);

    // 爪腳樞軸銷釘
    const hingePin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006 * scale, 0.006 * scale, 0.016 * scale, 10),
      darkMetalMat
    );
    hingePin.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(-sinA, 0, cosA)
    );
    pGroup.add(hingePin);

    // 連桿飾條（連接上臂到中央鐵芯方向）
    const linkCurve = new THREE.LineCurve3(
      p1.clone().multiplyScalar(0.55),
      new THREE.Vector3(0.02 * L * cosA, -0.18 * L, 0.02 * L * sinA)
    );
    const linkMesh = new THREE.Mesh(
      new THREE.TubeGeometry(linkCurve, 4, 0.0028 * scale, 6, false),
      darkMetalMat
    );
    pGroup.add(linkMesh);

    // 防滑爪套段（p2 -> p3，較粗且為白矽膠／黑膠材質）
    const tipCurve = new THREE.CatmullRomCurve3([
      p2,
      p2.clone().lerp(p3, 0.52).add(new THREE.Vector3(0.05 * L * cosA, -0.04 * L, 0.05 * L * sinA)),
      p3,
    ]);
    const tipGeo = new THREE.TubeGeometry(tipCurve, 10, 0.0068 * scale, 10, false);
    const tipMesh = new THREE.Mesh(tipGeo, sleeveMat);
    tipMesh.castShadow = true;
    pGroup.add(tipMesh);

    // 爪尖圓頭套帽
    const tipCap = new THREE.Mesh(new THREE.SphereGeometry(0.0072 * scale, 10, 8), sleeveMat);
    tipCap.position.copy(p3);
    pGroup.add(tipCap);

    group.add(pGroup);
    prongGroups.push(pGroup);
  }

  const upVec = new THREE.Vector3(0, 1, 0);
  const deltaVec = new THREE.Vector3();
  const midVec = new THREE.Vector3();

  const updateFromTelemetry = (t: ClawRigTelemetry) => {
    // 天車與橫樑
    trolleyGroup.position.copy(t.trolleyPos);
    crossBeamX.position.z = t.trolleyPos.z;

    // 爪頭本體與活動鐵芯高度
    clawHeadGroup.position.copy(t.clawHeadPos);
    clawHeadGroup.quaternion.copy(t.clawHeadQuat);
    plungerMesh.position.y = (-0.055 + t.plungerNormalized * 0.022) * scale;

    // 三根爪腳直接同步物理剛體姿態
    for (let i = 0; i < 3; i++) {
      prongGroups[i].position.copy(t.prongStates[i].pos);
      prongGroups[i].quaternion.copy(t.prongStates[i].quat);
    }

    // 鋼索與黑色螺旋電線連接天車掛點與爪頭吊環
    deltaVec.copy(t.cableAnchorTop).sub(t.cableAnchorBottom);
    const len = Math.max(0.02, deltaVec.length());
    midVec.copy(t.cableAnchorTop).add(t.cableAnchorBottom).multiplyScalar(0.5);

    cableMesh.position.copy(midVec);
    cableMesh.scale.set(1, len, 1);
    cableMesh.quaternion.setFromUnitVectors(upVec, deltaVec.clone().normalize());

    coiledWireMesh.position.copy(midVec);
    coiledWireMesh.scale.set(1, len, 1);
    coiledWireMesh.quaternion.copy(cableMesh.quaternion);
  };

  return {
    group,
    trolleyGroup,
    crossBeamX,
    clawHeadGroup,
    plungerMesh,
    prongGroups,
    cableMesh,
    coiledWireMesh,
    updateFromTelemetry,
  };
}
