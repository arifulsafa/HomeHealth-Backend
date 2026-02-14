import { FastifyRequest, FastifyReply } from 'fastify';
import getCloudflareR2Service, { UploadedFile } from '../config/r2.js';
import { Recording } from '../models/Recording.js';
import { logger } from '../utils/logger.js';
import { validateAndProcessFile, ProcessedFile } from '../middleware/uploadMiddleware.js';
import { submitTranscript, pollTranscriptUntilComplete } from '../services/assemblyaiService.js';
import { validatePatientIdentifier, normalizePatientIdentifier } from '../utils/validators.js';

// Allowed form types (must match exactly)
export const ALLOWED_FORM_TYPES = [
  'PT Oasis',
  'PT Discharge',
  'PT Evaluation',
  'PT Oasis Discharge',
] as const;

export type FormType = typeof ALLOWED_FORM_TYPES[number];

export interface UploadParams {
  sessionId: string;
}

export interface UploadBody {
  patientIdentifier?: string;
  formTypes?: string;
}

export interface GetRecordingParams {
  sessionId: string;
}

export interface ListRecordingsQuery {
  page?: string;
  limit?: string;
  status?: 'uploaded' | 'processing' | 'transcribed' | 'completed' | 'failed';
  patientIdentifier?: string;
  sessionId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface SearchPatientsQuery {
  query?: string;
  limit?: string;
}

interface FileValidationError {
  statusCode: number;
  message: string;
  code: string;
}

export const uploadRecording = async (
  request: FastifyRequest<{ Params: UploadParams; Body: UploadBody }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { sessionId } = request.params;

    // Read multipart form data
    const parts = request.parts();
    let processedFile: ProcessedFile | null = null;
    let patientIdentifier: string | undefined;
    let formTypes: string | undefined;
    let durationStr: string | undefined;
    let notes: string | undefined;

    // Process all parts of the multipart form
    for await (const part of parts) {
      if (part.type === 'file') {
        // Only process the 'audio' file field - read and validate immediately
        if (part.fieldname === 'audio') {
          try {
            processedFile = await validateAndProcessFile(part);
          } catch (error) {
            const fileError = error as FileValidationError;
            reply.code(fileError.statusCode || 400).send({
              error: true,
              message: fileError.message,
              code: fileError.code,
            });
            return;
          }
        } else {
          // Discard other file fields to prevent stream blocking - consume the stream
          for await (const _ of part.file) {
            // Consume and discard
          }
        }
      } else {
        // Handle form fields - read the value directly
        const value = (await part.value) as string | Buffer;
        const stringValue = typeof value === 'string' ? value : value.toString('utf8');
        if (part.fieldname === 'patientIdentifier') {
          patientIdentifier = stringValue;
        } else if (part.fieldname === 'formTypes') {
          formTypes = stringValue;
        } else if (part.fieldname === 'duration') {
          durationStr = stringValue;
        } else if (part.fieldname === 'notes') {
          notes = stringValue;
        }
      }
    }

    // Ensure file was processed
    if (!processedFile) {
      reply.code(400).send({
        error: true,
        message: 'No file uploaded. Please include an audio file in the "audio" field.',
        code: 'NO_FILE',
      });
      return;
    }

    // Validation
    if (!sessionId) {
      reply.code(400).send({
        error: true,
        message: 'Session ID is required',
        code: 'MISSING_SESSION_ID',
      });
      return;
    }

    if (!patientIdentifier) {
      reply.code(400).send({
        error: true,
        message: 'Patient identifier is required',
        code: 'MISSING_PATIENT_IDENTIFIER',
      });
      return;
    }

    // Validate and normalize patient identifier
    const patientIdValidation = validatePatientIdentifier(patientIdentifier);
    if (!patientIdValidation.valid) {
      reply.code(400).send({
        error: true,
        message: patientIdValidation.error || 'Invalid patient identifier',
        code: 'INVALID_PATIENT_IDENTIFIER',
      });
      return;
    }

    // Use normalized patient identifier
    const normalizedPatientIdentifier = patientIdValidation.normalized || normalizePatientIdentifier(patientIdentifier);

    if (!formTypes) {
      reply.code(400).send({
        error: true,
        message: 'Form types are required',
        code: 'MISSING_FORM_TYPES',
      });
      return;
    }

    // Parse form types (comma-separated string)
    const formTypesArray = formTypes
      .split(',')
      .map((type) => type.trim())
      .filter((type) => type.length > 0);

    // Validate: Must have at least 1 form type
    if (formTypesArray.length === 0) {
      reply.code(400).send({
        error: true,
        message: 'At least one form type is required',
        code: 'INVALID_FORM_TYPES',
      });
      return;
    }

    // Validate: Maximum 4 form types
    if (formTypesArray.length > 4) {
      reply.code(400).send({
        error: true,
        message: 'Maximum 4 form types allowed',
        code: 'INVALID_FORM_TYPES',
        details: {
          selected: formTypesArray.length,
          maximum: 4,
        },
      });
      return;
    }

    // Validate: Check for duplicates
    const uniqueFormTypes = new Set(formTypesArray);
    if (uniqueFormTypes.size !== formTypesArray.length) {
      reply.code(400).send({
        error: true,
        message: 'Duplicate form types are not allowed',
        code: 'INVALID_FORM_TYPES',
        details: {
          duplicates: formTypesArray.filter((type, index) => formTypesArray.indexOf(type) !== index),
        },
      });
      return;
    }

    // Validate: Only allowed form types
    const invalidFormTypes = formTypesArray.filter(
      (type) => !ALLOWED_FORM_TYPES.includes(type as FormType)
    );

    if (invalidFormTypes.length > 0) {
      reply.code(400).send({
        error: true,
        message: 'Invalid form type(s) provided',
        code: 'INVALID_FORM_TYPES',
        details: {
          invalid: invalidFormTypes,
          allowed: ALLOWED_FORM_TYPES,
        },
      });
      return;
    }

    // Check if recording with this sessionId already exists
    const existingRecording = await Recording.findOne({ sessionId });
    if (existingRecording) {
      reply.code(400).send({
        error: true,
        message: 'Recording with this session ID already exists',
        code: 'SESSION_ID_EXISTS',
      });
      return;
    }

    if (!request.userId) {
      reply.code(401).send({
        error: true,
        message: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    // Upload to Cloudflare R2 using the service
    const r2Service = getCloudflareR2Service();
    
    // Get file extension
    const fileExt = processedFile.filename.split('.').pop() || 'm4a';
    const customKey = `${sessionId}.${fileExt}`;
    
    // Convert ProcessedFile to UploadedFile format
    const uploadedFile: UploadedFile = {
      fieldname: 'audio',
      originalname: processedFile.filename,
      encoding: '7bit',
      mimetype: processedFile.mimetype,
      buffer: processedFile.buffer,
      size: processedFile.size,
    };

    let uploadResult;
    try {
      uploadResult = await r2Service.uploadFile(uploadedFile, 'recordings', customKey);
    } catch (uploadError) {
      const err = uploadError as Error & { code?: string; $metadata?: any };
      
      logger.error(
        {
          error: err.message,
          code: err.code,
          stack: err.stack,
          metadata: err.$metadata,
        },
        'R2 upload failed'
      );

      // Check for common R2 configuration errors
      if (err.code === 'EPROTO' || err.message.includes('SSL') || err.message.includes('handshake')) {
        reply.code(500).send({
          error: true,
          message: 'Failed to upload to storage. SSL handshake failure with Cloudflare R2.',
          code: 'R2_UPLOAD_FAILED',
          details: {
            suggestion: 'Verify R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_PUBLIC_URL in .env file. Ensure credentials are correct and account ID matches your Cloudflare account.',
          },
        });
        return;
      }

      reply.code(500).send({
        error: true,
        message: 'Failed to upload file to storage',
        code: 'R2_UPLOAD_FAILED',
      });
      return;
    }

    // Store the file key (fileName) instead of URL
    // We'll generate presigned URLs on-demand when returning data
    const audioFileKey = uploadResult.fileName; // e.g., "recordings/session-123.m4a"

    // Duration: prefer client-provided value if valid, otherwise 0 for now
    let duration = 0;
    if (durationStr) {
      const parsed = Number(durationStr);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        duration = parsed;
      }
    }

    // Create recording in database
    // Store the file key, not the URL (presigned URLs expire, so we generate them fresh)
    const recording = await Recording.create({
      sessionId,
      userId: request.userId,
      patientIdentifier: normalizedPatientIdentifier,
      formTypes: formTypesArray,
      audioFileUrl: audioFileKey, // Store key, not URL
      duration,
      status: 'uploaded',
      uploadedAt: new Date(),
      notes: notes && notes.trim().length > 0 ? notes.trim() : undefined,
    });

    // Generate presigned URL for the response (expires in 1 hour)
    const presignedAudioUrl = await r2Service.getPresignedFileUrl(audioFileKey, 3600);

    // Send response immediately with transcript as pending
    // Enhanced audit logging for HIPAA compliance
    logger.info(
      {
        recordingId: recording._id,
        sessionId,
        userId: request.userId,
        patientIdentifier: normalizedPatientIdentifier,
        formTypes: formTypesArray,
        fileSize: processedFile.size,
        fileName: processedFile.filename,
        mimeType: processedFile.mimetype,
        md5: processedFile.md5,
        audioFileKey: audioFileKey,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        timestamp: new Date().toISOString(),
        action: 'RECORDING_UPLOADED',
      },
      'Recording uploaded successfully - Audit log'
    );

    reply.code(201).send({
      message: 'Recording uploaded successfully',
      sessionId,
      audioFileUrl: presignedAudioUrl, // Return presigned URL
      recording: {
        id: recording._id.toString(),
        sessionId: recording.sessionId,
        userId: recording.userId.toString(),
        patientIdentifier: recording.patientIdentifier,
        formTypes: recording.formTypes,
        audioFileUrl: presignedAudioUrl, // Return presigned URL
        duration: recording.duration,
        status: recording.status,
        notes: (recording as any).notes,
        transcript: {
          status: 'pending',
        },
        uploadedAt: recording.uploadedAt,
        createdAt: recording.createdAt,
      },
    });

    // Submit transcription to AssemblyAI in background (completely async, don't block)
    // This happens after the response is sent to the client
    (async () => {
      try {
        // Generate a longer-lived presigned URL for AssemblyAI (24 hours)
        // AssemblyAI needs to access the file, so we generate a presigned URL
        const assemblyAiR2Service = getCloudflareR2Service();
        const assemblyAiPresignedUrl = await assemblyAiR2Service.getPresignedFileUrl(audioFileKey, 86400); // 24 hours

        const transcriptResponse = await submitTranscript(assemblyAiPresignedUrl, {
          auto_chapters: false,
          auto_highlights: false,
          content_safety: false,
          entity_detection: true,
          filter_profanity: false,
          format_text: true,
          iab_categories: false,
          language_code: 'en_us',
          language_detection: false,
          punctuate: true,
          redact_pii: false,
          sentiment_analysis: false,
          speaker_labels: false,
          summarization: false,
        });

        // Update recording with transcript ID and set status to processing
        const updatedRecording = await Recording.findById(recording._id);
        if (updatedRecording) {
          updatedRecording.status = 'processing';
          updatedRecording.transcript = {
            transcriptId: transcriptResponse.id,
          };
          await updatedRecording.save();

          logger.info(
            {
              recordingId: updatedRecording._id,
              sessionId,
              transcriptId: transcriptResponse.id,
            },
            'Transcript submitted to AssemblyAI'
          );
        }

        // Poll for transcript completion in background
        pollTranscriptUntilComplete(transcriptResponse.id)
          .then(async (completedTranscript) => {
            // Update recording with transcript data
            const finalRecording = await Recording.findById(recording._id);
            if (finalRecording) {
              finalRecording.status = 'transcribed';
              finalRecording.transcript = {
                transcriptId: completedTranscript.id,
                text: completedTranscript.text,
                words: completedTranscript.words,
                chapters: completedTranscript.chapters,
                summary: completedTranscript.summary,
                highlights: completedTranscript.highlights,
                entities: completedTranscript.entities,
                sentimentAnalysisResults: completedTranscript.sentiment_analysis_results,
                iabCategoriesResult: completedTranscript.iab_categories_result,
                transcribedAt: new Date(),
              };
              await finalRecording.save();

              logger.info(
                {
                  recordingId: finalRecording._id,
                  sessionId,
                  transcriptId: completedTranscript.id,
                },
                'Transcript completed and saved'
              );
            }
          })
          .catch(async (error) => {
            // Update recording status to failed
            const failedRecording = await Recording.findById(recording._id);
            if (failedRecording) {
              failedRecording.status = 'failed';
              await failedRecording.save();
            }

            logger.error(
              {
                error: (error as Error).message,
                recordingId: recording._id,
                sessionId,
                transcriptId: transcriptResponse.id,
              },
              'Failed to get transcript from AssemblyAI'
            );
          });
      } catch (transcriptError) {
        // Log error but don't fail the upload (already sent response)
        logger.error(
          {
            error: (transcriptError as Error).message,
            recordingId: recording._id,
            sessionId,
          },
          'Failed to submit transcript to AssemblyAI'
        );
        // Recording stays in 'uploaded' status if transcription fails to start
      }
    })();
  } catch (error) {
    const err = error as Error & { code?: number };
    logger.error({ error: err.message, stack: err.stack }, 'Upload recording error');

    // Handle duplicate sessionId error
    if (err.code === 11000) {
      reply.code(400).send({
        error: true,
        message: 'Recording with this session ID already exists',
        code: 'SESSION_ID_EXISTS',
      });
      return;
    }

    throw error;
  }
};

export const listRecordings = async (
  request: FastifyRequest<{ Querystring: ListRecordingsQuery }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    if (!request.userId) {
      reply.code(401).send({
        error: true,
        message: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const page = Math.max(1, parseInt(request.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)));

    const filter: Record<string, any> = {
      userId: request.userId,
    };

    if (request.query.sessionId) {
      filter.sessionId = request.query.sessionId;
    }

    if (request.query.status) {
      filter.status = request.query.status;
    }

    if (request.query.patientIdentifier) {
      // simple contains match, case-insensitive
      filter.patientIdentifier = { $regex: request.query.patientIdentifier, $options: 'i' };
    }

    // Optional date range filter (createdAt)
    if (request.query.fromDate || request.query.toDate) {
      const createdAtFilter: Record<string, Date> = {};

      if (request.query.fromDate) {
        const from = new Date(request.query.fromDate);
        if (Number.isNaN(from.getTime())) {
          reply.code(400).send({
            error: true,
            message: 'Invalid fromDate. Use an ISO 8601 date string.',
            code: 'INVALID_FROM_DATE',
          });
          return;
        }
        createdAtFilter.$gte = from;
      }

      if (request.query.toDate) {
        const to = new Date(request.query.toDate);
        if (Number.isNaN(to.getTime())) {
          reply.code(400).send({
            error: true,
            message: 'Invalid toDate. Use an ISO 8601 date string.',
            code: 'INVALID_TO_DATE',
          });
          return;
        }
        createdAtFilter.$lte = to;
      }

      // Ensure range is valid if both provided
      if (createdAtFilter.$gte && createdAtFilter.$lte && createdAtFilter.$gte > createdAtFilter.$lte) {
        reply.code(400).send({
          error: true,
          message: 'fromDate must be earlier than or equal to toDate',
          code: 'INVALID_DATE_RANGE',
        });
        return;
      }

      filter.createdAt = createdAtFilter;
    }

    const total = await Recording.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const recordings = await Recording.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Generate presigned URLs for all recordings
    const r2Service = getCloudflareR2Service();
    const recordingsWithUrls = await Promise.all(
      recordings.map(async (r: any) => {
        const audioFileKey = r.audioFileUrl; // This is now the key, not a URL
        let presignedUrl: string | undefined;
        
        try {
          // Generate presigned URL (expires in 1 hour)
          presignedUrl = await r2Service.getPresignedFileUrl(audioFileKey, 3600);
        } catch (error) {
          logger.error(
            { error: (error as Error).message, audioFileKey },
            'Failed to generate presigned URL for recording'
          );
          // Continue without URL if generation fails
        }

        return {
          id: r._id?.toString?.() || String(r._id),
          sessionId: r.sessionId,
          userId: r.userId?.toString?.() || String(r.userId),
          patientIdentifier: r.patientIdentifier,
          formTypes: r.formTypes,
          audioFileUrl: presignedUrl, // Presigned URL
          duration: r.duration,
          status: r.status,
          notes: r.notes,
          transcript: r.transcript ? {
            transcriptId: r.transcript.transcriptId,
            text: r.transcript.text,
            summary: r.transcript.summary,
            transcribedAt: r.transcript.transcribedAt,
          } : undefined,
          uploadedAt: r.uploadedAt,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      })
    );

    reply.code(200).send({
      page,
      limit,
      total,
      totalPages,
      recordings: recordingsWithUrls,
    });
  } catch (error) {
    logger.error({ error: (error as Error).message, stack: (error as Error).stack }, 'List recordings error');
    throw error;
  }
};

export const getRecordingBySessionId = async (
  request: FastifyRequest<{ Params: GetRecordingParams }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    if (!request.userId) {
      reply.code(401).send({
        error: true,
        message: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const { sessionId } = request.params;

    const recording = await Recording.findOne({ sessionId, userId: request.userId }).lean();
    if (!recording) {
      reply.code(404).send({
        error: true,
        message: 'Recording not found',
        code: 'RECORDING_NOT_FOUND',
      });
      return;
    }

    // Generate presigned URL for the audio file
    const r2Service = getCloudflareR2Service();
    const audioFileKey = (recording as any).audioFileUrl; // This is now the key, not a URL
    let presignedAudioUrl: string | undefined;

    try {
      // Generate presigned URL (expires in 1 hour)
      presignedAudioUrl = await r2Service.getPresignedFileUrl(audioFileKey, 3600);
    } catch (error) {
      logger.error(
        { error: (error as Error).message, audioFileKey },
        'Failed to generate presigned URL for recording'
      );
      // Continue without URL if generation fails
    }

    reply.code(200).send({
      id: (recording as any)._id?.toString?.() || String((recording as any)._id),
      sessionId: (recording as any).sessionId,
      userId: (recording as any).userId?.toString?.() || String((recording as any).userId),
      patientIdentifier: (recording as any).patientIdentifier,
      formTypes: (recording as any).formTypes,
      audioFileUrl: presignedAudioUrl, // Presigned URL
      duration: (recording as any).duration,
      status: (recording as any).status,
      notes: (recording as any).notes,
      transcript: (recording as any).transcript ? {
        transcriptId: (recording as any).transcript.transcriptId,
        text: (recording as any).transcript.text,
        words: (recording as any).transcript.words,
        chapters: (recording as any).transcript.chapters,
        summary: (recording as any).transcript.summary,
        highlights: (recording as any).transcript.highlights,
        entities: (recording as any).transcript.entities,
        sentimentAnalysisResults: (recording as any).transcript.sentimentAnalysisResults,
        iabCategoriesResult: (recording as any).transcript.iabCategoriesResult,
        transcribedAt: (recording as any).transcript.transcribedAt,
      } : undefined,
      uploadedAt: (recording as any).uploadedAt,
      createdAt: (recording as any).createdAt,
      updatedAt: (recording as any).updatedAt,
    });
  } catch (error) {
    logger.error({ error: (error as Error).message, stack: (error as Error).stack }, 'Get recording error');
    throw error;
  }
};

/**
 * Search patient identifiers (autocomplete)
 * Returns unique patient identifiers that match the search query
 */
export const searchPatients = async (
  request: FastifyRequest<{ Querystring: SearchPatientsQuery }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    if (!request.userId) {
      reply.code(401).send({
        error: true,
        message: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const searchQuery = request.query.query || '';
    const limit = Math.min(50, Math.max(1, parseInt(request.query.limit || '20', 10)));

    // Build search filter
    const filter: Record<string, any> = {
      userId: request.userId,
    };

    if (searchQuery.trim().length > 0) {
      // Case-insensitive search on patient identifier
      filter.patientIdentifier = { $regex: searchQuery.trim(), $options: 'i' };
    }

    // Get distinct patient identifiers for this user
    const recordings = await Recording.find(filter)
      .select('patientIdentifier')
      .sort({ createdAt: -1 })
      .limit(limit * 2) // Get more to account for duplicates
      .lean();

    // Extract unique patient identifiers
    const uniquePatients = new Map<string, { identifier: string; lastVisit: Date }>();

    for (const recording of recordings) {
      const identifier = (recording as any).patientIdentifier;
      if (identifier && !uniquePatients.has(identifier)) {
        uniquePatients.set(identifier, {
          identifier,
          lastVisit: (recording as any).createdAt || new Date(),
        });
      }
    }

    // Convert to array, sort by last visit (most recent first), and limit
    const patients = Array.from(uniquePatients.values())
      .sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime())
      .slice(0, limit)
      .map((p) => p.identifier);

    reply.code(200).send({
      patients,
      count: patients.length,
      query: searchQuery,
    });
  } catch (error) {
    logger.error({ error: (error as Error).message, stack: (error as Error).stack }, 'Search patients error');
    throw error;
  }
};
