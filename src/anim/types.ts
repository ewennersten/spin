// Ljudbanden 0 till 1, utjämnade.
export interface Bands { bass: number; mid: number; treble: number }

// Det en scen läser varje bildruta. calmMix är calm utjämnad (0 intensivt, 1 lugnt); scenerna blandar med den.
// runIntensity är taket för lugnt läge (calmCap i drive.ts): intensiteten samma procent har när passet går,
// NO_CAP i vila, och utjämnat så att glöden inte rycker vid 60 %.
export interface SceneInput { intensity: number; pulse: number; bands: Bands; color: string; calm: boolean; calmMix: number; runIntensity: number; timeSec: number; dtSec: number }
