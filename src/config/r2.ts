import { S3Client, PutObjectCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
dotenv.config();

// Multipart upload threshold (5MB) - use multipart for files larger than this
const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5MB
const MULTIPART_PART_SIZE = 10 * 1024 * 1024; // 10MB per part

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface UploadResponse {
  success: boolean;
  fileName: string;
  url: string;
  size: number;
  mimetype: string;
}

export interface DeleteResponse {
  success: boolean;
  message: string;
}

export interface PresignedUrlResponse {
  success: boolean;
  presignedUrl: string;
  key: string;
  url: string;
}

export interface MultipleUploadResponse {
  success: boolean;
  files: UploadResponse[];
  count: number;
}

class CloudflareR2Service {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL; // CloudFront or R2 public URL

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      throw new Error('Missing Cloudflare R2 environment variables');
    }

    this.bucketName = bucketName;
    this.publicUrl = publicUrl;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      // Optimize for speed - increase timeout for large files
      requestHandler: {
        requestTimeout: 300000, // 5 minutes for large files
      },
      // Retry configuration
      maxAttempts: 3,
      // Force path style (required for R2)
      forcePathStyle: false,
    });
  }

  async uploadFile(file: UploadedFile, folder: string = 'uploads', customKey?: string): Promise<UploadResponse> {
    const fileName = customKey 
      ? `${folder}/${customKey}`
      : `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}-${file.originalname}`;

    // Use multipart upload for large files (faster and more reliable)
    if (file.size > MULTIPART_THRESHOLD) {
      return this.uploadFileMultipart(file, fileName);
    }

    // Use simple upload for small files
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      // Security headers
      ContentDisposition: `attachment; filename="${file.originalname}"`, // Prevent execution
      CacheControl: 'private, max-age=1209600', // 14 days (matches retention policy)
      // Server-side encryption (R2 handles this, but we specify it)
      ServerSideEncryption: 'AES256',
      // Metadata for audit trail
      Metadata: {
        'upload-timestamp': new Date().toISOString(),
        'original-filename': file.originalname,
        'file-size': file.size.toString(),
      },
    });

    await this.s3Client.send(command);

    // Generate presigned URL for secure access (expires in 1 hour for upload response)
    // Note: For long-term access, generate new presigned URLs when needed
    const getCommand = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
    });
    const presignedUrl = await getSignedUrl(this.s3Client, getCommand, { expiresIn: 3600 }); // 1 hour

    return {
      success: true,
      fileName,
      url: presignedUrl, // Return presigned URL instead of public URL
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  private async uploadFileMultipart(file: UploadedFile, fileName: string): Promise<UploadResponse> {
    let uploadId: string | undefined;

    try {
      // Step 1: Initialize multipart upload
      const createCommand = new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: fileName,
        ContentType: file.mimetype,
        // Security headers
        ContentDisposition: `attachment; filename="${file.originalname}"`, // Prevent execution
        CacheControl: 'private, max-age=1209600', // 14 days (matches retention policy)
        // Server-side encryption
        ServerSideEncryption: 'AES256',
        // Metadata for audit trail
        Metadata: {
          'upload-timestamp': new Date().toISOString(),
          'original-filename': file.originalname,
          'file-size': file.size.toString(),
        },
      });

      const createResponse = await this.s3Client.send(createCommand);
      uploadId = createResponse.UploadId;
      
      if (!uploadId) {
        throw new Error('Failed to initialize multipart upload');
      }

      // Step 2: Upload parts in parallel
      const parts: Array<{ ETag: string; PartNumber: number }> = [];
      const totalParts = Math.ceil(file.buffer.length / MULTIPART_PART_SIZE);

      const uploadPromises: Promise<{ ETag: string; PartNumber: number }>[] = [];

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const start = (partNumber - 1) * MULTIPART_PART_SIZE;
        const end = Math.min(start + MULTIPART_PART_SIZE, file.buffer.length);
        const partBuffer = file.buffer.subarray(start, end);

        const uploadPart = async () => {
          const partCommand = new UploadPartCommand({
            Bucket: this.bucketName,
            Key: fileName,
            PartNumber: partNumber,
            UploadId: uploadId!,
            Body: partBuffer,
          });

          const response = await this.s3Client.send(partCommand);
          if (!response.ETag) {
            throw new Error(`Failed to upload part ${partNumber}`);
          }
          return { ETag: response.ETag, PartNumber: partNumber };
        };

        uploadPromises.push(uploadPart());
      }

      // Wait for all parts to upload (parallel uploads for speed)
      const uploadedParts = await Promise.all(uploadPromises);
      parts.push(...uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber));

      // Step 3: Complete multipart upload
      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: fileName,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      });

      await this.s3Client.send(completeCommand);

      // Generate presigned URL for secure access (expires in 1 hour for upload response)
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });
      const presignedUrl = await getSignedUrl(this.s3Client, getCommand, { expiresIn: 3600 }); // 1 hour

      return {
        success: true,
        fileName,
        url: presignedUrl, // Return presigned URL instead of public URL
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      // Abort multipart upload on error
      if (uploadId) {
        try {
          await this.s3Client.send(
            new AbortMultipartUploadCommand({
              Bucket: this.bucketName,
              Key: fileName,
              UploadId: uploadId,
            })
          );
        } catch (abortError) {
          // Ignore abort errors, just log them
          console.error('Failed to abort multipart upload:', abortError);
        }
      }
      throw error;
    }
  }

  async deleteFile(fileName: string): Promise<DeleteResponse> {
    const command = new DeleteObjectCommand({ Bucket: this.bucketName, Key: fileName });
    await this.s3Client.send(command);
    return { success: true, message: 'File deleted successfully' };
  }

  async generatePresignedUrl(fileName: string, contentType: string, folder: string = 'uploads'): Promise<PresignedUrlResponse> {
    const key = `${folder}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({ Bucket: this.bucketName, Key: key, ContentType: contentType });
    const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    const fileUrl = `${this.publicUrl}/${key}`;

    return { success: true, presignedUrl, key, url: fileUrl };
  }

  async uploadMultipleFiles(files: UploadedFile[], folder: string = 'uploads'): Promise<MultipleUploadResponse> {
    const results = await Promise.all(files.map((file) => this.uploadFile(file, folder)));
    return { success: true, files: results, count: results.length };
  }

  /**
   * Generate a presigned URL for accessing a file
   * Use this when returning file URLs to clients
   * @param key - The file key/path in R2
   * @param expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns Presigned URL that expires after specified time
   */
  async getPresignedFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * @deprecated Use getPresignedFileUrl instead for secure access
   * Keep for backward compatibility
   */
  getFileUrl(key: string): string {
    // Return key only - should use getPresignedFileUrl for actual access
    return key;
  }

  extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1);
    } catch (e) {
      return null;
    }
  }

  validateFileType(file: UploadedFile, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.mimetype);
  }

  validateFileSize(file: UploadedFile, maxSizeInBytes: number): boolean {
    return file.size <= maxSizeInBytes;
  }

  generateUniqueFileName(originalName: string, folder: string = 'uploads'): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2);
    const extension = originalName.split('.').pop();
    const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, '');
    return `${folder}/${timestamp}-${randomString}-${nameWithoutExtension}.${extension}`;
  }
}

let instance: CloudflareR2Service | null = null;
export default function getCloudflareR2Service(): CloudflareR2Service {
  if (!instance) {
    instance = new CloudflareR2Service();
  }
  return instance;
}

// Export for backward compatibility
export interface R2Config {
  bucketName: string;
  publicUrl: string;
  accountId: string;
}

export const r2Config: R2Config = {
  bucketName: process.env.R2_BUCKET_NAME || '',
  publicUrl: process.env.R2_PUBLIC_URL || '',
  accountId: process.env.R2_ACCOUNT_ID || '',
};
