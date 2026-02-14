# Postman - Upload Recording Endpoint

## Endpoint Details

**Method:** `POST`  
**URL:** `http://localhost:3000/api/recordings/:sessionId/upload`  
**Authentication:** Bearer Token (required)

---

## Postman Configuration

### 1. Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/api/recordings/{{sessionId}}/upload`

**Variables (if using Postman environment):**
- `baseUrl`: `http://localhost:3000` (or your server URL)
- `sessionId`: `unique-session-id-12345` (unique identifier for this recording session)
- `token`: Your JWT access token from login

---

### 2. Headers

```
Authorization: Bearer {{token}}
```

**Note:** Do NOT set `Content-Type` header manually. Postman will automatically set it to `multipart/form-data` when you add a file.

---

### 3. Body Configuration

**Body Type:** `form-data`

Add the following fields:

| Key | Type | Value | Description |
|-----|------|-------|-------------|
| `audio` | **File** | Select audio file | Required. Audio file (m4a, aac, mp3) |
| `patientIdentifier` | **Text** | `PATIENT-001` | Required. Patient identifier |
| `formTypes` | **Text** | `PT Oasis,PT Discharge` | Required. Comma-separated list of 1-4 form types. Valid options: `PT Oasis`, `PT Discharge`, `PT Evaluation`, `PT Oasis Discharge` |

---

### 4. Example Values

**sessionId (in URL):**
```
session-2024-01-26-001
```

**Form Data:**
- **audio**: Select a file (e.g., `recording.m4a`)
- **patientIdentifier**: `PATIENT-001`
- **formTypes**: `PT Oasis,PT Discharge` (select 1-4 from: `PT Oasis`, `PT Discharge`, `PT Evaluation`, `PT Oasis Discharge`)

---

## cURL Command Example

```bash
curl -X POST \
  'http://localhost:3000/api/recordings/session-2024-01-26-001/upload' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -F 'audio=@/path/to/your/recording.m4a' \
  -F 'patientIdentifier=PATIENT-001' \
  -F 'formTypes=PT Oasis,PT Discharge'
```

---

## Success Response (201 Created)

**Note:** The response is sent immediately after upload. Transcription happens in the background and the recording is updated automatically.

**Important:** All `audioFileUrl` values are **presigned URLs** that expire after 1 hour. The backend automatically generates fresh signed URLs on each request, so the client doesn't need to handle URL expiration. The R2 bucket is now private for enhanced security.

```json
{
  "message": "Recording uploaded successfully",
  "sessionId": "session-2024-01-26-001",
  "audioFileUrl": "https://41193d7ab5270dcbb81ae79b2e8b29a5.r2.cloudflarestorage.com/recordings/session-2024-01-26-001.m4a?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...&X-Amz-Date=20240126T103000Z&X-Amz-Expires=3600&X-Amz-Signature=...",
  "recording": {
    "id": "507f1f77bcf86cd799439011",
    "sessionId": "session-2024-01-26-001",
    "userId": "507f191e810c19729de860ea",
    "patientIdentifier": "PATIENT-001",
    "formTypes": [
      "PT Oasis",
      "PT Discharge"
    ],
    "audioFileUrl": "https://41193d7ab5270dcbb81ae79b2e8b29a5.r2.cloudflarestorage.com/recordings/session-2024-01-26-001.m4a?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...&X-Amz-Date=20240126T103000Z&X-Amz-Expires=3600&X-Amz-Signature=...",
    "duration": 0,
    "status": "uploaded",
    "transcript": {
      "status": "pending"
    },
    "uploadedAt": "2024-01-26T10:30:00.000Z",
    "createdAt": "2024-01-26T10:30:00.000Z"
  }
}
```

**Presigned URLs:**
- All `audioFileUrl` values are presigned URLs (secure, time-limited access)
- URLs expire after **1 hour**
- Backend automatically generates fresh URLs on each API call
- No client-side changes needed - just use the URL as returned
- R2 bucket is private (more secure than public URLs)

