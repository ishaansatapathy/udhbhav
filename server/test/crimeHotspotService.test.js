"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { getHotspots, clearAggregationCache } = require("../services/crimeHotspotService")

test("crime hotspots: city points + national domain roll-up (no raw rows)", () => {
  clearAggregationCache()
  const h = getHotspots({ limit: 5 })
  assert.equal(h.missingFile, false)
  assert.ok(h.rowCount > 10_000)
  assert.ok(h.points.length <= 5 && h.points.length >= 1)
  assert.ok(h.points.every(p => typeof p.city === "string" && p.count > 0))
  assert.ok(Array.isArray(h.topDomainsNational))
  assert.ok(h.topDomainsNational.length >= 1)
  const first = h.topDomainsNational[0]
  assert.ok(first.domain && first.count > 0)
  assert.equal(h.schemaVersion, 1)
})
