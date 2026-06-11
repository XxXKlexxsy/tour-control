// Texterkennung auf dem Geraet (offline) mit Tesseract.js, deutsche Sprache.
import { createWorker } from 'tesseract.js'

let _worker = null

async function getWorker(onProgress) {
  if (_worker) return _worker
  _worker = await createWorker('deu', 1, {
    logger: m => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round((m.progress || 0) * 100))
      }
    }
  })
  // PSM 4 = einzelne Textspalte mit unterschiedlichen Schriftgroessen (passt zur
  // zugeschnittenen Empfaenger-Spalte: grosser Name, kleinere Adresszeilen).
  // Wortabstaende erhalten -> Zeilen verschmelzen seltener.
  await _worker.setParameters({
    tessedit_pageseg_mode: '4',
    preserve_interword_spaces: '1'
  })
  return _worker
}

// Liefert den erkannten Rohtext eines Bildes (File/Blob/DataURL).
export async function recognize(image, onProgress) {
  const worker = await getWorker(onProgress)
  const { data } = await worker.recognize(image)
  return data.text || ''
}

export async function terminateOcr() {
  if (_worker) {
    await _worker.terminate()
    _worker = null
  }
}
