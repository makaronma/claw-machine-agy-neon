export type ParameterSource = 'manual' | 'reference' | 'assumed';

export interface SourcedValue<T> {
  value: T;
  source: ParameterSource;
  note?: string;
}

export type CabinetFamily = 'dingli_standard' | 'dingli_xxl' | 'feiloli_mini';
export type ClawSize = 'small' | 'medium' | 'large';
export type ClawSleeveType = 'white_silicone' | 'black_rubber' | 'bare_metal' | 'worn_sleeve';

export type MachinePhase =
  | 'AIM'
  | 'DESCENT'
  | 'BOTTOM_DWELL'
  | 'LIFT'
  | 'TOP_DWELL'
  | 'RETURN'
  | 'RELEASE'
  | 'SETTLE';

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface CabinetSpec {
  family: CabinetFamily;
  externalSize: SourcedValue<{ width: number; depth: number; height: number }>;
  playAreaSize: SourcedValue<{ width: number; depth: number; floorY: number; railY: number }>;
  chuteOpening: SourcedValue<{ width: number; depth: number; wallHeight: number }>;
  barrierHeight: SourcedValue<number>;
  antiSwingPlate: {
    enabled: boolean;
    side: 'chute_right' | 'chute_back' | 'both';
    height: number;
    width: number;
  };
  crossBar?: {
    enabled: boolean;
    yOffsetFromFloor: number;
    zLocal: number;
    radius: number;
  };
  themeColor: string;
  accentColor: string;
  marqueeTitle: string;
  marqueeSubtitle: string;
}

export interface ControllerSpec {
  clawPower: {
    P1: SourcedValue<number>; // 0..255 bottom grab
    P2: SourcedValue<number>; // 0..255 lift
    P3: SourcedValue<number>; // 0..255 top dwell
    P4: SourcedValue<number>; // 0..255 return to chute
  };
  motorSettings: {
    forward: SourcedValue<number>;
    backward: SourcedValue<number>;
    left: SourcedValue<number>;
    right: SourcedValue<number>;
    down: SourcedValue<number>;
    up: SourcedValue<number>;
  };
  bottomDwellSeconds: SourcedValue<number>; // T1
  topDwellSeconds: SourcedValue<number>; // T3
  descentMaxSeconds: SourcedValue<number>;
  midAirClawEnabled: boolean; // 二收
  midAirCloseDelaySeconds: number;
  dropHeightLimit: number; // max cable length in meters
}

export interface ClawPhysicsSpec {
  size: ClawSize;
  sleeveType: ClawSleeveType;
  clawHeadMass: SourcedValue<number>; // kg
  prongMass: SourcedValue<number>; // kg per prong
  prongLength: SourcedValue<number>; // m
  maxOpenSpread: SourcedValue<number>; // m tip-to-tip diameter when open
  openAngleRad: number;
  closedAngleRad: number;
  sleeveFriction: SourcedValue<number>;
  trolleyMaxSpeedScale: SourcedValue<number>; // converts controller 0..255 to m/s
  trolleyAcceleration: SourcedValue<number>; // m/s^2
  trolleyBraking: SourcedValue<number>; // m/s^2
  driveLatencySeconds: SourcedValue<number>; // s
  winchDownSpeed: SourcedValue<number>; // m/s at 255
  winchUpSpeed: SourcedValue<number>; // m/s at 255
  minCableLength: SourcedValue<number>; // m
  solenoidPeakTorquePerProng: SourcedValue<number>; // N·m at P=255
  solenoidResistanceOhm: SourcedValue<number>;
  solenoidInductanceH: SourcedValue<number>;
  coiledWireYawStiffness: SourcedValue<number>;
  coiledWireYawDamping: SourcedValue<number>;
}

export type PrizeArchetype =
  | 'box_3c_earbuds'
  | 'box_3c_fan'
  | 'box_3c_speaker'
  | 'box_3c_shaver'
  | 'box_transparent_figure'
  | 'box_thin_collectible'
  | 'box_long_gadget'
  | 'box_blindbox_mini'
  | 'plush_sitting_bear'
  | 'plush_round_duck';

export interface PrizePlacement {
  archetype: PrizeArchetype;
  position: Vec3Tuple; // local to play area floor center (x, y above playFloorY, z)
  rotationEuler?: Vec3Tuple;
  variantSeed?: number;
}

export interface MachineProfile {
  id: string;
  displayName: string;
  shortTag: string;
  description: string;
  manufacturer: string;
  referenceType: 'manual-based' | 'reference-adapted';
  shopPosition: Vec3Tuple;
  shopRotationY: number;
  cabinet: CabinetSpec;
  controller: ControllerSpec;
  physics: ClawPhysicsSpec;
  prizes: PrizePlacement[];
  game: {
    timeLimitEnabled: false;
    paymentRequired: false;
    attemptLimitEnabled: false;
    preservePrizeStates: true;
  };
}

export interface PrizeCatalogItem {
  archetype: PrizeArchetype;
  displayName: string;
  category: '3c' | 'transparent' | 'thin' | 'long' | 'blindbox' | 'plush';
  dimensions: { width: number; height: number; depth: number }; // meters
  massKg: number;
  comOffset: Vec3Tuple; // center-of-mass offset in local meters (real asymmetric weight!)
  friction: number;
  restitution: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  labelTitle: string;
  labelSub: string;
  badgeText: string;
  hasWindow?: boolean;
  isTransparentShell?: boolean;
  isArticulatedPlush?: boolean;
  glbPath?: string; // future hot-swap .glb asset path
}

export type AppMode = 'SHOP_WALK' | 'TRANSITION_IN' | 'MACHINE_PLAY' | 'TRANSITION_OUT';
