import { MachineProfile, PrizePlacement } from '../types/machine';

/**
 * 台灣夾娃娃店 6 台特色機台規格（皆具備獨立 Rapier 3D 物理世界與狀態保留）
 * - 1 號機：DL-G2-BASE（鼎莉二代原廠基準機，3C 彩盒標準台）
 * - 2 號機：DL-G2-THIN（薄盒捏薄＋二收技巧台）
 * - 3 號機：DL-G2-WEAK（透明公仔盒＋弱爪防甩片內丟台）
 * - 4 號機：DL-XXL-LONG（鼎莉巨無霸台，大盒長盒假槍位）
 * - 5 號機：FL-MINI-BLIND（飛絡力小型精品台，潮流盲盒台）
 * - 6 號機：DL-G2-STACK（雙層堆疊硬盒＋坐姿布偶展示台）
 *
 * 所有來自鼎莉/飛絡力原廠手冊或商品頁的數值標註為 manual / reference；
 * 尚未實機量測的物理參數均明確標註為 assumed（工程暫定值）。
 */

const baseStandardCabinet = {
  family: 'dingli_standard' as const,
  externalSize: {
    value: { width: 0.80, depth: 0.86, height: 1.91 },
    source: 'manual' as const,
    note: '鼎莉選物販賣機二代原廠手冊 800×860×1910 mm',
  },
  playAreaSize: {
    value: { width: 0.72, depth: 0.76, floorY: 0.78, railY: 1.64 },
    source: 'assumed' as const,
    note: '依 800×860 mm 外框扣除框架厚度推估之內部空間',
  },
  chuteOpening: {
    value: { width: 0.298, depth: 0.330, wallHeight: 0.44 },
    source: 'reference' as const,
    note: '參考飛絡力標準台洞口壓克力板 298×330 mm 尺寸',
  },
};

const baseStandardPhysics = {
  size: 'medium' as const,
  sleeveType: 'white_silicone' as const,
  clawHeadMass: { value: 0.42, source: 'assumed' as const },
  prongMass: { value: 0.065, source: 'assumed' as const },
  prongLength: { value: 0.145, source: 'assumed' as const },
  maxOpenSpread: { value: 0.205, source: 'assumed' as const },
  openAngleRad: 0.56,
  closedAngleRad: 0.03,
  sleeveFriction: { value: 0.92, source: 'assumed' as const, note: '白矽膠爪套與彩盒/PVC 之高抓地係數' },
  trolleyMaxSpeedScale: { value: 0.00205, source: 'assumed' as const, note: '控制值 170 對應約 0.35 m/s' },
  trolleyAcceleration: { value: 2.35, source: 'assumed' as const },
  trolleyBraking: { value: 4.8, source: 'assumed' as const, note: '急停煞車減速度，決定甩爪擺幅' },
  driveLatencySeconds: { value: 0.025, source: 'assumed' as const },
  winchDownSpeed: { value: 0.46, source: 'assumed' as const },
  winchUpSpeed: { value: 0.38, source: 'assumed' as const },
  minCableLength: { value: 0.14, source: 'assumed' as const },
  solenoidPeakTorquePerProng: { value: 0.85, source: 'assumed' as const, note: 'P=255 時單爪閉合扭矩 (N·m)，確保 P1/P2 確實舉升並在 P3 弱爪滑脫' },
  solenoidResistanceOhm: { value: 18.0, source: 'assumed' as const },
  solenoidInductanceH: { value: 1.45, source: 'assumed' as const },
  coiledWireYawStiffness: { value: 0.018, source: 'assumed' as const },
  coiledWireYawDamping: { value: 0.008, source: 'assumed' as const },
};

