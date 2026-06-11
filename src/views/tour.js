import { el, clear, toast, fmtDate } from '../ui.js'
import { getTour, saveTour, getCustomer, setCustomerCoords, addNote, getSetting } from '../db.js'
import { geocode } from '../geocode.js'
import { optimize } from '../route.js'
import { renderRouteMap } from '../map.js'

export async function renderTour(root, [id]) {
  const tour = await getTour(id)
  if (!tour) { root.appendChild(el('p', { text: 'Tour nicht gefunden.' })); return }

  const depot = await getSetting('depot', null)

  // Kundenstammdaten (Koordinaten + Notizen) zu jedem Stopp laden
  async function loadCustomers() {
    const map = {}
    for (const s of tour.stops) {
      if (s.customerId) map[s.customerId] = await getCustomer(s.customerId)
    }
    return map
  }
  let customers = await loadCustomers()

  root.appendChild(el('div', { class: 'header-row' }, [
    el('div', {}, [
      el('a', { href: '#/', class: 'back-link', text: '‹ Touren' }),
      el('h1', { text: tour.name || ('Tour ' + fmtDate(tour.createdAt)) })
    ]),
    el('button', { class: 'btn primary', id: 'optBtn', text: '🧭 Route optimieren', onclick: runOptimize })
  ]))

  const statusLine = el('div', { class: 'muted', style: 'margin:-6px 0 10px' })
  root.appendChild(statusLine)

  const mapBox = el('div', { class: 'map-box hidden', id: 'map' })
  root.appendChild(mapBox)

  const loadInfo = el('div', { class: 'load-order hidden' })
  root.appendChild(loadInfo)

  const listWrap = el('div', { class: 'list stops-list' })
  root.appendChild(listWrap)

  // Falls schon einmal optimiert: direkt anzeigen
  await renderCurrent()
  updateStatusLine()

  function startPoint() {
    if (depot && Number.isFinite(depot.lat)) return { lat: depot.lat, lon: depot.lon }
    // sonst: erster Stopp mit Koordinaten als Start
    for (const s of orderedStops()) {
      const c = customers[s.customerId]
      if (c && Number.isFinite(c.lat)) return { lat: c.lat, lon: c.lon }
    }
    return null
  }

  function orderedStops() {
    if (tour.order && tour.order.length) {
      const byId = Object.fromEntries(tour.stops.map(s => [s.id, s]))
      const ord = tour.order.map(sid => byId[sid]).filter(Boolean)
      // evtl. neue Stopps anhaengen
      for (const s of tour.stops) if (!tour.order.includes(s.id)) ord.push(s)
      return ord
    }
    return tour.stops
  }

  function geo(s) {
    const c = customers[s.customerId]
    return c && Number.isFinite(c.lat) ? { lat: c.lat, lon: c.lon } : { lat: NaN, lon: NaN }
  }

  function updateStatusLine() {
    const total = tour.stops.length
    const located = tour.stops.filter(s => Number.isFinite(geo(s).lat)).length
    const done = tour.stops.filter(s => s.status === 'done').length
    let txt = `${total} Stopps · ${done} erledigt · ${located}/${total} auf Karte verortet`
    if (tour.optimized && Number.isFinite(tour.distanceKm)) {
      txt += ` · ca. ${tour.distanceKm.toFixed(1)} km`
    }
    statusLine.textContent = txt
  }

  async function runOptimize() {
    const btn = document.getElementById('optBtn')
    btn.disabled = true
    const original = btn.textContent

    // 1) Fehlende Koordinaten online holen (mit Rate-Limit) und beim Kunden cachen
    const need = tour.stops.filter(s => !Number.isFinite(geo(s).lat))
    let i = 0
    let failed = 0
    for (const s of need) {
      i++
      btn.textContent = `Adressen suchen … ${i}/${need.length}`
      const c = customers[s.customerId]
      const res = await geocode({ name: s.name, street: s.street, plz: s.plz, city: s.city })
      if (res && c) {
        await setCustomerCoords(c.id, res.lat, res.lon)
        c.lat = res.lat; c.lon = res.lon
      } else {
        failed++
      }
    }

    // 2) Optimieren
    const stopsForOpt = tour.stops.map(s => ({ ...s, ...geo(s) }))
    const start = startPoint()
    const result = optimize(start, stopsForOpt)

    tour.order = [...result.ordered.map(s => s.id), ...result.unlocated.map(s => s.id)]
    tour.distanceKm = result.distanceKm
    tour.optimized = true
    await saveTour(tour)

    btn.textContent = original
    btn.disabled = false

    if (failed) toast(`${failed} Adresse(n) nicht gefunden – bitte PLZ/Ort prüfen`, 'error')
    else toast('Route optimiert')

    await renderCurrent()
    updateStatusLine()
  }

  async function renderCurrent() {
    customers = await loadCustomers()
    const ordered = orderedStops()
    const located = ordered.filter(s => Number.isFinite(geo(s).lat))

    // Karte
    if (located.length && tour.optimized) {
      mapBox.classList.remove('hidden')
      clear(mapBox)
      renderRouteMap(
        mapBox,
        startPoint(),
        located.map((s, idx) => ({ ...geo(s), n: ordered.indexOf(s) + 1, label: s.name }))
      )

      // Ladereihenfolge (umgekehrt)
      loadInfo.classList.remove('hidden')
      clear(loadInfo)
      loadInfo.appendChild(el('details', {}, [
        el('summary', { html: '📦 <b>Ladereihenfolge</b> (zuletzt geladen wird zuerst zugestellt)' }),
        el('ol', { class: 'load-list' },
          located.slice().reverse().map(s => el('li', { text: s.name })))
      ]))
    } else {
      mapBox.classList.add('hidden')
      loadInfo.classList.add('hidden')
    }

    // Stoppliste
    clear(listWrap)
    ordered.forEach((s, idx) => listWrap.appendChild(stopCard(s, idx)))
  }

  function stopCard(s, idx) {
    const c = customers[s.customerId] || {}
    const hasGeo = Number.isFinite(geo(s).lat)
    const notes = c.notes || []
    const done = s.status === 'done'

    const card = el('div', { class: 'card stop-card' + (done ? ' done' : '') })

    const head = el('div', { class: 'stop-card-head' }, [
      el('div', { class: 'stop-badge' + (hasGeo ? '' : ' nogeo'), text: String(idx + 1) }),
      el('div', { class: 'stop-card-main' }, [
        el('a', { href: '#/kunde/' + s.customerId, class: 'stop-name', text: s.name }),
        el('div', { class: 'stop-addr muted', text: [s.street, [s.plz, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '— keine Adresse —' }),
        s.qty ? el('div', { class: 'stop-qty', text: '📦 ' + s.qty }) : null,
        !hasGeo ? el('div', { class: 'warn', text: '⚠ Adresse nicht verortet – wird in Route ans Ende gestellt' }) : null
      ]),
      el('button', {
        class: 'check-btn' + (done ? ' checked' : ''),
        title: done ? 'Als offen markieren' : 'Als geliefert markieren',
        html: done ? '✓' : '',
        onclick: async () => {
          s.status = done ? 'open' : 'done'
          await saveTour(tour)
          card.classList.toggle('done', s.status === 'done')
          updateStatusLine()
          await renderCurrent()
        }
      })
    ])
    card.appendChild(head)

    // Wissensdatenbank-Vorschau
    if (notes.length) {
      card.appendChild(el('div', { class: 'notes-preview' },
        notes.slice(0, 3).map(n => el('div', { class: 'note-chip', text: '📌 ' + n.text }))
      ))
      if (notes.length > 3) card.appendChild(el('div', { class: 'muted small', text: `+${notes.length - 3} weitere Notizen` }))
    }

    // Schnellaktionen
    const actions = el('div', { class: 'stop-actions' }, [
      hasGeo ? el('a', {
        class: 'btn tiny ghost',
        href: `https://www.google.com/maps/dir/?api=1&destination=${geo(s).lat},${geo(s).lon}`,
        target: '_blank', rel: 'noopener',
        text: '🧭 Navi'
      }) : null,
      el('button', { class: 'btn tiny ghost', text: '📝 Notiz', onclick: () => quickNote(s, card) }),
      el('a', { class: 'btn tiny ghost', href: '#/kunde/' + s.customerId, text: '👤 Kunde' })
    ])
    card.appendChild(actions)

    return card
  }

  function quickNote(s, card) {
    const existing = card.querySelector('.quick-note')
    if (existing) { existing.remove(); return }
    const input = el('textarea', { class: 'input note-input', placeholder: 'Was ist hier wichtig? (Tor, Klingel, Zeitfenster, Ansprechpartner …)', rows: 2 })
    const box = el('div', { class: 'quick-note' }, [
      input,
      el('div', { class: 'row gap' }, [
        el('button', { class: 'btn tiny primary', text: 'Speichern', onclick: async () => {
          const txt = input.value.trim()
          if (!txt) return
          await addNote(s.customerId, txt)
          customers = await loadCustomers()
          toast('Notiz gespeichert')
          await renderCurrent()
        } }),
        el('button', { class: 'btn tiny ghost', text: 'Abbrechen', onclick: () => box.remove() })
      ])
    ])
    card.appendChild(box)
    input.focus()
  }
}
