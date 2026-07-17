export const mouthPath = (expr) => {
  switch (expr) {
    case 'happy':
      return 'M 40 66 Q 50 76 60 66'
    case 'angry':
      return 'M 41 70 Q 50 63 59 70'
    case 'worried':
      return 'M 43 68 Q 50 65 57 68'
    case 'sleepy':
      return 'M 45 67 Q 50 70 55 67'
    default:
      return 'M 42 67 Q 50 70 58 67'
  }
}

export const eyebrowPaths = (expr) => {
  switch (expr) {
    case 'angry':
      return [
        { cx: 38, d: 'M 31 34 L 45 39' },
        { cx: 62, d: 'M 69 34 L 55 39' },
      ]
    case 'worried':
      return [
        { cx: 38, d: 'M 31 38 Q 38 32 45 37' },
        { cx: 62, d: 'M 55 37 Q 62 32 69 38' },
      ]
    default:
      return []
  }
}

export const legTransform = (phase, side) => {
  const lift = side === 'left' ? phase === 1 : phase === 2
  const translateY = lift ? -3 : 3
  const rotate = lift ? (side === 'left' ? -10 : 10) : side === 'left' ? 6 : -6
  return `translate(0 ${translateY}) rotate(${rotate} ${side === 'left' ? 38 : 62} 84)`
}

export const sparkleMarkup = () => `
  <g class="sparkle" transform="translate(20 24)">
    <path d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill="#fff59d" />
  </g>
  <g class="sparkle" transform="translate(80 30)">
    <path d="M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3 Z" fill="#fff59d" />
  </g>
`

export const eyeGroup = (expr, cx, cy, ringColor, pupilColor) => {
  if (expr === 'sleepy') {
    return `
      <g class="eye-group">
        <path d="M ${cx - 8} ${cy} Q ${cx} ${cy + 4} ${cx + 8} ${cy}" stroke="${ringColor}" stroke-width="2.4" fill="none" stroke-linecap="round" />
      </g>
    `
  }

  const pupilOffsetY = expr === 'worried' ? 1.5 : 0

  return `
    <g class="eye-group">
      <circle cx="${cx}" cy="${cy}" r="10.5" fill="#ffffff" stroke="${ringColor}" stroke-width="2.4" />
      <circle cx="${cx}" cy="${cy + pupilOffsetY}" r="4.6" fill="${pupilColor}" />
      <circle cx="${cx + 1.6}" cy="${cy - 1.6}" r="1.3" fill="#ffffff" />
    </g>
  `
}
