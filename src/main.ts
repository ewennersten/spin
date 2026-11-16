import './styles.css'
import { parseRoute, type Route, type View } from './router'

const placeholder =
  (name: string): View =>
  (root) => {
    root.textContent = name
  }

// Kopplingen mellan adress och vy. Senare uppgifter byter platshållarna här.
const views: Record<Route['view'], View> = {
  library: placeholder('Bibliotek'),
  edit: placeholder('Redigera pass'),
  run: placeholder('Kör pass'),
}

const root = document.querySelector<HTMLElement>('#app')!
let cleanup: (() => void) | void

function mount() {
  cleanup?.()
  root.replaceChildren()
  const route = parseRoute(location.hash)
  cleanup = views[route.view](root, 'id' in route ? route.id : undefined)
}

addEventListener('hashchange', mount)
mount()
