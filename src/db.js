// Lokaler Datenspeicher (IndexedDB). Nichts verlaesst das Geraet.
import { openDB } from 'idb'

const DB_NAME = 'tour-control'
const DB_VERSION = 1

let _db = null

async function db() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('customers')) {
        const c = database.createObjectStore('customers', { keyPath: 'id' })
        c.createIndex('byKey', 'matchKey', { unique: false })
        c.createIndex('byName', 'name', { unique: false })
      }
      if (!database.objectStoreNames.contains('tours')) {
        database.createObjectStore('tours', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' })
      }
    }
  })
  return _db
}

export function uid(prefix = 'id') {
  // bewusst ohne Math.random-Abhaengigkeit an heiklen Stellen; hier in der UI unkritisch
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

// Normalisierter Schluessel, um Kunden ueber unterschiedliche Schreibweisen wiederzufinden
export function matchKey(name = '', plz = '') {
  const n = String(name)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\b(gmbh|kg|ag|ohg|e\.?k\.?|co|mbh|ug|gbr)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
  return (n + '|' + String(plz).replace(/\D/g, '')).trim()
}

// ---------- Kunden ----------

export async function getCustomer(id) {
  return (await db()).get('customers', id)
}

export async function allCustomers() {
  const list = await (await db()).getAll('customers')
  return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'))
}

export async function findCustomerByKey(key) {
  if (!key) return null
  const list = await (await db()).getAllFromIndex('customers', 'byKey', key)
  return list[0] || null
}

export async function saveCustomer(cust) {
  const now = Date.now()
  const rec = {
    notes: [],
    lat: null,
    lon: null,
    ...cust,
    matchKey: matchKey(cust.name, cust.plz),
    updatedAt: now,
    createdAt: cust.createdAt || now
  }
  if (!rec.id) rec.id = uid('cust')
  await (await db()).put('customers', rec)
  return rec
}

// Findet bestehenden Kunden oder legt einen neuen an
export async function upsertCustomerFromStop(stop) {
  const key = matchKey(stop.name, stop.plz)
  let existing = await findCustomerByKey(key)
  if (existing) {
    // Adresse ergaenzen, falls beim Kunden noch leer
    let changed = false
    for (const f of ['street', 'plz', 'city']) {
      if (!existing[f] && stop[f]) { existing[f] = stop[f]; changed = true }
    }
    if (changed) await saveCustomer(existing)
    return existing
  }
  return saveCustomer({
    name: stop.name,
    street: stop.street || '',
    plz: stop.plz || '',
    city: stop.city || ''
  })
}

export async function addNote(customerId, text) {
  const c = await getCustomer(customerId)
  if (!c) return null
  c.notes = c.notes || []
  c.notes.unshift({ id: uid('note'), text: text.trim(), ts: Date.now() })
  await saveCustomer(c)
  return c
}

export async function deleteNote(customerId, noteId) {
  const c = await getCustomer(customerId)
  if (!c) return null
  c.notes = (c.notes || []).filter(n => n.id !== noteId)
  await saveCustomer(c)
  return c
}

export async function setCustomerCoords(customerId, lat, lon) {
  const c = await getCustomer(customerId)
  if (!c) return null
  c.lat = lat
  c.lon = lon
  await saveCustomer(c)
  return c
}

// ---------- Touren ----------

export async function getTour(id) {
  return (await db()).get('tours', id)
}

export async function allTours() {
  const list = await (await db()).getAll('tours')
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export async function saveTour(tour) {
  const now = Date.now()
  const rec = { ...tour, updatedAt: now, createdAt: tour.createdAt || now }
  if (!rec.id) rec.id = uid('tour')
  await (await db()).put('tours', rec)
  return rec
}

export async function deleteTour(id) {
  await (await db()).delete('tours', id)
}

// ---------- Einstellungen ----------

export async function getSetting(key, fallback = null) {
  const rec = await (await db()).get('settings', key)
  return rec ? rec.value : fallback
}

export async function setSetting(key, value) {
  await (await db()).put('settings', { key, value })
}
