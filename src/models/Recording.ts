import mongoose, { Document, Schema, Types } from 'mongoose';

export type RecordingStatus = 'uploaded' | 'processing' | 'transcribed' | 'completed' | 'failed';

export interface TranscriptData {
  transcriptId: string;
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
  sentimentAnalysisResults?: Array<{
    text: string;
    start: number;
    end: number;
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    confidence: number;
  }>;
  iabCategoriesResult?: any;
  transcribedAt?: Date;
}

export interface IRecording extends Document {
  sessionId: string;
  userId: Types.ObjectId;
  patientIdentifier: string;
  formTypes: string[];
  audioFileUrl: string;
  duration: number;
  status: RecordingStatus;
  transcript?: TranscriptData;
  notes?: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const recordingSchema = new Schema<IRecording>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patientIdentifier: {
      type: String,
      required: true,
    },
    formTypes: {
      type: [String],
      required: true,
    },
    audioFileUrl: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'transcribed', 'completed', 'failed'],
      default: 'uploaded',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    transcript: {
      transcriptId: {
        type: String,
      },
      text: {
        type: String,
      },
      words: [{
        text: String,
        start: Number,
        end: Number,
        confidence: Number,
        speaker: String,
      }],
      chapters: [{
        summary: String,
        headline: String,
        start: Number,
        end: Number,
      }],
      summary: {
        type: String,
      },
      highlights: [{
        text: String,
        start: Number,
        end: Number,
      }],
      entities: [{
        entity_type: String,
        text: String,
        start: Number,
        end: Number,
      }],
      sentimentAnalysisResults: [{
        text: String,
        start: Number,
        end: Number,
        sentiment: {
          type: String,
          enum: ['POSITIVE', 'NEGATIVE', 'NEUTRAL'],
        },
        confidence: Number,
      }],
      iabCategoriesResult: {
        type: Schema.Types.Mixed,
      },
      transcribedAt: {
        type: Date,
      },
    },
    notes: {
      type: String,
      required: false,
      trim: true,
      // maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
);

// Index for sorting by createdAt
recordingSchema.index({ createdAt: -1 });

export const Recording = mongoose.model<IRecording>('Recording', recordingSchema);
