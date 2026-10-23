import pkg from '../../package.json'

// Everything shown in Settings → About. Edit the values here — no JSX to touch.
// Each pill is one line: icon + label, then an optional muted `value` and/or a
// `badge`. A pill with a `url` is tappable; one without is a plain badge.
export const APP_INFO = {
  pills: [
    { id: 'channel', icon: 'about-channel', label: 'Channel', url: 'https://t.me/ParadoxBackup' },
    { id: 'developer', icon: 'about-developer', label: 'Developer', value: '𝗣𝗔𝗥𝗔𝗗𝗢𝗫 🇮🇳', url: 'https://t.me/ReligiousKid' },
    { id: 'bot', icon: 'about-bot', label: 'Bot', value: 'Channel Rich Bot', url: 'https://t.me/TgRichBot' },
    { id: 'version', icon: 'about-version', label: 'Version', value: `v${pkg.version}`, badge: 'Beta' }
  ]
}
