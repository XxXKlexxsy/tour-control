// Bildaufbereitung fuer bessere Offline-Texterkennung:
// linke Empfaenger-Spalte zuschneiden, sinnvoll skalieren, Kontrast anheben.

export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve(img); /* URL bleibt gueltig bis GC; bewusst nicht sofort revoken */ }
    img.onerror = e => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

/**
 * Schneidet die linke Spalte zu und bereitet das Bild fuer Tesseract auf.
 * @param {HTMLImageElement} img
 * @param {object} opt
 * @param {number} opt.leftFraction  Anteil der linken Spalte (0..1), 1 = ganze Seite
 * @param {boolean} opt.contrast     Graustufen + Kontraststreckung
 * @returns {HTMLCanvasElement}
 */
export function preprocessToCanvas(img, { leftFraction = 1, contrast = true } = {}) {
  const sw = Math.max(1, Math.round(img.naturalWidth * Math.min(1, Math.max(0.1, leftFraction))))
  const sh = img.naturalHeight

  // Zielbreite ~1800px (hoehere Aufloesung -> schaerfere Buchstaben, weniger OCR-Muell)
  const targetW = 1800
  let scale = targetW / sw
  scale = Math.max(0.5, Math.min(scale, 2.5))

  const cw = Math.round(sw * scale)
  const ch = Math.round(sh * scale)

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, sw, sh, 0, 0, cw, ch)

  if (contrast) {
    const id = ctx.getImageData(0, 0, cw, ch)
    const d = id.data
    const factor = 1.45 // moderate Kontraststreckung
    for (let i = 0; i < d.length; i += 4) {
      let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      g = (g - 128) * factor + 128
      g = g < 0 ? 0 : g > 255 ? 255 : g
      d[i] = d[i + 1] = d[i + 2] = g
    }
    ctx.putImageData(id, 0, 0)
  }
  return canvas
}

// Kleine Vorschau (skaliert) inkl. eingezeichnetem Crop-Rahmen fuer die Oberflaeche.
export function previewCanvas(img, leftFraction, maxW = 320) {
  const scale = Math.min(1, maxW / img.naturalWidth)
  const cw = Math.round(img.naturalWidth * scale)
  const ch = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, cw, ch)
  // abgedunkelter Bereich rechts des Schnitts
  const cut = Math.round(cw * Math.min(1, Math.max(0.1, leftFraction)))
  ctx.fillStyle = 'rgba(15,23,42,0.62)'
  ctx.fillRect(cut, 0, cw - cut, ch)
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, cut - 2, ch - 2)
  return canvas
}
