import { el, toast } from '../ui.js'
import { getSetting, setSetting, allCustomers, allTours, saveCustomer, saveTour } from '../db.js'
import { geocode } from '../geocode.js'

export async function renderSettings(root) {
  const depot = await getSetting('depot', { street: '', plz: '', city: '', lat: null, lon: null })

  root.appendChild(el('h1', { text: 'Einstellungen' }))

  // ----- Depot / Startpunkt -----
  root.appendChild(el('div', { class: 'section-head' }, [el('h2', { text: '🏠 Start / Depot' })]))
  root.appendChild(el('p', { class: 'muted', text: 'Von hier startet jede Route. Lässt du es leer, beginnt die Route am ersten verorteten Stopp.' }))

  const fStreet = el('input', { class: 'input', value: depot.street || '', placeholder: 'Straße + Nr.' })
  const fPlz = el('input', { class: 'input plz', value: depot.plz || '', placeholder: 'PLZ' })
  const fCity = el('input', { class: 'input grow', value: depot.city || '', placeholder: 'Ort' })
  const status = el('div', { class: 'muted small' })
  status.textContent = Number.isFinite(depot.lat) ? `📍 verortet (${depot.lat.toFixed(4)}, ${depot.lon.toFixed(4)})` : 'noch nicht verortet'

  root.appendChild(el('div', { class: 'card', style: 'padding:14px' }, [
    fStreet,
    el('div', { class: 'row gap', style: 'margin-top:8px' }, [fPlz, fCity]),
    el('div', { class: 'row gap', style: 'margin-top:10px' }, [
      el('button', { class: 'btn primary', text: 'Speichern & verorten', onclick: async () => {
        const d = { street: fStreet.value.trim(), plz: fPlz.value.trim(), city: fCity.value.trim(), lat: null, lon: null }
        status.textContent = 'Adresse wird gesucht …'
        const res = await geocode(d)
        if (res) { d.lat = res.lat; d.lon = res.lon; status.textContent = `📍 verortet (${res.lat.toFixed(4)}, ${res.lon.toFixed(4)})` }
        else status.textContent = '⚠ Adresse nicht gefunden – gespeichert, aber ohne Koordinaten'
        await setSetting('depot', d)
        toast('Depot gespeichert')
      } })
    ]),
    status
  ]))

  // ----- Datensicherung -----
  root.appendChild(el('div', { class: 'section-head' }, [el('h2', { text: '💾 Datensicherung' })]))
  root.appendChild(el('p', { class: 'muted', text: 'Alle Daten liegen nur auf diesem Gerät. Exportiere regelmäßig ein Backup (z.B. in deine Cloud), damit nichts verloren geht.' }))

  root.appendChild(el('div', { class: 'row gap' }, [
    el('button', { class: 'btn ghost', text: '⬇️ Backup exportieren', onclick: exportData }),
    (() => {
      const imp = el('input', { type: 'file', accept: 'application/json', class: 'hidden', onchange: e => importData(e.target.files[0]) })
      const btn = el('button', { class: 'btn ghost', text: '⬆️ Backup importieren', onclick: () => imp.click() })
      return el('div', {}, [btn, imp])
    })()
  ]))

  // ----- Info -----
  root.appendChild(el('div', { class: 'section-head' }, [el('h2', { text: 'ℹ️ Über' })]))
  root.appendChild(el('p', { class: 'muted small', text: 'Tour-Control · läuft offline · Karten © OpenStreetMap-Mitwirkende · Geocoding via Nominatim.' }))

  async function exportData() {
    const data = {
      _app: 'tour-control', _version: 1, exportedAt: new Date().toISOString(),
      depot: await getSetting('depot', null),
      customers: await allCustomers(),
      tours: await allTours()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = el('a', { href: url, download: `tour-control-backup-${new Date().toISOString().slice(0, 10)}.json` })
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    toast('Backup exportiert')
  }

  async function importData(file) {
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (data._app !== 'tour-control') { toast('Keine gültige Backup-Datei', 'error'); return }
      for (const c of data.customers || []) await saveCustomer(c)
      for (const t of data.tours || []) await saveTour(t)
      if (data.depot) await setSetting('depot', data.depot)
      toast(`Import: ${data.customers?.length || 0} Kunden, ${data.tours?.length || 0} Touren`)
      location.reload()
    } catch (err) {
      console.error(err)
      toast('Import fehlgeschlagen', 'error')
    }
  }
}
