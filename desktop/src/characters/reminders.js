export const roleSlug = 'reminders'

const stickyNoteProp = (outlineColor) => `
  <g class="sticky-note" transform="rotate(-12 128 54)">
    <rect x="112" y="40" width="30" height="30" rx="3" fill="#fff0a6" stroke="${outlineColor}" stroke-width="2" />
    <line x1="118" y1="49" x2="136" y2="49" stroke="#e0a94a" stroke-width="2" />
    <line x1="118" y1="56" x2="136" y2="56" stroke="#e0a94a" stroke-width="2" />
    <line x1="118" y1="63" x2="130" y2="63" stroke="#e0a94a" stroke-width="2" />
  </g>
`

export const variant = {
  roleSlug,
  bodyColor: '#ff9e7d',
  bellyColor: '#ffd9c9',
  outlineColor: '#c85a3c',
  footColor: '#e87a55',
  cheekColor: '#ff7a9c',
  tuftColor: '#ffd166',
  prop: stickyNoteProp,
}