const machine1Prizes: PrizePlacement[] = [
  // 槍位斜靠擋板與洞口周邊（注意洞口在左前 x ∈ [-0.36, -0.062], z ∈ [0.05, 0.38]）
  { archetype: 'box_3c_earbuds', position: { x: 0.06, y: 0.03, z: 0.19 }, rotationEuler: { x: 0, y: 0.22, z: 0 } },
  { archetype: 'box_3c_fan', position: { x: 0.20, y: 0.035, z: 0.18 }, rotationEuler: { x: 0, y: -0.15, z: 0 } },
  { archetype: 'box_3c_shaver', position: { x: -0.19, y: 0.03, z: -0.08 }, rotationEuler: { x: 0, y: 0.35, z: 0 } },
  { archetype: 'box_3c_speaker', position: { x: 0.04, y: 0.058, z: -0.04 }, rotationEuler: { x: 0, y: 0.1, z: 0 } },
  { archetype: 'box_3c_earbuds', position: { x: 0.21, y: 0.03, z: -0.05 }, rotationEuler: { x: 0, y: -0.4, z: 0 } },
  { archetype: 'box_3c_fan', position: { x: -0.18, y: 0.035, z: -0.24 }, rotationEuler: { x: 0, y: 1.45, z: 0 } },
  { archetype: 'box_3c_speaker', position: { x: 0.02, y: 0.058, z: -0.23 }, rotationEuler: { x: 0, y: -0.25, z: 0 } },
  { archetype: 'box_3c_shaver', position: { x: 0.20, y: 0.03, z: -0.22 }, rotationEuler: { x: 0, y: 0.15, z: 0 } },
  // 疊在第二層的熱門 3C 盒
  { archetype: 'box_3c_earbuds', position: { x: 0.04, y: 0.14, z: -0.04 }, rotationEuler: { x: 0, y: -0.3, z: 0 } },
  { archetype: 'box_3c_fan', position: { x: 0.18, y: 0.095, z: 0.14 }, rotationEuler: { x: 0, y: 0.45, z: 0 } },
];

const machine2Prizes: PrizePlacement[] = [
  // 薄盒捏薄專場：斜靠與平放交錯
  { archetype: 'box_thin_collectible', position: { x: 0.02, y: 0.025, z: 0.18 }, rotationEuler: { x: 0, y: 0.12, z: 0 } },
  { archetype: 'box_thin_collectible', position: { x: 0.19, y: 0.025, z: 0.15 }, rotationEuler: { x: 0, y: -0.25, z: 0 } },
  { archetype: 'box_thin_collectible', position: { x: -0.18, y: 0.025, z: -0.11 }, rotationEuler: { x: 0, y: 0.55, z: 0 } },
  { archetype: 'box_thin_collectible', position: { x: 0.03, y: 0.025, z: -0.06 }, rotationEuler: { x: 0, y: -0.12, z: 0 } },
  { archetype: 'box_thin_collectible', position: { x: 0.20, y: 0.025, z: -0.10 }, rotationEuler: { x: 0, y: 0.35, z: 0 } },
  { archetype: 'box_3c_earbuds', position: { x: -0.16, y: 0.03, z: -0.25 }, rotationEuler: { x: 0, y: 0.1, z: 0 } },
  { archetype: 'box_thin_collectible', position: { x: 0.04, y: 0.025, z: -0.24 }, rotationEuler: { x: 0, y: 0.08, z: 0 } },
  // 二樓薄盒（壓在底盒上方便玩家翻盒）
  { archetype: 'box_thin_collectible', position: { x: 0.03, y: 0.068, z: 0.15 }, rotationEuler: { x: 0, y: -0.35, z: 0 } },
  { archetype: 'box_thin_collectible', position: { x: 0.04, y: 0.068, z: -0.05 }, rotationEuler: { x: 0, y: 0.42, z: 0 } },
  { archetype: 'box_3c_shaver', position: { x: 0.19, y: 0.072, z: -0.08 }, rotationEuler: { x: 0, y: -0.18, z: 0 } },
];

