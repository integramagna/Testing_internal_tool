import { eyeGroup, eyebrowPaths, legTransform, mouthPath, sparkleMarkup } from './shared.js'

export const palette = {
  body: '#ff8a3d',
  bodyShade: '#e46c1f',
  pupil: '#2b1400',
  envelope: '#fff6ec',
  envelopeEdge: '#d97a37',
}

export const face = (expr) => {
  const eyebrows = eyebrowPaths(expr)
    .map(({ d }) => `<path d="${d}" stroke="${palette.pupil}" stroke-width="2" fill="none" stroke-linecap="round" />`)
    .join('')

  return `
    <g class="face">
      ${eyeGroup(expr, 40, 48, palette.pupil, palette.pupil)}
      ${eyeGroup(expr, 60, 48, palette.pupil, palette.pupil)}
      ${eyebrows}
      <path d="${mouthPath(expr)}" stroke="${palette.pupil}" stroke-width="2.4" fill="none" stroke-linecap="round" />
      <circle cx="29" cy="59" r="4.5" fill="#ffe0b0" opacity="0.6" />
      <circle cx="71" cy="59" r="4.5" fill="#ffe0b0" opacity="0.6" />
    </g>
  `
}

export const svgBuddy = (expr, phase) => {
  const legLeft = legTransform(phase, 'left')
  const legRight = legTransform(phase, 'right')
  const sparkles = expr === 'happy' ? sparkleMarkup() : ''

  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bolt-body" cx="38%" cy="26%" r="75%">
          <stop offset="0%" stop-color="#ffb877" />
          <stop offset="70%" stop-color="${palette.body}" />
          <stop offset="100%" stop-color="${palette.bodyShade}" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="96" rx="26" ry="4" fill="rgba(0,0,0,0.16)" />
      <g class="legs">
        <rect class="leg-left" x="33" y="79" width="11" height="17" rx="5.5" fill="${palette.bodyShade}" transform="${legLeft}" />
        <rect class="leg-right" x="56" y="79" width="11" height="17" rx="5.5" fill="${palette.bodyShade}" transform="${legRight}" />
      </g>
      <g class="arms">
        <rect x="11" y="53" width="10" height="22" rx="5" fill="url(#bolt-body)" stroke="${palette.bodyShade}" stroke-width="1" transform="rotate(-10 16 59)" />
        <rect x="79" y="53" width="10" height="22" rx="5" fill="url(#bolt-body)" stroke="${palette.bodyShade}" stroke-width="1" transform="rotate(10 84 59)" />
        <g transform="translate(74 64) rotate(-4)">
          <rect x="0" y="0" width="18" height="13" rx="1.5" fill="${palette.envelope}" stroke="${palette.envelopeEdge}" stroke-width="1.2" />
          <path d="M0 1 L9 8 L18 1" fill="none" stroke="${palette.envelopeEdge}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <path d="M 44 12 L 50 22 L 56 12 L 60 24 L 40 24 Z" fill="${palette.bodyShade}" />
      <rect x="20" y="21" width="60" height="61" rx="24" fill="url(#bolt-body)" stroke="${palette.bodyShade}" stroke-width="1.5" />
      ${face(expr)}
      ${sparkles}
    </svg>
  `
}
