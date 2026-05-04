/**
 * RiskHeatmap — Renders colored polygon overlays on the Leaflet map
 * for each risk zone defined in riskZones.ts.
 *
 * Usage:
 *   <RiskHeatmap map={mapRef.current} visible={showRiskZones} />
 *
 * Renders into a custom "riskzones" pane (z-index 450) so zones sit
 * between the grid and station layers.
 */

import { useEffect, useRef } from "react"
import L from "leaflet"
import { riskZones, ZONE_COLORS } from "../lib/riskZones"

interface Props {
  map: L.Map | null
  visible: boolean
}

export default function RiskHeatmap({ map, visible }: Props) {
  const layerRef = useRef<L.LayerGroup>(new L.LayerGroup())

  useEffect(() => {
    if (!map) return

    // Ensure the custom pane exists
    if (!map.getPane("riskzones")) {
      map.createPane("riskzones")
      map.getPane("riskzones")!.style.zIndex = "450"
    }

    if (visible) {
      layerRef.current.clearLayers()

      riskZones.forEach(zone => {
        const colors = ZONE_COLORS[zone.type]
        const latlngs = zone.coordinates.map(([lat, lng]) => [lat, lng] as L.LatLngTuple)

        // Close the polygon
        latlngs.push(latlngs[0])

        L.polygon(latlngs, {
          fillColor: colors.fill,
          color: colors.border,
          fillOpacity: 0.22,
          weight: 1,
          opacity: 0.4,
          pane: "riskzones",
        })
          .bindTooltip(
            `<div style="font-family:monospace;font-size:11px;">
              <strong>${zone.label}</strong><br/>
              Risk: <span style="color:${colors.fill};font-weight:bold;">${zone.type}</span>
            </div>`,
            { direction: "center", className: "risk-zone-tooltip" }
          )
          .addTo(layerRef.current)
      })

      layerRef.current.addTo(map)
    } else {
      layerRef.current.clearLayers()
      if (map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current)
      }
    }

    return () => {
      layerRef.current.clearLayers()
    }
  }, [map, visible])

  return null // Pure side-effect component
}
