// Parser fuer die Beladeliste (linke Empfaenger-Spalte, offline erkannt).
// Feste Struktur pro Stopp (auf jedem Zettel gleich):
//   Zeile 1: Empfaenger (Name)
//   Zeile 2: Strasse + Hausnummer
//   Zeile 3: "DE-09131 CHEMNITZ"  (PLZ + Stadt)
// Anker ist die PLZ/Stadt-Zeile; die beiden verwertbaren Zeilen darueber sind
// Strasse bzw. Name -> keine Rate-Heuristik noetig.

function cleanLine(s) {
  return s.replace(/\s+/g, ' ').trim()
}

// Ortszeile: optional "DE-"/"DE ", 5-stellige PLZ, dann Ortsname
const CITY_RE = /(?:DE[-\s]?)?\b(\d{5})\b[\s,]+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .\-/]{1,40})/

// Zeilen, die keine Adresse sind (Spaltenkoepfe / Mengen-/Kopfzeilen der Liste)
const NOISE_RE = /^(anzahl|wareninhalt|gewicht|ma[sß]e|stellpl|einladung|entladung|hallencheck|ok\b|tor\b|seite\b|relation|zusatzinfo|beladeliste|abfertigung|fahrzeug|fahrer|unternehmer|hauptvogel|\d+\s*(plh|pal|ple|ct|pk)\b)/i

function isNoise(line) {
  return !line || line.length < 2 || NOISE_RE.test(line)
}

function makeStop(name, street, plz, city, raw) {
  return {
    id: 's_' + plz + '_' + String(name).replace(/\W/g, '').slice(0, 8) + '_' + Math.random().toString(36).slice(2, 6),
    // ohne Firmennamen (Privatkunde) den Stopp ueber die Adresse identifizieren
    name: cleanLine(name) || cleanLine(street) || '(unbekannter Kunde)',
    street: cleanLine(street),
    plz,
    city: cleanLine(city),
    qty: '',
    raw: raw || '',
    status: 'open'
  }
}

export function parseLoadingList(rawText) {
  const lines = String(rawText).split(/\r?\n/).map(cleanLine).filter(l => l.length > 1)
  const stops = []

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(CITY_RE)
    if (!m) continue
    if (lines[i].length > 40) continue // lange Zeilen (Referenz-/Telefonnummern) ausschliessen

    const plz = m[1]
    const city = cleanLine(m[2]).replace(/\s{2,}.*$/, '')

    // Bis zu zwei verwertbare Zeilen oberhalb sammeln: [0] = Strasse, [1] = Name.
    // Eine weitere Ortszeile ist die Grenze zum vorherigen Stopp -> stoppen.
    const above = []
    for (let j = i - 1; j >= 0 && above.length < 2; j--) {
      if (CITY_RE.test(lines[j])) break
      if (isNoise(lines[j])) continue
      above.push(lines[j])
    }

    const street = above[0] || ''
    const name = above[1] || ''

    stops.push(makeStop(name, street, plz, city, [name || street, street, lines[i]].filter(Boolean).join(' · ')))
  }

  return dedupe(stops)
}

// Doppelte Stopps (gleicher Name + PLZ) zusammenfuehren
function dedupe(stops) {
  const seen = new Map()
  for (const s of stops) {
    const key = (s.name.toLowerCase().replace(/\W/g, '') + s.plz + s.street.toLowerCase().replace(/\W/g, ''))
    if (!seen.has(key)) seen.set(key, s)
  }
  return [...seen.values()]
}

export function emptyStop(i = 0) {
  return {
    id: 's_new_' + i + '_' + Math.random().toString(36).slice(2, 8),
    name: '', street: '', plz: '', city: '', qty: '', raw: '', status: 'open'
  }
}
