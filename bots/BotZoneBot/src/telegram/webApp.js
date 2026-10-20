// Thin, defensive wrapper around window.Telegram.WebApp so the rest of the
// app never has to null-check the SDK itself. Falls back to no-ops when
// opened outside Telegram (e.g. `vite dev` in a plain browser) so you can
// still work on layout without a real Telegram client.

export function getWebApp() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp ?? null : null
}

/** Call once on app mount. */
export function initWebApp() {
  const tg = getWebApp()
  if (!tg) return null
  tg.ready()
  tg.expand()
  tg.disableVerticalSwipes?.()
  tg.setHeaderColor?.('bg_color')
  tg.setBackgroundColor?.('bg_color')
  tg.enableClosingConfirmation?.()
  return tg
}

export function getInitData() {
  return getWebApp()?.initData || ''
}

export function getTelegramUser() {
  return getWebApp()?.initDataUnsafe?.user || null
}

// ---- Haptics -------------------------------------------------------------
const IMPACT_STYLES = new Set(['light', 'medium', 'heavy', 'rigid', 'soft'])
const NOTIFICATION_TYPES = new Set(['error', 'success', 'warning'])

export function haptic(kind = 'light') {
  const h = getWebApp()?.HapticFeedback
  if (!h) return
  if (IMPACT_STYLES.has(kind)) h.impactOccurred(kind)
  else if (NOTIFICATION_TYPES.has(kind)) h.notificationOccurred(kind)
  else h.selectionChanged?.()
}

// ---- MainButton -----------------------------------------------------------
export function configureMainButton({ onClick } = {}) {
  const button = getWebApp()?.MainButton
  if (!button) return () => {}
  button.onClick(onClick)
  return () => button.offClick(onClick)
}

export function setMainButton({ visible, text, active = true, progress = false } = {}) {
  const button = getWebApp()?.MainButton
  if (!button) return
  if (text) button.setText(text)
  progress ? button.showProgress(false) : button.hideProgress()
  active ? button.enable() : button.disable()
  visible ? button.show() : button.hide()
}

// ---- SettingsButton ---------------------------------------------------
export function configureSettingsButton({ onClick } = {}) {
  const button = getWebApp()?.SettingsButton
  if (!button) return () => {}
  button.show()
  button.onClick(onClick)
  return () => button.offClick(onClick)
}

// ---- BackButton -------------------------------------------------------
export function configureBackButton({ onClick } = {}) {
  const button = getWebApp()?.BackButton
  if (!button) return () => {}
  button.onClick(onClick)
  return () => button.offClick(onClick)
}

export function setBackButtonVisible(visible) {
  const button = getWebApp()?.BackButton
  if (!button) return
  visible ? button.show() : button.hide()
}

// ---- Popups -------------------------------------------------------------
export function showAlert(message) {
  const tg = getWebApp()
  return new Promise((resolve) => {
    if (tg?.showAlert) tg.showAlert(message, () => resolve())
    else {
      window.alert(message)
      resolve()
    }
  })
}

export function showConfirm(message) {
  const tg = getWebApp()
  return new Promise((resolve) => {
    if (tg?.showConfirm) tg.showConfirm(message, (ok) => resolve(ok))
    else resolve(window.confirm(message))
  })
}

/**
 * Native popup with up to 3 buttons (Bot API 6.2+). Pass buttons with a
 * `type` of 'destructive' for Telegram's own red/destructive styling — the
 * native popup isn't part of our DOM, so it always matches the client's
 * theme automatically; there's no CSS variable to set on our side.
 * Resolves the pressed button's `id` ("" if it had none), or null if the
 * popup was dismissed without a button press.
 * buttons: Array<{ id?: string, type?: 'default'|'ok'|'close'|'cancel'|'destructive', text?: string }>
 */
export function showPopup({ title, message, buttons }) {
  const tg = getWebApp()
  return new Promise((resolve) => {
    if (tg?.showPopup) {
      tg.showPopup({ title, message, buttons }, (id) => resolve(id ?? null))
    } else {
      resolve(window.confirm(message) ? buttons?.[0]?.id ?? 'ok' : null)
    }
  })
}

// ---- Native gallery picker (Bot API 7.7+) --------------------------------
/** Returns a File the user picked from their gallery, or null if unsupported/cancelled. */
export function pickPhotoNative() {
  return null // no direct native "return bytes to JS" API yet — see MediaBlock.jsx for the <input type="file"> fallback we use instead.
}

// ---- Theme --------------------------------------------------------------
export function getThemeParams() {
  return getWebApp()?.themeParams || {}
}

export function getColorScheme() {
  return getWebApp()?.colorScheme || 'light'
}
