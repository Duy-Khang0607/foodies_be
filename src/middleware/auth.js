const User = require('../models/User');
const jwtUtils = require('../utils/jwtUtils');

// Try to import express-rate-limit, fallback to simple rate limiting
let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch (error) {
  const rateLimitStore = new Map();
  
  rateLimit = (options) => {
    return (req, res, next) => {
      const key = req.ip + (req.body.email || req.body.name || '');
      const now = Date.now();
      
      if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { count: 1, resetTime: now + options.windowMs });
        return next();
      }
      
      const record = rateLimitStore.get(key);
      if (now > record.resetTime) {
        rateLimitStore.set(key, { count: 1, resetTime: now + options.windowMs });
        return next();
      }
      
      if (record.count >= options.max) {
        return res.status(429).json(options.message);
      }
      
      record.count++;
      next();
    };
  };
}

/**
 * Authentication middleware - Verify JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const token = jwtUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token không được cung cấp'
      });
    }

    // Verify token
    const decoded = jwtUtils.verifyAccessToken(token);
    
    // Get user from database
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị vô hiệu hóa'
      });
    }

    // Check if user is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Tài khoản đã bị khóa do đăng nhập sai quá nhiều lần'
      });
    }

    // Check if password changed after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        success: false,
        message: 'Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại'
      });
    }

    // Grant access to protected route
    req.user = user;
    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Token không hợp lệ'
    });
  }
};

/**
 * Optional authentication middleware - Doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwtUtils.verifyAccessToken(token);
    const user = await User.findById(decoded.id);
    
    if (user && user.isActive && !user.isLocked && !user.changedPasswordAfter(decoded.iat)) {
      req.user = user;
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

/**
 * Authorization middleware - Check user roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để truy cập'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập tài nguyên này'
      });
    }

    next();
  };
};

/**
 * Check if user owns the resource or is admin
 */
const authorizeOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập để truy cập'
    });
  }

  const userId = req.params.userId || req.params.id || req.body.userId;
  
  if (req.user.role === 'admin' || req.user._id.toString() === userId) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Bạn chỉ có thể truy cập tài nguyên của chính mình'
  });
};

/**
 * Rate limiting for authentication routes
 */
const createAuthRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests
    skipSuccessfulRequests: true,
    // Custom key generator to include IP and user identifier
    keyGenerator: (req) => {
      return req.ip + (req.body.email || req.body.phone || '');
    }
  });
};

// Rate limits for different auth operations
const loginRateLimit = createAuthRateLimit(
  5 * 60 * 1000, // 5 minutes
  5, // 5 attempts
  'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 5 phút'
);

const registerRateLimit = createAuthRateLimit(
  60 * 60 * 1000, // 1 hour
  3, // 3 attempts
  'Quá nhiều lần đăng ký. Vui lòng thử lại sau 1 giờ'
);

const forgotPasswordRateLimit = createAuthRateLimit(
  60 * 60 * 1000, // 1 hour
  3, // 3 attempts
  'Quá nhiều yêu cầu reset mật khẩu. Vui lòng thử lại sau 1 giờ'
);

const verifyEmailRateLimit = createAuthRateLimit(
  60 * 60 * 1000, // 1 hour
  5, // 5 attempts
  'Quá nhiều yêu cầu xác thực email. Vui lòng thử lại sau 1 giờ'
);

/**
 * Middleware to validate refresh token
 */
const validateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token không được cung cấp'
      });
    }

    // Verify refresh token
    const decoded = jwtUtils.verifyRefreshToken(refreshToken);
    
    // Find user with this refresh token
    const user = await User.findByRefreshToken(refreshToken);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token không hợp lệ'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị vô hiệu hóa'
      });
    }

    req.user = user;
    req.refreshToken = refreshToken;
    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Refresh token không hợp lệ'
    });
  }
};

/**
 * Middleware to log user activity
 */
const logUserActivity = (action) => {
  return (req, res, next) => {
    // Add user activity logging
    next();
  };
};

/**
 * Middleware to check if email is verified for certain actions
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập để truy cập'
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Vui lòng xác thực email trước khi thực hiện hành động này',
      needEmailVerification: true
    });
  }

  next();
};

/**
 * Middleware to extract device info from request
 */
const extractDeviceInfo = (req, res, next) => {
  req.deviceInfo = {
    userAgent: req.headers['user-agent'] || 'Unknown',
    ip: req.ip || req.connection.remoteAddress || 'Unknown'
  };
  next();
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  authorizeOwnerOrAdmin,
  validateRefreshToken,
  logUserActivity,
  requireEmailVerification,
  extractDeviceInfo,
  // Rate limiting
  loginRateLimit,
  registerRateLimit,
  forgotPasswordRateLimit,
  verifyEmailRateLimit
};
