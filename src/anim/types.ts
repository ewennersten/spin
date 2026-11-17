// Ljudbanden 0 till 1, utjämnade.
export interface Bands { bass: number; mid: number; treble: number }

// Det en scen läser varje bildruta.
export interface SceneInput { intensity: number; pulse: number; bands: Bands; color: string; calm: boolean; timeSec: number; dtSec: number }
