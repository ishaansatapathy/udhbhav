"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const mesh = require("../services/meshCommsService")

function snap(overrides = {}) {
  return {
    availableMW: 420,
    unservedMW: 12,
    blackoutRiskPct: 3,
    cascadeResidualStress: 0,
    cascadeActive: false,
    cascadeStrikeCount: 0,
    sumRequested: 400,
    utilities: [{ id: "u1", shortCode: "U1", allocatedMW: 10, shortfallMW: 0.08 }],
    ...overrides,
  }
}

test("syncFromSnapshot returns null on identical signature", () => {
  mesh.reset()
  assert.ok(mesh.syncFromSnapshot(snap()))
  assert.equal(mesh.syncFromSnapshot(snap()), null)
})

test("cascade detail is merged into the grid line (no second cascade stub)", () => {
  mesh.reset()
  const delta = mesh.syncFromSnapshot(
    snap({
      cascadeActive: true,
      cascadeResidualStress: 2.5,
      cascadeStrikeCount: 3,
      unservedMW: 50,
      availableMW: 200,
      blackoutRiskPct: 22,
      sumRequested: 420,
      utilities: [{ id: "u1", shortCode: "U1", allocatedMW: 5, shortfallMW: 2 }],
    }),
  )
  assert.ok(delta)
  const gridLines = delta.messages.filter(m => m.role === "grid")
  assert.equal(gridLines.length, 1, "single grid/cascade combined line")
  assert.match(gridLines[0].body, /Cascade stack/)
})

test("noteFairnessGamma emits policy channel line", () => {
  mesh.reset()
  mesh.noteFairnessGamma(0.55)
  const st = mesh.getState()
  assert.ok(st.messages.some(m => m.channel === "policy" && m.body.includes("0.55")))
})
