import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

// Where uploaded chat attachments live. Served statically at /uploads.
export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

// Allowed attachment types: images + common document formats.
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
  cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
};

export const uploadAttachment = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('file');

// Profile photo upload — images only, smaller size cap. Exposed as `avatar`.
const AVATAR_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']);
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB

const imageFilter = (_req, file, cb) => {
  if (AVATAR_MIME.has(file.mimetype)) return cb(null, true);
  cb(ApiError.badRequest('Profile photo must be a PNG, JPG, GIF or WebP image'));
};

export const uploadAvatar = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: MAX_AVATAR_SIZE },
}).single('avatar');

// Supporting documents for a role-change request — up to 5 files in one go,
// stored in the same /uploads area. Each is exposed under the `documents` field.
export const MAX_ROLE_DOCUMENTS = 5;
export const uploadRoleDocuments = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).array('documents', MAX_ROLE_DOCUMENTS);
