// Ljudbanden 0 till 1, utjämnade.
export interface Bands { bass: number; mid: number; treble: number }

// Det en scen läser varje bildruta. calmMix är calm utjämnad (0 intensivt, 1 lugnt); scenerna blandar med den.
export interface SceneInput { intensity: number; pulse: number; bands: Bands; color: string; calm: boolean; calmMix: number; timeSec: number; dtSec: number }
