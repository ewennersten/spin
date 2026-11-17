export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] =>
  Object.assign(document.createElement(tag), props)
export const link = (textContent: string, href: string) => el('a', { textContent, href, className: 'button' })

// Klubbens logga (röd skrivstil, görs vit i CSS) och de tre sportcirklarna, som bara syns mot svart.
export const logo = () => el('img', { src: '/triathlon-vast.webp', alt: 'Triathlon Väst', className: 'logo' })
export const sports = () => el('img', { src: '/sim-cykel-lop.png', alt: '', className: 'sports' })

// Sidhuvudet i tridräktens färger: rött som tonar via vinrött till svart. Menyn markerar fliken man står i.
export function clubHeader(title: string, current: 'pass' | 'pep'): HTMLElement {
  const tagline = el('p', { className: 'tagline' })
  tagline.append(sports(), 'sim.cykel.löp – sedan ’89')
  const tab = (text: string, href: string, id: typeof current) => {
    const a = el('a', { textContent: text, href })
    if (id === current) a.ariaCurrent = 'page'
    return a
  }
  const nav = el('nav', { className: 'tabs', ariaLabel: 'Meny' })
  nav.append(tab('Pass', '#/', 'pass'), tab('Peppord', '#/peppord', 'pep'))
  const header = el('header', { className: 'club' })
  header.append(logo(), el('h1', { textContent: title }), tagline, nav)
  return header
}

// Resultatet eller felet visas alltid som text, så att inget fel från lagringen försvinner tyst.
export async function attempt(status: HTMLElement, action: () => Promise<string | void>) {
  status.textContent = ''
  try {
    status.textContent = (await action()) || ''
  } catch (e) {
    status.textContent = message(e)
  }
}

// Webbläsarens eget fel när lagringen är full är på engelska.
export const message = (e: unknown) =>
  e instanceof DOMException && e.name === 'QuotaExceededError' ? 'Webbläsarens lagring är full, så ändringen sparades inte.'
    : e instanceof Error ? e.message : String(e)
