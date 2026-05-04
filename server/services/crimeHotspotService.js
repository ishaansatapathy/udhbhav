/**
 * Aggregates synthetic India crime CSV (city-level only; no victim PII exposed).
 */

const fs = require("fs")
const path = require("path")

const CSV_FILENAME = path.join(__dirname, "..", "..", "model", "crime_dataset_india.csv")

/** @type {ReadonlyArray<readonly [string, number, number]>} */
const CITY_COORDS = [
  ["Delhi", 28.6139, 77.209],
  ["Mumbai", 19.076, 72.8777],
  ["Bangalore", 12.9716, 77.5946],
  ["Hyderabad", 17.385, 78.4867],
  ["Kolkata", 22.5726, 88.3639],
  ["Chennai", 13.0827, 80.2707],
  ["Pune", 18.5204, 73.8567],
  ["Ahmedabad", 23.0225, 72.5714],
  ["Jaipur", 26.9124, 75.7873],
  ["Lucknow", 26.8467, 80.9462],
  ["Kanpur", 26.4499, 80.3319],
  ["Surat", 21.1702, 72.8311],
  ["Nagpur", 21.1458, 79.0882],
  ["Agra", 27.1767, 78.0081],
  ["Ludhiana", 30.901, 75.8573],
  ["Visakhapatnam", 17.6868, 83.2185],
  ["Thane", 19.2183, 72.9781],
  ["Ghaziabad", 28.6692, 77.4538],
  ["Indore", 22.7196, 75.8577],
  ["Patna", 25.5941, 85.1376],
  ["Bhopal", 23.2599, 77.4126],
  ["Meerut", 28.9845, 77.7064],
  ["Srinagar", 34.0837, 74.7973],
  ["Nashik", 19.9975, 73.7898],
  ["Vasai", 19.3919, 72.8397],
  ["Varanasi", 25.3176, 82.9739],
  ["Kalyan", 19.2403, 73.1305],
  ["Faridabad", 28.4089, 77.3178],
  ["Rajkot", 22.3039, 70.8022],
]

const coordByCity = new Map(CITY_COORDS.map(([c, la, ln]) => [c.toLowerCase(), { lat: la, lng: ln }]))

function parseCsvLine(line) {
  const out = []
  let cur = ""
  let quote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') quote = !quote
    else if (ch === "," && !quote) {
      out.push(cur.trim())
      cur = ""
    } else cur += ch
  }
  out.push(cur.trim())
  return out
}

let cache = null

function aggregateFromDisk() {
  if (!fs.existsSync(CSV_FILENAME)) {
    return {
      totalsByCity: new Map(),
      domainTotals: new Map(),
      rowCount: 0,
      totalsByCityDomain: new Map(),
      missingFile: true,
    }
  }
  const raw = fs.readFileSync(CSV_FILENAME, "utf8")
  const lines = raw.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) {
    return {
      totalsByCity: new Map(),
      domainTotals: new Map(),
      rowCount: 0,
      totalsByCityDomain: new Map(),
      missingFile: false,
    }
  }

  const header = parseCsvLine(lines[0]).map(h => h.replace(/^"|"$/g, ""))
  const ci = header.indexOf("City")
  const di = header.indexOf("Crime Domain")
  if (ci < 0) {
    return {
      totalsByCity: new Map(),
      domainTotals: new Map(),
      rowCount: 0,
      totalsByCityDomain: new Map(),
      missingFile: false,
    }
  }

  const totalsByCity = new Map()
  const totalsByCityDomain = new Map()
  const domainTotals = new Map()
  let rowCount = 0

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i])
    const city = (row[ci] || "").replace(/^"|"$/g, "").trim()
    if (!city) continue
    rowCount++
    totalsByCity.set(city, (totalsByCity.get(city) || 0) + 1)
    if (di >= 0) {
      const domain = (row[di] || "").replace(/^"|"$/g, "").trim() || "Unknown"
      domainTotals.set(domain, (domainTotals.get(domain) || 0) + 1)
      const key = `${city}\t${domain}`
      totalsByCityDomain.set(key, (totalsByCityDomain.get(key) || 0) + 1)
    }
  }

  return { totalsByCity, domainTotals, rowCount, totalsByCityDomain, missingFile: false }
}

function getCache() {
  if (!cache) cache = aggregateFromDisk()
  return cache
}

/** @param {number} n */
function nationalTopDomains(domainTotals, n = 8) {
  if (!domainTotals || domainTotals.size === 0) return []
  return [...domainTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([domain, count]) => ({ domain, count }))
}

function clearAggregationCache() {
  cache = null
}

function topDomainForCity(city, totalsByCityDomain) {
  if (!totalsByCityDomain || totalsByCityDomain.size === 0) return null
  let best = null
  let bestN = 0
  const prefix = `${city}\t`
  for (const [k, n] of totalsByCityDomain) {
    if (k.startsWith(prefix) && n > bestN) {
      bestN = n
      best = k.slice(prefix.length)
    }
  }
  return best
}

/**
 * @param {{ limit?: number }} opts
 */
function getHotspots(opts = {}) {
  const lim = Math.min(40, Math.max(5, Number(opts.limit) || 20))
  const { totalsByCity, domainTotals, rowCount, totalsByCityDomain, missingFile } = getCache()
  const sorted = [...totalsByCity.entries()].sort((a, b) => b[1] - a[1])
  const points = []

  for (const [city, count] of sorted) {
    const key = city.trim().toLowerCase()
    const latlng = coordByCity.get(key)
    if (!latlng) continue
    const jitter = ((city.charCodeAt(0) || 7) % 17) * 0.002 - 0.016
    const jitterLng = ((city.charCodeAt(2) || 3) % 13) * 0.002 - 0.012

    points.push({
      city,
      lat: latlng.lat + jitter,
      lng: latlng.lng + jitterLng,
      count,
      topDomain: topDomainForCity(city, totalsByCityDomain),
    })
    if (points.length >= lim) break
  }

  return {
    disclaimer:
      "City-level aggregates from bundled synthetic CSV only — not live police data; no victims or precise incident locations exposed.",
    source:
      "model/crime_dataset_india.csv (aggregated counts by official city labels; centroid markers with jitter for UI separation).",
    schemaVersion: 1,
    rowCount,
    cityCount: totalsByCity.size,
    sampledCitiesReturned: points.length,
    topDomainsNational: nationalTopDomains(domainTotals, 8),
    missingFile,
    points,
    updatedAt: Date.now(),
  }
}

module.exports = { getHotspots, clearAggregationCache }
