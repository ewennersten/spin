// Positionen räknas alltid ur väggklockan från en ankarpunkt, aldrig genom att summera bildrutor, så den kan inte driva.
export interface ClockState { running: boolean; anchorMs: number; posAtAnchorMs: number }

export const IDLE: ClockState = { running: false, anchorMs: 0, posAtAnchorMs: 0 }

export function position(s: ClockState, nowMs: number): number {
  return Math.max(0, s.running ? s.posAtAnchorMs + nowMs - s.anchorMs : s.posAtAnchorMs)
}

export function start(s: ClockState, nowMs: number): ClockState {
  return { running: true, anchorMs: nowMs, posAtAnchorMs: position(s, nowMs) }
}

export function pause(s: ClockState, nowMs: number): ClockState {
  return { running: false, anchorMs: nowMs, posAtAnchorMs: position(s, nowMs) }
}

export function seek(s: ClockState, posMs: number, nowMs: number): ClockState {
  return { running: s.running, anchorMs: nowMs, posAtAnchorMs: Math.max(0, posMs) }
}
