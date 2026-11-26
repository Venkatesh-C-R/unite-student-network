import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { open, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import multer from 'multer'
import sharp from 'sharp'
import { config } from '../config.js'
import { badRequest } from './errors.js'

export const uploadDir = path.resolve(config.uploads.dir)
mkdirSync(uploadDir, { recursive: true })

const TYPES = {
  'application/pdf': { ext: '.pdf', magic: [Buffer.from('%PDF-')] },
  'image/png': { ext: '.png', magic: [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])] },
  'image/jpeg': { ext: '.jpg', magic: [Buffer.from([0xff, 0xd8, 0xff])] },
}

// How photos are stored. The longest side is capped (enough to read small print on a certificate or
// poster when zoomed in), then the image is saved as a high-quality JPEG without camera metadata
// (which can include the GPS location where the photo was taken).
const IMAGE_PROFILES = {
  document: { maxEdge: 2400 }, // claim evidence and OD letters
  flyer: { maxEdge: 2000 },
}
const JPEG = { quality: 82, mozjpeg: true, chromaSubsampling: '4:4:4' } // 4:4:4 keeps coloured text crisp

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, randomBytes(16).toString('hex') + TYPES[file.mimetype].ext),
})

// multer's limit is the largest anything may be (a photo); PDFs are held to their lower limit in verifyFiles
const limits = (files) => ({ fileSize: config.uploads.maxImageBytes, files, fields: 10 })

export const evidenceUpload = multer({
  storage,
  limits: limits(config.uploads.maxFiles),
  fileFilter: (req, file, cb) => {
    if (TYPES[file.mimetype]) cb(null, true)
    else cb(badRequest('Evidence must be a PDF, PNG or JPG file.', 'bad_file_type'))
  },
}).array('evidence', config.uploads.maxFiles)

// One photo per event flyer (field "image"), PNG or JPG
export const flyerUpload = multer({
  storage,
  limits: limits(1),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') cb(null, true)
    else cb(badRequest('The flyer must be a PNG or JPG photo.', 'bad_file_type'))
  },
}).single('image')

// One OD letter per request (field "letter"): PDF, PNG or JPG
export const letterUpload = multer({
  storage,
  limits: limits(1),
  fileFilter: (req, file, cb) => {
    if (TYPES[file.mimetype]) cb(null, true)
    else cb(badRequest('The OD letter must be a PDF, PNG or JPG file.', 'bad_file_type'))
  },
}).single('letter')

const mb = (bytes) => `${Math.round(bytes / (1024 * 1024))} MB`

// Shrink one uploaded photo in place: cap its size, drop metadata, save as JPEG. Updates the multer
// file object (path, filename, mimetype, size) so routes store the new file. Keeps the original
// when it is a PNG that is already smaller (small screenshots and diagrams compress better as PNG).
async function optimiseImage(f, profile) {
  const { maxEdge } = IMAGE_PROFILES[profile]
  let out
  try {
    out = await sharp(f.path, { limitInputPixels: 80_000_000 })
      .rotate() // apply the camera's orientation before the metadata is dropped
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }) // transparent PNG areas become white, not black
      .jpeg(JPEG)
      .toBuffer()
  } catch {
    throw badRequest(`"${f.originalname}" could not be read as an image.`, 'bad_file_content')
  }
  if (f.mimetype === 'image/png' && out.length >= f.size) return
  const filename = path.basename(f.filename, path.extname(f.filename)) + '.jpg'
  const target = path.join(uploadDir, filename)
  const fh = await open(target, 'w')
  await fh.writeFile(out)
  await fh.close()
  if (target !== f.path) await unlink(f.path).catch(() => {})
  Object.assign(f, { path: target, filename, mimetype: 'image/jpeg', size: (await stat(target)).size })
}

// The browser-supplied type can lie, so check the first bytes of each saved file too. Then apply the
// size rules: PDFs must be within their limit; photos are shrunk (profile "document" or "flyer").
export async function verifyFiles(files, profile = 'document') {
  for (const f of files) {
    const fh = await open(f.path, 'r')
    const head = Buffer.alloc(8)
    await fh.read(head, 0, 8, 0)
    await fh.close()
    if (!TYPES[f.mimetype].magic.some((m) => head.subarray(0, m.length).equals(m))) {
      throw badRequest(`"${f.originalname}" is not a real ${TYPES[f.mimetype].ext.slice(1).toUpperCase()} file.`, 'bad_file_content')
    }
    if (f.mimetype === 'application/pdf') {
      if (f.size > config.uploads.maxPdfBytes) {
        throw badRequest(`"${f.originalname}" is larger than ${mb(config.uploads.maxPdfBytes)}. Save the PDF at a smaller size, or upload a photo of it instead.`, 'pdf_too_large')
      }
    } else {
      await optimiseImage(f, profile)
    }
  }
}

export async function removeFiles(files = []) {
  await Promise.all(files.map((f) => unlink(f.path).catch(() => {})))
}
