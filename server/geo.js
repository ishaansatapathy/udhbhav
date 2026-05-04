/**
 * Geo-intelligence module: Haversine distance, station assignment
 */

const fs = require("fs");
const path = require("path");

// Fallback stations if JSON not found
const FALLBACK_STATIONS = [
  { id: "ps_001", name: "Vidhana Soudha PS", lat: 12.9794, lon: 77.5906, area: "Bangalore Central" },
  { id: "ps_002", name: "Cubbon Park PS", lat: 12.9716, lon: 77.5946, area: "Bangalore Central" },
  { id: "ps_003", name: "UB City PS", lat: 12.9716, lon: 77.5946, area: "Bangalore Central" },
  { id: "ps_004", name: "Brigade Road PS", lat: 12.9716, lon: 77.6033, area: "Bangalore East" },
  { id: "ps_005", name: "Koramangala PS", lat: 12.9279, lon: 77.6271, area: "Bangalore South" },
  { id: "ps_006", name: "BTM Layout PS", lat: 12.9165, lon: 77.6101, area: "Bangalore South" },
  { id: "ps_007", name: "Electronic City PS", lat: 12.8456, lon: 77.6603, area: "Bangalore South" },
  { id: "ps_008", name: "Whitefield PS", lat: 12.9698, lon: 77.7500, area: "Bangalore East" },
  { id: "ps_009", name: "Hebbal PS", lat: 13.0358, lon: 77.5970, area: "Bangalore North" },
  { id: "ps_010", name: "Yelahanka PS", lat: 13.1007, lon: 77.5963, area: "Bangalore North" },
  { id: "ps_011", name: "Mysuru City PS", lat: 12.2958, lon: 76.6394, area: "Mysuru" },
  { id: "ps_012", name: "Chamundi Hill PS", lat: 12.2724, lon: 76.6730, area: "Mysuru" },
];

// Load stations from JSON file
function loadStations() {
  try {
    const jsonPath = path.join(__dirname, "..", "public", "police_stations_bangalore_mysore.json");
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      if (Array.isArray(data) && data.length > 0) {
        return data.map(station => ({
          ...station,
          lon: station.lng || station.lon,
          area: station.area || "Unknown Area"
        }));
      }
    }
  } catch (error) {
    console.warn("Failed to load police stations JSON, using fallback:", error.message);
  }
  return FALLBACK_STATIONS;
}

const stations = loadStations();

/** Haversine distance in km */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Find owning police station for coordinates */
function getOwningStation(lat, lon) {
  let closest = stations[0];
  let minDistance = haversineDistance(lat, lon, closest.lat, closest.lon);

  for (const station of stations) {
    const distance = haversineDistance(lat, lon, station.lat, station.lon);
    if (distance < minDistance) {
      minDistance = distance;
      closest = station;
    }
  }

  return {
    ...closest,
    distance: minDistance,
    insideRadius: minDistance <= 2.0,
  };
}

function getStations() {
  return stations;
}

module.exports = {
  haversineDistance,
  getOwningStation,
  getStations,
};