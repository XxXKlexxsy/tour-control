import { el, clear, toast, fmtDateTime, confirmDialog } from '../ui.js'
import { getCustomer, saveCustomer, addNote, deleteNote } from '../db.js'

export async function renderCustomer(root, [id]) {
  let c = await getCustomer(id)
  if (!c) { root.appendChild(el('p', { text: 'Kunde nicht gefunden.' })); return }

  root.appendChild(el('a', { href: '#/kunden', class: 'back-link', text: '‹ Kunden' }))

  // ----- Stammdaten -----
  const header = el('div', { class: 'cust-header' })
  root.appendChild(header)

  function renderHeader() {
    clear(header)
    header.appendChild(el('h1', { text: c.name }))
    header.appendChild(el('div', { class: 'muted', text: [c.street, [c.plz, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '— keine Adresse —' }))
    header.appendChild(el('div', { class: 'row gap', style: 'margin-top:8px' }, [
      el('button', { class: 'btn tiny ghost', text: '✏️ Stammdaten bearbeiten', onclick: editFields }),
      Number.isFinite(c.lat)
        ? el('span', { class: 'chip ok', text: '📍 verortet' })
        : el('span', { class: 'chip', text: '📍 nicht verortet' })
    ]))
  }

  function editFields() {
    clear(header)
    const fName = el('input', { class: 'input', value: c.name, placeholder: 'Name' })
    const fStreet = el('input', { class: 'input', value: c.street || '', placeholder: 'Straße + Nr.' })
    const fPlz = el('input', { class: 'input plz', value: c.plz || '', placeholder: 'PLZ' })
    const fCity = el('input', { class: 'input grow', value: c.city || '', placeholder: 'Ort' })
    header.appendChild(el('div', { class: 'edit-fields' }, [
      fName, fStreet,
      el('div', { class: 'row gap' }, [fPlz, fCity]),
      el('div', { class: 'row gap' }, [
        el('button', { class: 'btn primary', text: 'Speichern', onclick: async () => {
          c.name = fName.value.trim() || c.name
          c.street = fStreet.value.trim()
          // Bei Adressaenderung Koordinaten verwerfen, damit neu geocodiert wird
          const addrChanged = c.plz !== fPlz.value.trim() || c.street !== fStreet.value.trim() || c.city !== fCity.value.trim()
          c.plz = fPlz.value.trim()
          c.city = fCity.value.trim()
          if (addrChanged) { c.lat = null; c.lon = null }
          c = await saveCustomer(c)
          toast('Gespeichert')
          renderHeader()
        } }),
        el('button', { class: 'btn ghost', text: 'Abbrechen', onclick: renderHeader })
      ])
    ]))
  }
  renderHeader()

  // ----- Wissensdatenbank -----
  root.appendChild(el('div', { class: 'section-head' }, [el('h2', { text: '📚 Wissensdatenbank' })]))

  const addInput = el('textarea', { class: 'input note-input', rows: 2, placeholder: 'Neue Info zu diesem Kunden (z.B. „Anlieferung nur 7–11 Uhr", „Rampe hinten, Tor 4", „Schlüssel beim Pförtner")' })
  root.appendChild(el('div', { class: 'add-note' }, [
    addInput,
    el('button', { class: 'btn primary', text: '+ Notiz speichern', onclick: async () => {
      const txt = addInput.value.trim()
      if (!txt) return
      c = await addNote(c.id, txt)
      addInput.value = ''
      drawNotes()
      toast('Notiz gespeichert')
    } })
  ]))

  const notesWrap = el('div', { class: 'notes-full' })
  root.appendChild(notesWrap)

  function drawNotes() {
    clear(notesWrap)
    const notes = c.notes || []
    if (!notes.length) {
      notesWrap.appendChild(el('p', { class: 'muted center', text: 'Noch keine Notizen. Halte beim Ausliefern wichtige Infos fest – sie erscheinen bei der nächsten Tour automatisch.' }))
      return
    }
    notes.forEach(n => {
      notesWrap.appendChild(el('div', { class: 'note-item' }, [
        el('div', { class: 'note-text', text: n.text }),
        el('div', { class: 'note-meta' }, [
          el('span', { class: 'muted small', text: fmtDateTime(n.ts) }),
          el('button', { class: 'icon-btn small', html: '🗑', title: 'Löschen', onclick: async () => {
            if (await confirmDialog('Notiz löschen?')) {
              c = await deleteNote(c.id, n.id)
              drawNotes()
            }
          } })
        ])
      ]))
    })
  }
  drawNotes()
}
