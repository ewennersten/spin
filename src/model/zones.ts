export interface Zone { id: 'vila' | 'lugnt' | 'tempo' | 'sweetspot' | 'troskel' | 'vo2max' | 'anaerob'; name: string; from: number; color: string; textColor: string }

// Stigande efter undre gräns; zoneFor förutsätter den ordningen.
export const ZONES: Zone[] = [
  { id: 'vila', name: 'Vila', from: 0, color: '#5F5E5A', textColor: '#D3D1C7' },
  { id: 'lugnt', name: 'Lugnt', from: 60, color: '#378ADD', textColor: '#85B7EB' },
  { id: 'tempo', name: 'Tempo', from: 76, color: '#1D9E75', textColor: '#5DCAA5' },
  { id: 'sweetspot', name: 'Sweetspot', from: 88, color: '#EF9F27', textColor: '#FAC775' },
  { id: 'troskel', name: 'Tröskel', from: 95, color: '#D85A30', textColor: '#F0997B' },
  { id: 'vo2max', name: 'VO2max', from: 106, color: '#E24B4A', textColor: '#F09595' },
  // Över VO2max, till exempel korta sprintar: mörkare rött, så att de skiljer sig från VO2max-intervallerna.
  { id: 'anaerob', name: 'Anaerob', from: 121, color: '#A3141F', textColor: '#F4A6AA' },
]

export function zoneFor(pct: number): Zone {
  return ZONES.reduce((zone, z) => (pct >= z.from ? z : zone))
}
