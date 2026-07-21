export const roleSlug = 'dispatch'

const paperPlaneProp = (outlineColor) => `
  <line x1="96" y1="46" x2="108" y2="46" stroke="#c3b9f7" stroke-width="3" stroke-linecap="round" />
  <line x1="90" y1="56" x2="100" y2="56" stroke="#c3b9f7" stroke-width="3" stroke-linecap="round" />
  <g class="plane">
    <path d="M118 40 L150 52 L124 60 L128 50 Z" fill="#ffffff" stroke="${outlineColor}" stroke-width="2" stroke-linejoin="round" />
    <line x1="124" y1="60" x2="128" y2="50" stroke="${outlineColor}" stroke-width="1.5" />
  </g>
`

export const variant = {
  roleSlug,
  bodyColor: '#a99bf5',
  bellyColor: '#ded7fb',
  outlineColor: '#6355c0',
  footColor: '#8b7ce8',
  cheekColor: '#ff9db1',
  tuftColor: '#ffd166',
  prop: paperPlaneProp,
}
