export const PUPIL_COLOR = '#223247'
export const SPARKLE_COLOR = '#ffd166'
export const TEARDROP_COLOR = '#8fd0ff'

export const EXPRESSIONS = ['happy', 'wave', 'thinking', 'celebrate', 'concerned', 'sleepy']

export const legTransform = (phase, side) => {
  const lift = side === 'left' ? phase === 1 : phase === 2
  const translateY = lift ? -4 : 4
  const rotate = lift ? (side === 'left' ? -8 : 8) : side === 'left' ? 5 : -5
  const pivotX = side === 'left' ? 58 : 92
  return `translate(0 ${translateY}) rotate(${rotate} ${pivotX} 150)`
}

const armPair = (bodyColor, outlineColor, left, right) => `
  ${left.wrap ? `<g transform="${left.wrap}">` : ''}
  <ellipse cx="${left.cx}" cy="${left.cy}" rx="11" ry="16" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="3" />
  ${left.wrap ? '</g>' : ''}
  ${right.wrap ? `<g transform="${right.wrap}">` : ''}
  <ellipse cx="${right.cx}" cy="${right.cy}" rx="11" ry="16" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="3" />
  ${right.wrap ? '</g>' : ''}
`

export const armsMarkup = (expr, bodyColor, outlineColor) => {
  switch (expr) {
    case 'wave':
      return armPair(
        bodyColor,
        outlineColor,
        { cx: 26, cy: 112 },
        { cx: 128, cy: 70, wrap: 'rotate(25 124 96)' },
      )
    case 'thinking':
      return armPair(bodyColor, outlineColor, { cx: 26, cy: 108 }, { cx: 112, cy: 120 })
    case 'celebrate':
      return armPair(
        bodyColor,
        outlineColor,
        { cx: 22, cy: 72, wrap: 'rotate(-30 26 96)' },
        { cx: 128, cy: 72, wrap: 'rotate(30 124 96)' },
      )
    case 'concerned':
      return armPair(bodyColor, outlineColor, { cx: 26, cy: 110 }, { cx: 124, cy: 110 })
    case 'sleepy':
      return armPair(bodyColor, outlineColor, { cx: 26, cy: 112 }, { cx: 124, cy: 112 })
    default:
      return armPair(bodyColor, outlineColor, { cx: 26, cy: 108 }, { cx: 124, cy: 108 })
  }
}

const openEyes = (outlineColor, cy, pupilCy, hlCy) => `
  <g class="eye-group">
    <ellipse cx="58" cy="${cy}" rx="14" ry="17" fill="#ffffff" stroke="${outlineColor}" stroke-width="2" />
    <circle cx="58" cy="${pupilCy}" r="7" fill="${PUPIL_COLOR}" />
    <circle cx="61" cy="${hlCy}" r="2.5" fill="#ffffff" />
  </g>
  <g class="eye-group">
    <ellipse cx="92" cy="${cy}" rx="14" ry="17" fill="#ffffff" stroke="${outlineColor}" stroke-width="2" />
    <circle cx="92" cy="${pupilCy}" r="7" fill="${PUPIL_COLOR}" />
    <circle cx="95" cy="${hlCy}" r="2.5" fill="#ffffff" />
  </g>
`

export const eyesMarkup = (expr, outlineColor) => {
  if (expr === 'sleepy') {
    return `
      <path d="M46 90 Q58 96 70 90" stroke="${outlineColor}" stroke-width="3" fill="none" stroke-linecap="round" />
      <path d="M80 90 Q92 96 104 90" stroke="${outlineColor}" stroke-width="3" fill="none" stroke-linecap="round" />
    `
  }

  if (expr === 'concerned') {
    return `
      <path d="M48 78 Q58 72 68 78" stroke="${outlineColor}" stroke-width="3" fill="none" stroke-linecap="round" />
      <path d="M82 78 Q92 72 102 78" stroke="${outlineColor}" stroke-width="3" fill="none" stroke-linecap="round" />
      <g class="eye-group">
        <ellipse cx="58" cy="90" rx="13" ry="15" fill="#ffffff" stroke="${outlineColor}" stroke-width="2" />
        <circle cx="58" cy="92" r="6" fill="${PUPIL_COLOR}" />
      </g>
      <g class="eye-group">
        <ellipse cx="92" cy="90" rx="13" ry="15" fill="#ffffff" stroke="${outlineColor}" stroke-width="2" />
        <circle cx="92" cy="92" r="6" fill="${PUPIL_COLOR}" />
      </g>
    `
  }

  if (expr === 'thinking') {
    return openEyes(outlineColor, 86, 80, 76)
  }

  return openEyes(outlineColor, 88, 90, 86)
}

