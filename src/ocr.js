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
