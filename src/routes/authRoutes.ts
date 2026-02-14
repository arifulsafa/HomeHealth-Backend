import { FastifyInstance } from 'fastify';
import { login, signup, logout, getMe, refresh, verifyEmail, resendVerification } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Public routes
  fastify.post('/api/auth/login', login);
  fastify.post('/api/auth/signup', signup);
  fastify.post('/api/auth/refresh', refresh);
  fastify.post('/api/auth/verify-email', verifyEmail);
  fastify.post('/api/auth/resend-verification', resendVerification);

  // Protected routes
  fastify.get('/api/auth/me', { preHandler: authenticateToken }, getMe);
  fastify.post('/api/auth/logout', { preHandler: authenticateToken }, logout);
}
