// Plattorna bakom texten under passet: --natt (#170a0c) med 92 % täckning (#170a0ceb i styles.css).
export const PLATE = '#170a0c'
export const PLATE_ALPHA = 0.92

const channels = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = ([r, g, b]: number[]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)

// Kontrast enligt WCAG 2 mellan texten och plattan när det bakom plattan är helvitt, det sämsta läget.
// Plattan blandas med vitt i sRGB, som webbläsaren gör.
export function contrastOnPlate(textHex: string, plateAlpha: number): number {
  const plate = channels(PLATE).map(c => plateAlpha * c + (1 - plateAlpha))
  const [hi, lo] = [luminance(channels(textHex)), luminance(plate)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}
