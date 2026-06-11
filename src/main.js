import './style.css'
import { el, clear } from './ui.js'
import { renderHome } from './views/home.js'
import { renderNewTour } from './views/newtour.js'
import { renderTour } from './views/tour.js'
import { renderCustomers } from './views/customers.js'
import { renderCustomer } from './views/customer.js'
import { renderSettings } from './views/settings.js'

const app = document.getElementById('app')

const routes = [
  { re: /^\/?$/, view: renderHome },
  { re: /^\/tour\/new$/, view: renderNewTour },
  { re: /^\/tour\/([^/]+)$/, view: renderTour },
  { re: /^\/kunden$/, view: renderCustomers },
  { re: /^\/kunde\/([^/]+)$/, view: renderCustomer },
  { re: /^\/einstellungen$/, view: renderSettings }
]

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/'
  return h
}

async function router() {
  const path = parseHash()
  const match = routes.map(r => ({ r, m: path.match(r.re) })).find(x => x.m)
  const container = el('div', { class: 'view' })
  clear(app)
  app.appendChild(buildChrome(path))
  app.appendChild(container)
  try {
    if (match) await match.r.view(container, match.m.slice(1))
    else container.appendChild(el('p', { class: 'muted', text: 'Seite nicht gefunden.' }))
  } catch (err) {
    console.error(err)
    container.appendChild(el('p', { class: 'error', text: 'Fehler: ' + (err?.message || err) }))
  }
  window.scrollTo(0, 0)
}

function navItem(href, label, icon, active) {
  return el('a', { href: '#' + href, class: 'nav-item' + (active ? ' active' : '') }, [
    el('span', { class: 'nav-icon', html: icon }),
    el('span', { class: 'nav-label', text: label })
  ])
}

const ICONS = {
  home: '🏠',
  truck: '🚚',
  people: '👥',
  gear: '⚙️'
}

function buildChrome(path) {
  const isHome = /^\/?$/.test(path)
  const isCust = /^\/kund/.test(path)
  const isSettings = /^\/einstellungen$/.test(path)
  const isTour = /^\/tour/.test(path)

  const header = el('header', { class: 'topbar' }, [
    el('span', { class: 'brand', html: '🚚&nbsp;Tour-Control' })
  ])

  const nav = el('nav', { class: 'tabbar' }, [
    navItem('/', 'Touren', ICONS.truck, isHome || isTour),
    navItem('/kunden', 'Kunden', ICONS.people, isCust),
    navItem('/einstellungen', 'Einstellung', ICONS.gear, isSettings)
  ])

  return el('div', { class: 'chrome' }, [header, nav])
}

window.addEventListener('hashchange', router)
window.addEventListener('load', router)
router()
