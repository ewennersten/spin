// Ljudbanden 0 till 1, utjämnade.
export interface Bands { bass: number; mid: number; treble: number }

// Det en scen läser varje bildruta. calmMix är calm utjämnad (0 intensivt, 1 lugnt); scenerna blandar med den.
// runIntensity är intensiteten samma procent har när passet går, null i vila (där är det lugnt även när passet går).
// Lugnt läge tar den som tak, så att en paus aldrig blir ljusare än passet.
export interface SceneInput { intensity: number; pulse: number; bands: Bands; color: string; calm: boolean; calmMix: number; runIntensity: number | null; timeSec: number; dtSec: number }
