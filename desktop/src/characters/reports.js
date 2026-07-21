export const roleSlug = 'reports'

const capAndSatchelProp = () => `
  <path d="M46 66 L104 128" stroke="#b98a4a" stroke-width="8" stroke-linecap="round" />
  <rect x="96" y="120" width="22" height="18" rx="3" fill="#c99a58" stroke="#8a6a34" stroke-width="2" />
  <g class="cap-group">
    <ellipse cx="75" cy="56" rx="32" ry="8" fill="#e0b76a" stroke="#8a6a34" stroke-width="2" />
    <path d="M46 56 Q75 26 104 56 Z" fill="#efc978" stroke="#8a6a34" stroke-width="2" />
  </g>
`

export const variant = {
  roleSlug,
  bodyColor: '#6fd0ca',
  bellyColor: '#c3efeb',
  outlineColor: '#2b7d78',
  footColor: '#4bb8b1',
  cheekColor: '#ff9db1',
  tuftColor: '#ff9db1',
  prop: capAndSatchelProp,
}