const machine3Prizes: PrizePlacement[] = [
  // 透明公仔盒：高盒、重心偏低、PVC 較滑，搭配弱爪＋防甩片
  { archetype: 'box_transparent_figure', position: { x: 0.04, y: 0.095, z: 0.18 }, rotationEuler: { x: 0, y: 0.18, z: 0 } },
  { archetype: 'box_transparent_figure', position: { x: 0.21, y: 0.095, z: 0.16 }, rotationEuler: { x: 0, y: -0.22, z: 0 } },
  { archetype: 'box_transparent_figure', position: { x: -0.19, y: 0.095, z: -0.10 }, rotationEuler: { x: 0, y: 0.3, z: 0 } },
  { archetype: 'box_transparent_figure', position: { x: 0.03, y: 0.095, z: -0.06 }, rotationEuler: { x: 0, y: -0.1, z: 0 } },
  { archetype: 'box_transparent_figure', position: { x: 0.21, y: 0.095, z: -0.08 }, rotationEuler: { x: 0, y: 0.25, z: 0 } },
  // 橫躺的透明盒（槍位好翻但容易打滑）
  { archetype: 'box_transparent_figure', position: { x: 0.06, y: 0.065, z: -0.24 }, rotationEuler: { x: 0, y: 0.4, z: Math.PI / 2 } },
  { archetype: 'box_3c_speaker', position: { x: -0.17, y: 0.058, z: -0.25 }, rotationEuler: { x: 0, y: -0.2, z: 0 } },
];

const machine4Prizes: PrizePlacement[] = [
  // 巨無霸長盒與大透明盒（play area 1.00 × 1.06 m，洞口在左前 x ∈ [-0.50, -0.115], z ∈ [0.13, 0.53]）
  { archetype: 'box_long_gadget', position: { x: 0.05, y: 0.055, z: 0.25 }, rotationEuler: { x: 0, y: 0.24, z: 0 } },
  { archetype: 'box_long_gadget', position: { x: 0.30, y: 0.055, z: 0.22 }, rotationEuler: { x: 0, y: 1.38, z: 0 } },
  { archetype: 'box_long_gadget', position: { x: -0.26, y: 0.055, z: -0.08 }, rotationEuler: { x: 0, y: -0.2, z: 0 } },
  { archetype: 'box_long_gadget', position: { x: 0.08, y: 0.055, z: -0.05 }, rotationEuler: { x: 0, y: 0.12, z: 0 } },
  { archetype: 'box_transparent_figure', position: { x: 0.32, y: 0.095, z: -0.08 }, rotationEuler: { x: 0, y: -0.35, z: 0 } },
  { archetype: 'box_long_gadget', position: { x: -0.22, y: 0.055, z: -0.30 }, rotationEuler: { x: 0, y: 0.32, z: 0 } },
  { archetype: 'box_long_gadget', position: { x: 0.14, y: 0.055, z: -0.30 }, rotationEuler: { x: 0, y: -0.15, z: 0 } },
  // 疊放長盒
  { archetype: 'box_long_gadget', position: { x: 0.08, y: 0.155, z: -0.04 }, rotationEuler: { x: 0, y: -0.28, z: 0 } },
];

