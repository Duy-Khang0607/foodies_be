const mongoose = require('mongoose');
const crypto = require('crypto');

// Try to import validator, fallback to simple validation
let validator;
try {
  validator = require('validator');
} catch (error) {
  validator = {
    isEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    isMobilePhone: (phone, locale) => /^[0-9\-\+\s\(\)]+$/.test(phone)
  };
}

// Try to import bcryptjs, fallback to Node.js built-in crypto
let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (error) {
  bcrypt = {
    hash: async (password, rounds = 12) => {
      return crypto.pbkdf2Sync(password, 'foodies-salt', 10000, 64, 'sha512').toString('hex');
    },
    compare: async (password, hash) => {
      const hashedPassword = crypto.pbkdf2Sync(password, 'foodies-salt', 10000, 64, 'sha512').toString('hex');
      return hashedPassword === hash;
    }
  };
}

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên không được để trống'],
    unique: true,
    trim: true,
    minlength: [2, 'Tên phải có ít nhất 2 ký tự'],
    maxlength: [50, 'Tên không được quá 50 ký tự']
  },
  email: {
    type: String,
    required: [true, 'Email không được để trống'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Email không hợp lệ']
  },
  password: {
    type: String,
    required: [true, 'Mật khẩu không được để trống'],
    minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự'],
    select: false // Không trả về password khi query user
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || validator.isMobilePhone(v, 'vi-VN');
      },
      message: 'Số điện thoại không hợp lệ'
    }
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    district: { type: String, trim: true },
    ward: { type: String, trim: true },
    zipCode: { type: String, trim: true }
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  avatar: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  passwordChangedAt: {
    type: Date,
    select: false
  },
  loginAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  lockUntil: {
    type: Date,
    select: false
  },
  refreshTokens: [{
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    deviceInfo: {
      userAgent: String,
      ip: String
    }
  }],
  preferences: {
    language: {
      type: String,
      enum: ['vi', 'en'],
      default: 'vi'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    privacy: {
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false }
    }
  },
  lastLogin: {
    type: Date,
    select: false
  },
  lastLoginIP: {
    type: String,
    select: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ name: 1 });
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'refreshTokens.token': 1 });
userSchema.index({ 'refreshTokens.expiresAt': 1 });

// Virtual for account locked status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware để hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  // Hash password với cost 12
  this.password = await bcrypt.hash(this.password, 12);
  
  // Set passwordChangedAt nếu không phải user mới
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000;
  }
  
  next();
});

// Pre-save middleware để clean up expired refresh tokens
userSchema.pre('save', function(next) {
  if (this.isModified('refreshTokens')) {
    this.refreshTokens = this.refreshTokens.filter(
      token => token.expiresAt > new Date()
    );
  }
  next();
});

// Instance method để so sánh password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method để check password đã thay đổi sau khi issue JWT
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Instance method để increment login attempts
userSchema.methods.incLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // If we have max attempts and no lock, lock account
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 5 * 60 * 1000 }; // 5 minutes
  }
  
  return this.updateOne(updates);
};

// Instance method để reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1
    }
  });
};

// Instance method để add refresh token
userSchema.methods.addRefreshToken = async function(token, expiresAt, deviceInfo = {}) {
  this.refreshTokens.push({
    token,
    expiresAt,
    deviceInfo
  });
  
  // Giới hạn số lượng refresh tokens (max 5 devices)
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }
  
  await this.save();
};

// Instance method để remove refresh token
userSchema.methods.removeRefreshToken = async function(token) {
  this.refreshTokens = this.refreshTokens.filter(
    rt => rt.token !== token
  );
  await this.save();
};

// Instance method để remove all refresh tokens
userSchema.methods.removeAllRefreshTokens = async function() {
  this.refreshTokens = [];
  await this.save();
};

// Static method để find user by refresh token
userSchema.statics.findByRefreshToken = function(token) {
  return this.findOne({
    'refreshTokens.token': token,
    'refreshTokens.expiresAt': { $gt: new Date() }
  });
};

// Static method để clean expired tokens cho tất cả users
userSchema.statics.cleanExpiredTokens = async function() {
  return this.updateMany(
    { 'refreshTokens.expiresAt': { $lt: new Date() } },
    { $pull: { refreshTokens: { expiresAt: { $lt: new Date() } } } }
  );
};

const User = mongoose.model('User', userSchema);

module.exports = User;
