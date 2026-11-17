// Fack i har mittfrekvensen i × sampleRate / fftSize. Värdena är 0 till 255 från getByteFrequencyData.
export function bandEnergy(freq: Uint8Array, sampleRate: number, fftSize: number, loHz: number, hiHz: number): number {
  let sum = 0
  let n = 0
  for (let i = 0; i < freq.length; i++) {
    const hz = (i * sampleRate) / fftSize
    if (hz >= loHz && hz < hiHz) { sum += freq[i]; n++ }
  }
  return n ? sum / n / 255 : 0
}
