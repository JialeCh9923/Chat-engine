import multer from 'multer';
import { config } from '../config';
import { CustomApiError } from './errorHandler';

/**
 * Multer configuration for file uploads
 */
const storage = multer.memoryStorage();

/**
 * File filter function
 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new CustomApiError(
      'File type not allowed',
      400,
      'INVALID_FILE_TYPE',
      { 
        allowedTypes: config.upload.allowedMimeTypes,
        actualType: file.mimetype 
      }
    ));
  }
};

/**
 * Multer upload middleware
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1, // Only allow one file per upload
  },
});

/**
 * Single file upload middleware for documents
 */
export const uploadSingle = upload.single('document');