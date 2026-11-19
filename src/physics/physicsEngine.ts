import RAPIER from '@dimforge/rapier3d-compat';

let initialized = false;

export const FIXED_DT = 1 / 120;

/**
 * Rapier 碰撞分組（高 16 位為自身群組，低 16 位為可碰撞對象遮罩）
 * - CABINET (0x0001): 機台壁、擋板、防甩片、橫桿
 * - CLAW_HEAD (0x0002): 爪頭本體（與機台壁、防甩片、獎品碰撞，不與爪腳互撞）
 * - CLAW_PRONG (0x0004): 三根爪腳（與機台壁、擋板、防甩片、獎品碰撞，不與爪頭或其他爪腳互撞）
 * - PRIZE (0x0008): 獎品本體（與全部實體碰撞）
 * - SENSOR (0x0010): 出貨口感應器（僅偵測獎品）
 */
export const COLLISION_GROUP = {
  CABINET: (0x0001 << 16) | 0x000e,
  CLAW_HEAD: (0x0002 << 16) | 0x0009,
  CLAW_PRONG: (0x0004 << 16) | 0x0009,
  PRIZE: (0x0008 << 16) | 0x001f,
  SENSOR: (0x0010 << 16) | 0x0008,
} as const;

export async function initRapier(): Promise<typeof RAPIER> {
  if (!initialized) {
    await RAPIER.init();
    initialized = true;
  }
  return RAPIER;
}

export function getRapier(): typeof RAPIER {
  if (!initialized) {
    throw new Error('Rapier has not been initialized. Call initRapier() first.');
  }
  return RAPIER;
}

export function createMachineWorld(): RAPIER.World {
  const rapier = getRapier();
  const world = new rapier.World({ x: 0, y: -9.81, z: 0 });
  world.integrationParameters.dt = FIXED_DT;
  world.integrationParameters.numSolverIterations = 8;
  world.integrationParameters.numAdditionalFrictionIterations = 6;
  world.integrationParameters.numInternalPgsIterations = 2;
  return world;
}

export { RAPIER };
