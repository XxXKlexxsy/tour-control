// Erzeugt PNG-App-Icons ohne externe Abhaengigkeiten (nur Node-Bordmittel: zlib).
// Zeichnet einen LKW-aehnlichen Glyph auf dunklem Grund.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function pngFromRGBA(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit, RGBA
  // Filter-Byte 0 pro Zeile
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

function makeIcon(size) {
  const buf = Buffer.alloc(size * size * 4)
  const bg = hex('#0f172a'), blue = hex('#2563eb'), light = hex('#f1f5f9')
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a
  }
  const rect = (x0, y0, w, h, col) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, col)
  }
  const disc = (cx, cy, rad, col) => {
    for (let y = cy - rad; y <= cy + rad; y++)
      for (let x = cx - rad; x <= cx + rad; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) set(x, y, col)
  }
  // Hintergrund
  rect(0, 0, size, size, bg)
  // LKW (skaliert auf 64er-Raster)
  const u = size / 64
  const U = (n) => Math.round(n * u)
  rect(U(10), U(22), U(26), U(18), blue)          // Kabine/Aufbau
  rect(U(36), U(27), U(16), U(13), blue)          // Front
  disc(U(20), U(44), U(5), light)                  // Rad 1
  disc(U(44), U(44), U(5), light)                  // Rad 2
  disc(U(20), U(44), U(2), bg)
  disc(U(44), U(44), U(2), bg)
  return pngFromRGBA(size, size, buf)
}

for (const s of [192, 512]) {
  const png = makeIcon(s)
  writeFileSync(join(OUT, `icon-${s}.png`), png)
  console.log(`icon-${s}.png  (${png.length} bytes)`)
}