const machine5Prizes: PrizePlacement[] = [
  // 飛絡力小型精品機（play area 0.45 × 0.52 m，洞口左前 x ∈ [-0.225, -0.030], z ∈ [0.045, 0.26]）
  { archetype: 'box_blindbox_mini', position: { x: 0.04, y: 0.052, z: 0.12 }, rotationEuler: { x: 0, y: 0.15, z: 0 } },
  { archetype: 'box_blindbox_mini', position: { x: 0.14, y: 0.052, z: 0.11 }, rotationEuler: { x: 0, y: -0.25, z: 0 } },
  { archetype: 'box_blindbox_mini', position: { x: -0.12, y: 0.052, z: -0.05 }, rotationEuler: { x: 0, y: 0.35, z: 0 } },
  { archetype: 'box_blindbox_mini', position: { x: 0.0, y: 0.052, z: -0.04 }, rotationEuler: { x: 0, y: -0.1, z: 0 } },
  { archetype: 'box_blindbox_mini', position: { x: 0.12, y: 0.052, z: -0.06 }, rotationEuler: { x: 0, y: 0.4, z: 0 } },
  { archetype: 'box_blindbox_mini', position: { x: -0.11, y: 0.052, z: -0.16 }, rotationEuler: { x: 0, y: -0.2, z: 0 } },
  { archetype: 'box_blindbox_mini', position: { x: 0.02, y: 0.052, z: -0.16 }, rotationEuler: { x: 0, y: 0.22, z: 0 } },
  { archetype: 'box_blindbox_mini', position: { x: 0.13, y: 0.052, z: -0.17 }, rotationEuler: { x: 0, y: -0.35, z: 0 } },
  // 第二層盲盒槍位
  { archetype: 'box_blindbox_mini', position: { x: 0.05, y: 0.152, z: -0.04 }, rotationEuler: { x: 0, y: 0.5, z: 0 } },
  { archetype: 'box_blindbox_mini', position: { x: 0.12, y: 0.152, z: 0.07 }, rotationEuler: { x: 0, y: -0.18, z: 0 } },
];

const machine6Prizes: PrizePlacement[] = [
  // 二樓槍位硬盒堆疊＋多關節坐姿布偶（展現布偶與硬盒混合台）
  { archetype: 'box_3c_speaker', position: { x: 0.03, y: 0.058, z: 0.19 }, rotationEuler: { x: 0, y: 0.08, z: 0 } },
  { archetype: 'box_3c_earbuds', position: { x: 0.03, y: 0.145, z: 0.18 }, rotationEuler: { x: 0, y: -0.22, z: 0 } },
  { archetype: 'box_3c_fan', position: { x: 0.20, y: 0.035, z: 0.16 }, rotationEuler: { x: 0, y: 0.3, z: 0 } },
  { archetype: 'box_3c_shaver', position: { x: 0.20, y: 0.095, z: 0.15 }, rotationEuler: { x: 0, y: -0.4, z: 0 } },
  { archetype: 'plush_sitting_bear', position: { x: -0.16, y: 0.11, z: -0.11 }, rotationEuler: { x: 0, y: 0.25, z: 0 } },
  { archetype: 'plush_round_duck', position: { x: 0.05, y: 0.09, z: -0.08 }, rotationEuler: { x: 0, y: -0.3, z: 0 } },
  { archetype: 'plush_sitting_bear', position: { x: 0.21, y: 0.11, z: -0.12 }, rotationEuler: { x: 0, y: -0.45, z: 0 } },
  { archetype: 'box_transparent_figure', position: { x: -0.17, y: 0.095, z: -0.26 }, rotationEuler: { x: 0, y: 0.15, z: 0 } },
  { archetype: 'box_3c_speaker', position: { x: 0.05, y: 0.058, z: -0.24 }, rotationEuler: { x: 0, y: -0.1, z: 0 } },
];

