// Typsnittet följer med appen, så att det fungerar i salen utan internet.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/archivo/wdth-italic.css'
import './styles.css'
import { parseRoute, type Route, type View } from './router'
import { createStorage, type Store } from './storage/storage'
import { el } from './ui/dom'
import { editorView } from './ui/editor'
import { libraryView, pepView } from './ui/library'
import { runView } from './ui/run'

const root = document.querySelector<HTMLElement>('#app')!

function app(store: Store) {
  // Kopplingen mellan adress och vy.
  const views: Record<Route['view'], View> = {
    library: libraryView(store),
    pep: pepView(store),
    edit: editorView(store),
    run: runView(store),
  }

  let cleanup: (() => void) | void

  function mount() {
    cleanup?.()
    root.replaceChildren()
    const route = parseRoute(location.hash)
    cleanup = views[route.view](root, 'id' in route ? route.id : undefined)
  }

  addEventListener('hashchange', mount)
  mount()
}

// Blockerar webbläsaren lokal lagring kastar createStorage, och då går inga pass att visa eller spara.
let store: Store | null = null
try { store = createStorage() } catch { /* store förblir null */ }
if (store) app(store)
else {
  const main = el('main', { className: 'library' })
  main.append(el('p', { textContent: 'Webbläsaren tillåter inte att appen sparar något. Tillåt lagring för den här adressen och ladda om sidan.' }))
  root.append(main)
}
