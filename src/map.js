// Leaflet-Karte mit OpenStreetMap. Wird nur bei Bedarf geladen.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Standard-Marker-Icons aus dem Paket korrekt einbinden (Vite-Asset-URLs)
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

function numberedIcon(n, color = '#2563eb') {
  return L.divIcon({
    className: 'num-marker',
    html: `<div class="pin" style="background:${color}">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  })
}

// stops: [{lat, lon, label, n}], start: {lat, lon} | null
export function renderRouteMap(container, start, stops) {
  const map = L.map(container, { zoomControl: true, attributionControl: true })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map)

  const pts = []
  if (start && Number.isFinite(start.lat)) {
    L.marker([start.lat, start.lon], { icon: numberedIcon('🏠', '#0f172a') })
      .addTo(map).bindPopup('Start / Depot')
    pts.push([start.lat, start.lon])
  }

  const line = start && Number.isFinite(start.lat) ? [[start.lat, start.lon]] : []
  stops.forEach(s => {
    if (!Number.isFinite(s.lat)) return
    L.marker([s.lat, s.lon], { icon: numberedIcon(s.n) }).addTo(map).bindPopup(s.label)
    pts.push([s.lat, s.lon])
    line.push([s.lat, s.lon])
  })

  if (line.length > 1) L.polyline(line, { color: '#2563eb', weight: 3, opacity: 0.7 }).addTo(map)

  if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 14 })
  else map.setView([51.16, 10.45], 6) // Deutschland

  // Karte nach Layout neu vermessen
  setTimeout(() => map.invalidateSize(), 100)
  return map
}
