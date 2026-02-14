import { FastifyRequest, FastifyReply } from 'fastify';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { validateEmail, validatePassword } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { sendVerificationEmail } from '../utils/email.js';
import crypto from 'crypto';

interface LoginBody {
  email: string;
  password: string;
}

interface SignupBody {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

interface VerifyEmailBody {
  code: string;
}

interface ResendVerificationBody {
  email: string;
}

interface TokenPayload extends JwtPayload {
  userId: string;
  email?: string;
  role?: string;
  tokenId?: string;
}

// Generate tokens
const generateTokens = (
  userId: string,
  email: string,
  role: string
): { accessToken: string; refreshToken: string } => {
  const accessToken = jwt.sign({ userId, email, role }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });

  const tokenId = crypto.randomBytes(16).toString('hex');
  const refreshToken = jwt.sign({ userId, tokenId }, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn,
  });

  return { accessToken, refreshToken };
};

// Store refresh token in database
const storeRefreshToken = async (
  userId: string,
  token: string
): Promise<void> => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await RefreshToken.create({
    userId,
    token,
    expiresAt,
  });
};

export const login = async (
  request: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { email, password } = request.body;

    // Validation
    if (!email || !password) {
      reply.code(400).send({
        error: true,
        message: 'Email and password are required',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    if (!validateEmail(email)) {
      reply.code(400).send({
        error: true,
        message: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
      return;
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      reply.code(401).send({
        error: true,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      reply.code(401).send({
        error: true,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(
      user._id.toString(),
      user.email,
      user.role
    );

    // Store refresh token
    await storeRefreshToken(user._id.toString(), refreshToken);

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    logger.info({ userId: user._id, email: user.email }, 'User logged in');

    reply.code(200).send({
      token: accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Login error');
    throw error;
  }
};

export const signup = async (
  request: FastifyRequest<{ Body: SignupBody }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { firstName, lastName, email, password } = request.body;

    // Validation
    if (!firstName || !lastName || !email || !password) {
      reply.code(400).send({
        error: true,
        message: 'First name, last name, email, and password are required',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    if (!validateEmail(email)) {
      reply.code(400).send({
        error: true,
        message: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
      return;
    }

    if (!validatePassword(password)) {
      reply.code(400).send({
        error: true,
        message: 'Password must be at least 6 characters',
        code: 'INVALID_PASSWORD',
      });
      return;
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      reply.code(400).send({
        error: true,
        message: 'Email already exists',
        code: 'EMAIL_EXISTS',
      });
      return;
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date();
    verificationExpires.setMinutes(verificationExpires.getMinutes() + 10); // 10 minutes

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      role: 'PT',
      emailVerified: false,
      emailVerificationCode: verificationCode,
      emailVerificationExpires: verificationExpires,
    });

    // Generate tokens (user can still login but email not verified)
    const { accessToken, refreshToken } = generateTokens(
      user._id.toString(),
      user.email,
      user.role
    );

    // Store refresh token
    await storeRefreshToken(user._id.toString(), refreshToken);

    // Send verification email
    try {
      await sendVerificationEmail(user.email, verificationCode, user.firstName);
    } catch (emailError) {
      logger.error({ error: (emailError as Error).message }, 'Failed to send verification email');
      // Don't fail signup if email fails, but log it
    }

    logger.info({ userId: user._id, email: user.email }, 'User signed up');

    reply.code(201).send({
      token: accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      message: 'Account created successfully. Please check your email to verify your account.',
    });
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Signup error');
    throw error;
  }
};

export const logout = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Optionally, you can blacklist the token here
      // For now, we'll just return success
      // In production, you might want to store blacklisted tokens
    }

    logger.info({ userId: request.userId }, 'User logged out');

    reply.code(200).send({
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Logout error');
    throw error;
  }
};

export const getMe = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  try {
    const user = request.user;

    if (!user) {
      reply.code(401).send({
        error: true,
        message: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    reply.code(200).send({
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      emailVerified: user.emailVerified,
    });
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Get me error');
    throw error;
  }
};

export const refresh = async (
  request: FastifyRequest<{ Body: RefreshBody }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { refreshToken } = request.body;

    if (!refreshToken) {
      reply.code(400).send({
        error: true,
        message: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN',
      });
      return;
    }

    // Verify refresh token
    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret) as TokenPayload;
    } catch (error) {
      reply.code(401).send({
        error: true,
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
      return;
    }

    if (!decoded.userId) {
      reply.code(401).send({
        error: true,
        message: 'Invalid refresh token payload',
        code: 'INVALID_REFRESH_TOKEN',
      });
      return;
    }

    // Check if refresh token exists in database
    const storedToken = await RefreshToken.findOne({
      userId: decoded.userId,
      token: refreshToken,
    });

    if (!storedToken) {
      reply.code(401).send({
        error: true,
        message: 'Refresh token not found or revoked',
        code: 'REFRESH_TOKEN_NOT_FOUND',
      });
      return;
    }

    // Get user
    const user = await User.findById(decoded.userId);
    if (!user) {
      reply.code(401).send({
        error: true,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    logger.info({ userId: user._id }, 'Token refreshed');

    reply.code(200).send({
      token: accessToken,
    });
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Refresh token error');
    throw error;
  }
};

export const verifyEmail = async (
  request: FastifyRequest<{ Body: VerifyEmailBody }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { code } = request.body;

    if (!code) {
      reply.code(400).send({
        error: true,
        message: 'Verification code is required',
        code: 'MISSING_CODE',
      });
      return;
    }

    // Find user with matching code
    const user = await User.findOne({
      emailVerificationCode: code,
      emailVerificationExpires: { $gt: new Date() }, // Code not expired
    });

    if (!user) {
      reply.code(400).send({
        error: true,
        message: 'Invalid or expired verification code',
        code: 'INVALID_CODE',
      });
      return;
    }

    // Check if already verified
    if (user.emailVerified) {
      reply.code(400).send({
        error: true,
        message: 'Email already verified',
        code: 'ALREADY_VERIFIED',
      });
      return;
    }

    // Verify the email
    user.emailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    logger.info({ userId: user._id, email: user.email }, 'Email verified');

    reply.code(200).send({
      message: 'Email verified successfully',
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Verify email error');
    throw error;
  }
};

export const resendVerification = async (
  request: FastifyRequest<{ Body: ResendVerificationBody }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { email } = request.body;

    if (!email) {
      reply.code(400).send({
        error: true,
        message: 'Email is required',
        code: 'MISSING_EMAIL',
      });
      return;
    }

    if (!validateEmail(email)) {
      reply.code(400).send({
        error: true,
        message: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
      return;
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if email exists or not for security
      reply.code(200).send({
        message: 'If the email exists and is not verified, a verification code has been sent.',
      });
      return;
    }

    // Check if already verified
    if (user.emailVerified) {
      reply.code(400).send({
        error: true,
        message: 'Email is already verified',
        code: 'ALREADY_VERIFIED',
      });
      return;
    }

    // Generate new 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date();
    verificationExpires.setMinutes(verificationExpires.getMinutes() + 10); // 10 minutes

    // Update user with new code
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(user.email, verificationCode, user.firstName);
      logger.info({ userId: user._id, email: user.email }, 'Verification code resent');
    } catch (emailError) {
      logger.error({ error: (emailError as Error).message }, 'Failed to send verification email');
      reply.code(500).send({
        error: true,
        message: 'Failed to send verification email',
        code: 'EMAIL_SEND_FAILED',
      });
      return;
    }

    reply.code(200).send({
      message: 'Verification code has been sent to your email.',
    });
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Resend verification error');
    throw error;
  }
};
