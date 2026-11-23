import type { SupabaseClient } from '@supabase/supabase-js'
import { fail } from '../storage/cloud'
import { attempt, el, logo } from './dom'

const page = (...children: (Node | string)[]) => {
  const main = el('main', { className: 'library login' })
  main.append(logo(), el('h2', { textContent: 'Torsdagsspinning' }), ...children)
  return main
}
const field = (label: string, input: HTMLInputElement) => {
  const l = el('label')
  l.append(label, input)
  return l
}

// Supabases egna fel vid inloggning är på engelska; de vanligaste får svensk text.
function authFail(e: { message: string; code?: string } | null): void {
  if (!e) return
  if (e.code === 'invalid_credentials') throw new Error('Fel e-post eller lösenord.')
  if (e.code === 'email_not_confirmed') throw new Error('Bekräfta e-postadressen via länken i mejlet först.')
  if (e.code === 'user_already_exists') throw new Error('Det finns redan ett konto med den e-postadressen. Logga in i stället.')
  if (e.code === 'weak_password') throw new Error('Lösenordet är för svagt. Välj minst 8 tecken.')
  if (e.code === 'over_email_send_rate_limit') throw new Error('För många mejl har skickats just nu. Försök igen om en stund.')
  fail(e)
}

// Inloggning och registrering. Efter lyckad inloggning laddas sidan om, så att appen startar med kontot.
export function loginView(root: HTMLElement, client: SupabaseClient): void {
  const email = el('input', { type: 'email', autocomplete: 'username', required: true })
  const password = el('input', { type: 'password', autocomplete: 'current-password', required: true, minLength: 8 })
  const status = el('p', { className: 'status', role: 'status' })
  const form = el('form')
  const signUp = el('button', { type: 'button', textContent: 'Skapa konto' })
  const buttons = el('div')
  buttons.append(el('button', { type: 'submit', textContent: 'Logga in', className: 'primary' }), signUp)
  form.append(field('E-post', email), field('Lösenord', password), buttons)
  form.onsubmit = e => {
    e.preventDefault()
    void attempt(status, async () => {
      const { error } = await client.auth.signInWithPassword({ email: email.value, password: password.value })
      authFail(error)
      location.reload()
    })
  }
  signUp.onclick = () => {
    if (!form.reportValidity()) return
    void attempt(status, async () => {
      const { data, error } = await client.auth.signUp({ email: email.value, password: password.value, options: { emailRedirectTo: location.origin } })
      authFail(error)
      if (data.session) { location.reload(); return }
      return 'Kontot är skapat. Bekräfta e-postadressen via länken i mejlet, och logga sedan in här.'
    })
  }
  root.append(page(form, status))
}

// Kontot finns men är inte godkänt än. Elias godkänner i Supabase (tabellen profiles, kolumnen approved).
export function pendingView(root: HTMLElement, client: SupabaseClient, email: string): void {
  root.append(page(
    el('p', { textContent: `Kontot ${email} väntar på att bli godkänt. Ladda om sidan när det är klart.` }),
    logoutButton(client),
  ))
}

// Visas när servern inte går att nå vid start, så att man inte möts av en tom sida i salen.
export function errorView(root: HTMLElement, client: SupabaseClient, text: string): void {
  root.append(page(el('p', { textContent: text }), el('button', { textContent: 'Försök igen', onclick: () => location.reload() }), logoutButton(client)))
}

export function logoutButton(client: SupabaseClient): HTMLButtonElement {
  return el('button', {
    textContent: 'Logga ut',
    onclick: async () => {
      // Utloggningen gäller den här datorn även om servern inte svarar.
      await client.auth.signOut({ scope: 'local' })
      location.hash = '#/'
      location.reload()
    },
  })
}
