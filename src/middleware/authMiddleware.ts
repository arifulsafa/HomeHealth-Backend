import { FastifyRequest, FastifyReply } from 'fastify';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { User } from '../models/User.js';

export const authenticateToken = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({
        error: true,
        message: 'Unauthorized - Missing or invalid token',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, jwtConfig.secret) as JwtPayload;

      if (!decoded.userId) {
        reply.code(401).send({
          error: true,
          message: 'Unauthorized - Invalid token payload',
          code: 'INVALID_TOKEN',
        });
        return;
      }

      // Attach user info to request
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        reply.code(401).send({
          error: true,
          message: 'Unauthorized - User not found',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      request.user = user;
      request.userId = decoded.userId.toString();
    } catch (error) {
      const jwtError = error as jwt.JsonWebTokenError;
      if (jwtError.name === 'TokenExpiredError') {
        reply.code(401).send({
          error: true,
          message: 'Unauthorized - Token expired',
          code: 'TOKEN_EXPIRED',
        });
        return;
      }

      reply.code(401).send({
        error: true,
        message: 'Unauthorized - Invalid token',
        code: 'INVALID_TOKEN',
      });
      return;
    }
  } catch (error) {
    reply.code(500).send({
      error: true,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};
