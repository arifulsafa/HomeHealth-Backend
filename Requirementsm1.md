# Backend Requirements for Milestone 1

## Overview
This document outlines what needs to be implemented in the Node.js + MongoDB backend for Milestone 1 of the HealthDoc project.

---

## Required Endpoints

### 1. Authentication Endpoints

#### POST `/api/auth/login`
**Purpose:** User login  
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "token": "jwt_access_token_here",
  "refreshToken": "jwt_refresh_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "role": "PT"
  }
}
```

**Error Responses:**
- `401` - Invalid credentials
- `400` - Missing email/password

---

#### POST `/api/auth/signup`
**Purpose:** User registration  
**Request Body:**
```json
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (201):**
```json
{
  "token": "jwt_access_token_here",
  "refreshToken": "jwt_refresh_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "role": "PT"
  }
}
```

**Error Responses:**
- `400` - Email already exists / Validation errors
- `422` - Invalid input

---

#### POST `/api/auth/logout`
**Purpose:** User logout  
**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

#### GET `/api/auth/me`
**Purpose:** Get current authenticated user  
**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "name": "User Name",
  "role": "PT"
}
```

**Error Responses:**
- `401` - Unauthorized (invalid/missing token)

---

#### POST `/api/auth/refresh`
**Purpose:** Refresh access token  
**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response (200):**
```json
{
  "token": "new_jwt_access_token_here"
}
```

**Error Responses:**
- `401` - Invalid refresh token

---

### 2. Audio Upload Endpoint

#### POST `/api/recordings/:sessionId/upload`
**Purpose:** Upload audio recording file  
**Headers:** 
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Request (Form Data):**
- `audio`: File (audio file - .m4a, .aac, or .mp3 format)
- `patientIdentifier`: String (patient identifier)
- `formTypes`: String (comma-separated list, e.g., "PT Oasis,PT Evaluation")

**Response (200/201):**
```json
{
  "message": "Recording uploaded successfully",
  "sessionId": "session_id",
  "audioFileUrl": "https://s3.amazonaws.com/bucket/audio_file.m4a",
  "recording": {
    "id": "recording_id",
    "sessionId": "session_id",
    "userId": "user_id",
    "patientIdentifier": "patient_123",
    "formTypes": ["PT Oasis", "PT Evaluation"],
    "audioFileUrl": "https://s3.amazonaws.com/bucket/audio_file.m4a",
    "duration": 300,
    "status": "uploaded",
    "uploadedAt": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-15T10:25:00Z"
  }
}
```

**Error Responses:**
- `401` - Unauthorized
- `400` - Missing required fields / Invalid file format
- `413` - File too large
- `500` - Server error

**Notes:**
- File size limit: Recommend 100MB max
- Supported formats: .m4a, .aac, .mp3
- Audio files should be stored in AWS S3 (or local storage for development)
- Return S3 URL or file URL in `audioFileUrl`

---

## Database Schema

### Users Collection
```javascript
{
  _id: ObjectId,
  email: String (unique, required, indexed),
  password: String (hashed, required),
  name: String (required),
  role: String (enum: ['PT', 'Admin'], default: 'PT'),
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date
}
```

### Recordings Collection
```javascript
{
  _id: ObjectId,
  sessionId: String (unique, required, indexed),
  userId: ObjectId (ref: 'User', required, indexed),
  patientIdentifier: String (required),
  formTypes: [String] (required),
  audioFileUrl: String (required), // S3 URL or file path
  duration: Number (seconds, required),
  status: String (enum: ['uploaded', 'processing', 'transcribed', 'completed', 'failed']),
  uploadedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Refresh Tokens Collection (Optional - for token blacklisting)
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User', required),
  token: String (required, indexed),
  expiresAt: Date (required),
  createdAt: Date
}
```

---

## Authentication Requirements

### JWT Token Structure
- **Access Token:**
  - Expiration: 30 minutes
  - Payload: `{ userId, email, role, iat, exp }`
  - Algorithm: HS256 or RS256

- **Refresh Token:**
  - Expiration: 7 days (or configurable)
  - Payload: `{ userId, tokenId, iat, exp }`
  - Stored in database for revocation

### Token Validation
- All protected routes must validate JWT token
- Return `401 Unauthorized` if token is invalid/expired
- Middleware should extract user from token and attach to request

### Session Management
- Track last activity timestamp
- Auto-logout after 30 minutes of inactivity (handled by client, but backend should validate token expiration)

---

## Security Requirements

### Password Security
- Hash passwords using bcrypt (salt rounds: 10-12)
- Never return password in API responses
- Enforce password requirements (min 6 characters for now)

### File Upload Security
- Validate file type (audio files only)
- Validate file size (max 100MB recommended)
- Sanitize filenames
- Store files securely (S3 with proper IAM policies)

### API Security
- Use HTTPS only (TLS 1.3)
- Validate all input
- Rate limiting (recommended: 100 requests/minute per IP)
- CORS configuration (allow only Flutter app origin)

### HIPAA Compliance (Basic)
- Encrypt data at rest (MongoDB encryption or S3 encryption)
- Encrypt data in transit (TLS 1.3)
- Access logging (log all API requests)
- Audit trails (track user actions)

---

## File Storage

### Option 1: AWS S3 (Recommended for Production)
- Create S3 bucket with encryption enabled
- Generate presigned URLs for uploads (optional - can use direct multipart upload)
- Store file URLs in database
- Set lifecycle policy for 14-day deletion (Milestone 2 requirement)

### Option 2: Local Storage (Development)
- Store files in `uploads/recordings/` directory
- Generate file URLs: `https://api.domain.com/uploads/recordings/{filename}`
- Implement file cleanup job for old files

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": true,
  "message": "Error message here",
  "code": "ERROR_CODE",
  "details": {} // Optional additional details
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `413` - Payload Too Large
- `500` - Internal Server Error

