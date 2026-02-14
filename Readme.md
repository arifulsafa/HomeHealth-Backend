# HealthDoc - Home Health Documentation Platform

A HIPAA-compliant platform that enables Physical Therapists (PTs) to record patient visits, transcribe audio, and automatically generate Google Doc forms using AI. The system works offline and provides both mobile (Flutter) and web dashboard interfaces.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Milestones](#project-milestones)
- [Features](#features)
- [Setup & Installation](#setup--installation)
- [API Documentation](#api-documentation)
- [HIPAA Compliance](#hipaa-compliance)
- [Development Status](#development-status)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## 🎯 Project Overview

HealthDoc automates the documentation process for Physical Therapists conducting home visits. The system:

- **Records** patient visits via mobile app (works offline)
- **Transcribes** audio recordings using AssemblyAI
- **Extracts** structured data using Claude AI
- **Generates** Google Doc forms automatically
- **Manages** documents via web dashboard

### User Flow

**Mobile App (Flutter - iOS)**
1. PT opens app → prompted to start a visit
2. Selects form type(s) (1-4): PT Oasis, PT Discharge, PT Evaluation, PT Oasis Discharge
3. Enters patient identifier (free text)
4. Records visit (works offline)
5. Stops recording → saves locally
6. Auto-uploads when internet available
7. Local recordings auto-delete after 30 days (with retry logic)

**Web Dashboard**
- Button to "Start New Recording" (same flow as mobile)
- List of all patients showing:
  - Patient identifier
  - Visit date (ordered by date desc)
  - Form types generated
  - Links to each Google Doc output

---

## 🏗️ Architecture

### System Components

```
┌─────────────────┐
│  Mobile App     │  (Flutter - iOS)
│  (Offline)      │
└────────┬────────┘
         │
         │ Upload Audio
         ▼
┌─────────────────┐
│  Backend API    │  (Node.js + Fastify)
│  - Auth         │
│  - Upload       │
│  - Processing   │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────────┐
    │         │          │              │
    ▼         ▼          ▼              ▼
┌────────┐ ┌──────┐ ┌──────────┐ ┌──────────┐
│Cloudflare│ │Assembly│ │  Claude  │ │  Google  │
│   R2    │ │   AI   │ │   API    │ │  Drive   │
│ Storage │ │Transcribe│ │  Extract │ │  Docs    │
└────────┘ └──────┘ └──────────┘ └──────────┘
```

### Processing Pipeline

1. **Audio Upload** → Cloudflare R2 storage
2. **Transcription** → AssemblyAI processes audio
3. **AI Extraction** → Claude Sonnet extracts structured data
4. **Document Generation** → Google Docs created from templates
5. **Storage** → Docs saved to Google Drive
6. **Dashboard** → Links displayed to PTs

---

## 🛠️ Technology Stack

### Backend
- **Runtime:** Node.js (v18+)
- **Framework:** Fastify
- **Database:** MongoDB (via Mongoose)
- **Authentication:** JWT (JSON Web Tokens)
- **File Storage:** Cloudflare R2 (S3-compatible)
- **Transcription:** AssemblyAI API
- **AI Processing:** Claude Sonnet (Anthropic API)
- **Document Generation:** Google Drive API
- **Security:** bcrypt, TLS 1.3

### Mobile
- **Framework:** Flutter (iOS first, Android-ready)
- **Storage:** Local encrypted storage
- **Offline Support:** Yes

### Web Dashboard
- **Framework:** (To be determined)
- **Authentication:** Supabase Auth
- **Database:** Supabase

---

## 📅 Project Milestones

### ✅ Milestone 1 – Foundation & Authentication (COMPLETED)
**Timeline:** Week 1  
**Status:** ✅ Complete

**Deliverables:**
- ✅ User authentication (signup, login, JWT)
- ✅ Email verification with 6-digit code
- ✅ Audio file upload endpoint
- ✅ Cloudflare R2 integration
- ✅ Recording model and database schema
- ✅ Secure file storage pipeline
- ✅ Session management (30-minute timeout)

**Acceptance Criteria:**
- ✅ Users can sign up and verify email
- ✅ Users can login and receive JWT tokens
- ✅ Audio files upload to R2 successfully
- ✅ Files are validated and stored securely

---

### 🚧 Milestone 2 – Forms, Uploads & Transcription (IN PROGRESS)
**Timeline:** Week 2  
**Status:** 🚧 In Progress  
**Payment:** $750

**Deliverables:**
- ✅ Multi-select form type support (1–4 forms)
- ✅ Patient identifier workflow
- ✅ Secure R2 upload pipeline (with multipart upload)
- ✅ AssemblyAI transcription integration
- ⏳ Transcription status tracking
- ⏳ Background processing pipeline

**Acceptance Criteria:**
- ✅ User can select form type(s) (1-4)
- ✅ Patient identifier captured
- ✅ Audio uploads to R2 successfully
- ✅ Transcriptions generated automatically per recording
- ⏳ Status updates available via API

**Form Types:**
1. PT Oasis
2. PT Discharge
3. PT Evaluation
4. PT Oasis Discharge

---

### 📋 Milestone 3 – AI Processing & Document Generation
**Timeline:** Week 3  
**Status:** 📋 Planned  
**Payment:** $750

**Deliverables:**
- Claude Sonnet integration
- JSON-based field extraction per form type
- Google Docs templates with placeholder mapping
- Google Drive API integration for document creation
- Template management system

**Acceptance Criteria:**
- Transcripts processed via AI
- Structured JSON output generated per form
- Google Docs created automatically and stored in Drive
- Templates properly mapped and filled

**LLM Field Mappings:**
- Developer creates configuration files (one per form type)
- Defines which fields Claude should extract from transcripts
- Client reviews and approves mappings

---

### 📋 Milestone 4 – Dashboard, Security & Final Delivery
**Timeline:** Week 4  
**Status:** 📋 Planned  
**Payment:** $750

**Deliverables:**
- Web dashboard
  - Patient list view
  - Generated document links
- Retention rules & auto-deletion jobs
- HIPAA-aligned audit logging
- Security hardening & QA
- TestFlight build (if applicable)
- Documentation & handoff

**Acceptance Criteria:**
- Dashboard fully functional
- Data retention policies enforced
- Audit logs accessible
- App ready for TestFlight review

---

## ✨ Features

### Current Features (Milestone 1)
- ✅ User authentication with email verification
- ✅ JWT-based session management
- ✅ Audio file upload to Cloudflare R2
- ✅ Multipart upload support for large files
- ✅ Recording management (create, list, retrieve)
- ✅ Secure file validation
- ✅ Error handling and logging

### In Progress (Milestone 2)
- 🚧 AssemblyAI transcription integration
- 🚧 Background transcription processing
- 🚧 Transcription status tracking
- 🚧 Multi-form type selection

### Planned Features
- 📋 Claude AI integration for data extraction
- 📋 Google Docs template system
- 📋 Google Drive API integration
- 📋 Web dashboard
- 📋 Automated data retention
- 📋 HIPAA audit logging

---

## 🚀 Setup & Installation

### Prerequisites

- Node.js v18 or higher
- MongoDB database
- Cloudflare R2 account
- AssemblyAI API key
- (Future) Anthropic API key
- (Future) Google Service Account

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/healthdoc
MONGODB_DB_NAME=healthdoc

# JWT
JWT_SECRET=your-very-strong-secret-key-minimum-32-characters
JWT_EXPIRES_IN=30m
JWT_REFRESH_SECRET=your-refresh-secret-key-different-from-main
JWT_REFRESH_EXPIRES_IN=7d

# Cloudflare R2
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=healthdoc-audio-files
R2_PUBLIC_URL=https://your-bucket.r2.dev

# Email Configuration
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# AssemblyAI
ASSEMBLYAI_API_KEY=your-assemblyai-api-key

# CORS
CORS_ORIGIN=http://localhost:3000

# File Upload
MAX_FILE_SIZE=104857600
ALLOWED_FILE_TYPES=m4a,aac,mp3
```

See [ENV_SETUP.md](./ENV_SETUP.md) for detailed setup instructions.

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "Home Health Backend"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp ENV_SETUP.md .env
   # Edit .env with your credentials
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Run in development**
   ```bash
   npm run dev
   ```

6. **Run in production**
   ```bash
   npm start
   ```

### Database Setup

The application uses MongoDB. Ensure MongoDB is running and accessible at the URI specified in your `.env` file.

---

## 📚 API Documentation

### Authentication Endpoints

#### Signup
```http
POST /api/auth/signup
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "password123"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "password123"
}
```

#### Verify Email
```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "code": "123456"
}
```

#### Resend Verification Code
```http
POST /api/auth/resend-verification
Content-Type: application/json

{
  "email": "john.doe@example.com"
}
```

### Recording Endpoints

#### Upload Recording
```http
POST /api/recordings/:sessionId/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- audio: [file]
- patientIdentifier: "PATIENT-001"
- formTypes: "Initial Evaluation,Progress Note"
```

#### List Recordings
```http
GET /api/recordings?page=1&limit=20&status=transcribed
Authorization: Bearer <token>
```

#### Get Recording by Session ID
```http
GET /api/recordings/:sessionId
Authorization: Bearer <token>
```

#### Search Patients (Autocomplete)
```http
GET /api/patients/search?query=John&limit=20
Authorization: Bearer <token>
```

**Query Parameters:**
- `query` (optional): Search term (case-insensitive)
- `limit` (optional): Max results (default: 20, max: 50)

**Response:**
```json
{
  "patients": ["John Doe", "John Smith"],
  "count": 2,
  "query": "John"
}
```

For detailed API documentation, see:
- [POSTMAN_UPLOAD_EXAMPLE.md](./POSTMAN_UPLOAD_EXAMPLE.md) - Upload endpoint details
- [FRONTEND_API_CHANGES.md](./FRONTEND_API_CHANGES.md) - Frontend integration guide

---

## 🔒 HIPAA Compliance

### Security Measures

- ✅ **End-to-end encryption** (TLS 1.3)
- ✅ **Encryption at rest** (AES-256)
- ✅ **Secure authentication** (JWT with refresh tokens)
- ✅ **Session timeout** (30 minutes)
- ✅ **Password hashing** (bcrypt with salt rounds 12)
- ✅ **Input validation** and sanitization
- ✅ **Error handling** (no sensitive data in errors)

### Business Associate Agreements (BAAs)

Required BAAs with:
- ✅ AssemblyAI (for transcription)
- 📋 Anthropic (for Claude AI)
- ✅ Cloudflare R2 (for storage)
- 📋 Supabase (for database/auth)
- 📋 Google (for Drive API)

### Data Retention Policies

- **Audio files:** 14 days on server, then auto-delete
- **Local mobile storage:** 30 days with upload retry, then delete
- **Transcripts:** Keep indefinitely (configurable)
- **Google Docs:** Permanent (managed by admin)

### Audit Logging

- All authentication events logged
- File upload/download events logged
- Transcription processing events logged
- (Future) All data access events logged

---

## 📊 Development Status

### Completed ✅
- [x] User authentication system
- [x] Email verification
- [x] JWT token management
- [x] Audio file upload
- [x] Cloudflare R2 integration
- [x] Recording model and database
- [x] Multipart upload optimization
- [x] AssemblyAI transcription integration
- [x] Background transcription processing

### In Progress 🚧
- [ ] Transcription status tracking improvements
- [ ] Multi-form type selection UI
- [ ] Form type validation

### Planned 📋
- [ ] Claude AI integration
- [ ] Google Docs template system
- [ ] Google Drive API integration
- [ ] Web dashboard
- [ ] Automated data retention jobs
- [ ] HIPAA audit logging system
- [ ] TestFlight deployment

---

## 🗂️ Project Structure

```
Home Health Backend/
├── src/
│   ├── config/
│   │   ├── database.ts          # MongoDB connection
│   │   ├── jwt.ts               # JWT configuration
│   │   └── r2.ts                # Cloudflare R2 service
│   ├── controllers/
│   │   ├── authController.ts    # Authentication logic
│   │   └── recordingController.ts # Recording management
│   ├── models/
│   │   ├── User.ts              # User model
│   │   ├── Recording.ts         # Recording model
│   │   └── RefreshToken.ts      # Refresh token model
│   ├── routes/
│   │   ├── authRoutes.ts        # Auth endpoints
│   │   └── recordingRoutes.ts   # Recording endpoints
│   ├── middleware/
│   │   ├── authMiddleware.ts    # JWT validation
│   │   ├── errorHandler.ts      # Error handling
│   │   └── uploadMiddleware.ts  # File validation
│   ├── services/
│   │   └── assemblyaiService.ts # AssemblyAI integration
│   ├── utils/
│   │   ├── email.ts             # Email utilities
│   │   ├── logger.ts            # Logging
│   │   └── validators.ts        # Input validation
│   └── server.ts                # Fastify server setup
├── .env                         # Environment variables (not in git)
├── package.json
├── tsconfig.json
├── README.md                    # This file
├── ENV_SETUP.md                 # Environment setup guide
├── POSTMAN_UPLOAD_EXAMPLE.md    # API examples
└── FRONTEND_API_CHANGES.md      # Frontend integration guide
```

---

## 🚢 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secrets
- [ ] Configure CORS for production domain
- [ ] Set up MongoDB connection string
- [ ] Configure Cloudflare R2 credentials
- [ ] Set up AssemblyAI API key
- [ ] Configure email service
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring and logging
- [ ] Configure automated backups
- [ ] Set up data retention jobs

### Environment-Specific Configuration

**Development:**
- Local MongoDB
- Development API keys
- Verbose logging

**Production:**
- Production MongoDB cluster
- Production API keys
- Error logging only
- Rate limiting enabled
- Security headers enabled

---

## 📝 Google Docs Integration (Future)

### Template System

The system will use 4 Google Doc templates:

1. **PT Oasis Template**
2. **PT Discharge Template**
3. **PT Evaluation Template**
4. **PT Oasis Discharge Template**

Each template contains placeholder fields that are replaced with data extracted by Claude AI from the transcript.

### Service Account Setup

1. Create Google Service Account
2. Enable Google Drive API
3. Share target Drive folder with service account email
4. Download service account JSON key
5. Configure in backend environment variables

### Document Structure

```
Google Drive/
└── PT Visits/
    └── [PT Name]/
        └── [Date]/
            ├── PT_Oasis_[Date].gdoc
            ├── PT_Discharge_[Date].gdoc
            └── ...
```

---

## 🧪 Testing

### Running Tests

```bash
npm test
```

### Manual Testing

See [POSTMAN_UPLOAD_EXAMPLE.md](./POSTMAN_UPLOAD_EXAMPLE.md) for Postman collection and testing examples.

---

## 📖 Additional Documentation

- [ENV_SETUP.md](./ENV_SETUP.md) - Environment variable setup
- [POSTMAN_UPLOAD_EXAMPLE.md](./POSTMAN_UPLOAD_EXAMPLE.md) - API testing examples
- [FRONTEND_API_CHANGES.md](./FRONTEND_API_CHANGES.md) - Frontend integration guide

---

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

---

## 📄 License

Proprietary - All rights reserved

---

## 📞 Support

For technical support or questions:
- Review documentation in this repository
- Check API examples in `POSTMAN_UPLOAD_EXAMPLE.md`
- Contact development team

---

## 🎯 Next Steps

1. **Complete Milestone 2**
   - Finalize transcription status tracking
   - Test multi-form type selection
   - Optimize background processing

2. **Begin Milestone 3**
   - Set up Claude AI integration
   - Create Google Doc templates
   - Implement field extraction logic
   - Integrate Google Drive API

3. **Plan Milestone 4**
   - Design web dashboard
   - Implement data retention jobs
   - Set up audit logging
   - Prepare for TestFlight

---

**Last Updated:** January 2026  
**Version:** 1.0.0 (Milestone 1 Complete, Milestone 2 In Progress)
