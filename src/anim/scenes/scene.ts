import type * as THREE from 'three'
import type { SceneInput } from '../types'

// En 3D-scen. Scenen (stage.ts) äger renderaren och efterbehandlingen; scenen äger bara sitt innehåll.
export interface Scene {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  update(input: SceneInput): void
  setParticles(fraction: number): void
  dispose(): void
}

export type SceneFactory = () => Scene
