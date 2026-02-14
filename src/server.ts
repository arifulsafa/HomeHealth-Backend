import Fastify from 'fastify';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import recordingRoutes from './routes/recordingRoutes.js';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Start server
const start = async (): Promise<void> => {
  try {
    // Create Fastify instance
    const fastify = Fastify({
      logger: logger as any,
      requestIdLogLabel: 'reqId',
      disableRequestLogging: false,
    });

    // Register plugins
    await fastify.register(import('@fastify/cors'), {
      origin: CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      credentials: true,
    });

    await fastify.register(import('@fastify/helmet'), {
      contentSecurityPolicy: NODE_ENV === 'production',
    });

    await fastify.register(import('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '1 minute',
    });

    await fastify.register(import('@fastify/multipart'), {
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB
      },
      attachFieldsToBody: false, // Don't attach to body, we'll read manually
    });

    // Register routes
    await fastify.register(authRoutes);
    await fastify.register(recordingRoutes);

    // Health check endpoint
    fastify.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Set error handler
    fastify.setErrorHandler((err, req, rep) => errorHandler(err as any, req as any, rep as any));

    // Connect to database
    await connectDatabase();

    // Start server
    await fastify.listen({ port: PORT, host: '0.0.0.0' });

    logger.info(`Server is running on http://localhost:${PORT}`);
    logger.info(`Environment: ${NODE_ENV}`);

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await fastify.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await fastify.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Error starting server');
    process.exit(1);
  }
};

start();
