// Typsnittet följer med appen, så att det fungerar i salen utan internet.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/archivo/wdth-italic.css'
import '@fontsource-variable/tektur/wdth.css'
import './styles.css'
import { createClient } from '@supabase/supabase-js'
import { parseRoute, type Route, type View } from './router'
import { createCloudStorage, fail, type Live, supabaseLive, supabaseRows, uploadLocalOnce } from './storage/cloud'
import { createStorage, type Store } from './storage/storage'
import { el, message } from './ui/dom'
import { editorView } from './ui/editor'
import { followView } from './ui/follow'
import { type Account, libraryView, pepView } from './ui/library'
import { errorView, loginView, logoutButton, pendingView } from './ui/login'
import { runView } from './ui/run'

const root = document.querySelector<HTMLElement>('#app')!

// Följvyn kräver Supabase; utan det finns inget pass på en annan dator att följa.
const noFollow: View = root => { root.append(el('main', { className: 'follow', textContent: 'Följvyn kräver inloggning med Supabase.' })) }

function app(store: Store, account?: Account, live?: Live) {
  // Kopplingen mellan adress och vy.
  const views: Record<Route['view'], View> = {
    library: libraryView(store, account),
    pep: pepView(store),
    edit: editorView(store),
    run: runView(store),
    follow: live ? followView(store, live) : noFollow,
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

// Med Supabase inställt (VITE_SUPABASE_URL och VITE_SUPABASE_PUBLISHABLE_KEY) ligger passen i molnet och kräver
// ett godkänt konto. Utan dem ligger passen i webbläsaren, som i första versionen.
async function start(local: Store) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return app(local)
  const client = createClient(url, key)
  const { data: { session } } = await client.auth.getSession()
  if (!session) return loginView(root, client)
  const user = session.user
  try {
    const { data, error } = await client.from('profiles').select('approved').eq('id', user.id).maybeSingle()
    fail(error)
    if (!data?.approved) return pendingView(root, client, user.email ?? '')
    const rows = supabaseRows(client, user.id)
    await uploadLocalOnce(rows, local, user.id)
    const live = supabaseLive(client, user.id)
    const store = { ...createCloudStorage(rows, local), shareRun: live.share }
    app(store, { email: user.email ?? '', logout: logoutButton(client) }, live)
  } catch (e) {
    errorView(root, client, message(e))
  }
}

// Blockerar webbläsaren lokal lagring kastar createStorage, och då går inga pass att visa eller spara.
let store: Store | null = null
try { store = createStorage() } catch { /* store förblir null */ }
if (store) void start(store)
else {
  const main = el('main', { className: 'library' })
  main.append(el('p', { textContent: 'Webbläsaren tillåter inte att appen sparar något. Tillåt lagring för den här adressen och ladda om sidan.' }))
  root.append(main)
}
