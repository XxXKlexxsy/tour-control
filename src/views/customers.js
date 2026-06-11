import { el } from '../ui.js'
import { allCustomers } from '../db.js'

export async function renderCustomers(root) {
  const customers = await allCustomers()

  root.appendChild(el('div', { class: 'header-row' }, [
    el('h1', { text: 'Kunden' }),
    el('span', { class: 'muted', text: customers.length + ' gespeichert' })
  ]))

  if (!customers.length) {
    root.appendChild(el('div', { class: 'empty' }, [
      el('p', { text: 'Noch keine Kunden.' }),
      el('p', { class: 'muted', text: 'Kunden entstehen automatisch, sobald du eine Tour anlegst.' })
    ]))
    return
  }

  const search = el('input', { class: 'input search', type: 'search', placeholder: '🔍 Kunde suchen …' })
  root.appendChild(search)

  const list = el('div', { class: 'list' })
  root.appendChild(list)

  function draw(filter = '') {
    list.replaceChildren()
    const f = filter.toLowerCase()
    customers
      .filter(c => !f || (c.name || '').toLowerCase().includes(f) || (c.city || '').toLowerCase().includes(f) || (c.plz || '').includes(f))
      .forEach(c => {
        const noteCount = (c.notes || []).length
        list.appendChild(el('a', { href: '#/kunde/' + c.id, class: 'card cust-card' }, [
          el('div', { class: 'card-main' }, [
            el('div', { class: 'card-title', text: c.name }),
            el('div', { class: 'card-sub muted', text: [c.street, [c.plz, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '— keine Adresse —' })
          ]),
          el('div', { class: 'card-side' }, [
            noteCount ? el('span', { class: 'badge', text: '📌 ' + noteCount }) : el('span', { class: 'muted small', text: 'keine Notiz' }),
            Number.isFinite(c.lat) ? el('span', { class: 'dot ok', title: 'verortet' }) : el('span', { class: 'dot', title: 'nicht verortet' })
          ])
        ]))
      })
  }

  search.addEventListener('input', () => draw(search.value))
  draw()
}
