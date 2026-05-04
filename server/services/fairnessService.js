/**
 * Global fairness blend for allocator (0 = pure proximity×priority greedy, 1 = strong idle-spread).
 * Demo knob for judges — ties to scoring "why" copy.
 */

const DEFAULT_GAMMA = 0.38

/** @type {number} */
let fairnessGamma = DEFAULT_GAMMA

function getFairnessGamma() {
  return fairnessGamma
}

function setFairnessGamma(g) {
  const x = typeof g === "number" ? g : Number.parseFloat(g)
  if (Number.isNaN(x)) return fairnessGamma
  fairnessGamma = Math.min(1, Math.max(0, x))
  return fairnessGamma
}

function reset() {
  fairnessGamma = DEFAULT_GAMMA
  return fairnessGamma
}

module.exports = {
  getFairnessGamma,
  setFairnessGamma,
  reset,
  DEFAULT_GAMMA,
}
