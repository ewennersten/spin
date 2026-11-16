export type Route = { view: 'library' } | { view: 'edit'; id: string } | { view: 'run'; id: string }

// Returvärdet är en städfunktion som main.ts anropar innan nästa vy monteras.
export type View = (root: HTMLElement, id?: string) => (() => void) | void

export function parseRoute(hash: string): Route {
  const m = /^#\/(edit|run)\/([^/]+)$/.exec(hash)
  return m ? { view: m[1] as 'edit' | 'run', id: m[2] } : { view: 'library' }
}
