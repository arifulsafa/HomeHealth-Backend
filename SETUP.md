# HealthDoc Backend Setup Guide

## Prerequisites

- Node.js v18 or higher
- MongoDB (local or cloud instance)
- Cloudflare R2 account and bucket configured

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   Copy the environment variables from `ENV_SETUP.md` and create a `.env` file in the root directory with your actual values.

3. **Configure MongoDB:**
   - Make sure MongoDB is running
   - Update `MONGODB_URI` in `.env` to point to your MongoDB instance

4. **Configure Cloudflare R2:**
   - Create an R2 bucket in your Cloudflare dashboard
   - Create API tokens with R2 read/write permissions
   - Update R2 configuration in `.env`:
     - `R2_ACCOUNT_ID`: Your Cloudflare account ID
     - `R2_ACCESS_KEY_ID`: Your R2 access key ID
     - `R2_SECRET_ACCESS_KEY`: Your R2 secret access key
     - `R2_BUCKET_NAME`: Your R2 bucket name
     - `R2_PUBLIC_URL`: Public URL for your R2 bucket (if configured)

5. **Generate JWT secrets:**
   - Generate strong random strings for `JWT_SECRET` and `JWT_REFRESH_SECRET`
   - Minimum 32 characters recommended
   - You can use: `openssl rand -base64 32`

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

## API Endpoints

### Base URL
All endpoints are prefixed with `/api`

Example: `POST /api/auth/login`

---

### 1. Authentication Endpoints

#### `POST /api/auth/login`
User login with email and password.

**Request Body:**
```json
{
  "email": "pt@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "pt@example.com",
    "name": "John Doe",
    "role": "PT"
  }
}
```

**Error Response (401):**
```json
{
  "error": true,
  "message": "Invalid email or password",
  "code": "INVALID_CREDENTIALS"
}
```

**Error Response (400):**
```json
{
  "error": true,
  "message": "Email and password are required",
  "code": "MISSING_FIELDS"
}
```

---

#### `POST /api/auth/signup`
Register a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "pt@example.com",
  "password": "password123"
}
```

**Success Response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "pt@example.com",
    "name": "John Doe",
    "role": "PT"
  }
}
```

**Error Response (400):**
```json
{
  "error": true,
  "message": "Email already exists",
  "code": "EMAIL_EXISTS"
}
```

**Error Response (400):**
```json
{
  "error": true,
  "message": "Password must be at least 6 characters",
  "code": "INVALID_PASSWORD"
}
```

---

#### `POST /api/auth/logout`
Logout user (invalidate token).

**Headers:**
- `Authorization: Bearer {token}`

**Success Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

**Error Response (401):**
```json
{
  "error": true,
  "message": "Unauthorized - Missing or invalid token",
  "code": "UNAUTHORIZED"
}
```

---

#### `GET /api/auth/me`
Get current authenticated user.

**Headers:**
- `Authorization: Bearer {token}`

