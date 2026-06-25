// Generates PWA icons (orange ascending bars on a ping-pong paddle) as PNGs — no deps.
// Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const BG = [255, 255, 255]
const PADDLE = [51, 65, 85]        // slate-700
const BARS = [249, 115, 22]        // orange-500
const BALL = [255, 255, 255]

// ---- geometry helpers (unit square 0..1) ----
function inCircle(x, y, cx, cy, r) {
  const dx = x - cx, dy = y - cy
  return dx * dx + dy * dy <= r * r
}
function inRoundRect(x, y, x0, y0, x1, y1, rad) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const ix0 = x0 + rad, ix1 = x1 - rad, iy0 = y0 + rad, iy1 = y1 - rad
  const cx = x < ix0 ? ix0 : x > ix1 ? ix1 : x
  const cy = y < iy0 ? iy0 : y > iy1 ? iy1 : y
  const dx = x - cx, dy = y - cy
  return dx * dx + dy * dy <= rad * rad
}

const BARS_DEF = [
  { x0: 0.3425, x1: 0.4175, top: 0.38 },
  { x0: 0.4625, x1: 0.5375, top: 0.32 },
  { x0: 0.5825, x1: 0.6575, top: 0.26 },
]
const BAR_BOTTOM = 0.54
const BLADE = { cx: 0.5, cy: 0.42, r: 0.31 }
const HANDLE = { x0: 0.425, y0: 0.66, x1: 0.575, y1: 0.9, r: 0.06 }
const BALLG = { cx: 0.7, cy: 0.24, r: 0.05 }

// Returns [r,g,b] for a unit-space point, or null for background.
function colorAt(u, v) {
  // paddle (blade + handle)
  const onPaddle = inCircle(u, v, BLADE.cx, BLADE.cy, BLADE.r)
    || inRoundRect(u, v, HANDLE.x0, HANDLE.y0, HANDLE.x1, HANDLE.y1, HANDLE.r)
  let c = onPaddle ? PADDLE : null
  // bars
  for (const b of BARS_DEF) {
    if (inRoundRect(u, v, b.x0, b.top, b.x1, BAR_BOTTOM, 0.02)) c = BARS
  }
  // ball (on top)
  if (inCircle(u, v, BALLG.cx, BALLG.cy, BALLG.r)) c = BALL
  return c
}

function render(size, contentScale) {
  const ss = 4
  const n = size * ss
  const buf = Buffer.alloc(n * n * 4)
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      const u0 = (px + 0.5) / n, v0 = (py + 0.5) / n
      // scale content around center for padding / maskable safe zone
      const u = 0.5 + (u0 - 0.5) / contentScale
      const v = 0.5 + (v0 - 0.5) / contentScale
      const c = colorAt(u, v) ?? BG
      const i = (py * n + px) * 4
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255
    }
  }
  // box-downsample ss×ss → size
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0
      for (let dy = 0; dy < ss; dy++) {
        for (let dx = 0; dx < ss; dx++) {
          const i = ((y * ss + dy) * n + (x * ss + dx)) * 4
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]
        }
      }
      const k = ss * ss, o = (y * size + x) * 4
      out[o] = Math.round(r / k); out[o + 1] = Math.round(g / k); out[o + 2] = Math.round(b / k); out[o + 3] = 255
    }
  }
  return out
}

// ---- minimal PNG encoder (RGBA, 8-bit) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}
function encodePNG(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync('public', { recursive: true })
const targets = [
  { file: 'public/icon-192.png', size: 192, scale: 0.94 },
  { file: 'public/icon-512.png', size: 512, scale: 0.94 },
  { file: 'public/apple-touch-icon.png', size: 180, scale: 0.9 },
  { file: 'public/icon-maskable-512.png', size: 512, scale: 0.72 },
]
for (const t of targets) {
  writeFileSync(t.file, encodePNG(render(t.size, t.scale), t.size))
  console.log('wrote', t.file)
}
