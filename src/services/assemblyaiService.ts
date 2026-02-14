import { logger } from '../utils/logger.js';

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || 'd54149bb59aa4c57a44c7e035d988f77';
const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2';

export interface TranscriptRequest {
  audio_url: string;
  auto_chapters?: boolean;
  auto_highlights?: boolean;
  content_safety?: boolean;
  entity_detection?: boolean;
  filter_profanity?: boolean;
  format_text?: boolean;
  iab_categories?: boolean;
  language_code?: string;
  language_detection?: boolean;
  punctuate?: boolean;
  redact_pii?: boolean;
  sentiment_analysis?: boolean;
  speaker_labels?: boolean;
  speakers_expected?: number;
  summarization?: boolean;
  summary_model?: 'informative' | 'conversational' | 'catchy';
  summary_type?: 'bullets' | 'paragraph';
  webhook_url?: string;
}

export interface TranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  audio_url: string;
  text?: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: string;
  }>;
  chapters?: Array<{
    summary: string;
    headline: string;
    start: number;
    end: number;
  }>;
  summary?: string;
  highlights?: Array<{
    text: string;
    start: number;
    end: number;
  }>;
  entities?: Array<{
    entity_type: string;
    text: string;
    start: number;
    end: number;
  }>;
  sentiment_analysis_results?: Array<{
    text: string;
    start: number;
    end: number;
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    confidence: number;
  }>;
  iab_categories_result?: {
    status: string;
    results: Array<{
      labels: Array<{
        relevance: number;
        label: string;
      }>;
      timestamp: {
        start: number;
        end: number;
      };
    }>;
  };
  error?: string;
}

/**
 * Submit a transcription request to AssemblyAI
 */
export async function submitTranscript(audioUrl: string, options?: Partial<TranscriptRequest>): Promise<TranscriptResponse> {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY is not configured');
  }

  const requestBody: TranscriptRequest = {
    audio_url: audioUrl,
    auto_chapters: options?.auto_chapters ?? false,
    auto_highlights: options?.auto_highlights ?? false,
    content_safety: options?.content_safety ?? false,
    entity_detection: options?.entity_detection ?? true,
    filter_profanity: options?.filter_profanity ?? false,
    format_text: options?.format_text ?? true,
    iab_categories: options?.iab_categories ?? false,
    language_code: options?.language_code ?? 'en_us',
    language_detection: options?.language_detection ?? false,
    punctuate: options?.punctuate ?? true,
    redact_pii: options?.redact_pii ?? false,
    sentiment_analysis: options?.sentiment_analysis ?? false,
    speaker_labels: options?.speaker_labels ?? false,
    summarization: options?.summarization ?? false,
    ...options,
  };

  try {
    const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `AssemblyAI API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json() as TranscriptResponse;
    logger.info({ transcriptId: data.id, status: data.status }, 'Transcript submitted to AssemblyAI');
    return data;
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Failed to submit transcript to AssemblyAI');
    throw error;
  }
}

/**
 * Get transcript status and results from AssemblyAI
 */
export async function getTranscript(transcriptId: string): Promise<TranscriptResponse> {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY is not configured');
  }

  try {
    const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`, {
      method: 'GET',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `AssemblyAI API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json() as TranscriptResponse;
    return data;
  } catch (error) {
    logger.error({ error: (error as Error).message, transcriptId }, 'Failed to get transcript from AssemblyAI');
    throw error;
  }
}

/**
 * Poll transcript until completion (with timeout)
 */
export async function pollTranscriptUntilComplete(
  transcriptId: string,
  options?: { maxAttempts?: number; intervalMs?: number }
): Promise<TranscriptResponse> {
  const maxAttempts = options?.maxAttempts ?? 60; // 60 attempts
  const intervalMs = options?.intervalMs ?? 3000; // 3 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const transcript = await getTranscript(transcriptId);

    if (transcript.status === 'completed') {
      return transcript;
    }

    if (transcript.status === 'error') {
      throw new Error(`Transcript failed: ${transcript.error || 'Unknown error'}`);
    }

    // Wait before next poll
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`Transcript polling timeout after ${maxAttempts} attempts`);
}
