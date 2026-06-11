import { el, clear, toast } from '../ui.js'
import { recognize } from '../ocr.js'
import { parseLoadingList, emptyStop } from '../parse.js'
import { saveTour, upsertCustomerFromStop } from '../db.js'
import { fileToImage, preprocessToCanvas, previewCanvas } from '../imaging.js'

export async function renderNewTour(root) {
  let stops = []
  let images = [] // { id, file, img }
  let leftFraction = 0.45
  let contrast = true

  root.appendChild(el('div', { class: 'header-row' }, [
    el('h1', { text: 'Neue Tour' }),
    el('a', { href: '#/', class: 'btn ghost', text: 'Abbrechen' })
  ]))

  // versteckte Datei-Inputs: Kamera (einzeln) + Galerie (mehrere)
  const camInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', onchange: e => addFiles(e.target.files, e) })
  const galInput = el('input', { type: 'file', accept: 'image/*', multiple: true, class: 'hidden', onchange: e => addFiles(e.target.files, e) })

  const captureBox = el('div', { class: 'capture-box' }, [
    el('div', { class: 'capture-illus', html: '📋📷' }),
    el('p', { class: 'muted center', text: 'Ladeliste(n) fotografieren oder auswählen. Mehrseitige Listen: einfach mehrere Bilder hinzufügen.' }),
    el('div', { class: 'row gap center' }, [
      el('button', { class: 'btn primary', text: '📷 Foto aufnehmen', onclick: () => camInput.click() }),
      el('button', { class: 'btn ghost', text: '🖼 Bilder wählen', onclick: () => galInput.click() })
    ]),
    el('button', { class: 'btn ghost small-link', text: '✍️ Ohne Foto manuell starten', onclick: () => { stops = [emptyStop(0)]; showEditor() } }),
    camInput, galInput
  ])
  root.appendChild(captureBox)

  // Bereich: Thumbnails + Zuschnitt + Erkennen
  const prepWrap = el('div', { class: 'prep-wrap hidden' })
  root.appendChild(prepWrap)

  const progress = el('div', { class: 'progress-bar hidden' }, [el('div', { class: 'bar' })])
  const progressLabel = el('div', { class: 'muted center hidden', style: 'margin-top:6px' })
  root.appendChild(progress)
  root.appendChild(progressLabel)

  const editorWrap = el('div', { class: 'editor-wrap' })
  root.appendChild(editorWrap)

  async function addFiles(fileList, ev) {
    const files = [...(fileList || [])]
    if (ev?.target) ev.target.value = '' // erlaubt erneutes Auswaehlen desselben Bildes
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue
      try {
        const img = await fileToImage(f)
        images.push({ id: 'img_' + images.length + '_' + Math.random().toString(36).slice(2, 6), file: f, img })
      } catch { toast('Bild konnte nicht geladen werden', 'error') }
    }
    renderPrep()
  }

  function renderPrep() {
    if (!images.length) { prepWrap.classList.add('hidden'); return }
    prepWrap.classList.remove('hidden')
    clear(prepWrap)

    prepWrap.appendChild(el('div', { class: 'section-head' }, [
      el('h2', { text: `Seiten (${images.length})` }),
      el('button', { class: 'btn tiny ghost', text: '+ weitere', onclick: () => galInput.click() })
    ]))

    // Thumbnails
    const thumbs = el('div', { class: 'thumbs' })
    images.forEach((im, idx) => {
      const c = previewCanvas(im.img, leftFraction, 130)
      c.className = 'thumb-canvas'
      thumbs.appendChild(el('div', { class: 'thumb' }, [
        c,
        el('span', { class: 'thumb-num', text: String(idx + 1) }),
        el('button', { class: 'thumb-x', html: '✕', title: 'Entfernen', onclick: () => { images.splice(idx, 1); renderPrep() } })
      ]))
    })
    prepWrap.appendChild(thumbs)

    // Zuschnitt-Regler mit Live-Vorschau am ersten Bild
    const preview = el('div', { class: 'crop-preview' })
    const drawPreview = () => { clear(preview); const pc = previewCanvas(images[0].img, leftFraction, 320); pc.className = 'crop-canvas'; preview.appendChild(pc) }
    drawPreview()

    const slider = el('input', { type: 'range', min: '20', max: '100', value: String(Math.round(leftFraction * 100)), class: 'slider' })
    slider.addEventListener('input', () => {
      leftFraction = parseInt(slider.value, 10) / 100
      drawPreview()
      // Thumbs-Rahmen mitziehen (leichtgewichtig: nur erstes neu zeichnen reicht visuell)
    })
    slider.addEventListener('change', () => renderPrep())

    prepWrap.appendChild(el('div', { class: 'crop-box' }, [
      el('div', { class: 'crop-head muted small', text: 'Blauer Rahmen = erkannter Bereich. Nur die linke Empfänger-Spalte einrahmen.' }),
      preview,
      el('label', { class: 'slider-row' }, [
        el('span', { class: 'small muted', text: 'Spaltenbreite' }),
        slider,
        el('span', { class: 'small', text: Math.round(leftFraction * 100) + '%' })
      ]),
      el('label', { class: 'check-row' }, [
        (() => { const cb = el('input', { type: 'checkbox' }); cb.checked = contrast; cb.addEventListener('change', () => contrast = cb.checked); return cb })(),
        el('span', { class: 'small', text: 'Kontrast verbessern (für dunkle Namensboxen)' })
      ])
    ]))

    prepWrap.appendChild(el('button', { class: 'btn primary wide', text: '🔍 Stopps erkennen', onclick: runOcr }))
  }

  async function runOcr() {
    progress.classList.remove('hidden')
    progressLabel.classList.remove('hidden')
    const bar = progress.querySelector('.bar')
    let combined = ''
    try {
      for (let p = 0; p < images.length; p++) {
        progressLabel.textContent = `Seite ${p + 1}/${images.length} wird gelesen …`
        const canvas = preprocessToCanvas(images[p].img, { leftFraction, contrast })
        const text = await recognize(canvas, pct => {
          const base = (p / images.length) * 100
          const span = (1 / images.length) * pct
          bar.style.width = Math.max(5, base + span) + '%'
          progressLabel.textContent = `Seite ${p + 1}/${images.length} · ${pct}%`
        })
        combined += '\n' + text
      }
      const parsed = parseLoadingList(combined)
      stops = parsed.length ? parsed : [emptyStop(0)]
      progressLabel.textContent = `${parsed.length} Stopps erkannt – bitte prüfen.`
      showEditor()
    } catch (err) {
      console.error(err)
      toast('Erkennung fehlgeschlagen – bitte manuell eingeben', 'error')
      stops = stops.length ? stops : [emptyStop(0)]
      showEditor()
    } finally {
      setTimeout(() => progress.classList.add('hidden'), 700)
    }
  }

  // ----- Editor -----
  function showEditor() {
    clear(editorWrap)
    editorWrap.appendChild(el('div', { class: 'section-head' }, [
      el('h2', { text: 'Stopps prüfen & korrigieren' }),
      el('span', { class: 'muted small', text: 'Name + PLZ genügen' })
    ]))

    const tableWrap = el('div', { class: 'stops-edit' })
    editorWrap.appendChild(tableWrap)
    renderStops(tableWrap)

    editorWrap.appendChild(el('div', { class: 'row gap', style: 'margin-top:12px' }, [
      el('button', { class: 'btn ghost', text: '+ Stopp hinzufügen', onclick: () => { stops.push(emptyStop(stops.length)); renderStops(tableWrap) } })
    ]))

    const nameField = el('input', { class: 'input', placeholder: 'Tour-Name (optional)', type: 'text' })
    editorWrap.appendChild(el('div', { class: 'save-bar' }, [
      nameField,
      el('button', { class: 'btn primary', text: '✓ Tour speichern', onclick: () => saveAll(nameField.value) })
    ]))

    editorWrap.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function renderStops(wrap) {
    clear(wrap)
    stops.forEach((s, idx) => {
      const card = el('div', { class: 'stop-edit-card' }, [
        el('div', { class: 'stop-edit-head' }, [
          el('span', { class: 'stop-num', text: String(idx + 1) }),
          el('input', { class: 'input grow', placeholder: 'Empfänger / Kundenname', value: s.name, oninput: e => s.name = e.target.value }),
          el('button', { class: 'icon-btn', html: '✕', title: 'Entfernen', onclick: () => { stops.splice(idx, 1); renderStops(wrap) } })
        ]),
        el('input', { class: 'input', placeholder: 'Straße + Nr.', value: s.street, oninput: e => s.street = e.target.value }),
        el('div', { class: 'row gap' }, [
          el('input', { class: 'input plz', placeholder: 'PLZ', value: s.plz, inputmode: 'numeric', oninput: e => s.plz = e.target.value }),
          el('input', { class: 'input grow', placeholder: 'Ort', value: s.city, oninput: e => s.city = e.target.value })
        ]),
        s.raw ? el('div', { class: 'raw-hint muted', text: 'Erkannt: ' + s.raw }) : null
      ])
      wrap.appendChild(card)
    })
  }

  async function saveAll(name) {
    const valid = stops.filter(s => (s.name && s.name.trim()) || s.plz || s.street)
    if (!valid.length) { toast('Bitte mindestens einen Stopp ausfüllen', 'error'); return }

    const enriched = []
    for (const s of valid) {
      const cust = await upsertCustomerFromStop(s)
      enriched.push({
        id: s.id,
        customerId: cust.id,
        name: cust.name,
        street: s.street || cust.street || '',
        plz: s.plz || cust.plz || '',
        city: s.city || cust.city || '',
        qty: '',
        status: 'open'
      })
    }

    const tour = await saveTour({ name: name?.trim() || '', stops: enriched, optimized: false })
    toast('Tour gespeichert')
    location.hash = '#/tour/' + tour.id
  }
}
