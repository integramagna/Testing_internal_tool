import { loadCharacter } from './characters/index.js'
import { legTransform } from './characters/shared.js'

const buddyEl = document.getElementById('buddy')

let activeModule = null
let currentExpr = 'neutral'
let phaseInterval = null
let phase = 1

const draw = (expr) => {
  buddyEl.innerHTML = activeModule.svgBuddy(expr, phase)
}

const updateLegs = () => {
  const svg = buddyEl.querySelector('svg')
  if (!svg) return
  const left = svg.querySelector('.leg-left')
  const right = svg.querySelector('.leg-right')
  if (left) left.setAttribute('transform', legTransform(phase, 'left'))
  if (right) right.setAttribute('transform', legTransform(phase, 'right'))
}

const stopWalkCycle = () => {
  if (phaseInterval) {
    clearInterval(phaseInterval)
    phaseInterval = null
  }
}

const startWalkCycle = () => {
  stopWalkCycle()
  phaseInterval = setInterval(() => {
    phase = phase === 1 ? 2 : 1
    updateLegs()
  }, 200)
}

export const enter = async (characterId, expr = 'neutral') => {
  activeModule = await loadCharacter(characterId)
  currentExpr = expr
  phase = 1

  buddyEl.classList.remove('idle', 'bounce')
  draw(expr)
  buddyEl.classList.add('walking')
  startWalkCycle()
  buddyEl.classList.remove('in')
  requestAnimationFrame(() => requestAnimationFrame(() => buddyEl.classList.add('in')))

  return new Promise((resolve) => {
    setTimeout(() => {
      stopWalkCycle()
      buddyEl.classList.remove('walking')
      draw(expr)
      buddyEl.classList.add('idle')
      resolve()
    }, 1150)
  })
}

export const setExpression = (expr) => {
  if (!activeModule) return
  currentExpr = expr
  buddyEl.classList.remove('idle')
  draw(expr)
  buddyEl.classList.remove('bounce')
  void buddyEl.offsetWidth
  buddyEl.classList.add('bounce')
  setTimeout(() => buddyEl.classList.add('idle'), 520)
}

export const exit = () => {
  if (!activeModule) return Promise.resolve()

  buddyEl.classList.remove('idle', 'bounce')
  draw(currentExpr)
  buddyEl.classList.add('walking')
  startWalkCycle()
  buddyEl.classList.remove('in')

  return new Promise((resolve) => {
    setTimeout(() => {
      stopWalkCycle()
      buddyEl.classList.remove('walking')
      buddyEl.innerHTML = ''
      activeModule = null
      resolve()
    }, 1150)
  })
}

export const isOnStage = () => activeModule !== null
