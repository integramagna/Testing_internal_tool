import { legTransform, mouthPath, sparkleMarkup } from './shared.js'

export const palette = {
  body: '#4fc3c0',
  bodyShade: '#3aa19e',
  pupil: '#12312f',
  clockFace: '#f5f0e6',
  clockRim: '#2b2b2b',
}

const eye = (expr) => {
  if (expr === 'sleepy') {
    return `<path d="M 38 46 Q 50 52 62 46" stroke="${palette.pupil}" stroke-width="2.6" fill="none" stroke-linecap="round" />`
  }

  const pupilOffsetY = expr === 'worried' ? 2 : 0
  const browAngry =
    expr === 'angry'
      ? '<path d="M 34 30 L 66 30" stroke="' +
        palette.pupil +
        '" stroke-width="2.4" stroke-linecap="round" />'
      : ''
  const browWorried =
    expr === 'worried'
      ? '<path d="M 34 32 Q 50 26 66 32" stroke="' +
        palette.pupil +
        '" stroke-width="2" fill="none" stroke-linecap="round" />'
      : ''

  return `
    ${browAngry}
    ${browWorried}
    <circle cx="50" cy="46" r="15" fill="#ffffff" stroke="${palette.pupil}" stroke-width="2.4" />
    <circle cx="50" cy="${46 + pupilOffsetY}" r="7" fill="${palette.pupil}" />
    <circle cx="52.5" cy="43" r="2" fill="#ffffff" />
  `
}

export const face = (expr) => `
  <g class="face">
    ${eye(expr)}
    <path d="${mouthPath(expr)}" stroke="${palette.pupil}" stroke-width="2.2" fill="none" stroke-linecap="round" />
    <circle cx="27" cy="58" r="4.5" fill="#ff9db0" opacity="0.5" />
    <circle cx="73" cy="58" r="4.5" fill="#ff9db0" opacity="0.5" />
  </g>
`

export const svgBuddy = (expr, phase) => {
  const legLeft = legTransform(phase, 'left')
  const legRight = legTransform(phase, 'right')
  const sparkles = expr === 'happy' ? sparkleMarkup() : ''

  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="pip-body" cx="38%" cy="26%" r="75%">
          <stop offset="0%" stop-color="#8fe3e0" />
          <stop offset="70%" stop-color="${palette.body}" />
          <stop offset="100%" stop-color="${palette.bodyShade}" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="96" rx="26" ry="4" fill="rgba(0,0,0,0.16)" />
      <g class="legs">
        <rect class="leg-left" x="33" y="80" width="11" height="16" rx="5.5" fill="${palette.bodyShade}" transform="${legLeft}" />
        <rect class="leg-right" x="56" y="80" width="11" height="16" rx="5.5" fill="${palette.bodyShade}" transform="${legRight}" />
      </g>
      <g class="arms">
        <rect x="10" y="54" width="10" height="20" rx="5" fill="url(#pip-body)" stroke="${palette.bodyShade}" stroke-width="1" transform="rotate(-6 15 60)" />
        <rect x="80" y="54" width="10" height="20" rx="5" fill="url(#pip-body)" stroke="${palette.bodyShade}" stroke-width="1" transform="rotate(6 85 60)" />
        <g transform="translate(78 62) rotate(-6)">
          <circle cx="8" cy="8" r="9" fill="${palette.clockFace}" stroke="${palette.clockRim}" stroke-width="1.4" />
          <line x1="8" y1="8" x2="8" y2="3" stroke="${palette.clockRim}" stroke-width="1.2" stroke-linecap="round" />
          <line x1="8" y1="8" x2="11.5" y2="9.5" stroke="${palette.clockRim}" stroke-width="1.2" stroke-linecap="round" />
        </g>
      </g>
      <rect x="18" y="22" width="64" height="64" rx="32" fill="url(#pip-body)" stroke="${palette.bodyShade}" stroke-width="1.5" />
      ${face(expr)}
      ${sparkles}
    </svg>
  `
}
