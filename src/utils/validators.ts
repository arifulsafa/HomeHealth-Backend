export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string | undefined | null): boolean => {
  return !!(password && password.length >= 6);
};

export const validateFileType = (filename: string | undefined, allowedTypes: string[]): boolean => {
  if (!filename) return false;
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? allowedTypes.includes(ext) : false;
};

export const validateFileSize = (size: number, maxSize: number): boolean => {
  return size <= maxSize;
};

export const sanitizeFilename = (filename: string): string => {
  // Remove special characters and keep only alphanumeric, dots, hyphens, and underscores
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
};

/**
 * Normalize patient identifier
 * - Trim whitespace
 * - Remove extra spaces
 * - Optional: Convert to title case or keep as-is
 */
export const normalizePatientIdentifier = (identifier: string): string => {
  return identifier.trim().replace(/\s+/g, ' ');
};

/**
 * Validate patient identifier
 * - Must be between 1 and 100 characters
 * - Can contain letters, numbers, spaces, hyphens, underscores, and common punctuation
 * - Cannot be empty after normalization
 */
export const validatePatientIdentifier = (identifier: string | undefined | null): {
  valid: boolean;
  normalized?: string;
  error?: string;
} => {
  if (!identifier) {
    return { valid: false, error: 'Patient identifier is required' };
  }

  const normalized = normalizePatientIdentifier(identifier);

  if (normalized.length === 0) {
    return { valid: false, error: 'Patient identifier cannot be empty' };
  }

  if (normalized.length > 100) {
    return { valid: false, error: 'Patient identifier must be 100 characters or less' };
  }

  if (normalized.length < 1) {
    return { valid: false, error: 'Patient identifier must be at least 1 character' };
  }

  // Allow letters, numbers, spaces, hyphens, underscores, and common punctuation
  // This is flexible to allow various identifier formats (names, IDs, codes, etc.)
  // Also allow ampersand (&) for names like "Smith & Co"
  const validPattern = /^[a-zA-Z0-9\s\-_.,'()&]+$/;
  if (!validPattern.test(normalized)) {
    return { valid: false, error: 'Patient identifier contains invalid characters' };
  }

  return { valid: true, normalized };
};

/**
 * Validate MIME type matches file extension
 * Prevents MIME type spoofing attacks
 */
export const validateMimeType = (filename: string, mimeType: string | undefined): boolean => {
  if (!mimeType) return false;

  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return false;

  const mimeTypeMap: Record<string, string[]> = {
    m4a: ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
    aac: ['audio/aac', 'audio/x-aac', 'audio/aacp'],
    mp3: ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg-3'],
  };

  const allowedMimeTypes = mimeTypeMap[ext];
  if (!allowedMimeTypes) return false;

  return allowedMimeTypes.includes(mimeType.toLowerCase());
};

/**
 * Validate file content by checking magic bytes (file signature)
 * Ensures file is actually an audio file, not a renamed malicious file
 */
export const validateAudioFileContent = (buffer: Buffer): { valid: boolean; format?: string; error?: string } => {
  if (buffer.length < 12) {
    return { valid: false, error: 'File too small to be a valid audio file' };
  }

  // Check for M4A/AAC (MP4 container)
  // M4A files start with: 00 00 00 ?? 66 74 79 70 (ftyp)
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    // Check for M4A/AAC specific brand
    const brand = buffer.toString('ascii', 8, 12);
    if (brand.includes('M4A') || brand.includes('mp4') || brand.includes('isom')) {
      return { valid: true, format: 'm4a' };
    }
  }

  // Check for AAC (ADIF header: "ADIF")
  if (
    buffer[0] === 0x41 &&
    buffer[1] === 0x44 &&
    buffer[2] === 0x49 &&
    buffer[3] === 0x46
  ) {
    return { valid: true, format: 'aac' };
  }

  // Check for MP3 (ID3v2 tag: "ID3" or MP3 frame sync: FF FB/FA/F3/F2)
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) || // ID3
    (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3 || buffer[1] === 0xf2))
  ) {
    return { valid: true, format: 'mp3' };
  }

  // Check for MP3 without ID3 tag (look for frame sync in first few bytes)
  for (let i = 0; i < Math.min(100, buffer.length - 1); i++) {
    if (buffer[i] === 0xff && (buffer[i + 1] & 0xe0) === 0xe0) {
      return { valid: true, format: 'mp3' };
    }
  }

  return { valid: false, error: 'File does not appear to be a valid audio file (M4A, AAC, or MP3)' };
};
