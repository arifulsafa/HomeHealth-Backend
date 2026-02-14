import { MultipartFile } from '@fastify/multipart';
import { validateFileType, validateFileSize, sanitizeFilename, validateMimeType, validateAudioFileContent } from '../utils/validators.js';
import crypto from 'crypto';

export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '104857600'); // 100MB default
export const ALLOWED_FILE_TYPES = (process.env.ALLOWED_FILE_TYPES || 'm4a,aac,mp3').split(',');

export interface ProcessedFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  size: number;
  md5: string;
}

interface FileValidationError {
  statusCode: number;
  message: string;
  code: string;
}

export const validateAndProcessFile = async (
  fileData: MultipartFile | undefined
): Promise<ProcessedFile> => {
  if (!fileData) {
    const error: FileValidationError = {
      statusCode: 400,
      message: 'No file uploaded. Please include an audio file in the "audio" field.',
      code: 'NO_FILE',
    };
    throw error;
  }

  // Validate file type by extension
  const filename = fileData.filename || '';
  if (!validateFileType(filename, ALLOWED_FILE_TYPES)) {
    const error: FileValidationError = {
      statusCode: 400,
      message: `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`,
      code: 'INVALID_FILE_TYPE',
    };
    throw error;
  }

  // Validate MIME type matches file extension (prevent MIME spoofing)
  if (!validateMimeType(filename, fileData.mimetype)) {
    const error: FileValidationError = {
      statusCode: 400,
      message: `MIME type does not match file extension. Detected: ${fileData.mimetype || 'unknown'}`,
      code: 'INVALID_MIME_TYPE',
    };
    throw error;
  }

  // Read file to buffer
  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of fileData.file) {
    chunks.push(chunk);
    totalSize += chunk.length;

    // Check size during streaming to avoid loading huge files into memory
    if (totalSize > MAX_FILE_SIZE) {
      const error: FileValidationError = {
        statusCode: 413,
        message: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        code: 'FILE_TOO_LARGE',
      };
      throw error;
    }
  }

  const fileBuffer = Buffer.concat(chunks);

  // Validate final file size
  if (!validateFileSize(fileBuffer.length, MAX_FILE_SIZE)) {
    const error: FileValidationError = {
      statusCode: 413,
      message: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      code: 'FILE_TOO_LARGE',
    };
    throw error;
  }

  // Validate file content (magic bytes check) - ensures it's actually an audio file
  const contentValidation = validateAudioFileContent(fileBuffer);
  if (!contentValidation.valid) {
    const error: FileValidationError = {
      statusCode: 400,
      message: contentValidation.error || 'File content validation failed',
      code: 'INVALID_FILE_CONTENT',
    };
    throw error;
  }

  // Calculate MD5 checksum for file integrity verification
  const md5Hash = crypto.createHash('md5').update(fileBuffer).digest('hex');

  return {
    buffer: fileBuffer,
    filename: sanitizeFilename(filename),
    mimetype: fileData.mimetype || 'audio/m4a',
    size: fileBuffer.length,
    md5: md5Hash,
  };
};
