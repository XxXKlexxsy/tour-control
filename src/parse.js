// Parser fuer die Beladeliste (linke Empfaenger-Spalte, offline erkannt).
// Feste Struktur pro Stopp (auf jedem Zettel gleich):
//   Zeile 1: Empfaenger (Name; Firma ODER Privatperson)
//   Zeile 2: Strasse + Hausnummer
//   Zeile 3: "DE-09131 CHEMNITZ"  (PLZ + Stadt)
// Anker ist die PLZ/Stadt-Zeile; die verwertbaren Zeilen darueber sind Strasse bzw. Name.

// Erlaubte Zeichen; OCR-Muell (|, *, #, ~ usw.) wird zu Leerzeichen.
function cleanLine(s) {
  return String(s)
    .replace(/[^0-9A-Za-zÄÖÜäöüß.,\-/&()'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Ortszeile: optional "DE-"/"DE ", 5-stellige PLZ, dann Ortsname
const CITY_RE = /(?:DE[-\s]?)?\b(\d{5})\b[\s,]+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .\-/]{1,40})/

// Zeilen, die keine Adresse sind (Spaltenkoepfe / Mengen-/Kopfzeilen der Liste)
const NOISE_RE = /^(anzahl|wareninhalt|gewicht|ma[sß]e|stellpl|einladung|entladung|hallencheck|ok\b|tor\b|seite\b|relation|zusatzinfo|beladeliste|abfertigung|fahrzeug|fahrer|unternehmer|hauptvogel|\d+\s*(plh|pal|ple|ct|pk)\b)/i

// Deutsche Strassen-Endungen (fuer das Auftrennen verschmolzener Zeilen)
const STREET_SUFFIX = '(?:stra(?:ss|ß)e|str\\.?|weg|allee|platz|ring|gasse|damm|ufer|chaussee|graben|anger|markt|hofe?|berg|wall|garten|kamp|steig|pfad|aue|feld|breite|reihe|winkel|blick|h[oö]he)'
// "<Name> <Strassenwort mit Endung> <Hausnr>" am Zeilenende
const MERGED_RE = new RegExp(
  '^(.*?[A-Za-zÄÖÜäöüß])\\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9.\\-]*' + STREET_SUFFIX + '\\.?)\\s+(\\d{1,4}\\s*[a-zA-Z]?)\\s*$',
  'i'
)
const STREET_PREFIX = /^(am|an|auf|zur|zum|im|in|bei|zu|alte[nr]?|neue[nr]?)$/i

function isNoise(line) {
  return !line || line.length < 2 || NOISE_RE.test(line)
}

const DIR_PREFIX = /^(am|an|auf|zur|zum|im|in|bei|zu)$/i

// Trennt eine evtl. verschmolzene "Name + Strasse + Hausnr"-Zeile auf.
function splitNameStreet(line) {
  const m = line.match(MERGED_RE)
  if (m) {
    let pre = cleanLine(m[1])
    let street = cleanLine(m[2] + ' ' + m[3])
    // Strassen-Praefix ("Am Fuchsgraben") wieder zur Strasse ziehen, falls es am Namensende haengt
    const words = pre.split(' ')
    if (words.length && DIR_PREFIX.test(words[words.length - 1])) {
      street = words.pop() + ' ' + street
      pre = words.join(' ')
    }
    // pre nur akzeptieren, wenn es ein echter Name ist (nicht nur ein Strassen-Praefix wie "Am")
    if (pre.length >= 3 && !STREET_PREFIX.test(pre)) return { name: pre, street }
  }
  return { name: '', street: cleanLine(line) }
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

    let name, street
    if (above.length >= 2) {
      // Normalfall: Strasse und Name stehen auf getrennten Zeilen
      street = above[0]
      name = above[1]
    } else if (above.length === 1) {
      // Nur eine Zeile -> evtl. Name+Strasse verschmolzen (oder Privatkunde ohne Name)
      const sp = splitNameStreet(above[0])
      street = sp.street
      name = sp.name
    } else {
      street = ''
      name = ''
    }

    stops.push(makeStop(name, street, plz, city, [name || street, street, lines[i]].filter(Boolean).join(' · ')))
  }

  return dedupe(stops)
}

// Doppelte Stopps (gleicher Name + PLZ + Strasse) zusammenfuehren
function dedupe(stops) {
  const seen = new Map()
  for (const s of stops) {
    const key = s.name.toLowerCase().replace(/\W/g, '') + s.plz + s.street.toLowerCase().replace(/\W/g, '')
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
