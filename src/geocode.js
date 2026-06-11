// Geocoding ueber OpenStreetMap Nominatim (kostenlos, ohne API-Schluessel).
// Nutzungsregeln: max. 1 Anfrage/Sekunde. Ergebnisse werden beim Kunden lokal
// zwischengespeichert, sodass danach kein Internet mehr noetig ist.

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'

let _lastCall = 0

async function rateLimit() {
  const now = Date.now()
  const wait = 1100 - (now - _lastCall)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  _lastCall = Date.now()
}

function buildQuery({ street, plz, city, name }) {
  // Strasse bevorzugen; fehlt sie (z.B. Privatkunde mit Adresse im Namensfeld),
  // ersatzweise den Namen als Adresszeile verwenden.
  const line1 = street && street.trim() ? street : (name || '')
  return [line1, [plz, city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

// Liefert {lat, lon} oder null. Wirft bei fehlendem Netz nicht, sondern gibt null zurueck.
export async function geocode(addr) {
  const q = buildQuery(addr)
  if (!q || q.replace(/\W/g, '').length < 4) return null
  await rateLimit()
  try {
    const url = `${ENDPOINT}?format=jsonv2&limit=1&countrycodes=de&q=${encodeURIComponent(q)}`
    const res = await fetch(url, { headers: { 'Accept-Language': 'de' } })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || !data.length) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}