export const MACHINE_PROFILES: MachineProfile[] = [
  // 左排 1~3 號機（靠左牆面朝走道 +X）
  {
    id: 'DL-G2-BASE',
    displayName: '1 號機｜鼎莉二代 3C 彩盒標準台',
    shortTag: '原廠基準・3C 彩盒',
    description: '依鼎莉二代手冊原始參數設定（P1 255 / P2 200 / P3 45 / P4 45），白矽膠爪套配標準低擋板，體驗最道地的台灣標準台手感。',
    manufacturer: '鼎莉國際 (Ding Li)',
    referenceType: 'manual-based',
    shopPosition: { x: -2.05, y: 0, z: -1.75 },
    shopRotationY: Math.PI / 2,
    cabinet: {
      ...baseStandardCabinet,
      barrierHeight: { value: 0.072, source: 'assumed', note: '標準低擋板 7.2 cm' },
      antiSwingPlate: { enabled: true, side: 'chute_right', height: 0.14, width: 0.16 },
      themeColor: '#f5f6f8',
      accentColor: '#e63946',
      marqueeTitle: '熱門 3C 精品屋',
      marqueeSubtitle: '耳機・風扇・音箱・原廠標準台',
    },
    controller: {
      clawPower: {
        P1: { value: 255, source: 'manual', note: '原廠手冊初始值 255' },
        P2: { value: 200, source: 'manual', note: '原廠手冊初始值 200' },
        P3: { value: 45, source: 'manual', note: '原廠手冊初始值 45' },
        P4: { value: 45, source: 'manual', note: '原廠手冊初始值 45' },
      },
      motorSettings: {
        forward: { value: 130, source: 'manual' },
        backward: { value: 120, source: 'manual' },
        left: { value: 170, source: 'manual' },
        right: { value: 170, source: 'manual' },
        down: { value: 255, source: 'manual' },
        up: { value: 255, source: 'manual' },
      },
      bottomDwellSeconds: { value: 1.0, source: 'manual' },
      topDwellSeconds: { value: 0.7, source: 'manual' },
      descentMaxSeconds: { value: 3.5, source: 'manual' },
      midAirClawEnabled: true,
      midAirCloseDelaySeconds: 0.05,
      dropHeightLimit: 0.72,
    },
    physics: { ...baseStandardPhysics },
    prizes: machine1Prizes,
    game: {
      timeLimitEnabled: false,
      paymentRequired: false,
      attemptLimitEnabled: false,
      preservePrizeStates: true,
    },
  },
  {
    id: 'DL-G2-THIN',
    displayName: '2 號機｜薄盒改盒・二收捏薄技巧台',
    shortTag: '薄盒捏薄・二收專用',
    description: '高抓地黑爪套＋中高度擋板＋靈敏二收收爪，考驗精準點放二收與捏邊翻盒過擋板！',
    manufacturer: '鼎莉國際 (Ding Li)',
    referenceType: 'reference-adapted',
    shopPosition: { x: -2.05, y: 0, z: -0.45 },
    shopRotationY: Math.PI / 2,
    cabinet: {
      ...baseStandardCabinet,
      barrierHeight: { value: 0.095, source: 'assumed', note: '中高度壓克力擋板 9.5 cm' },
      antiSwingPlate: { enabled: true, side: 'chute_right', height: 0.16, width: 0.18 },
      themeColor: '#eef2ff',
      accentColor: '#ec4899',
      marqueeTitle: '薄盒挑戰・技術台',
      marqueeSubtitle: '支援空中二收・捏邊翻轉出貨',
    },
    controller: {
      clawPower: {
        P1: { value: 245, source: 'assumed' },
        P2: { value: 185, source: 'assumed' },
        P3: { value: 60, source: 'assumed' },
        P4: { value: 55, source: 'assumed' },
      },
      motorSettings: {
        forward: { value: 155, source: 'assumed' },
        backward: { value: 150, source: 'assumed' },
        left: { value: 185, source: 'assumed' },
        right: { value: 185, source: 'assumed' },
        down: { value: 255, source: 'manual' },
        up: { value: 255, source: 'manual' },
      },
      bottomDwellSeconds: { value: 0.85, source: 'assumed' },
      topDwellSeconds: { value: 0.55, source: 'assumed' },
      descentMaxSeconds: { value: 3.5, source: 'manual' },
      midAirClawEnabled: true,
      midAirCloseDelaySeconds: 0.03,
      dropHeightLimit: 0.72,
    },
    physics: {
      ...baseStandardPhysics,
      sleeveType: 'black_rubber',
      sleeveFriction: { value: 1.05, source: 'assumed', note: '高摩擦黑膠爪套' },
      trolleyBraking: { value: 5.5, source: 'assumed' },
    },
    prizes: machine2Prizes,
    game: {
      timeLimitEnabled: false,
      paymentRequired: false,
      attemptLimitEnabled: false,
      preservePrizeStates: true,
    },
  },
  {
    id: 'DL-G2-WEAK',
    displayName: '3 號機｜透明公仔盒・弱爪防甩內丟台',
    shortTag: '弱爪滑脫・透明盒',
    description: '透明 PVC 公仔展示盒表面滑順、重心偏低，加上雙側防甩片與弱爪 P2/P3 切換，必須善用翻滾與甩爪內丟。',
    manufacturer: '鼎莉國際 (Ding Li)',
    referenceType: 'reference-adapted',
    shopPosition: { x: -2.05, y: 0, z: 0.85 },
    shopRotationY: Math.PI / 2,
    cabinet: {
      ...baseStandardCabinet,
      barrierHeight: { value: 0.115, source: 'assumed', note: '加高擋板 11.5 cm' },
      antiSwingPlate: { enabled: true, side: 'both', height: 0.18, width: 0.20 },
      themeColor: '#fff8ed',
      accentColor: '#f59e0b',
      marqueeTitle: '精裝透明盒公仔',
      marqueeSubtitle: '雙防甩片・弱爪滑脫考驗技術',
    },
    controller: {
      clawPower: {
        P1: { value: 235, source: 'assumed' },
        P2: { value: 145, source: 'assumed', note: '上升弱爪，容易中途滑脫翻滾' },
        P3: { value: 32, source: 'assumed' },
        P4: { value: 32, source: 'assumed' },
      },
      motorSettings: {
        forward: { value: 145, source: 'assumed' },
        backward: { value: 140, source: 'assumed' },
        left: { value: 175, source: 'assumed' },
        right: { value: 175, source: 'assumed' },
        down: { value: 240, source: 'assumed' },
        up: { value: 245, source: 'assumed' },
      },
      bottomDwellSeconds: { value: 0.9, source: 'assumed' },
      topDwellSeconds: { value: 0.8, source: 'assumed' },
      descentMaxSeconds: { value: 3.5, source: 'manual' },
      midAirClawEnabled: true,
      midAirCloseDelaySeconds: 0.06,
      dropHeightLimit: 0.72,
    },
    physics: {
      ...baseStandardPhysics,
      sleeveType: 'worn_sleeve',
      sleeveFriction: { value: 0.76, source: 'assumed', note: '磨損爪套摩擦係數較低' },
      solenoidPeakTorquePerProng: { value: 0.62, source: 'assumed' },
    },
    prizes: machine3Prizes,
    game: {
      timeLimitEnabled: false,
      paymentRequired: false,
      attemptLimitEnabled: false,
      preservePrizeStates: true,
    },
  },

  // 右排 4~6 號機（靠右牆面朝走道 -X）
  {
    id: 'DL-XXL-LONG',
    displayName: '4 號機｜鼎莉巨無霸・大爪長盒家電台',
    shortTag: '巨無霸大爪・偏心長盒',
    description: '依鼎莉巨無霸 110×119×211 cm 與 385×400 mm 大洞口建構，配大爪與重心偏移長盒，考驗找重心與拖拉技巧。',
    manufacturer: '鼎莉國際 (Ding Li)',
    referenceType: 'reference-adapted',
    shopPosition: { x: 2.05, y: 0, z: -1.65 },
    shopRotationY: -Math.PI / 2,
    cabinet: {
      family: 'dingli_xxl',
      externalSize: {
        value: { width: 1.10, depth: 1.19, height: 2.11 },
        source: 'manual',
        note: '鼎莉巨無霸產品頁 110×119×211 cm',
      },
      playAreaSize: {
        value: { width: 1.00, depth: 1.06, floorY: 0.80, railY: 1.82 },
        source: 'assumed',
      },
      chuteOpening: {
        value: { width: 0.385, depth: 0.400, wallHeight: 0.46 },
        source: 'reference',
        note: '參考飛絡力巨無霸洞口壓克力板 385×400 mm',
      },
      barrierHeight: { value: 0.11, source: 'assumed' },
      antiSwingPlate: { enabled: true, side: 'chute_right', height: 0.20, width: 0.22 },
      themeColor: '#f1f5f9',
      accentColor: '#0284c7',
      marqueeTitle: '巨無霸・生活家電王',
      marqueeSubtitle: '大爪大洞口・長盒重心挑戰',
    },
    controller: {
      clawPower: {
        P1: { value: 255, source: 'manual' },
        P2: { value: 215, source: 'assumed' },
        P3: { value: 58, source: 'assumed' },
        P4: { value: 55, source: 'assumed' },
      },
      motorSettings: {
        forward: { value: 140, source: 'assumed' },
        backward: { value: 135, source: 'assumed' },
        left: { value: 165, source: 'assumed' },
        right: { value: 165, source: 'assumed' },
        down: { value: 255, source: 'manual' },
        up: { value: 245, source: 'assumed' },
      },
      bottomDwellSeconds: { value: 1.05, source: 'assumed' },
      topDwellSeconds: { value: 0.75, source: 'assumed' },
      descentMaxSeconds: { value: 4.0, source: 'assumed' },
      midAirClawEnabled: true,
      midAirCloseDelaySeconds: 0.05,
      dropHeightLimit: 0.86,
    },
    physics: {
      ...baseStandardPhysics,
      size: 'large',
      sleeveType: 'white_silicone',
      clawHeadMass: { value: 0.62, source: 'assumed' },
      prongMass: { value: 0.095, source: 'assumed' },
      prongLength: { value: 0.195, source: 'assumed' },
      maxOpenSpread: { value: 0.295, source: 'assumed' },
      solenoidPeakTorquePerProng: { value: 1.15, source: 'assumed' },
      minCableLength: { value: 0.16, source: 'assumed' },
    },
    prizes: machine4Prizes,
    game: {
      timeLimitEnabled: false,
      paymentRequired: false,
      attemptLimitEnabled: false,
      preservePrizeStates: true,
    },
  },
  {
    id: 'FL-MINI-BLIND',
    displayName: '5 號機｜飛絡力精品小台・潮流盲盒專區',
    shortTag: '精品小爪・潮流盲盒',
    description: '依飛絡力 F03R 精品機 510×610×1530 mm 尺寸打造，配高靈敏小爪與盲盒堆疊，適合快節奏精準夾取。',
    manufacturer: '飛絡力 (Feiloli)',
    referenceType: 'reference-adapted',
    shopPosition: { x: 2.05, y: 0, z: -0.25 },
    shopRotationY: -Math.PI / 2,
    cabinet: {
      family: 'feiloli_mini',
      externalSize: {
        value: { width: 0.51, depth: 0.61, height: 1.53 },
        source: 'manual',
        note: '飛絡力 F03R 原廠規格 510×610×1530 mm',
      },
      playAreaSize: {
        value: { width: 0.45, depth: 0.52, floorY: 0.72, railY: 1.32 },
        source: 'assumed',
      },
      chuteOpening: {
        value: { width: 0.195, depth: 0.215, wallHeight: 0.36 },
        source: 'assumed',
      },
      barrierHeight: { value: 0.055, source: 'assumed' },
      antiSwingPlate: { enabled: false, side: 'chute_right', height: 0.1, width: 0.1 },
      themeColor: '#fefce8',
      accentColor: '#7c3aed',
      marqueeTitle: 'MINI 精品盲盒機',
      marqueeSubtitle: '潮流公仔盲盒・精準小爪',
    },
    controller: {
      clawPower: {
        P1: { value: 250, source: 'assumed' },
        P2: { value: 205, source: 'assumed' },
        P3: { value: 75, source: 'assumed' },
        P4: { value: 70, source: 'assumed' },
      },
      motorSettings: {
        forward: { value: 130, source: 'assumed' },
        backward: { value: 130, source: 'assumed' },
        left: { value: 145, source: 'assumed' },
        right: { value: 145, source: 'assumed' },
        down: { value: 220, source: 'assumed' },
        up: { value: 220, source: 'assumed' },
      },
      bottomDwellSeconds: { value: 0.75, source: 'assumed' },
      topDwellSeconds: { value: 0.5, source: 'assumed' },
      descentMaxSeconds: { value: 3.0, source: 'assumed' },
      midAirClawEnabled: true,
      midAirCloseDelaySeconds: 0.04,
      dropHeightLimit: 0.48,
    },
    physics: {
      ...baseStandardPhysics,
      size: 'small',
      sleeveType: 'white_silicone',
      clawHeadMass: { value: 0.24, source: 'assumed' },
      prongMass: { value: 0.036, source: 'assumed' },
      prongLength: { value: 0.105, source: 'assumed' },
      maxOpenSpread: { value: 0.142, source: 'assumed' },
      trolleyMaxSpeedScale: { value: 0.00175, source: 'assumed' },
      winchDownSpeed: { value: 0.36, source: 'assumed' },
      winchUpSpeed: { value: 0.32, source: 'assumed' },
      minCableLength: { value: 0.10, source: 'assumed' },
      solenoidPeakTorquePerProng: { value: 0.38, source: 'assumed' },
    },
    prizes: machine5Prizes,
    game: {
      timeLimitEnabled: false,
      paymentRequired: false,
      attemptLimitEnabled: false,
      preservePrizeStates: true,
    },
  },
  {
    id: 'DL-G2-STACK',
    displayName: '6 號機｜二樓槍位・硬盒布偶綜合台',
    shortTag: '二樓槍位・混合堆疊',
    description: '前方 3C 彩盒二樓槍位配後方多關節縫線布偶，附前方低橫桿，一次體驗盒裝翻滾與布偶四肢受力！',
    manufacturer: '鼎莉國際 (Ding Li)',
    referenceType: 'reference-adapted',
    shopPosition: { x: 2.05, y: 0, z: 0.95 },
    shopRotationY: -Math.PI / 2,
    cabinet: {
      ...baseStandardCabinet,
      barrierHeight: { value: 0.082, source: 'assumed' },
      antiSwingPlate: { enabled: true, side: 'chute_right', height: 0.15, width: 0.16 },
      crossBar: {
        enabled: true,
        yOffsetFromFloor: 0.145,
        zLocal: 0.045,
        radius: 0.008,
      },
      themeColor: '#f0fdf4',
      accentColor: '#16a34a',
      marqueeTitle: '二樓槍位・綜合人氣台',
      marqueeSubtitle: '3C 盒裝＋縫線布偶・真實支撐堆疊',
    },
    controller: {
      clawPower: {
        P1: { value: 255, source: 'manual' },
        P2: { value: 210, source: 'assumed' },
        P3: { value: 65, source: 'assumed' },
        P4: { value: 60, source: 'assumed' },
      },
      motorSettings: {
        forward: { value: 140, source: 'assumed' },
        backward: { value: 135, source: 'assumed' },
        left: { value: 175, source: 'assumed' },
        right: { value: 175, source: 'assumed' },
        down: { value: 255, source: 'manual' },
        up: { value: 255, source: 'manual' },
      },
      bottomDwellSeconds: { value: 0.95, source: 'assumed' },
      topDwellSeconds: { value: 0.65, source: 'assumed' },
      descentMaxSeconds: { value: 3.5, source: 'manual' },
      midAirClawEnabled: true,
      midAirCloseDelaySeconds: 0.04,
      dropHeightLimit: 0.72,
    },
    physics: {
      ...baseStandardPhysics,
      sleeveType: 'white_silicone',
      solenoidPeakTorquePerProng: { value: 0.74, source: 'assumed' },
    },
    prizes: machine6Prizes,
    game: {
      timeLimitEnabled: false,
      paymentRequired: false,
      attemptLimitEnabled: false,
      preservePrizeStates: true,
    },
  },
];