**Transcript Status Flow:**
- Initial response: `transcript.status: "pending"` (transcription starting in background)
- After AssemblyAI submission: `status: "processing"`, `transcript.transcriptId` available
- After completion: `status: "transcribed"`, full transcript data available
- On failure: `status: "failed"`

**To get updated transcript:** Poll `GET /api/recordings/:sessionId` to check when transcription completes. Each response will include a fresh presigned URL for the audio file.

---

## Error Responses

### Missing File (400)
```json
{
  "error": true,
  "message": "No file uploaded. Please include an audio file in the \"audio\" field.",
  "code": "NO_FILE"
}
```

### Missing Patient Identifier (400)
```json
{
  "error": true,
  "message": "Patient identifier is required",
  "code": "MISSING_PATIENT_IDENTIFIER"
}
```

### Missing Form Types (400)
```json
{
  "error": true,
  "message": "Form types are required",
  "code": "MISSING_FORM_TYPES"
}
```

### Invalid Form Types (400)
```json
{
  "error": true,
  "message": "Invalid form type(s) provided",
  "code": "INVALID_FORM_TYPES",
  "details": {
    "invalid": ["Invalid Form"],
    "allowed": ["PT Oasis", "PT Discharge", "PT Evaluation", "PT Oasis Discharge"]
  }
}
```

### Too Many Form Types (400)
```json
{
  "error": true,
  "message": "Maximum 4 form types allowed",
  "code": "INVALID_FORM_TYPES",
  "details": {
    "selected": 5,
    "maximum": 4
  }
}
```

### Duplicate Form Types (400)
```json
{
  "error": true,
  "message": "Duplicate form types are not allowed",
  "code": "INVALID_FORM_TYPES",
  "details": {
    "duplicates": ["PT Oasis"]
  }
}
```

### Duplicate Session ID (400)
```json
{
  "error": true,
  "message": "Recording with this session ID already exists",
  "code": "SESSION_ID_EXISTS"
}
```

### Unauthorized (401)
```json
{
  "error": true,
  "message": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

### Upload Failed (500)
```json
{
  "error": true,
  "message": "Failed to upload file to storage",
  "code": "R2_UPLOAD_FAILED"
}
```

---

## Postman Collection JSON

You can import this into Postman:

```json
{
  "info": {
    "name": "Upload Recording",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Upload Recording",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}",
            "type": "text"
          }
        ],
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "audio",
              "type": "file",
              "src": []
            },
            {
              "key": "patientIdentifier",
              "value": "PATIENT-001",
              "type": "text"
            },
            {
              "key": "formTypes",
              "value": "PT Oasis,PT Discharge",
              "type": "text"
            }
          ]
        },
        "url": {
          "raw": "{{baseUrl}}/api/recordings/{{sessionId}}/upload",
          "host": ["{{baseUrl}}"],
          "path": ["api", "recordings", "{{sessionId}}", "upload"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "sessionId",
      "value": "session-2024-01-26-001"
    },
    {
      "key": "token",
      "value": "your-jwt-token-here"
    }
  ]
}
```

---

## Step-by-Step Postman Setup

1. **Create New Request**
   - Click "New" → "HTTP Request"
   - Name it: "Upload Recording"

2. **Set Method and URL**
   - Method: `POST`
   - URL: `http://localhost:3000/api/recordings/session-123/upload`
   - Replace `session-123` with your actual session ID

3. **Add Authorization Header**
   - Go to "Headers" tab
   - Add header:
     - Key: `Authorization`
     - Value: `Bearer YOUR_JWT_TOKEN_HERE`

4. **Configure Body**
   - Go to "Body" tab
   - Select "form-data"
   - Add fields:
     - `audio` (Type: File) - Click "Select Files" and choose your audio file
     - `patientIdentifier` (Type: Text) - Enter patient ID
     - `formTypes` (Type: Text) - Enter 1-4 comma-separated form types from: `PT Oasis`, `PT Discharge`, `PT Evaluation`, `PT Oasis Discharge`

