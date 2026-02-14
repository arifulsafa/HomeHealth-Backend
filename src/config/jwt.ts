import dotenv from 'dotenv';
import type { SignOptions } from 'jsonwebtoken';

dotenv.config();

export interface JWTConfig {
  secret: string;
  expiresIn: SignOptions['expiresIn'];
  refreshSecret: string;
  refreshExpiresIn: SignOptions['expiresIn'];
}

export const jwtConfig: JWTConfig = {
  secret: process.env.JWT_SECRET || 'your-very-strong-secret-key-minimum-32-characters',
  expiresIn: (process.env.JWT_EXPIRES_IN || '30m') as SignOptions['expiresIn'],
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-different-from-main',
  refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
};
