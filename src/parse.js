// Parser fuer die Beladeliste (linke Empfaenger-Spalte, offline erkannt).
// Anker ist die Ortszeile "DE-09131 CHEMNITZ" bzw. "09131 CHEMNITZ".
// Zeile darueber = Strasse, Zeile darueber = Empfaengername.

function cleanLine(s) {
  return s.replace(/\s+/g, ' ').trim()
}

// Ortszeile: optional "DE-", dann 5-stellige PLZ, dann Ortsname (Buchstabe am Anfang)
const CITY_RE = /(?:DE[-\s]?)?\b(\d{5})\b[\s,]+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .\-/]{1,40})/

// Strassenzeile = endet auf eine Hausnummer ODER auf eine Strassen-Endung (am Wortende!).
// Wichtig: Endung am Zeilenende verankern, sonst matcht z.B. "str" in "Indu-str-ie".
const HOUSE_NO = /\d+\s*[a-zA-Z]?\s*$/
const STREET_END = /(stra(?:ss|ße)e?|str\.?|weg|allee|platz|ring|gasse|damm|ufer|chaussee)\s*$/i

// Zeilen, die sicher keine Adresse sind (Spaltenkoepfe / Kopfdaten der Liste)
const NOISE_RE = /^(anzahl|wareninhalt|gewicht|ma[sß]e|stellpl|einladung|entladung|hallencheck|ok\b|tor\b|seite\b|relation|zusatzinfo|beladeliste|abfertigung|fahrzeug|fahrer|unternehmer|hauptvogel|\d+\s*(plh|pal|ple|ct|pk)\b)/i

function looksLikeStreet(line) {
  if (!line) return false
  if (NOISE_RE.test(line)) return false
  return HOUSE_NO.test(line) || STREET_END.test(line)
}

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
    // Referenz-/Telefonnummern aussortieren: echte Ortszeilen sind kurz
    if (lines[i].length > 38) continue
    const plz = m[1]
    const city = cleanLine(m[2]).replace(/\s{2,}.*$/, '')

    // Strasse: naechste verwertbare Zeile oberhalb der Ortszeile
    let streetIdx = -1
    let street = ''
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      if (isNoise(lines[j])) continue
      if (looksLikeStreet(lines[j])) { street = lines[j]; streetIdx = j; break }
      // erste nicht-rausch Zeile, die keine Strasse ist -> vermutlich schon der Name
      break
    }

    // Name: Zeile(n) oberhalb der Strasse (bzw. oberhalb der Ortszeile)
    const top = streetIdx >= 0 ? streetIdx - 1 : i - 1
    let name = ''
    for (let j = top; j >= Math.max(0, top - 2); j--) {
      // eine Ortszeile ist die Grenze zum vorherigen Stopp -> Suche hier beenden
      if (CITY_RE.test(lines[j])) break
      if (isNoise(lines[j]) || looksLikeStreet(lines[j])) continue
      name = lines[j]
      break
    }

    // Privatkunden: keine Firmenzeile -> die Adresse landet im Namensfeld und die Strasse
    // bleibt leer. Wenn der "Name" eine Hausnummer enthaelt, ihn zusaetzlich als Strasse
    // verwenden, damit der Stopp geortet werden kann.
    if (!street && /\d/.test(name)) street = name

    stops.push(makeStop(name, street, plz, city, [name, street, lines[i]].filter(Boolean).join(' · ')))
  }

  return dedupe(stops)
}

// Doppelte Stopps (gleicher Name + PLZ) zusammenfuehren
function dedupe(stops) {
  const seen = new Map()
  for (const s of stops) {
    const key = (s.name.toLowerCase().replace(/\W/g, '') + s.plz)
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
