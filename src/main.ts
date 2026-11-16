import './styles.css'
import { parseRoute, type Route, type View } from './router'
import { createStorage } from './storage/storage'
import { editorView } from './ui/editor'
import { libraryView } from './ui/library'

const store = createStorage()

const placeholder =
  (name: string): View =>
  (root) => {
    root.textContent = name
  }

// Kopplingen mellan adress och vy. Senare uppgifter byter platshållarna här.
const views: Record<Route['view'], View> = {
  library: libraryView(store),
  edit: editorView(store),
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
