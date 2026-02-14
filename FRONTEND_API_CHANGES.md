# Frontend API Changes - Email Verification

## Overview
Email verification has been updated to use a 6-digit code instead of a verification link. Users receive a code via email that they must enter to verify their account.

---

## 1. Signup Endpoint

### Endpoint
```
POST /api/auth/signup
```

### Request Payload
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "password123"
}
```

### Response Example (201 Created)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "PT",
    "emailVerified": false
  },
  "message": "Account created successfully. Please check your email to verify your account."
}
```

### Notes
- User receives a 6-digit verification code via email
- Code expires in 10 minutes
- User can still login, but `emailVerified` will be `false` until verified

---

## 2. Verify Email Endpoint

### Endpoint
```
POST /api/auth/verify-email
```

### Request Payload
```json
{
  "code": "123456"
}
```

### Success Response (200 OK)
```json
{
  "message": "Email verified successfully",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "PT",
    "emailVerified": true
  }
}
```

### Error Responses

#### Missing Code (400)
```json
{
  "error": true,
  "message": "Verification code is required",
  "code": "MISSING_CODE"
}
```

#### Invalid/Expired Code (400)
```json
{
  "error": true,
  "message": "Invalid or expired verification code",
  "code": "INVALID_CODE"
}
```

#### Already Verified (400)
```json
{
  "error": true,
  "message": "Email already verified",
  "code": "ALREADY_VERIFIED"
}
```

---

## 3. Resend Verification Code Endpoint

### Endpoint
```
POST /api/auth/resend-verification
```

### Request Payload
```json
{
  "email": "john.doe@example.com"
}
```

### Success Response (200 OK)
```json
{
  "message": "Verification code has been sent to your email."
}
```

### Error Responses

#### Missing Email (400)
```json
{
  "error": true,
  "message": "Email is required",
  "code": "MISSING_EMAIL"
}
```

#### Invalid Email Format (400)
```json
{
  "error": true,
  "message": "Invalid email format",
  "code": "INVALID_EMAIL"
}
```

#### Already Verified (400)
```json
{
  "error": true,
  "message": "Email is already verified",
  "code": "ALREADY_VERIFIED"
}
```

#### Email Send Failed (500)
```json
{
  "error": true,
  "message": "Failed to send verification email",
  "code": "EMAIL_SEND_FAILED"
}
```

### Notes
- Returns success message even if email doesn't exist (security measure)
- Generates a new 6-digit code
- New code expires in 10 minutes

---

## 4. Updated Login Response

### Endpoint
```
POST /api/auth/login
```

### Response Example (200 OK)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "PT",
    "emailVerified": true
  }
}
```

### Notes
- `emailVerified` field is now included in the response
- Use this to show verification status in UI

---

## 5. Updated Get Me Response

### Endpoint
```
GET /api/auth/me
```

### Response Example (200 OK)
```json
{
  "id": "507f1f77bcf86cd799439011",
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "PT",
  "emailVerified": true
}
```

### Notes
- `emailVerified` field is now included in the response

---

## Frontend Implementation Checklist

- [ ] Update signup flow to show message about checking email for verification code
- [ ] Create verification screen/component to enter 6-digit code
- [ ] Call `POST /api/auth/verify-email` with code from user input
- [ ] Handle verification success/error states
- [ ] Add "Resend Code" button/link that calls `POST /api/auth/resend-verification`
- [ ] Show verification status in user profile/settings using `emailVerified` field
- [ ] Optionally restrict certain features until email is verified
- [ ] Update login response handling to include `emailVerified` status

---

## Code Expiration
- Verification codes expire in **10 minutes**
- Users can request a new code via resend endpoint

---

## User Flow Example

1. User signs up → Receives email with 6-digit code
2. User enters code in app → Calls `POST /api/auth/verify-email`
3. If code expired/wrong → User can call `POST /api/auth/resend-verification`
4. After verification → `emailVerified: true` in all user responses