**Success Response (200):**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "email": "pt@example.com",
  "name": "John Doe",
  "role": "PT"
}
```

**Error Response (401):**
```json
{
  "error": true,
  "message": "Unauthorized - Missing or invalid token",
  "code": "UNAUTHORIZED"
}
```

---

#### `POST /api/auth/refresh`
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200):**
```json
{
  "token": "new_access_token_here"
}
```

**Error Response (401):**
```json
{
  "error": true,
  "message": "Invalid refresh token",
  "code": "INVALID_REFRESH_TOKEN"
}
```

**Error Response (400):**
```json
{
  "error": true,
  "message": "Refresh token is required",
  "code": "MISSING_REFRESH_TOKEN"
}
```

---

### 2. Recording Upload Endpoint

#### `POST /api/recordings/:sessionId/upload`
Upload audio recording file.

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**URL Parameters:**
- `sessionId` (string, required) - Unique session identifier (e.g., "1705312500000")

**Form Data:**
- `audio` (File, required) - Audio file (.m4a, .aac, or .mp3 format)
- `patientIdentifier` (String, required) - Patient identifier (e.g., "Patient-123")
- `formTypes` (String, required) - Comma-separated list (e.g., "PT Oasis,PT Evaluation")

**Success Response (201):**
```json
{
  "message": "Recording uploaded successfully",
  "sessionId": "1705312500000",
  "audioFileUrl": "https://your-bucket.r2.cloudflarestorage.com/recordings/1705312500000.m4a",
  "recording": {
    "id": "507f1f77bcf86cd799439012",
    "sessionId": "1705312500000",
    "userId": "507f1f77bcf86cd799439011",
    "patientIdentifier": "Patient-123",
    "formTypes": ["PT Oasis", "PT Evaluation"],
    "audioFileUrl": "https://your-bucket.r2.cloudflarestorage.com/recordings/1705312500000.m4a",
    "duration": 0,
    "status": "uploaded",
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**

**401 - Unauthorized:**
```json
{
  "error": true,
  "message": "Unauthorized - Missing or invalid token",
  "code": "UNAUTHORIZED"
}
```

**400 - Missing Required Fields:**
```json
{
  "error": true,
  "message": "Patient identifier is required",
  "code": "MISSING_PATIENT_IDENTIFIER"
}
```

**400 - Invalid File Type:**
```json
{
  "error": true,
  "message": "Invalid file type. Allowed types: m4a, aac, mp3",
  "code": "INVALID_FILE_TYPE"
}
```

**400 - Session ID Exists:**
```json
{
  "error": true,
  "message": "Recording with this session ID already exists",
  "code": "SESSION_ID_EXISTS"
}
```

**413 - File Too Large:**
```json
{
  "error": true,
  "message": "File too large. Maximum size: 100MB",
  "code": "FILE_TOO_LARGE"
}
```

---

### 3. Recordings Fetch Endpoints

#### `GET /api/recordings`
Fetch recordings for the currently authenticated user (paginated).

**Headers:**
- `Authorization: Bearer {token}`

**Query Parameters (optional):**
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `status` (string) one of: `uploaded`, `processing`, `transcribed`, `completed`, `failed`
- `patientIdentifier` (string) partial match (case-insensitive)
- `sessionId` (string) exact match

**Success Response (200):**
```json
{
  "page": 1,
  "limit": 20,
  "total": 2,
  "totalPages": 1,
  "recordings": [
    {
      "id": "507f1f77bcf86cd799439012",
      "sessionId": "1705312500000",
      "userId": "507f1f77bcf86cd799439011",
      "patientIdentifier": "Patient-123",
      "formTypes": ["PT Oasis", "PT Evaluation"],
      "audioFileUrl": "https://pub-xxxxx.r2.dev/recordings/1705312500000.m4a",
      "duration": 0,
      "status": "uploaded",
      "uploadedAt": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Error Response (401):**
```json
{
  "error": true,
  "message": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

---

#### `GET /api/recordings/:sessionId`
Fetch a single recording (must belong to the authenticated user).

**Headers:**
- `Authorization: Bearer {token}`

**URL Parameters:**
- `sessionId` (string, required)

**Success Response (200):**
```json
{
  "id": "507f1f77bcf86cd799439012",
  "sessionId": "1705312500000",
  "userId": "507f1f77bcf86cd799439011",
  "patientIdentifier": "Patient-123",
  "formTypes": ["PT Oasis", "PT Evaluation"],
  "audioFileUrl": "https://pub-xxxxx.r2.dev/recordings/1705312500000.m4a",
  "duration": 0,
  "status": "uploaded",
  "uploadedAt": "2024-01-15T10:30:00.000Z",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Response (404):**
```json
{
  "error": true,
  "message": "Recording not found",
  "code": "RECORDING_NOT_FOUND"
}
```

---

### 3. Health Check Endpoint

#### `GET /health`
Server health check (no authentication required).

**Success Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Testing the API

### 1. Sign Up
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "pt@example.com",
    "password": "password123"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "pt@example.com",
    "password": "password123"
  }'
```

### 3. Get Current User
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Upload Recording
```bash
curl -X POST http://localhost:3000/api/recordings/1705312500000/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "audio=@path/to/audio.m4a" \
  -F "patientIdentifier=Patient-123" \
  -F "formTypes=PT Oasis,PT Evaluation"
```

**Expected Response:**
```json
{
  "message": "Recording uploaded successfully",
  "sessionId": "1705312500000",
  "audioFileUrl": "https://your-bucket.r2.cloudflarestorage.com/recordings/1705312500000.m4a",
  "recording": {
    "id": "507f1f77bcf86cd799439012",
    "sessionId": "1705312500000",
    "userId": "507f1f77bcf86cd799439011",
    "patientIdentifier": "Patient-123",
    "formTypes": ["PT Oasis", "PT Evaluation"],
    "audioFileUrl": "https://your-bucket.r2.cloudflarestorage.com/recordings/1705312500000.m4a",
    "duration": 0,
    "status": "uploaded",
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 5. Refresh Token
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

**Expected Response:**
```json
{
  "token": "new_access_token_here"
}
```

### 6. Logout
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "message": "Logged out successfully"
}
```

### 7. Health Check
```bash
curl -X GET http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.ts   # MongoDB connection
│   │   ├── jwt.ts       # JWT configuration
│   │   └── r2.ts        # Cloudflare R2 configuration
│   ├── controllers/      # Request handlers
│   │   ├── authController.ts
│   │   └── recordingController.ts
│   ├── models/          # MongoDB models
│   │   ├── User.ts
│   │   ├── Recording.ts
│   │   └── RefreshToken.ts
│   ├── routes/          # API routes
│   │   ├── authRoutes.ts
│   │   └── recordingRoutes.ts
│   ├── middleware/       # Middleware functions
│   │   ├── authMiddleware.ts
│   │   ├── errorHandler.ts
│   │   └── uploadMiddleware.ts
│   ├── types/           # TypeScript type definitions
│   │   └── fastify.d.ts
│   ├── utils/           # Utility functions
│   │   ├── logger.ts
│   │   └── validators.ts
│   └── server.ts        # Fastify server setup
├── dist/                # Compiled JavaScript (generated)
├── .env                 # Environment variables (not in git)
├── .gitignore
├── package.json
├── tsconfig.json        # TypeScript configuration
└── README.md
```

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- Verify network connectivity to MongoDB instance

### Cloudflare R2 Upload Issues
- Verify R2 credentials in `.env`
- Check bucket name and permissions
- Ensure bucket exists in your Cloudflare account

### JWT Token Issues
- Verify `JWT_SECRET` and `JWT_REFRESH_SECRET` are set
- Ensure secrets are strong (32+ characters)
- Check token expiration settings

### File Upload Issues
- Verify file size is under 100MB
- Check file type is one of: m4a, aac, mp3
- Ensure multipart form data is being sent correctly

## Security Notes

- Never commit `.env` file to version control
- Use strong, unique JWT secrets in production
- Enable HTTPS in production
- Configure CORS to only allow your Flutter app origin
- Regularly rotate API keys and secrets

## Next Steps

After Milestone 1 is complete, the following features will be added:
- Audio transcription (AssemblyAI)
- AI processing (Claude API)
- Google Docs generation
- Web dashboard API endpoints
- Automated file cleanup (14-day retention)
