import { eyeGroup, eyebrowPaths, legTransform, mouthPath, sparkleMarkup } from './shared.js'

export const palette = {
  body: '#ffd23f',
  bodyShade: '#f4b400',
  overalls: '#3a6ea5',
  overallsShade: '#2f5989',
  goggleRing: '#2b2b2b',
  pupil: '#1a1a1a',
  hair: '#2b2b2b',
}

export const face = (expr) => {
  const eyebrows = eyebrowPaths(expr)
    .map(({ d }) => `<path d="${d}" stroke="${palette.pupil}" stroke-width="2" fill="none" stroke-linecap="round" />`)
    .join('')

  return `
    <g class="face">
      ${eyeGroup(expr, 38, 47, 'url(#nimbus-goggle)', palette.pupil)}
      ${eyeGroup(expr, 62, 47, 'url(#nimbus-goggle)', palette.pupil)}
      <circle cx="33" cy="42" r="1.6" fill="#ffffff" opacity="0.8" />
      <circle cx="57" cy="42" r="1.6" fill="#ffffff" opacity="0.8" />
      <path d="M 30 39 Q 50 30 70 39" stroke="${palette.goggleRing}" stroke-width="2" fill="none" stroke-linecap="round" />
      ${eyebrows}
      <path d="${mouthPath(expr)}" stroke="${palette.pupil}" stroke-width="2.4" fill="none" stroke-linecap="round" />
      <circle cx="29" cy="58" r="4.5" fill="#ff9db0" opacity="0.5" />
      <circle cx="71" cy="58" r="4.5" fill="#ff9db0" opacity="0.5" />
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
        <radialGradient id="nimbus-body" cx="38%" cy="26%" r="75%">
          <stop offset="0%" stop-color="#ffe873" />
          <stop offset="70%" stop-color="${palette.body}" />
          <stop offset="100%" stop-color="${palette.bodyShade}" />
        </radialGradient>
        <linearGradient id="nimbus-overalls" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${palette.overalls}" />
          <stop offset="100%" stop-color="${palette.overallsShade}" />
        </linearGradient>
        <radialGradient id="nimbus-goggle" cx="35%" cy="28%" r="70%">
          <stop offset="0%" stop-color="#f4f6f7" />
          <stop offset="55%" stop-color="#c3cad1" />
          <stop offset="100%" stop-color="#8b939b" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="96" rx="26" ry="4" fill="rgba(0,0,0,0.16)" />
      <g class="legs">
        <rect class="leg-left" x="32" y="78" width="12" height="18" rx="6" fill="${palette.bodyShade}" transform="${legLeft}" />
        <rect class="leg-right" x="56" y="78" width="12" height="18" rx="6" fill="${palette.bodyShade}" transform="${legRight}" />
      </g>
      <g class="arms">
        <rect x="12" y="52" width="11" height="24" rx="5.5" fill="url(#nimbus-body)" stroke="${palette.bodyShade}" stroke-width="1" transform="rotate(-8 17 58)" />
        <rect x="77" y="52" width="11" height="24" rx="5.5" fill="url(#nimbus-body)" stroke="${palette.bodyShade}" stroke-width="1" transform="rotate(10 82 58)" />
        <g transform="translate(80 66) rotate(8)">
          <rect x="0" y="0" width="14" height="18" rx="2" fill="#f5f0e6" stroke="#c9c2b2" stroke-width="1" />
          <line x1="3" y1="5" x2="11" y2="5" stroke="#c9c2b2" stroke-width="1.2" />
          <line x1="3" y1="9" x2="11" y2="9" stroke="#c9c2b2" stroke-width="1.2" />
          <line x1="3" y1="13" x2="11" y2="13" stroke="#c9c2b2" stroke-width="1.2" />
        </g>
      </g>
      <rect x="20" y="20" width="60" height="62" rx="26" fill="url(#nimbus-body)" stroke="${palette.bodyShade}" stroke-width="1.5" />
      <path d="M 32 58 L 32 82 Q 32 86 36 86 L 64 86 Q 68 86 68 82 L 68 58 Z" fill="url(#nimbus-overalls)" />
      <path d="M 34 58 L 30 40 L 38 40 L 40 58 Z" fill="url(#nimbus-overalls)" />
      <path d="M 66 58 L 70 40 L 62 40 L 60 58 Z" fill="url(#nimbus-overalls)" />
      <circle cx="40" cy="70" r="2" fill="${palette.overallsShade}" />
      <circle cx="60" cy="70" r="2" fill="${palette.overallsShade}" />
      <path d="M 26 22 Q 24 12 32 15 M 38 19 Q 39 10 47 14 M 55 19 Q 58 10 65 15 M 70 22 Q 74 13 78 18"
        fill="none" stroke="${palette.hair}" stroke-width="2.6" stroke-linecap="round" />
      ${face(expr)}
      ${sparkles}
    </svg>
  `
}
