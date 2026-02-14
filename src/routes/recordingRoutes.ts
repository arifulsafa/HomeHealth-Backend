import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  uploadRecording,
  UploadParams,
  UploadBody,
  listRecordings,
  ListRecordingsQuery,
  getRecordingBySessionId,
  GetRecordingParams,
  searchPatients,
  SearchPatientsQuery,
} from '../controllers/recordingController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

export default async function recordingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: ListRecordingsQuery }>(
    '/api/recordings',
    { preHandler: [authenticateToken] },
    listRecordings as (request: FastifyRequest<{ Querystring: ListRecordingsQuery }>, reply: FastifyReply) => Promise<void>
  );

  fastify.get<{ Params: GetRecordingParams }>(
    '/api/recordings/:sessionId',
    { preHandler: [authenticateToken] },
    getRecordingBySessionId as (request: FastifyRequest<{ Params: GetRecordingParams }>, reply: FastifyReply) => Promise<void>
  );

  fastify.get<{ Querystring: SearchPatientsQuery }>(
    '/api/patients/search',
    { preHandler: [authenticateToken] },
    searchPatients as (request: FastifyRequest<{ Querystring: SearchPatientsQuery }>, reply: FastifyReply) => Promise<void>
  );

  fastify.post<{ Params: UploadParams; Body: UploadBody }>(
    '/api/recordings/:sessionId/upload',
    {
      preHandler: [authenticateToken],
    },
    uploadRecording as (
      request: FastifyRequest<{ Params: UploadParams; Body: UploadBody }>,
      reply: FastifyReply
    ) => Promise<void>
  );
}
