import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { socketManager } from "../lib/socket";
import type { PoliceStation, CabState } from "../lib/geo";

// Fix Leaflet default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDOC4xMyAyIDUgNS4xMyA1IDlDNSAxNC4yNSAxMiAyMiAxMiAyMkMxMiAyMiAxOSAxNC4yNSAxOSA5QzE5IDUuMTMgMTUuODcgMiAxMiAyWk0xMiAxMS41QzEwLjYyIDExLjUgOS41IDEwLjM4IDkuNSA5QzkuNSA3LjYyIDEwLjYyIDYuNSAxMiA2LjVDMTMuMzggNi41IDE0LjUgNy42MiAxNC41IDlDMTQuNSAxMC4zOCAxMy4zOCAxMS41IDEyIDExLjVaIiBmaWxsPSIjMDBGRjAwIi8+Cjwvc3ZnPgo=",
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDOC4xMyAyIDUgNS4xMyA1IDlDNSAxNC4yNSAxMiAyMiAxMiAyMkMxMiAyMiAxOSAxNC4yNSAxOSA5QzE5IDUuMTMgMTUuODcgMiAxMiAyWk0xMiAxMS41QzEwLjYyIDExLjUgOS41IDEwLjM4IDkuNSA5QzkuNSA3LjYyIDEwLjYyIDYuNSAxMiA2LjVDMTMuMzggNi41IDE0LjUgNy42MiAxNC41IDlDMTQuNSAxMC4zOCAxMy4zOCAxMS41IDEyIDExLjVaIiBmaWxsPSIjMDBGRjAwIi8+Cjwvc3ZnPgo=",
  shadowUrl: "",
});

const INITIAL_CENTER: [number, number] = [12.9716, 77.5946]; // Bangalore
const INITIAL_ZOOM = 11;

