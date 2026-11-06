import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { open, unlink } from 'node:fs/promises'
import path from 'node:path'
import multer from 'multer'
import { config } from '../config.js'
import { badRequest } from './errors.js'

export const uploadDir = path.resolve(config.uploads.dir)
mkdirSync(uploadDir, { recursive: true })

const TYPES = {
  'application/pdf': { ext: '.pdf', magic: [Buffer.from('%PDF-')] },
  'image/png': { ext: '.png', magic: [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])] },
  'image/jpeg': { ext: '.jpg', magic: [Buffer.from([0xff, 0xd8, 0xff])] },
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, randomBytes(16).toString('hex') + TYPES[file.mimetype].ext),
})

export const evidenceUpload = multer({
  storage,
  limits: { fileSize: config.uploads.maxBytes, files: config.uploads.maxFiles, fields: 10 },
  fileFilter: (req, file, cb) => {
    if (TYPES[file.mimetype]) cb(null, true)
    else cb(badRequest('Evidence must be a PDF, PNG or JPG file.', 'bad_file_type'))
  },
}).array('evidence', config.uploads.maxFiles)

// One photo per event flyer (field "image"), PNG or JPG
export const flyerUpload = multer({
  storage,
  limits: { fileSize: config.uploads.maxBytes, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') cb(null, true)
    else cb(badRequest('The flyer must be a PNG or JPG photo.', 'bad_file_type'))
  },
}).single('image')

// The browser-supplied type can lie, so check the first bytes of each saved file too.
export async function verifyFiles(files) {
  for (const f of files) {
    const fh = await open(f.path, 'r')
    const head = Buffer.alloc(8)
    await fh.read(head, 0, 8, 0)
    await fh.close()
    if (!TYPES[f.mimetype].magic.some((m) => head.subarray(0, m.length).equals(m))) {
      throw badRequest(`"${f.originalname}" is not a real ${TYPES[f.mimetype].ext.slice(1).toUpperCase()} file.`, 'bad_file_content')
    }
  }
}

export async function removeFiles(files = []) {
  await Promise.all(files.map((f) => unlink(f.path).catch(() => {})))
}
