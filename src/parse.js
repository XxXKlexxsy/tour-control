// Heuristischer Parser: aus OCR-Rohtext werden Liefer-Stopps (Kunde + Adresse + Menge).
// Ladelisten sind sehr unterschiedlich aufgebaut, daher bewusst grob -> der Fahrer
// korrigiert anschliessend in der Oberflaeche. Anker ist die deutsche PLZ (5 Ziffern).

const PLZ_RE = /\b(\d{5})\b/
const STREET_RE = /\b([A-Za-zÄÖÜäöüß.\-]+(?:str(?:\.|asse|aße)?|weg|allee|platz|ring|gasse|damm|ufer|chaussee))\s*\.?\s*(\d+\s*[a-zA-Z]?)/i
// Menge: z.B. "12 Stk", "3 Paletten", "5x", "2 Coll"
const QTY_RE = /\b(\d{1,4})\s*(stk|st\.?|x|pal\.?|paletten?|coll[io]?|kart\.?|kartons?|kisten?|st[üu]ck|ce|pk)\b/i

function cleanLine(s) {
  return s.replace(/\s+/g, ' ').trim()
}

function looksLikeHeader(line) {
  return /(ladeliste|tour|datum|fahrer|kennzeichen|seite|summe|gesamt|unterschrift|kunden\-?nr|pos\b)/i.test(line)
}

// Versucht, aus einer "Stadt-Zeile" PLZ + Ort zu trennen
function splitPlzCity(line) {
  const m = line.match(PLZ_RE)
  if (!m) return { plz: '', city: '' }
  const plz = m[1]
  const after = line.slice(line.indexOf(plz) + 5).replace(/^[\s,.-]+/, '')
  const city = cleanLine(after.split(/\s{2,}|,/)[0] || '')
  return { plz, city }
}

export function parseLoadingList(rawText) {
  const lines = String(rawText)
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(l => l.length > 1 && !looksLikeHeader(l))

  const stops = []
  let current = null

  const flush = () => {
    if (current && current.name) stops.push(current)
    current = null
  }

  for (const line of lines) {
    const hasPlz = PLZ_RE.test(line)
    const street = line.match(STREET_RE)
    const qty = line.match(QTY_RE)

    // Eine PLZ schliesst in der Regel einen Adressblock ab
    if (hasPlz) {
      if (!current) current = { name: '', street: '', plz: '', city: '', qty: '', raw: line }
      const { plz, city } = splitPlzCity(line)
      current.plz = plz
      current.city = city
      // Falls Strasse in derselben Zeile steht
      if (street && !current.street) current.street = cleanLine(street[0])
      flush()
      continue
    }

    if (street) {
      if (!current) current = { name: '', street: '', plz: '', city: '', qty: '', raw: line }
      current.street = cleanLine(street[0])
      const rest = cleanLine(line.replace(street[0], ''))
      if (rest && !current.name) current.name = rest
      continue
    }

    if (qty) {
      if (!current) current = { name: '', street: '', plz: '', city: '', qty: '', raw: line }
      current.qty = `${qty[1]} ${qty[2]}`.trim()
      const rest = cleanLine(line.replace(qty[0], ''))
      if (rest && !current.name) current.name = rest
      continue
    }

    // sonst: vermutlich der Kundenname (oder Fortsetzung)
    if (!current) current = { name: '', street: '', plz: '', city: '', qty: '', raw: line }
    if (!current.name) current.name = line
    else current.name = cleanLine(current.name + ' ' + line).slice(0, 120)
  }
  flush()

  // Stopps ohne irgendeine verwertbare Info verwerfen
  return stops
    .filter(s => s.name || s.street || s.plz)
    .map((s, i) => ({
      id: 's_' + i + '_' + (s.plz || '') + (s.name || '').replace(/\W/g, '').slice(0, 6),
      name: s.name || '(unbekannter Kunde)',
      street: s.street || '',
      plz: s.plz || '',
      city: s.city || '',
      qty: s.qty || '',
      raw: s.raw || '',
      status: 'open'
    }))
}

export function emptyStop(i = 0) {
  return {
    id: 's_new_' + i + '_' + Date.now().toString(36),
    name: '', street: '', plz: '', city: '', qty: '', raw: '', status: 'open'
  }
}