export const mouthMarkup = (expr, outlineColor) => {
  switch (expr) {
    case 'wave':
      return `<path d="M58 116 Q75 134 92 116 Q75 126 58 116 Z" fill="${outlineColor}" />`
    case 'celebrate':
      return `<path d="M60 116 Q75 132 90 116" fill="${outlineColor}" />`
    case 'thinking':
      return `<path d="M66 120 Q75 116 84 120" stroke="${outlineColor}" stroke-width="2.4" fill="none" stroke-linecap="round" />`
    case 'concerned':
      return `<path d="M64 124 Q75 116 86 124" stroke="${outlineColor}" stroke-width="2.4" fill="none" stroke-linecap="round" />`
    case 'sleepy':
      return `<ellipse cx="75" cy="118" rx="6" ry="8" fill="${outlineColor}" />`
    default:
      return `<path d="M60 118 Q75 132 90 118" stroke="${outlineColor}" stroke-width="3" fill="none" stroke-linecap="round" />`
  }
}

export const extrasMarkup = (expr, bodyColor, outlineColor) => {
  if (expr === 'thinking') {
    return `
      <g class="thinking-dots">
        <circle cx="120" cy="70" r="4" fill="${bodyColor}" opacity="0.55" />
        <circle cx="132" cy="58" r="6" fill="${bodyColor}" opacity="0.55" />
        <circle cx="146" cy="44" r="8" fill="${bodyColor}" opacity="0.55" />
      </g>
    `
  }

  if (expr === 'celebrate') {
    return `
      <g class="sparkles">
        <path class="sparkle" d="M126 44 l3 6 l6 3 l-6 3 l-3 6 l-3-6 l-6-3 l6-3 Z" fill="${SPARKLE_COLOR}" />
        <path class="sparkle" d="M20 40 l2 4 l4 2 l-4 2 l-2 4 l-2-4 l-4-2 l4-2 Z" fill="${SPARKLE_COLOR}" />
        <path class="sparkle" d="M150 78 l2 4 l4 2 l-4 2 l-2 4 l-2-4 l-4-2 l4-2 Z" fill="${SPARKLE_COLOR}" />
      </g>
    `
  }

  if (expr === 'concerned') {
    return `<path class="teardrop" d="M118 66 Q126 78 118 90 Q110 78 118 66 Z" fill="${TEARDROP_COLOR}" stroke="${outlineColor}" stroke-width="1.5" />`
  }

  if (expr === 'sleepy') {
    return `
      <g class="zzz" fill="${outlineColor}" font-family="sans-serif" font-weight="500">
        <text x="118" y="66" font-size="14">z</text>
        <text x="130" y="52" font-size="18">z</text>
        <text x="146" y="38" font-size="22">z</text>
      </g>
    `
  }

  return ''
}

export const faceMarkup = (expr, outlineColor, cheekColor) => `
  <g class="face">
    ${eyesMarkup(expr, outlineColor)}
    <ellipse cx="45" cy="112" rx="8" ry="5" fill="${cheekColor}" opacity="0.8" />
    <ellipse cx="105" cy="112" rx="8" ry="5" fill="${cheekColor}" opacity="0.8" />
    ${mouthMarkup(expr, outlineColor)}
  </g>
`

export const svgBuddy = (variant, expr, phase) => {
  const { roleSlug, bodyColor, bellyColor, outlineColor, footColor, cheekColor, tuftColor, prop } = variant
  const legLeft = legTransform(phase, 'left')
  const legRight = legTransform(phase, 'right')

  return `
    <svg viewBox="0 0 150 165" xmlns="http://www.w3.org/2000/svg" class="variant-${roleSlug}">
      <ellipse cx="75" cy="158" rx="26" ry="4" fill="rgba(0,0,0,0.16)" />
      <g class="legs">
        <ellipse class="leg-left" cx="58" cy="150" rx="15" ry="9" fill="${footColor}" stroke="${outlineColor}" stroke-width="3" transform="${legLeft}" />
        <ellipse class="leg-right" cx="92" cy="150" rx="15" ry="9" fill="${footColor}" stroke="${outlineColor}" stroke-width="3" transform="${legRight}" />
      </g>
      <g class="arms">${armsMarkup(expr, bodyColor, outlineColor)}</g>
      <line x1="75" y1="38" x2="75" y2="22" stroke="${outlineColor}" stroke-width="3" stroke-linecap="round" />
      <circle cx="75" cy="16" r="7" fill="${tuftColor}" stroke="${outlineColor}" stroke-width="2.5" />
      <ellipse cx="75" cy="96" rx="52" ry="57" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="3" />
      <ellipse cx="75" cy="110" rx="33" ry="37" fill="${bellyColor}" />
      ${prop ? prop(outlineColor) : ''}
      ${faceMarkup(expr, outlineColor, cheekColor)}
      ${extrasMarkup(expr, bodyColor, outlineColor)}
    </svg>
  `
}
