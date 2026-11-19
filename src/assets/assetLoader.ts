import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * 預留外部 .glb 模型熱替換管線（符合 chat.md 規劃：視覺 Mesh 可替換為外部 GLB，
 * 物理剛體與碰撞仍由本系統獨立管控，互不干擾）。
 */
export class AssetLoader {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, THREE.Group>();

  public async tryLoadGlb(url: string): Promise<THREE.Group | null> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!.clone(true);
    }
    try {
      const gltf = await this.loader.loadAsync(url);
      this.cache.set(url, gltf.scene);
      return gltf.scene.clone(true);
    } catch {
      return null;
    }
  }
}

export const sharedAssetLoader = new AssetLoader();
