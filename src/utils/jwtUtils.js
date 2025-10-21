const crypto = require('crypto');

// Try to import jsonwebtoken, fallback to simple token implementation
let jwt;
try {
  jwt = require('jsonwebtoken');
} catch (error) {
  jwt = {
    sign: (payload, secret, options = {}) => {
      const header = { typ: 'JWT', alg: 'HS256' };
      const now = Math.floor(Date.now() / 1000);
      const exp = options.expiresIn ? now + (parseExpiry(options.expiresIn)) : now + 900; // 15 min default
      
      const fullPayload = { ...payload, iat: now, exp, iss: options.issuer, aud: options.audience };
      
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
      const signature = crypto.createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest('base64url');
      
      return `${encodedHeader}.${encodedPayload}.${signature}`;
    },
    verify: (token, secret, options = {}) => {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token format');
      
      const [header, payload, signature] = parts;
      const expectedSignature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
      
      if (signature !== expectedSignature) throw new Error('Invalid signature');
      
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
      
      if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      }
      
      return decodedPayload;
    },
    decode: (token) => {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      try {
        return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      } catch {
        return null;
      }
    }
  };
}

function parseExpiry(expiresIn) {
  if (typeof expiresIn === 'number') return expiresIn;
  if (typeof expiresIn === 'string') {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // 15 min default
    const [, num, unit] = match;
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
    return parseInt(num) * (multipliers[unit] || 60);
  }
  return 900;
}

class JWTUtils {
  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'foodies-access-secret-key-2024';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'foodies-refresh-secret-key-2024';
    this.emailTokenSecret = process.env.JWT_EMAIL_SECRET || 'foodies-email-secret-key-2024';
    
    // Token expiration times
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    this.emailTokenExpiry = process.env.JWT_EMAIL_EXPIRES_IN || '24h';
    this.passwordResetExpiry = process.env.JWT_PASSWORD_RESET_EXPIRES_IN || '1h';
  }

  /**
   * Generate access token
   * @param {Object} payload - User data to include in token
   * @returns {String} JWT access token
   */
  generateAccessToken(payload) {
    try {
      const tokenPayload = {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        type: 'access'
      };
      
      return jwt.sign(tokenPayload, this.accessTokenSecret, {
        expiresIn: this.accessTokenExpiry,
        issuer: 'foodies-app',
        audience: 'foodies-users'
      });
    } catch (error) {
      throw new Error(`Error generating access token: ${error.message}`);
    }
  }

  /**
   * Generate refresh token
   * @param {Object} payload - User data to include in token
   * @returns {String} JWT refresh token
   */
  generateRefreshToken(payload) {
    try {
      const tokenPayload = {
        id: payload.id,
        email: payload.email,
        type: 'refresh',
        tokenId: crypto.randomUUID() // Unique token ID
      };
      
      return jwt.sign(tokenPayload, this.refreshTokenSecret, {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'foodies-app',
        audience: 'foodies-users'
      });
    } catch (error) {
      throw new Error(`Error generating refresh token: ${error.message}`);
    }
  }

  /**
   * Generate email verification token
   * @param {Object} payload - User data to include in token
   * @returns {String} JWT email verification token
   */
  generateEmailToken(payload) {
    try {
      const tokenPayload = {
        id: payload.id,
        email: payload.email,
        type: 'email_verification'
      };
      
      return jwt.sign(tokenPayload, this.emailTokenSecret, {
        expiresIn: this.emailTokenExpiry,
        issuer: 'foodies-app',
        audience: 'foodies-users'
      });
    } catch (error) {
      throw new Error(`Error generating email token: ${error.message}`);
    }
  }

  /**
   * Generate password reset token
   * @param {Object} payload - User data to include in token
   * @returns {String} JWT password reset token
   */
  generatePasswordResetToken(payload) {
    try {
      const tokenPayload = {
        id: payload.id,
        email: payload.email,
        type: 'password_reset'
      };
      
      return jwt.sign(tokenPayload, this.emailTokenSecret, {
        expiresIn: this.passwordResetExpiry,
        issuer: 'foodies-app',
        audience: 'foodies-users'
      });
    } catch (error) {
      throw new Error(`Error generating password reset token: ${error.message}`);
    }
  }

  /**
   * Generate token pair (access + refresh)
   * @param {Object} payload - User data to include in tokens
   * @returns {Object} Object containing access and refresh tokens
   */
  generateTokenPair(payload) {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
      accessTokenExpiresIn: this.accessTokenExpiry,
      refreshTokenExpiresIn: this.refreshTokenExpiry
    };
  }

  /**
   * Verify access token
   * @param {String} token - JWT token to verify
   * @returns {Object} Decoded token payload
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'foodies-app',
        audience: 'foodies-users'
      });
      
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      } else {
        throw new Error(`Token verification failed: ${error.message}`);
      }
    }
  }

  /**
   * Verify refresh token
   * @param {String} token - JWT refresh token to verify
   * @returns {Object} Decoded token payload
   */
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'foodies-app',
        audience: 'foodies-users'
      });
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      } else {
        throw new Error(`Refresh token verification failed: ${error.message}`);
      }
    }
  }

  /**
   * Verify email verification token
   * @param {String} token - JWT email token to verify
   * @returns {Object} Decoded token payload
   */
  verifyEmailToken(token) {
    try {
      const decoded = jwt.verify(token, this.emailTokenSecret, {
        issuer: 'foodies-app',
        audience: 'foodies-users'
      });
      
      if (decoded.type !== 'email_verification') {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Email verification token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid email verification token');
      } else {
        throw new Error(`Email token verification failed: ${error.message}`);
      }
    }
  }

  /**
   * Verify password reset token
   * @param {String} token - JWT password reset token to verify
   * @returns {Object} Decoded token payload
   */
  verifyPasswordResetToken(token) {
    try {
      const decoded = jwt.verify(token, this.emailTokenSecret, {
        issuer: 'foodies-app',
        audience: 'foodies-users'
      });
      
      if (decoded.type !== 'password_reset') {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Password reset token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid password reset token');
      } else {
        throw new Error(`Password reset token verification failed: ${error.message}`);
      }
    }
  }

  /**
   * Extract token from Authorization header
   * @param {String} authHeader - Authorization header value
   * @returns {String|null} Extracted token or null
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }
    
    return parts[1];
  }

  /**
   * Get token expiration date
   * @param {String} token - JWT token
   * @returns {Date|null} Expiration date or null
   */
  getTokenExpiration(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) return null;
      
      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   * @param {String} token - JWT token
   * @returns {Boolean} True if expired, false otherwise
   */
  isTokenExpired(token) {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;
    
    return expiration < new Date();
  }

  /**
   * Get token payload without verification (for debugging)
   * @param {String} token - JWT token
   * @returns {Object|null} Decoded payload or null
   */
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate random token (for additional security)
   * @param {Number} length - Token length (default: 32)
   * @returns {String} Random hex token
   */
  generateRandomToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
}

// Export singleton instance
module.exports = new JWTUtils();
