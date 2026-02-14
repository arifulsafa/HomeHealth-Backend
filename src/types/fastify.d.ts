import { IUser } from '../models/User.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: IUser;
    userId?: string;
    uploadedFile?: {
      buffer: Buffer;
      filename: string;
      mimetype: string;
      size: number;
    };
  }
}

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  errors?: Record<string, any>;
  keyPattern?: Record<string, any>;
}
