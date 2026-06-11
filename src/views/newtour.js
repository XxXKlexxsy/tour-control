import { el, clear, toast } from '../ui.js'
import { recognize } from '../ocr.js'
import { parseLoadingList, emptyStop } from '../parse.js'
import { saveTour, upsertCustomerFromStop } from '../db.js'

export async function renderNewTour(root) {
  let stops = []

  root.appendChild(el('div', { class: 'header-row' }, [
    el('h1', { text: 'Neue Tour' }),
    el('a', { href: '#/', class: 'btn ghost', text: 'Abbrechen' })
  ]))

  // ----- Schritt 1: Foto / Eingabe -----
  const fileInput = el('input', {
    type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden',
    onchange: e => handleFile(e.target.files[0])
  })

  const progress = el('div', { class: 'progress-bar hidden' }, [el('div', { class: 'bar' })])
  const progressLabel = el('div', { class: 'muted center hidden' })

  const captureBox = el('div', { class: 'capture-box' }, [
    el('div', { class: 'capture-illus', html: '📋📷' }),
    el('p', { class: 'muted center', text: 'Ladeliste fotografieren oder Bild auswählen. Die Texterkennung läuft direkt auf dem Gerät.' }),
    el('div', { class: 'row gap center' }, [
      el('button', { class: 'btn primary', text: '📷 Foto aufnehmen', onclick: () => fileInput.click() }),
      el('button', { class: 'btn ghost', text: '✍️ Manuell starten', onclick: () => { stops = [emptyStop(0)]; showEditor() } })
    ]),
    fileInput, progress, progressLabel
  ])
  root.appendChild(captureBox)

  // Bereich fuer den Editor (Schritt 2)
  const editorWrap = el('div', { class: 'editor-wrap' })
  root.appendChild(editorWrap)

  async function handleFile(file) {
    if (!file) return
    progress.classList.remove('hidden')
    progressLabel.classList.remove('hidden')
    progressLabel.textContent = 'Bild wird gelesen …'
    const bar = progress.querySelector('.bar')
    bar.style.width = '5%'
    try {
      const text = await recognize(file, pct => {
        bar.style.width = Math.max(5, pct) + '%'
        progressLabel.textContent = `Texterkennung … ${pct}%`
      })
      const parsed = parseLoadingList(text)
      stops = parsed.length ? parsed : [emptyStop(0)]
      progressLabel.textContent = `${parsed.length} Stopps erkannt – bitte prüfen.`
      showEditor()
    } catch (err) {
      console.error(err)
      toast('Texterkennung fehlgeschlagen – bitte manuell eingeben', 'error')
      stops = [emptyStop(0)]
      showEditor()
    } finally {
      setTimeout(() => { progress.classList.add('hidden') }, 600)
    }
  }

  // ----- Schritt 2: Editor -----
  function showEditor() {
    clear(editorWrap)
    editorWrap.appendChild(el('div', { class: 'section-head' }, [
      el('h2', { text: 'Stopps prüfen & korrigieren' }),
      el('span', { class: 'muted', text: 'Name + PLZ genügen für die Route' })
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
          el('input', { class: 'input grow', placeholder: 'Kundenname', value: s.name, oninput: e => s.name = e.target.value }),
          el('button', { class: 'icon-btn', html: '✕', title: 'Entfernen', onclick: () => { stops.splice(idx, 1); renderStops(wrap) } })
        ]),
        el('div', { class: 'grid2' }, [
          el('input', { class: 'input', placeholder: 'Straße + Nr.', value: s.street, oninput: e => s.street = e.target.value }),
          el('div', { class: 'row gap' }, [
            el('input', { class: 'input plz', placeholder: 'PLZ', value: s.plz, inputmode: 'numeric', oninput: e => s.plz = e.target.value }),
            el('input', { class: 'input grow', placeholder: 'Ort', value: s.city, oninput: e => s.city = e.target.value })
          ])
        ]),
        el('input', { class: 'input', placeholder: 'Menge / Hinweis von der Liste', value: s.qty, oninput: e => s.qty = e.target.value }),
        s.raw ? el('div', { class: 'raw-hint muted', text: 'Original: ' + s.raw }) : null
      ])
      wrap.appendChild(card)
    })
  }

  async function saveAll(name) {
    const valid = stops.filter(s => (s.name && s.name.trim()) || s.plz || s.street)
    if (!valid.length) { toast('Bitte mindestens einen Stopp ausfüllen', 'error'); return }

    // Kunden anlegen/finden und Kunden-ID am Stopp hinterlegen
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
        qty: s.qty || '',
        status: 'open'
      })
    }

    const tour = await saveTour({
      name: name?.trim() || '',
      stops: enriched,
      optimized: false
    })
    toast('Tour gespeichert')
    location.hash = '#/tour/' + tour.id
  }
}