export default function PoliceDashboard() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const stationMarkersRef = useRef<L.LayerGroup>(new L.LayerGroup());
  const rangeCirclesRef = useRef<L.LayerGroup>(new L.LayerGroup());
  const cabMarkersRef = useRef<L.LayerGroup>(new L.LayerGroup());
  const scanningCircleRef = useRef<L.Circle | null>(null);
  const gridRef = useRef<L.LayerGroup>(new L.LayerGroup());

  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [cabs, setCabs] = useState<Map<string, CabState & { cabId: string }>>(new Map());
  const [isScanning, setIsScanning] = useState(true);
  const [scanRadius, setScanRadius] = useState(500);

  // Fetch stations
  useEffect(() => {
    fetch("/api/stations")
      .then(res => res.json())
      .then((data: PoliceStation[]) => {
        setStations(data);
        if (data.length > 0 && !selectedStation) {
          setSelectedStation(data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    });

    // OpenStreetMap standard light tiles (original white/light map)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    // Custom panes for layering
    map.createPane("grid");
    map.getPane("grid")!.style.zIndex = "400";
    map.createPane("ranges");
    map.getPane("ranges")!.style.zIndex = "500";
    map.createPane("stations");
    map.getPane("stations")!.style.zIndex = "600";
    map.createPane("cabs");
    map.getPane("cabs")!.style.zIndex = "700";
    map.createPane("scanning");
    map.getPane("scanning")!.style.zIndex = "800";

    // Add layers to map
    stationMarkersRef.current.addTo(map);
    rangeCirclesRef.current.addTo(map);
    cabMarkersRef.current.addTo(map);
    gridRef.current.addTo(map);

    mapRef.current = map;

    // Grid update on map move/zoom
    const updateGrid = () => {
      if (!mapRef.current) return;
      gridRef.current.clearLayers();

      const bounds = mapRef.current.getBounds();
      const zoom = mapRef.current.getZoom();
      const gridSize = Math.max(0.01, 0.1 / Math.pow(2, zoom - 10));

      const latStart = Math.floor(bounds.getSouth() / gridSize) * gridSize;
      const latEnd = Math.ceil(bounds.getNorth() / gridSize) * gridSize;
      const lngStart = Math.floor(bounds.getWest() / gridSize) * gridSize;
      const lngEnd = Math.ceil(bounds.getEast() / gridSize) * gridSize;

      // Vertical lines (subtle gray on light map)
      for (let lng = lngStart; lng <= lngEnd; lng += gridSize) {
        const line = L.polyline([[latStart, lng], [latEnd, lng]], {
          color: "#999999",
          weight: 1,
          opacity: 0.35,
          pane: "grid"
        });
        gridRef.current.addLayer(line);
      }

      // Horizontal lines
      for (let lat = latStart; lat <= latEnd; lat += gridSize) {
        const line = L.polyline([[lat, lngStart], [lat, lngEnd]], {
          color: "#999999", 
          weight: 1,
          opacity: 0.35,
          pane: "grid"
        });
        gridRef.current.addLayer(line);
      }
    };

    map.on("moveend", updateGrid);
    map.on("zoomend", updateGrid);
    updateGrid();

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update station markers and ranges
  useEffect(() => {
    if (!mapRef.current || stations.length === 0) return;

    stationMarkersRef.current.clearLayers();
    rangeCirclesRef.current.clearLayers();

    // Fit map to show all stations
    if (stations.length > 0) {
      const group = new L.FeatureGroup();
      stations.forEach(station => {
        const marker = L.circleMarker([station.lat, station.lon], {
          radius: 8,
          fillColor: "#00ff00",
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
          pane: "stations"
        });
        group.addLayer(marker);
      });
      mapRef.current.fitBounds(group.getBounds(), { padding: [20, 20] });
    }

    stations.forEach((station) => {
      // Station marker
      const marker = L.circleMarker([station.lat, station.lon], {
        radius: 8,
        fillColor: "#00ff00",
        color: "#ffffff", 
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
        pane: "stations"
      }).bindTooltip(station.name, {
        permanent: false,
        direction: "top",
        className: "station-tooltip"
      });

      stationMarkersRef.current.addLayer(marker);

      // 2km range circle (subtle for all stations)
      const rangeCircle = L.circle([station.lat, station.lon], {
        radius: 2000,
        fillColor: "#00ff00",
        color: "#00ff00",
        weight: 1,
        opacity: 0.3,
        fillOpacity: 0.06,
        pane: "ranges"
      });

      rangeCirclesRef.current.addLayer(rangeCircle);

      // Highlight selected station
      if (station.id === selectedStation) {
        const selectedCircle = L.circle([station.lat, station.lon], {
          radius: 2000,
          fillColor: "#00ff00",
          color: "#00ff00", 
          weight: 2,
          opacity: 0.6,
          fillOpacity: 0.12,
          pane: "ranges"
        });
        rangeCirclesRef.current.addLayer(selectedCircle);
      }
    });
  }, [stations, selectedStation]);

  // Scanning animation
  useEffect(() => {
    if (!mapRef.current || !selectedStation || !isScanning) return;

    const selectedStationData = stations.find(s => s.id === selectedStation);
    if (!selectedStationData) return;

    let animationFrame: number;
    let startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % 3000) / 3000; // 3 second cycle
      const currentRadius = 50 + (progress * 1950); // 50m to 2000m

      if (scanningCircleRef.current) {
        mapRef.current?.removeLayer(scanningCircleRef.current);
      }

      scanningCircleRef.current = L.circle([selectedStationData.lat, selectedStationData.lon], {
        radius: currentRadius,
        fillColor: "transparent",
        color: "#00ff00",
        weight: 2,
        opacity: 0.8 - (progress * 0.6), // Fade out
        fillOpacity: 0,
        pane: "scanning"
      });

      scanningCircleRef.current.addTo(mapRef.current!);

      if (isScanning) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (scanningCircleRef.current && mapRef.current) {
        mapRef.current.removeLayer(scanningCircleRef.current);
      }
    };
  }, [selectedStation, stations, isScanning]);

  // Socket connection and cab tracking
  useEffect(() => {
    const socket = socketManager.connect();

    socketManager.onStationCabs((cabList) => {
      const newCabs = new Map(cabs);
      cabList.forEach(cab => {
        newCabs.set(cab.id, { ...cab, cabId: cab.id });
      });
      setCabs(newCabs);
    });

    socketManager.onCabUpdate((cab) => {
      setCabs(prev => new Map(prev.set(cab.cabId, cab)));
    });

    socketManager.onCabLeft((cabId) => {
      setCabs(prev => {
        const newCabs = new Map(prev);
        newCabs.delete(cabId);
        return newCabs;
      });
    });

    // Simulate cab movement
    const simulateCabs = () => {
      if (stations.length === 0) return;
      
      const station = stations.find(s => s.id === selectedStation) || stations[0];
      const cabId = "cab_1";
      
      // Random position within 2km of station
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 0.018; // ~2km in degrees
      const lat = station.lat + (distance * Math.cos(angle));
      const lon = station.lon + (distance * Math.sin(angle));
      
      socketManager.emitCabPosition(cabId, lat, lon);
    };

    const cabInterval = setInterval(simulateCabs, 2000);

    return () => {
      clearInterval(cabInterval);
      socketManager.disconnect();
    };
  }, [selectedStation, stations]);

  // Update cab markers
  useEffect(() => {
    if (!mapRef.current) return;

    cabMarkersRef.current.clearLayers();

    cabs.forEach((cab) => {
      const cabIcon = L.divIcon({
        html: `
          <div class="cab-marker">
            <div class="cab-icon">🚗</div>
            <div class="cab-label">${cab.cabId}</div>
          </div>
        `,
        className: "custom-cab-marker",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([cab.lat, cab.lon], { 
        icon: cabIcon,
        pane: "cabs"
      });
      
      cabMarkersRef.current.addLayer(marker);
    });
  }, [cabs]);

  // Join selected station
  useEffect(() => {
    if (selectedStation) {
      socketManager.joinStation(selectedStation);
    }
  }, [selectedStation]);

  // Group stations by area
  const stationsByArea = stations.reduce((acc, station) => {
    const area = station.area || "Unknown";
    if (!acc[area]) acc[area] = [];
    acc[area].push(station);
    return acc;
  }, {} as Record<string, PoliceStation[]>);

  const cabArray = Array.from(cabs.values());
  const activeCabs = cabArray.filter(cab => cab.insideRadius).length;
  const totalCabs = cabArray.length;

  return (
    <div className="min-h-screen bg-gray-900 text-green-400 font-mono">
      {/* Header */}
      <div className="bg-black border-b border-green-500 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-green-400">SAHAYAK POLICE PORTAL</h1>
            <p className="text-green-300 text-sm">Tactical Command & Control System</p>
          </div>
          <div className="text-right">
            <div className="text-green-400 text-lg font-bold">
              STATUS: <span className="text-green-300">ACTIVE</span>
            </div>
            <div className="text-green-300 text-sm">
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <div className="w-80 bg-gray-800 border-r border-green-500 p-4 overflow-y-auto">
          <div className="space-y-6">
            {/* Station Selection */}
            <div>
              <label className="block text-green-400 font-bold mb-2">COMMAND STATION</label>
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="w-full bg-gray-900 border border-green-500 text-green-400 p-2 rounded focus:outline-none focus:border-green-300"
              >
                {Object.entries(stationsByArea).map(([area, areaStations]) => (
                  <optgroup key={area} label={area} className="text-green-300">
                    {areaStations.map((station) => (
                      <option key={station.id} value={station.id} className="text-green-400">
                        {station.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Status Panel */}
            <div className="border border-green-500 rounded p-3">
              <h3 className="text-green-400 font-bold mb-2">OPERATIONAL STATUS</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Stations:</span>
                  <span className="text-green-300">{stations.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Cabs:</span>
                  <span className="text-green-300">{activeCabs}/{totalCabs}</span>
                </div>
                <div className="flex justify-between">
                  <span>Scan Status:</span>
                  <span className={isScanning ? "text-green-300" : "text-yellow-400"}>
                    {isScanning ? "SCANNING" : "SILENT"}
                  </span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-3">
              <button
                onClick={() => setIsScanning(!isScanning)}
                className={`w-full p-2 rounded font-bold transition-colors ${
                  isScanning 
                    ? "bg-green-600 hover:bg-green-700 text-black" 
                    : "bg-gray-600 hover:bg-gray-700 text-green-400 border border-green-500"
                }`}
              >
                {isScanning ? "DISABLE SCAN" : "ENABLE SCAN"}
              </button>
            </div>

            {/* Cab List */}
            <div className="border border-green-500 rounded p-3">
              <h3 className="text-green-400 font-bold mb-2">ACTIVE UNITS</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {cabArray.length === 0 ? (
                  <div className="text-green-300 text-sm">No active units</div>
                ) : (
                  cabArray.map((cab) => (
                    <div key={cab.cabId} className="flex justify-between items-center text-sm">
                      <span className="text-green-400">{cab.cabId}</span>
                      <span className={cab.insideRadius ? "text-green-300" : "text-yellow-400"}>
                        {cab.insideRadius ? "IN RANGE" : "OUT OF RANGE"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <div ref={mapContainerRef} className="w-full h-full" />
          
          {/* Map Overlay Info */}
          <div className="absolute top-4 right-4 bg-black bg-opacity-80 border border-green-500 rounded p-3 text-green-400">
            <div className="text-sm">
              <div>Grid: <span className="text-green-300">ACTIVE</span></div>
              <div>Range: <span className="text-green-300">2KM RADIUS</span></div>
              <div>Mode: <span className="text-green-300">TACTICAL</span></div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .station-tooltip {
          background: rgba(0, 0, 0, 0.8) !important;
          border: 1px solid #00ff00 !important;
          color: #00ff00 !important;
          font-family: monospace !important;
          font-size: 12px !important;
        }
        
        .custom-cab-marker {
          background: transparent !important;
          border: none !important;
        }
        
        .cab-marker {
          text-align: center;
          color: #00ff00;
          font-family: monospace;
          font-size: 12px;
          font-weight: bold;
        }
        
        .cab-icon {
          font-size: 16px;
          margin-bottom: 2px;
        }
        
        .cab-label {
          background: rgba(0, 0, 0, 0.8);
          border: 1px solid #00ff00;
          border-radius: 3px;
          padding: 1px 4px;
          font-size: 10px;
        }
      `}</style>
    </div>
  );
}