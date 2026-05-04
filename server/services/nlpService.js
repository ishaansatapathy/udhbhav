/**
 * nlpService.js - Lightweight NLP Disaster Classifier (pure Node.js)
 * Keyword scoring + weighted matching on disaster patterns from tweets.csv
 */

const fs = require("fs")
const path = require("path")

const DISASTER_KEYWORDS = {
  flood: { weight: 2.5, words: ["flood","flooding","flooded","submerged","inundated","waterlogged","overflow","deluge"] },
  earthquake: { weight: 2.5, words: ["earthquake","quake","tremor","seismic","aftershock","richter","magnitude","epicenter"] },
  fire: { weight: 2.3, words: ["fire","wildfire","blaze","burning","inferno","explosion","blast","flames"] },
  storm: { weight: 2.0, words: ["storm","hurricane","cyclone","typhoon","tornado","winds","devastation"] },
  chemical: { weight: 2.4, words: ["chemical","toxic","hazmat","leak","spill","fumes","poisonous","contamination","radiation"] },
  miner_gas: { weight: 2.55, words: ["methane","ch4","gas leak","tunnel gas","lora","lorawan","stm32","underground sensor","miner health","ventilation fault","voc","mining gas"] },
  mine: { weight: 2.15, words: ["mine","collapse","trapped","underground","miners","cave-in","rescue"] },
  casualties: { weight: 1.8, words: ["dead","killed","death","casualties","injured","victim","hospital","emergency"] },
  crisis: { weight: 1.5, words: ["disaster","crisis","catastrophe","destruction","devastated","rescue","sos","help"] },
}

const NON_DISASTER = new Set(["movie","film","song","music","party","fun","love","happy","birthday","food","game","sports","travel","selfie","shopping"])

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(t => t.length > 2)
}

function classifyText(text) {
  if (!text || typeof text !== "string") return { label:"non-disaster", confidence:1.0, score:0, disaster_type:null }
  const tokens = tokenize(text)
  let totalScore = 0, matchedCategory = null, maxCat = 0
  for (const [cat, cfg] of Object.entries(DISASTER_KEYWORDS)) {
    let s = 0
    for (const w of cfg.words) if (text.toLowerCase().includes(w)) s += cfg.weight
    totalScore += s
    if (s > maxCat) { maxCat = s; matchedCategory = cat }
  }
  for (const t of tokens) if (NON_DISASTER.has(t)) totalScore -= 0.8
  const isDisaster = totalScore >= 1.5
  const confidence = isDisaster ? Math.min(0.99, 0.5 + totalScore/10) : Math.min(0.99, 0.5 + (1.5-totalScore)/5)
  return { label: isDisaster?"disaster":"non-disaster", confidence:parseFloat(confidence.toFixed(2)), score:parseFloat(totalScore.toFixed(2)), disaster_type: isDisaster?matchedCategory:null }
}

function mapToEventType(disaster_type) {
  const MAP = { flood:"flood", earthquake:"earthquake", fire:"fire", storm:"flood", chemical:"chemical_leak", miner_gas:"mine_gas_lora", mine:"mine_collapse", casualties:"earthquake", crisis:"flood" }
  return MAP[disaster_type] || "earthquake"
}

function analyzeTweetsDataset() {
  try {
    const csvPath = path.resolve(__dirname,"../../model/tweets.csv")
    if (!fs.existsSync(csvPath)) return { total:0, accuracy_estimate:"N/A" }
    const lines = fs.readFileSync(csvPath,"utf8").split("\n").slice(1)
    let total=0, correct=0
    for (const line of lines.slice(0,500)) {
      if (!line.trim()) continue
      const parts = line.split(",")
      const text = parts[3] || ""
      const label = parseInt(parts[4]) || 0
      const result = classifyText(text.replace(/["']/g,""))
      if ((result.label==="disaster"&&label===1)||(result.label==="non-disaster"&&label===0)) correct++
      total++
    }
    const acc = total>0 ? ((correct/total)*100).toFixed(1) : 0
    console.log(`[NLP] ${total} tweets analyzed, ~${acc}% accuracy`)
    return { total, accuracy_estimate:`~${acc}%` }
  } catch(e) { return { error:e.message } }
}

setTimeout(analyzeTweetsDataset, 3000)

module.exports = { classifyText, mapToEventType, analyzeTweetsDataset }
