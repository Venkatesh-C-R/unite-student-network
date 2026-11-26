import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import sharp from 'sharp'
import { config } from '../src/config.js'
import { removeFiles, uploadDir, verifyFiles } from '../src/lib/uploads.js'

// Save a buffer the way multer would and return multer's file object
async function saved(buf, mimetype, ext) {
  const filename = randomBytes(16).toString('hex') + ext
  const p = path.join(uploadDir, filename)
  await writeFile(p, buf)
  return { path: p, filename, mimetype, size: buf.length, originalname: 'upload' + ext }
}

// A noisy photo-like image (noise does not compress, like a real camera photo)
async function photo(width, height) {
  const raw = randomBytes(width * height * 3)
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .withExif({ IFD0: { Make: 'TestCam' } })
    .jpeg({ quality: 98 })
    .toBuffer()
}

test('a large photo is resized to 2400 px, stays sharp-quality JPEG and loses its metadata', async () => {
  const f = await saved(await photo(4000, 3000), 'image/jpeg', '.jpg')
  const before = f.size
  await verifyFiles([f])
  const meta = await sharp(f.path).metadata()
  assert.equal(Math.max(meta.width, meta.height), 2400)
  assert.equal(meta.format, 'jpeg')
  assert.equal(meta.exif, undefined)
  assert.ok(f.size < before / 2, `expected a much smaller file, got ${f.size} from ${before}`)
  assert.equal(f.size, (await stat(f.path)).size)
  await removeFiles([f])
})

test('flyers are capped at 2000 px; small photos are never enlarged', async () => {
  const big = await saved(await photo(3000, 1500), 'image/jpeg', '.jpg')
  await verifyFiles([big], 'flyer')
  assert.equal((await sharp(big.path).metadata()).width, 2000)
  const small = await saved(await photo(800, 600), 'image/jpeg', '.jpg')
  await verifyFiles([small])
  assert.equal((await sharp(small.path).metadata()).width, 800)
  await removeFiles([big, small])
})

test('a PNG photo becomes a JPEG (original removed); a small PNG that is already smaller is kept', async () => {
  const raw = randomBytes(1200 * 900 * 3)
  const png = await sharp(raw, { raw: { width: 1200, height: 900, channels: 3 } }).png().toBuffer()
  const f = await saved(png, 'image/png', '.png')
  const original = f.path
  await verifyFiles([f])
  assert.equal(f.mimetype, 'image/jpeg')
  assert.ok(f.filename.endsWith('.jpg'))
  assert.equal(existsSync(original), false)

  const tiny = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#ffffff' } }).png().toBuffer()
  const t = await saved(tiny, 'image/png', '.png')
  await verifyFiles([t])
  assert.equal(t.mimetype, 'image/png')
  assert.deepEqual(await readFile(t.path), tiny)
  await removeFiles([f, t])
})

test('PDFs over the limit are refused; smaller PDFs are kept unchanged', async () => {
  const pad = Buffer.alloc(config.uploads.maxPdfBytes + 1, 0x20)
  const big = await saved(Buffer.concat([Buffer.from('%PDF-1.4\n'), pad]), 'application/pdf', '.pdf')
  await assert.rejects(verifyFiles([big]), (e) => e.code === 'pdf_too_large' && /3 MB/.test(e.message))
  const ok = await saved(Buffer.from('%PDF-1.4\n%%EOF\n'), 'application/pdf', '.pdf')
  await verifyFiles([ok])
  assert.equal(ok.mimetype, 'application/pdf')
  await removeFiles([big, ok])
})

test('a file with an image signature that is not a real image is refused', async () => {
  const fake = await saved(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64)]), 'image/jpeg', '.jpg')
  await assert.rejects(verifyFiles([fake]), (e) => e.code === 'bad_file_content')
  await removeFiles([fake])
})
