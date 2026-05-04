import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Agent, CrimeCityHotspot, DisasterEvent, UtilityStakeholderAgent } from "../lib/useMultiAgent"
import { fetchDrivingRouteLatLng, trimRouteFromAgent } from "../lib/osrmRoute"

interface Props {
  agents: Agent[]
  events: DisasterEvent[]
  stakeholders?: UtilityStakeholderAgent[] | null
  blockedZones?: any[]
  /** City-level crime roll-up (synthetic CSV); optional overlay. */
  crimeHotspots?: CrimeCityHotspot[] | null
  crimeLayerOn?: boolean
  onResolve: (id: string) => void
}

const EVENT_COLORS: Record<string, string> = {
  flood: "#3b82f6",
  earthquake: "#f59e0b",
  fire: "#ef4444",
  chemical_leak: "#a855f7",
  mine_collapse: "#94a3b8",
  mine_gas_lora: "#eab308",
  women_sos: "#ec4899",
  industrial_hazard: "#f97316",
}

const EVENT_CODE: Record<string, string> = {
  flood: "FL",
  earthquake: "EQ",
  fire: "FR",
  chemical_leak: "CH",
  mine_collapse: "MC",
  mine_gas_lora: "MG",
  women_sos: "WS",
  industrial_hazard: "IH",
}

function eventPopupHtml(ev: DisasterEvent): string {
  const pair = (ev.secondary_assignments ?? []).map(s =>
    `<div style="color:#e9d5ff;font-size:10px;margin-top:3px">● ${s.agentId} (${s.type}) — ${s.role}</div>`,
  ).join("")
  const iot =
    ev.sensor_meta?.hardware
      ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #334155;font-size:10px;color:#fde047"><b>Sensor edge</b><br/>${ev.sensor_meta.hardware}<br/>${ev.sensor_meta.tunnel_node ? `Node ${ev.sensor_meta.tunnel_node}<br/>` : ""}${ev.sensor_meta.readings?.length ? ev.sensor_meta.readings.join(" · ") : ""}</div>`
      : ""
  return `<div style="font-family:sans-serif;min-width:200px;">
              <b style="font-size:13px">${ev.type.replace(/_/g, " ").toUpperCase()}</b><br/>
              <span style="color:#ef4444">Severity: ${ev.severity}/10</span><br/>
              Casualties: ~${ev.casualties_est}<br/>
              <i style="font-size:11px;color:#888">${ev.description}</i><br/>
              <span style="color:#22c55e;font-size:11px;display:block;margin-top:4px">
                ${ev.assigned_agent ? `Primary: ${ev.assigned_agent}` : "Awaiting assignment"}
              </span>
              ${pair}
              ${iot}
            </div>`
}

function makeAgentIcon(type: string, status: string) {
  const isFailed = status === "failed"
  const color =
    isFailed ? "#94a3b8"
      : status === "idle" ? "#22d3ee"
        : status === "assigned"
          ? (type === "hospital" ? "#c084fc" : "#4ade80")
          : "#f87171"
  const label = isFailed ? "F" : type === "ambulance" ? "A" : type === "police" ? "P" : type === "hospital" ? "H" : "C"
  const pulse = status === "assigned" ? `animation:agentPulse 1s infinite;` : ""
  const failedStyle = isFailed ? `border-style: dashed; opacity: 0.7; filter: grayscale(1);` : `border:2px solid rgba(255,255,255,0.9);`
  
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};border-radius:50%;width:30px;height:30px;
      display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#0b1120;
      ${failedStyle}
      box-shadow:0 0 10px ${color},0 0 20px ${color}66;
      ${pulse}transition:all 0.3s;">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

