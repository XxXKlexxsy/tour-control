// Routenoptimierung, vollstaendig lokal (offline). Luftlinien-Distanz (Haversine),
// Nearest-Neighbor als Startloesung, anschliessend 2-opt-Verbesserung.
// Reicht fuer Auslieferungstouren in einem Gebiet sehr gut aus.

export function haversine(a, b) {
  const R = 6371 // km
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function pathLength(points) {
  let d = 0
  for (let i = 0; i < points.length - 1; i++) d += haversine(points[i], points[i + 1])
  return d
}

function nearestNeighbor(start, points) {
  const remaining = points.slice()
  const order = []
  let cur = start
  while (remaining.length) {
    let bi = 0
    let bd = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(cur, remaining[i])
      if (d < bd) { bd = d; bi = i }
    }
    cur = remaining[bi]
    order.push(cur)
    remaining.splice(bi, 1)
  }
  return order
}

function twoOpt(start, order) {
  let best = order.slice()
  let improved = true
  const full = o => [start, ...o]
  while (improved) {
    improved = false
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1))
        if (pathLength(full(candidate)) < pathLength(full(best)) - 1e-9) {
          best = candidate
          improved = true
        }
      }
    }
  }
  return best
}

/**
 * @param {{lat:number,lon:number}} start  Depot/Startpunkt
 * @param {Array<object>} stops  Stopps mit lat/lon (und beliebigen weiteren Feldern)
 * @returns {{ordered:Array, unlocated:Array, distanceKm:number, loadingOrder:Array}}
 */
export function optimize(start, stops) {
  const located = stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon))
  const unlocated = stops.filter(s => !(Number.isFinite(s.lat) && Number.isFinite(s.lon)))

  if (!start || !Number.isFinite(start.lat) || located.length < 2) {
    return {
      ordered: located,
      unlocated,
      distanceKm: located.length ? pathLength([start, ...located].filter(p => p && Number.isFinite(p.lat))) : 0,
      loadingOrder: located.slice().reverse()
    }
  }

  const nn = nearestNeighbor(start, located)
  const opt = twoOpt(start, nn)
  const distanceKm = pathLength([start, ...opt])

  return {
    ordered: opt,
    unlocated,
    distanceKm,
    // LIFO: zuerst zugestellt = zuletzt geladen -> Ladereihenfolge ist die umgekehrte Lieferreihenfolge
    loadingOrder: opt.slice().reverse()
  }
}