---

## Testing Requirements

### Test Cases to Implement:
1. **Authentication:**
   - Login with valid credentials
   - Login with invalid credentials
   - Signup with new email
   - Signup with existing email (should fail)
   - Get current user with valid token
   - Get current user with invalid token (should fail)
   - Refresh token flow
   - Logout

2. **Audio Upload:**
   - Upload with valid token
   - Upload without token (should fail)
   - Upload with invalid file type (should fail)
   - Upload with file too large (should fail)
   - Upload with missing fields (should fail)

---

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/healthdoc
MONGODB_DB_NAME=healthdoc

# JWT
JWT_SECRET=your-secret-key-here (use strong random string)
JWT_EXPIRES_IN=30m
JWT_REFRESH_SECRET=your-refresh-secret-key-here
JWT_REFRESH_EXPIRES_IN=7d

# AWS S3 (if using S3)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=healthdoc-audio-files

# CORS
CORS_ORIGIN=http://localhost:3000,https://your-app-domain.com

# File Upload
MAX_FILE_SIZE=104857600  # 100MB in bytes
ALLOWED_FILE_TYPES=m4a,aac,mp3
```

---

## API Base URL
The Flutter app expects the API at: `https://api.healthdoc.example.com/api`

Update this in the Flutter app's `lib/config/app_config.dart` when backend is ready.

---

## Next Steps After Milestone 1
- Transcription integration (AssemblyAI)
- AI processing (Claude API)
- Google Docs generation
- Web dashboard API endpoints
- Advanced audit logging

---

## Priority Order
1. **Authentication endpoints** (login, signup, token refresh)
2. **Audio upload endpoint** (with file storage)
3. **Database setup** (MongoDB collections)
4. **Security middleware** (JWT validation, rate limiting)
5. **Error handling** (standardized error responses)
6. **Testing** (unit tests, integration tests)
