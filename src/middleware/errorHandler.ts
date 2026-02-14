import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { logger } from '../utils/logger.js';

type CustomError = Error & {
  statusCode?: number;
  code?: string;
  errors?: Record<string, any>;
  keyPattern?: Record<string, any>;
};

export const errorHandler = (
  error: FastifyError | CustomError,
  request: FastifyRequest,
  reply: FastifyReply
): void => {
  logger.error({
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
  });

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    reply.code(400).send({
      error: true,
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: (error as CustomError).errors,
    });
    return;
  }

  // Mongoose duplicate key error
  if ((error as any).code === 11000) {
    const field = Object.keys((error as CustomError).keyPattern || {})[0];
    reply.code(400).send({
      error: true,
      message: `${field} already exists`,
      code: 'DUPLICATE_ENTRY',
    });
    return;
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    reply.code(401).send({
      error: true,
      message: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    reply.code(401).send({
      error: true,
      message: 'Token expired',
      code: 'TOKEN_EXPIRED',
    });
    return;
  }

  // Default error
  const statusCode = (error as CustomError).statusCode || error.statusCode || 500;
  const message = error.message || 'Internal server error';

  reply.code(statusCode).send({
    error: true,
    message,
    code: (error as CustomError).code || 'INTERNAL_ERROR',
  });
};
