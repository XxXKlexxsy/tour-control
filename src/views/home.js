import { el } from '../ui.js'
import { allTours, deleteTour } from '../db.js'
import { fmtDate, confirmDialog, toast } from '../ui.js'

export async function renderHome(root) {
  const tours = await allTours()

  root.appendChild(
    el('div', { class: 'header-row' }, [
      el('h1', { text: 'Meine Touren' }),
      el('a', { href: '#/tour/new', class: 'btn primary', text: '+ Neue Tour' })
    ])
  )

  if (!tours.length) {
    root.appendChild(
      el('div', { class: 'empty' }, [
        el('p', { text: 'Noch keine Tour angelegt.' }),
        el('p', { class: 'muted', text: 'Tippe auf „Neue Tour", fotografiere die Ladeliste und leg los.' })
      ])
    )
    return
  }

  const list = el('div', { class: 'list' })
  for (const t of tours) {
    const total = t.stops?.length || 0
    const done = (t.stops || []).filter(s => s.status === 'done').length
    const card = el('a', { href: '#/tour/' + t.id, class: 'card tour-card' }, [
      el('div', { class: 'card-main' }, [
        el('div', { class: 'card-title', text: t.name || ('Tour ' + fmtDate(t.createdAt)) }),
        el('div', { class: 'card-sub muted', text: `${fmtDate(t.createdAt)} · ${total} Stopps · ${done} erledigt` })
      ]),
      el('div', { class: 'card-side' }, [
        el('div', { class: 'progress-ring', text: total ? Math.round((done / total) * 100) + '%' : '0%' }),
        el('button', {
          class: 'icon-btn',
          title: 'Tour löschen',
          onclick: async (e) => {
            e.preventDefault(); e.stopPropagation()
            if (await confirmDialog('Diese Tour wirklich löschen? (Kunden & Notizen bleiben erhalten)')) {
              await deleteTour(t.id)
              toast('Tour gelöscht')
              card.remove()
            }
          },
          html: '🗑'
        })
      ])
    ])
    list.appendChild(card)
  }
  root.appendChild(list)
}
