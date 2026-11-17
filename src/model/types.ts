export interface Block { kind: 'block'; id: string; name: string; durationSec: number; fromPct: number; toPct: number }
export interface Group { kind: 'group'; id: string; repeat: number; blocks: Block[] }
export type Item = Block | Group
export interface Workout { id: string; name: string; items: Item[]; updatedAt: number }
export interface Segment { name: string; startSec: number; durationSec: number; fromPct: number; toPct: number }
// leadMs: hur långt före det förutsagda slaget pulsen visas, för fördröjningen i ljudfångst och skärm.
export interface MicSettings { sensitivity: number; bassLoHz: number; bassHiHz: number; leadMs: number }