function makeEventIcon(type: string, severity: number) {
  const color = EVENT_COLORS[type] || "#ef4444"
  const code = EVENT_CODE[type] || "EV"
  const size = Math.round(22 + severity * 1.8)
  return L.divIcon({
    className: "",
    html: `<div style="background:${color}22;border:2px solid ${color};border-radius:50%;
      width:${size}px;height:${size}px;display:flex;align-items:center;
      justify-content:center;font-size:${Math.round(size * 0.25)}px;font-weight:700;color:${color};
      box-shadow:0 0 14px ${color},0 0 28px ${color}66;
      animation:eventPulse 1.5s ease-in-out infinite;">${code}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function makeStakeholderIcon(code: string, status: UtilityStakeholderAgent["status"]) {
  const border =
    status === "mandate_breach"
      ? "#f87171"
      : status === "load_shedding"
        ? "#fb923c"
        : status === "stressed"
          ? "#facc15"
          : "#7dd3fc"
  const glow =
    status === "mandate_breach"
      ? "#f8717166"
      : status === "load_shedding"
        ? "#fb923c66"
        : status === "stressed"
          ? "#facc1566"
          : "#38bdf866"
  const bg =
    status === "mandate_breach"
      ? "#450a0a"
      : status === "load_shedding"
        ? "#431407"
        : status === "stressed"
          ? "#422006"
          : "#0c4a6e"
  const safeCode = code.replace(/[^\w]/g, "").slice(0, 2).toUpperCase() || "U"
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
      <div style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;background:${bg};
        border:2px solid ${border};transform:rotate(45deg);box-shadow:0 0 12px ${glow},0 0 22px ${glow}">
        <span style="display:block;font-size:9px;font-weight:800;color:${border};transform:rotate(-45deg);">${safeCode}</span>
      </div>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

interface AgentInterp {
  fromLat: number
  fromLng: number
  toLat: number
  toLng: number
  startTime: number
  duration: number // ms
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export default function DisasterMap({
  agents,
  events,
  stakeholders = [],
  blockedZones = [],
  crimeHotspots = null,
  crimeLayerOn = false,
  onResolve,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<L.Map | null>(null)
  const agentMarkersRef = useRef<Map<string, L.Marker>>(new Map())
  const agentPosRef = useRef<Map<string, { lat: number; lng: number }>>(new Map())
  const agentInterpRef = useRef<Map<string, AgentInterp>>(new Map())
  const eventMarkersRef = useRef<Map<string, L.Marker>>(new Map())
  const stakeholderMarkersRef = useRef<Map<string, L.Marker>>(new Map())
  const routeLinesRef = useRef<Map<string, L.Polyline>>(new Map())
  /** Full OSRM polyline per assigned agent; trimmed in the animation loop. */
  const roadRouteGeomRef = useRef<Map<string, [number, number][]>>(new Map())
  const routeRequestKeyRef = useRef<Map<string, string>>(new Map())
  const routeFetchAbortRef = useRef<Map<string, AbortController>>(new Map())
  const crimeCirclesRef = useRef<L.Circle[]>([])
  const rafRef = useRef<number>(0)
  const [selectedEvent, setSelectedEvent] = useState<DisasterEvent | null>(null)

  // Inject keyframe styles once
  useEffect(() => {
    if (document.getElementById("disaster-map-styles")) return
    const style = document.createElement("style")
    style.id = "disaster-map-styles"
    style.textContent = `
      @keyframes agentPulse {
        0%,100% { box-shadow: 0 0 10px #4ade80, 0 0 20px #4ade8066; }
        50%      { box-shadow: 0 0 18px #4ade80, 0 0 36px #4ade80aa; }
      }
      @keyframes eventPulse {
        0%,100% { transform: scale(1); opacity: 1; }
        50%      { transform: scale(1.15); opacity: 0.85; }
      }
    `
    document.head.appendChild(style)
  }, [])

  // Init map once
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return
    leafletRef.current = L.map(mapRef.current, {
      center: [12.9716, 77.5946],
      zoom: 12,
      zoomControl: true,
    })
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(leafletRef.current)

    return () => {
      cancelAnimationFrame(rafRef.current)
      leafletRef.current?.remove()
      leafletRef.current = null
    }
  }, [])

  // Smooth animation loop via requestAnimationFrame
  useEffect(() => {
    function animate() {
      const now = performance.now()
      for (const [id, interp] of agentInterpRef.current) {
        const marker = agentMarkersRef.current.get(id)
        if (!marker) continue
        const t = Math.min(1, (now - interp.startTime) / interp.duration)
        const lat = lerp(interp.fromLat, interp.toLat, t)
        const lng = lerp(interp.fromLng, interp.toLng, t)
        marker.setLatLng([lat, lng])
        agentPosRef.current.set(id, { lat, lng })

        const line = routeLinesRef.current.get(id)
        const geom = roadRouteGeomRef.current.get(id)
        if (line) {
          if (geom && geom.length > 3) {
            line.setLatLngs(trimRouteFromAgent(geom, { lat, lng }))
          } else if (geom && geom.length >= 2) {
            line.setLatLngs([[lat, lng], geom[geom.length - 1]])
          } else {
            line.setLatLngs([[lat, lng], [interp.toLat, interp.toLng]])
          }
        }

        if (t >= 1) agentInterpRef.current.delete(id)
      }

      // Keep dispatch polylines aligned when the agent sits on a synced tick (no active interpolation).
      routeLinesRef.current.forEach((line, id) => {
        if (agentInterpRef.current.has(id)) return
        const geom = roadRouteGeomRef.current.get(id)
        if (!geom || geom.length < 2) return
        const marker = agentMarkersRef.current.get(id)
        if (!marker) return
        const ll = marker.getLatLng()
        if (geom.length > 3) line.setLatLngs(trimRouteFromAgent(geom, { lat: ll.lat, lng: ll.lng }))
        else line.setLatLngs([[ll.lat, ll.lng], geom[geom.length - 1]])
      })

      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // When server sends new agent positions, start interpolation
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return

    const seen = new Set<string>()

    for (const agent of agents) {
      seen.add(agent.id)
      const icon = makeAgentIcon(agent.type, agent.status)
      const currentPos = agentPosRef.current.get(agent.id)

      if (!agentMarkersRef.current.has(agent.id)) {
        // First time: place marker directly
        const m = L.marker([agent.lat, agent.lng], { icon, zIndexOffset: 100 })
          .addTo(map)
          .bindTooltip(
            `<b>${agent.type.toUpperCase()}</b><br/>Status: ${agent.status}<br/>Fuel: ${agent.fuel_level}%`,
            { permanent: false, direction: "top" }
          )
        agentMarkersRef.current.set(agent.id, m)
        agentPosRef.current.set(agent.id, { lat: agent.lat, lng: agent.lng })
      } else {
        // Update icon (status color may change)
        agentMarkersRef.current.get(agent.id)!.setIcon(icon)
        // Update tooltip
        agentMarkersRef.current.get(agent.id)!.setTooltipContent(
          `<b>${agent.type.toUpperCase()}</b><br/>Status: ${agent.status}<br/>Fuel: ${agent.fuel_level}%`
        )

        // Start smooth interpolation to new position
        if (currentPos) {
          const dist = Math.hypot(agent.lat - currentPos.lat, agent.lng - currentPos.lng)
          if (dist > 0.0001) {
            agentInterpRef.current.set(agent.id, {
              fromLat: currentPos.lat,
              fromLng: currentPos.lng,
              toLat: agent.lat,
              toLng: agent.lng,
              startTime: performance.now(),
              duration: 1800, // interpolate over 1.8s (just under 2s tick)
            })
          }
        }
        agentPosRef.current.set(agent.id, { lat: agent.lat, lng: agent.lng })
      }

      // Road-snapped dispatch path (OSRM) — avoids straight crow-flies overlay
      if (agent.status === "assigned" && agent.targetLat != null && agent.targetLng != null) {
        const tk = `${agent.targetLat.toFixed(6)}_${agent.targetLng.toFixed(6)}`
        const reqKey = `${agent.id}_${tk}`
        let line = routeLinesRef.current.get(agent.id)
        const curShown = agentPosRef.current.get(agent.id) || { lat: agent.lat, lng: agent.lng }

        if (!line) {
          line = L.polyline(
            [
              [curShown.lat, curShown.lng],
              [agent.targetLat, agent.targetLng],
            ],
            {
              color: "#4ade80",
              weight: 2.5,
              dashArray: "8,6",
              opacity: 0.82,
              lineCap: "round",
              lineJoin: "round",
            },
          ).addTo(map)
          routeLinesRef.current.set(agent.id, line)
        }

        if (routeRequestKeyRef.current.get(agent.id) !== reqKey) {
          routeRequestKeyRef.current.set(agent.id, reqKey)
          routeFetchAbortRef.current.get(agent.id)?.abort()
          roadRouteGeomRef.current.delete(agent.id)

          const ac = new AbortController()
          routeFetchAbortRef.current.set(agent.id, ac)
          const origin = { lat: agent.lat, lng: agent.lng }
          const dest = { lat: agent.targetLat, lng: agent.targetLng }
          line.setLatLngs([
            [curShown.lat, curShown.lng],
            [dest.lat, dest.lng],
          ])

          void fetchDrivingRouteLatLng(origin, dest, ac.signal).then((geom) => {
            if (ac.signal.aborted || routeRequestKeyRef.current.get(agent.id) !== reqKey) return
            roadRouteGeomRef.current.set(agent.id, geom)
            const ln = routeLinesRef.current.get(agent.id)
            const mp = leafletRef.current
            if (!ln || !mp) return
            if (!mp.hasLayer(ln)) ln.addTo(mp)
            ln.setLatLngs(geom)
          })
        }
      } else {
        routeFetchAbortRef.current.get(agent.id)?.abort()
        routeFetchAbortRef.current.delete(agent.id)
        routeRequestKeyRef.current.delete(agent.id)
        roadRouteGeomRef.current.delete(agent.id)

        const line = routeLinesRef.current.get(agent.id)
        if (line) {
          line.remove()
          routeLinesRef.current.delete(agent.id)
        }
      }
    }

    // Remove stale agents
    for (const [id, m] of agentMarkersRef.current) {
      if (!seen.has(id)) {
        m.remove()
        agentMarkersRef.current.delete(id)
        agentPosRef.current.delete(id)
        agentInterpRef.current.delete(id)
        routeFetchAbortRef.current.get(id)?.abort()
        routeFetchAbortRef.current.delete(id)
        routeRequestKeyRef.current.delete(id)
        roadRouteGeomRef.current.delete(id)
        routeLinesRef.current.get(id)?.remove()
        routeLinesRef.current.delete(id)
      }
    }
  }, [agents])

  // Fixed utility stakeholder nodes (negotiation layer — diamond markers)
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    const layer = stakeholders || []
    const seen = new Set<string>()

    for (const s of layer) {
      seen.add(s.id)
      const icon = makeStakeholderIcon(s.shortCode, s.status)
      const tip =
        `<b>${s.shortCode}</b> · ${s.status.replace(/_/g, " ").toUpperCase()}<br/>` +
        `${s.label}<br/>` +
        `<span style="color:#94a3b8;font-size:11px">${s.allocatedMW.toFixed(1)} / ${s.requestedMW} MW allotted</span>`

      if (!stakeholderMarkersRef.current.has(s.id)) {
        const m = L.marker([s.lat, s.lng], { icon, zIndexOffset: 115 })
          .addTo(map)
          .bindTooltip(tip, { direction: "top", opacity: 0.95 })
        stakeholderMarkersRef.current.set(s.id, m)
      } else {
        const m = stakeholderMarkersRef.current.get(s.id)!
        m.setLatLng([s.lat, s.lng])
        m.setIcon(icon)
        m.setTooltipContent(tip)
      }
    }

    for (const [id, m] of stakeholderMarkersRef.current) {
      if (!seen.has(id)) {
        m.remove()
        stakeholderMarkersRef.current.delete(id)
      }
    }
  }, [stakeholders])

  // Update event markers
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    const seen = new Set<string>()

    for (const ev of events) {
      seen.add(ev.id)
      if (!eventMarkersRef.current.has(ev.id)) {
        const icon = makeEventIcon(ev.type, ev.severity)
        const m = L.marker([ev.lat, ev.lng], { icon, zIndexOffset: 50 })
          .addTo(map)
          .bindPopup(eventPopupHtml(ev))
          .on("click", () => setSelectedEvent(ev))
        eventMarkersRef.current.set(ev.id, m)
      } else {
        eventMarkersRef.current.get(ev.id)!.setPopupContent(eventPopupHtml(ev))
      }
    }

    // Remove resolved events
    for (const [id, m] of eventMarkersRef.current) {
      if (!seen.has(id)) {
        m.remove()
        eventMarkersRef.current.delete(id)
      }
    }
  }, [events])

  // Draw blocked zones
  const blockedZonesRef = useRef<L.Circle[]>([])
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return

    // Clear old
    blockedZonesRef.current.forEach(c => c.remove())
    blockedZonesRef.current = []

    for (const zone of blockedZones) {
      const circle = L.circle([zone.lat, zone.lng], {
        color: "#ef4444",
        fillColor: "#ef4444",
        fillOpacity: 0.15,
        radius: zone.radius_km * 1000, // convert km to meters
        weight: 1,
        dashArray: "4,4",
      }).addTo(map).bindTooltip(`<b>Blocked Road</b><br/>${zone.road_name}<br/><i>Penalty: ${zone.penalty_multiplier.toFixed(1)}x</i>`)
      blockedZonesRef.current.push(circle)
    }
  }, [blockedZones])

  /** Synthetic city-level hotspot rings (privacy-safe; centroids only). */
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    crimeCirclesRef.current.forEach(c => c.remove())
    crimeCirclesRef.current = []

    if (!crimeLayerOn || !crimeHotspots?.length) return

    const maxCount = Math.max(...crimeHotspots.map(p => p.count), 1)
    for (const p of crimeHotspots) {
      const t = Math.pow(p.count / maxCount, 0.52)
      const radiusM = 2400 + t * 30000
      const circle = L.circle([p.lat, p.lng], {
        color: "#c4b5fd",
        fillColor: "#6d28d9",
        fillOpacity: 0.1,
        weight: 1,
        dashArray: "8,14",
        opacity: 0.72,
      })
        .addTo(map)
        .bindTooltip(
          `<div style="font-family:system-ui,sans-serif;min-width:180px;line-height:1.35;">
            <div style="font-weight:700;color:#ddd">${p.city}</div>
            <div style="color:#a78bfa;font-size:11px">${p.count.toLocaleString()} bundled records · city centroid</div>
            ${p.topDomain ? `<div style="margin-top:4px;font-size:10px;color:#94a3b8">Top crime bucket (synthetic taxonomy): ${p.topDomain}</div>` : ""}
          </div>`,
          { direction: "top", sticky: true, opacity: 0.95 },
        )
      crimeCirclesRef.current.push(circle)
    }

    return () => {
      crimeCirclesRef.current.forEach(c => c.remove())
      crimeCirclesRef.current = []
    }
  }, [crimeHotspots, crimeLayerOn])

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%", background: "#0f172a" }} />

      {/* Map legend */}
      <div
        className="pointer-events-none absolute right-4 top-4 z-500 max-w-[240px]"
        style={{
          background: "rgba(2,6,23,0.88)",
          border: "1px solid rgba(148,163,184,0.25)",
          borderRadius: 12,
          padding: "10px 12px",
          color: "#e2e8f0",
          boxShadow: "0 10px 36px rgba(0,0,0,0.45)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#94a3b8" }}>
          LEGEND
        </div>
        <div style={{ marginTop: 8, display: "grid", gap: 7 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 999, background: "#22d3ee", display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "#cbd5e1" }}>Fleet unit (idle)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 999, background: "#4ade80", display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "#cbd5e1" }}>Fleet unit (assigned)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 999, background: "#f87171", display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "#cbd5e1" }}>Fleet unit (busy)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 3 }}>
            <span
              style={{
                width: 12,
                height: 12,
                background: "#0c4a6e",
                border: "2px solid #7dd3fc",
                transform: "rotate(45deg)",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 11, color: "#cbd5e1" }}>Utility stakeholder node (diamond)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 20 }}>
            <span style={{ fontSize: 10, color: "#7dd3fc" }}>Nominal</span>
            <span style={{ fontSize: 10, color: "#facc15" }}>Stressed</span>
            <span style={{ fontSize: 10, color: "#fb923c" }}>Shed</span>
            <span style={{ fontSize: 10, color: "#f87171" }}>Breach</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 6, borderTop: "1px solid rgba(51,65,85,0.5)" }}>
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                border: "2px dashed #a78bfa",
                background: "rgba(109,40,217,0.15)",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 11, color: "#cbd5e1" }}>City crime roll-up (bundled CSV)</span>
          </div>
          <div style={{ fontSize: 9, color: "#64748b", lineHeight: 1.35, paddingTop: 2 }}>
            Green dispatch dashes snap to roads (OSRM public demo; straight fallback if offline).
          </div>
        </div>
      </div>

      {/* Event detail popup */}
      {selectedEvent && (
        <div style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
          background: "rgba(15,23,42,0.97)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14, padding: "16px 22px", color: "white",
          minWidth: 300, zIndex: 1000, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                {selectedEvent.type.replace(/_/g, " ").toUpperCase()}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                {selectedEvent.description}
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                <span style={{ color: "#f87171" }}>Severity: {selectedEvent.severity}/10</span>
                <span style={{ color: "#fbbf24" }}>~{selectedEvent.casualties_est} casualties</span>
                <span style={{
                  color: selectedEvent.priority === "CRITICAL" ? "#f472b6" :
                    selectedEvent.priority === "HIGH" ? "#fb923c" : "#94a3b8"
                }}>
                  {selectedEvent.priority}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#4ade80", marginTop: 4 }}>
                {selectedEvent.assigned_agent
                  ? `Primary (scene): ${selectedEvent.assigned_agent}`
                  : "No agent assigned yet"}
              </div>
              {(selectedEvent.secondary_assignments?.length ?? 0) > 0 && (
                <div style={{ fontSize: 10, color: "#e9d5ff", marginTop: 6, lineHeight: 1.45 }}>
                  <div style={{ color: "#94a3b8", marginBottom: 2 }}>Hospital / surge</div>
                  {selectedEvent.secondary_assignments!.map((s, i) => (
                    <div key={i}>● {s.agentId} — {s.role}</div>
                  ))}
                </div>
              )}
              {selectedEvent.sensor_meta?.hardware && (
                <div style={{
                  fontSize: 10, color: "#fde047", marginTop: 8, paddingTop: 8,
                  borderTop: "1px solid rgba(51,65,85,0.8)", lineHeight: 1.45,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {selectedEvent.type === "mine_gas_lora"
                      ? "STM32 · LoRa (pitch)"
                      : selectedEvent.type === "chemical_leak"
                        ? "Plant / hazmat ICS (pitch)"
                        : "Telemetry (pitch)"}
                  </div>
                  {selectedEvent.sensor_meta.hardware}
                  {selectedEvent.sensor_meta.tunnel_node && (
                    <div style={{ color: "#94a3b8" }}>Node {selectedEvent.sensor_meta.tunnel_node}</div>
                  )}
                  {selectedEvent.sensor_meta.readings?.length ? (
                    <div>{selectedEvent.sensor_meta.readings.join(" · ")}</div>
                  ) : null}
                </div>
              )}
            </div>
            <button onClick={() => setSelectedEvent(null)}
              style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
              ×
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => { onResolve(selectedEvent.id); setSelectedEvent(null) }}
              style={{
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                border: "none", borderRadius: 8, padding: "6px 16px",
                color: "white", cursor: "pointer", fontWeight: 600, fontSize: 12,
              }}>
              Mark Resolved
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