5. **Send Request**
   - Click "Send"
   - Check response for success/error

---

## Notes

- **File Size Limit:** Default is 100MB (configurable via `MAX_FILE_SIZE`)
- **Supported Formats:** m4a, aac, mp3 (configurable via `ALLOWED_FILE_TYPES`)
- **Session ID:** Must be unique. If you try to upload with an existing sessionId, you'll get a `SESSION_ID_EXISTS` error
- **Transcription:** After upload, response is sent immediately with `transcript.status: "pending"`. Transcription happens in the background:
  - Initial: `status: "uploaded"`, `transcript.status: "pending"`
  - Processing: `status: "processing"`, `transcript.transcriptId` available
  - Complete: `status: "transcribed"`, full transcript data available
  - Failed: `status: "failed"`
- **Polling:** Use `GET /api/recordings/:sessionId` to check when transcription completes
- **Presigned URLs:** All `audioFileUrl` values are presigned URLs (secure, time-limited access):
  - URLs expire after 1 hour
  - Backend automatically generates fresh URLs on each API call
  - No client-side changes needed - URLs work like regular URLs
  - R2 bucket is now private (more secure)
- **Form Types:** Must be 1-4 comma-separated values from the allowed list:
  - `PT Oasis`
  - `PT Discharge`
  - `PT Evaluation`
  - `PT Oasis Discharge`
  - Example: `"PT Oasis,PT Discharge"` or `"PT Oasis,PT Discharge,PT Evaluation,PT Oasis Discharge"`
  - No duplicates allowed
  - Maximum 4 form types

---

## Testing Workflow

1. **Login** to get JWT token
   ```
   POST /api/auth/login
   Body: { "email": "user@example.com", "password": "password123" }
   ```

2. **Copy the token** from login response

3. **Upload Recording** using the token
   ```
   POST /api/recordings/{sessionId}/upload
   Headers: Authorization: Bearer {token}
   Body: form-data with audio file and fields
   ```

4. **Check Status** (optional)
   ```
   GET /api/recordings/{sessionId}
   Headers: Authorization: Bearer {token}
   ```

5. **Search Patients** (for autocomplete)
   ```
   GET /api/patients/search?query=John&limit=20
   Headers: Authorization: Bearer {token}
   ```

---

## Patient Identifier Search/Autocomplete API

### Endpoint
**Method:** `GET`  
**URL:** `http://localhost:3000/api/patients/search`  
**Authentication:** Bearer Token (required)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | No | Search query (case-insensitive partial match) |
| `limit` | number | No | Maximum results (default: 20, max: 50) |

### Postman Setup

1. **Method:** `GET`
2. **URL:** `{{baseUrl}}/api/patients/search?query={{searchQuery}}&limit=20`
3. **Headers:**
   ```
   Authorization: Bearer {{token}}
   ```

### cURL Examples

**Search for patients:**
```bash
curl -X GET \
  'http://localhost:3000/api/patients/search?query=John' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Get all recent patients (no query):**
```bash
curl -X GET \
  'http://localhost:3000/api/patients/search?limit=10' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Success Response (200 OK)

```json
{
  "patients": [
    "John Doe",
    "John Smith",
    "Johnny Johnson"
  ],
  "count": 3,
  "query": "John"
}
```

**Empty query (returns recent patients):**
```json
{
  "patients": [
    "Patient A",
    "Patient B",
    "Patient C"
  ],
  "count": 3,
  "query": ""
}
```

### Notes

- Returns **unique** patient identifiers only (no duplicates)
- Results are sorted by most recent visit first
- Search is case-insensitive
- Only returns patients from recordings belonging to the authenticated user
- Useful for autocomplete/search functionality in mobile app and dashboard

---

## Patient Identifier Validation

Patient identifiers are automatically validated and normalized:

