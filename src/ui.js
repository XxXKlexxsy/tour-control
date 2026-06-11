// Kleine DOM-Helfer, damit die Views ohne Framework lesbar bleiben.

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k === 'class') node.className = v
    else if (k === 'html') node.innerHTML = v
    else if (k === 'text') node.textContent = v
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v)
    else if (k === 'value') node.value = v
    else node.setAttribute(k, v)
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return node
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild)
  return node
}

let _toastTimer = null
export function toast(msg, kind = 'info') {
  let t = document.getElementById('toast')
  if (!t) {
    t = el('div', { id: 'toast' })
    document.body.appendChild(t)
  }
  t.textContent = msg
  t.className = 'toast show ' + kind
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => { t.className = 'toast' }, 2600)
}

export function fmtDate(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtDateTime(ts) {
  const d = new Date(ts)
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function confirmDialog(message) {
  return new Promise(resolve => {
    const overlay = el('div', { class: 'overlay' })
    const box = el('div', { class: 'dialog' }, [
      el('p', { text: message }),
      el('div', { class: 'row gap' }, [
        el('button', { class: 'btn ghost', onclick: () => { overlay.remove(); resolve(false) }, text: 'Abbrechen' }),
        el('button', { class: 'btn danger', onclick: () => { overlay.remove(); resolve(true) }, text: 'Ja, löschen' })
      ])
    ])
    overlay.appendChild(box)
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false) } })
    document.body.appendChild(overlay)
  })
}
