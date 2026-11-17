// Fack i har mittfrekvensen i × sampleRate / fftSize. Värdena är decibel från getFloatFrequencyData, och de räknas
// om till linjär amplitud innan medelvärdet tas, så att detektorns kvot mot medelvärdet följer ljudnivån.
// −Infinity (inget ljud) blir 0.
export function bandLevel(db: Float32Array, sampleRate: number, fftSize: number, loHz: number, hiHz: number): number {
  let sum = 0
  let n = 0
  for (let i = 0; i < db.length; i++) {
    const hz = (i * sampleRate) / fftSize
    if (hz >= loHz && hz < hiHz) { sum += 10 ** (db[i] / 20); n++ }
  }
  return n ? sum / n : 0
}
