# Environment Variables Setup

Create a `.env` file in the root directory with the following variables:

```env
# Server
PORT=3000
NODE_ENV=development

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
R2_PUBLIC_URL=https://your-bucket.r2.cloudflarestorage.com

# CORS
CORS_ORIGIN=http://localhost:3000

# File Upload
MAX_FILE_SIZE=104857600
ALLOWED_FILE_TYPES=m4a,aac,mp3
UPLOAD_DIR=./uploads/recordings

# Email Configuration (for email verification)
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
BASE_URL=http://localhost:3000

# AssemblyAI (for audio transcription)
ASSEMBLYAI_API_KEY=your-assemblyai-api-key
```

## Getting Started

1. Copy this file to `.env` in the root directory
2. Fill in all the required values
3. Make sure MongoDB is running
4. Configure Cloudflare R2 bucket and credentials
5. Run `npm install` to install dependencies
6. Run `npm run dev` to start the development server
