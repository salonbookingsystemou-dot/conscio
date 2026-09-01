import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (~c) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const payload = Buffer.concat([t, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(payload))
  return Buffer.concat([len, payload, crc])
}

function png(size) {
  const moss = [75, 107, 87]
  const cream = [251, 250, 246]
  const ochre = [168, 118, 62]
  const raw = Buffer.alloc((size * 3 + 1) * size)
  const cx = (size - 1) / 2
  const rOuter = size * 0.38
  const rRing = size * 0.32
  const rInner = size * 0.22

  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cx
      const d = Math.sqrt(dx * dx + dy * dy)
      let rgb = moss
      if (d < rInner) rgb = cream
      else if (d < rRing) rgb = ochre
      else if (d < rOuter) rgb = cream
      const i = row + 1 + x * 3
      raw[i] = rgb[0]
      raw[i + 1] = rgb[1]
      raw[i + 2] = rgb[2]
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

writeFileSync(join(root, 'public', 'icon-512.png'), png(512))
writeFileSync(join(root, 'public', 'icon-192.png'), png(192))
console.log('scritte public/icon-192.png e public/icon-512.png')