### Validation Rules
- **Required:** Cannot be empty
- **Length:** 1-100 characters
- **Characters:** Letters, numbers, spaces, hyphens, underscores, and common punctuation (.,'())
- **Normalization:** 
  - Trims whitespace
  - Removes extra spaces
  - Standardizes formatting

### Example Normalization

| Input | Normalized Output |
|-------|-------------------|
| `"  John Doe  "` | `"John Doe"` |
| `"John   Doe"` | `"John Doe"` |
| `"PATIENT-001"` | `"PATIENT-001"` |
| `"patient_123"` | `"patient_123"` |

### Error Responses

**Invalid Patient Identifier (400):**
```json
{
  "error": true,
  "message": "Patient identifier must be 100 characters or less",
  "code": "INVALID_PATIENT_IDENTIFIER"
}
```

**Invalid Characters (400):**
```json
{
  "error": true,
  "message": "Patient identifier contains invalid characters",
  "code": "INVALID_PATIENT_IDENTIFIER"
}
```

---

## Get Transcript API

There are two ways to get transcript data:

### Option 1: Get Single Recording with Full Transcript

**Endpoint:** `GET /api/recordings/:sessionId`

**Method:** `GET`  
**URL:** `http://localhost:3000/api/recordings/:sessionId`  
**Authentication:** Bearer Token (required)

#### Postman Setup

1. **Method:** `GET`
2. **URL:** `{{baseUrl}}/api/recordings/{{sessionId}}`
3. **Headers:**
   ```
   Authorization: Bearer {{token}}
   ```

#### cURL Example

```bash
curl -X GET \
  'http://localhost:3000/api/recordings/session-2024-01-26-001' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

#### Success Response (200 OK)

**Note:** `audioFileUrl` is a presigned URL that expires after 1 hour. The backend generates fresh URLs on each request.

```json
{
  "id": "507f1f77bcf86cd799439011",
  "sessionId": "session-2024-01-26-001",
  "userId": "507f191e810c19729de860ea",
  "patientIdentifier": "PATIENT-001",
  "formTypes": [
    "PT Oasis",
    "PT Discharge"
  ],
  "audioFileUrl": "https://41193d7ab5270dcbb81ae79b2e8b29a5.r2.cloudflarestorage.com/recordings/session-2024-01-26-001.m4a?X-Amz-Algorithm=...&X-Amz-Expires=3600&X-Amz-Signature=...",
  "duration": 0,
  "status": "transcribed",
  "transcript": {
    "transcriptId": "abc123xyz789",
    "text": "This is the full transcript text of the audio recording...",
    "words": [
      {
        "text": "This",
        "start": 0,
        "end": 0.5,
        "confidence": 0.99,
        "speaker": null
      },
      {
        "text": "is",
        "start": 0.5,
        "end": 0.7,
        "confidence": 0.98,
        "speaker": null
      }
    ],
    "chapters": [
      {
        "summary": "Chapter summary",
        "headline": "Chapter headline",
        "start": 0,
        "end": 120
      }
    ],
    "summary": "Summary of the transcript",
    "highlights": [
      {
        "text": "Important highlight",
        "start": 10,
        "end": 15
      }
    ],
    "entities": [
      {
        "entity_type": "PERSON",
        "text": "John Doe",
        "start": 5,
        "end": 8
      }
    ],
    "sentimentAnalysisResults": [
      {
        "text": "Positive statement",
        "start": 0,
        "end": 5,
        "sentiment": "POSITIVE",
        "confidence": 0.95
      }
    ],
    "iabCategoriesResult": {},
    "transcribedAt": "2024-01-26T10:35:00.000Z"
  },
  "uploadedAt": "2024-01-26T10:30:00.000Z",
  "createdAt": "2024-01-26T10:30:00.000Z",
  "updatedAt": "2024-01-26T10:35:00.000Z"
}
```

#### Response When Transcript Not Ready

If transcription is still processing or hasn't started:

```json
{
  "id": "507f1f77bcf86cd799439011",
  "sessionId": "session-2024-01-26-001",
  "status": "processing",
  "audioFileUrl": "https://41193d7ab5270dcbb81ae79b2e8b29a5.r2.cloudflarestorage.com/recordings/session-2024-01-26-001.m4a?X-Amz-Algorithm=...&X-Amz-Expires=3600&X-Amz-Signature=...",
  "transcript": {
    "transcriptId": "abc123xyz789"
  },
  ...
}
```

**Note:** Even when transcript is not ready, you'll receive a presigned URL for the audio file.

#### Error Responses

**Recording Not Found (404):**
```json
{
  "error": true,
  "message": "Recording not found",
  "code": "RECORDING_NOT_FOUND"
}
```

**Unauthorized (401):**
```json
{
  "error": true,
  "message": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

---

### Option 2: List All Recordings with Basic Transcript Info

**Endpoint:** `GET /api/recordings`

**Method:** `GET`  
**URL:** `http://localhost:3000/api/recordings`  
**Authentication:** Bearer Token (required)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `status` | string | No | Filter by status: `uploaded`, `processing`, `transcribed`, `completed`, `failed` |
| `patientIdentifier` | string | No | Filter by patient identifier (case-insensitive search) |
| `sessionId` | string | No | Filter by specific session ID |

#### Postman Setup

1. **Method:** `GET`
2. **URL:** `{{baseUrl}}/api/recordings?page=1&limit=20&status=transcribed`
3. **Headers:**
   ```
   Authorization: Bearer {{token}}
   ```

#### cURL Examples

**Get all recordings:**
```bash
curl -X GET \
  'http://localhost:3000/api/recordings' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Get transcribed recordings only:**
```bash
curl -X GET \
  'http://localhost:3000/api/recordings?status=transcribed&page=1&limit=20' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Filter by patient:**
```bash
curl -X GET \
  'http://localhost:3000/api/recordings?patientIdentifier=PATIENT-001' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

#### Success Response (200 OK)

**Note:** All `audioFileUrl` values are presigned URLs that expire after 1 hour. Fresh URLs are generated on each request.

```json
{
  "page": 1,
  "limit": 20,
  "total": 5,
  "totalPages": 1,
  "recordings": [
    {
      "id": "507f1f77bcf86cd799439011",
      "sessionId": "session-2024-01-26-001",
      "userId": "507f191e810c19729de860ea",
      "patientIdentifier": "PATIENT-001",
      "formTypes": ["PT Oasis"],
      "audioFileUrl": "https://41193d7ab5270dcbb81ae79b2e8b29a5.r2.cloudflarestorage.com/recordings/session-2024-01-26-001.m4a?X-Amz-Algorithm=...&X-Amz-Expires=3600&X-Amz-Signature=...",
      "duration": 0,
      "status": "transcribed",
      "transcript": {
        "transcriptId": "abc123xyz789",
        "text": "This is the full transcript text...",
        "summary": "Summary of the transcript",
        "transcribedAt": "2024-01-26T10:35:00.000Z"
      },
      "uploadedAt": "2024-01-26T10:30:00.000Z",
      "createdAt": "2024-01-26T10:30:00.000Z",
      "updatedAt": "2024-01-26T10:35:00.000Z"
    }
  ]
}
```

**Note:** The list endpoint returns basic transcript info (`transcriptId`, `text`, `summary`, `transcribedAt`). For full transcript data including words, entities, sentiment analysis, etc., use the single recording endpoint.

---

## Transcript Status Values

- `uploaded` - Recording uploaded, transcription not started
- `processing` - Transcription in progress
- `transcribed` - Transcription completed successfully
- `failed` - Transcription failed
- `completed` - All processing completed (future use)

---

## Postman Collection for Get Transcript

Add this to your Postman collection:

```json
{
  "name": "Get Recording Transcript",
  "request": {
    "method": "GET",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{token}}",
        "type": "text"
      }
    ],
    "url": {
      "raw": "{{baseUrl}}/api/recordings/{{sessionId}}",
      "host": ["{{baseUrl}}"],
      "path": ["api", "recordings", "{{sessionId}}"]
    }
  }
}
```
