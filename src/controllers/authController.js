const User = require('../models/User');
const jwtUtils = require('../utils/jwtUtils');
const emailUtils = require('../utils/emailUtils');
const crypto = require('crypto');

class AuthController {
  /**
   * User Registration
   */
  async register(req, res) {
    try {
      const { name, email, password } = req.body;

      // Validate required fields
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Tên, email và mật khẩu là bắt buộc'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ 
        $or: [
          { name: name.trim() },
          { email: email.toLowerCase() }
        ]
      });

      if (existingUser) {
        if (existingUser.name === name.trim()) {
          return res.status(409).json({
            success: false,
            message: 'Tên đã được sử dụng'
          });
        }
        if (existingUser.email === email.toLowerCase()) {
          return res.status(409).json({
            success: false,
            message: 'Email đã được sử dụng'
          });
        }
      }

      // Create new user
      const userData = {
        name: name.trim(),
        email: email.toLowerCase(),
        password
      };

      const user = new User(userData);
      await user.save();

      // Log for audit trail (especially for email reuse detection)
      console.log(`👤 New user registered: ${user.email} (${user.name}) at ${new Date().toISOString()}`);

      // Generate email verification token
      const emailToken = jwtUtils.generateEmailToken({
        id: user._id,
        email: user.email
      });

      // Generate verification URL
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${emailToken}`;

      // Send verification email
      try {
        await emailUtils.sendEmailVerification(user, verificationUrl);
      } catch (error) {
        console.error('Failed to send verification email:', error.message);
        // Don't fail registration if email fails
      }

      // Generate token pair for immediate login (optional)
      const tokens = jwtUtils.generateTokenPair({
        id: user._id,
        email: user.email,
        role: user.role
      });

      // Calculate refresh token expiry
      const refreshTokenExpiry = new Date();
      refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

      // Add refresh token to user
      await user.addRefreshToken(
        tokens.refreshToken,
        refreshTokenExpiry,
        req.deviceInfo
      );

      // Return response without password
      const userResponse = user.toObject();
      delete userResponse.password;

      res.status(201).json({
        success: true,
        message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản',
        data: {
          user: userResponse,
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.accessTokenExpiresIn
          }
        }
      });

    } catch (error) {
      console.error('Register error:', error);

      // Handle validation errors
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors
        });
      }

      // Handle duplicate key errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        let message = 'Dữ liệu đã được sử dụng';
        if (field === 'email') message = 'Email đã được sử dụng';
        if (field === 'name') message = 'Tên đã được sử dụng';
        
        return res.status(409).json({
          success: false,
          message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi server. Vui lòng thử lại sau'
      });
    }
  }

  /**
   * User Login
   */
  async login(req, res) {
    try {
      const { name, password } = req.body;

      // Validate input
      if (!name || !password) {
        return res.status(400).json({
          success: false,
          message: 'Tên và mật khẩu là bắt buộc'
        });
      }

      // Find user and include password for comparison
      const user = await User.findOne({ 
        name: name.trim() 
      }).select('+password +passwordChangedAt +loginAttempts +lockUntil');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Tên hoặc mật khẩu không chính xác'
        });
      }

      // Check if account is locked
      if (user.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Tài khoản đã bị khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút'
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Tài khoản đã bị vô hiệu hóa'
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        // Increment login attempts
        await user.incLoginAttempts();
        
        return res.status(401).json({
          success: false,
          message: 'Tên hoặc mật khẩu không chính xác'
        });
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Update last login info
      user.lastLogin = new Date();
      user.lastLoginIP = req.ip || req.connection.remoteAddress;
      await user.save();

      // Generate token pair
      const tokens = jwtUtils.generateTokenPair({
        id: user._id,
        email: user.email,
        role: user.role
      });

      // Calculate refresh token expiry
      const refreshTokenExpiry = new Date();
      refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

      // Add refresh token to user
      await user.addRefreshToken(
        tokens.refreshToken,
        refreshTokenExpiry,
        req.deviceInfo
      );

      // Return response without sensitive data
      const userResponse = user.toObject();
      delete userResponse.password;
      delete userResponse.passwordChangedAt;
      delete userResponse.loginAttempts;
      delete userResponse.lockUntil;

      res.status(200).json({
        success: true,
        message: 'Đăng nhập thành công',
        data: {
          user: userResponse,
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.accessTokenExpiresIn
          }
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server. Vui lòng thử lại sau'
      });
    }
  }

  /**
   * Refresh Token
   */
  async refreshToken(req, res) {
    try {
      const user = req.user;
      const oldRefreshToken = req.refreshToken;

      // Generate new token pair
      const tokens = jwtUtils.generateTokenPair({
        id: user._id,
        email: user.email,
        role: user.role
      });

      // Calculate new refresh token expiry
      const refreshTokenExpiry = new Date();
      refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

      // Remove old refresh token and add new one
      await user.removeRefreshToken(oldRefreshToken);
      await user.addRefreshToken(
        tokens.refreshToken,
        refreshTokenExpiry,
        req.deviceInfo
      );

      res.status(200).json({
        success: true,
        message: 'Token đã được làm mới',
        data: {
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.accessTokenExpiresIn
          }
        }
      });

    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server. Vui lòng thử lại sau'
      });
    }
  }

  /**
   * Logout
   */
  async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const user = req.user;

      if (refreshToken) {
        // Remove specific refresh token
        await user.removeRefreshToken(refreshToken);
      }

      res.status(200).json({
        success: true,
        message: 'Đăng xuất thành công'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server. Vui lòng thử lại sau'
      });
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAll(req, res) {
    try {
      const user = req.user;

      // Remove all refresh tokens
      await user.removeAllRefreshTokens();

      res.status(200).json({
        success: true,
        message: 'Đã đăng xuất khỏi tất cả thiết bị'
      });

    } catch (error) {
      console.error('Logout all error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server. Vui lòng thử lại sau'
      });
    }
  }

  /**
   * Get current user profile
   */ 
  async getProfile(req, res) {
    try {
      const user = req.user;

      // Return user without sensitive data
      const userResponse = user.toObject();
      delete userResponse.password;

      res.status(200).json({
        success: true,
        message: 'Lấy thông tin profile thành công',
        data: { user: userResponse }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server. Vui lòng thử lại sau'
      });
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req, res) {
    try {
      const user = req.user;
      const updates = req.body;

      // Chỉ loại bỏ password (vì có API riêng để đổi password)
      delete updates.password;

      // Kiểm tra email unique nếu có cập nhật email
      if (updates.email && updates.email !== user.email) {
        const existingUser = await User.findOne({ 
          email: updates.email.toLowerCase().trim(),
          _id: { $ne: user._id }
        });
        
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Email đã được sử dụng bởi tài khoản khác'
          });
        }
      }

      // Kiểm tra name unique nếu có cập nhật name
      if (updates.name && updates.name !== user.name) {
        const existingUser = await User.findOne({ 
          name: updates.name.trim(),
          _id: { $ne: user._id }
        });
        
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Tên người dùng đã được sử dụng'
          });
        }
      }

      // Chuẩn hóa dữ liệu trước khi cập nhật
      if (updates.email) {
        updates.email = updates.email.toLowerCase().trim();
      }
      if (updates.name) {
        updates.name = updates.name.trim();
      }

      // Update user
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          user[key] = updates[key];
        }
      });

      await user.save();

      // Return updated user
      const userResponse = user.toObject();
      delete userResponse.password;

      res.status(200).json({
        success: true,
        message: 'Cập nhật profile thành công',
        data: { user: userResponse }
      });

    } catch (error) {
      console.error('Update profile error:', error);

      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors
        });
      }

      if (error.code === 11000) {
        // Duplicate key error
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
          success: false,
          message: `${field === 'email' ? 'Email' : 'Tên người dùng'} đã được sử dụng`
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi server. Vui lòng thử lại sau'
      });
    }
  }

  /**
   * Change password
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id).select('+password');

      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu hiện tại và mật khẩu mới là bắt buộc'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu hiện tại không chính xác'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Remove all refresh tokens (force re-login on all devices)
      await user.removeAllRefreshTokens();

      res.status(200).json({
        success: true,
        message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại'
      });

    } catch (error) {
      console.error('Change password error:', error);

      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi server. Vui lòng thử lại sau'
      });
    }
  }

  /**
   * Forgot password - Send reset email
   */
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email là bắt buộc'
        });
      }

      const user = await User.findOne({ email: email.toLowerCase() });

      // Always return success to prevent email enumeration
      if (!user) {
        return res.status(200).json({
          success: true,
          message: 'Nếu email tồn tại, link reset mật khẩu đã được gửi'
        });
      }

      // Generate password reset token
      const resetToken = jwtUtils.generatePasswordResetToken({
        id: user._id,
        email: user.email
      });

      // Generate reset URL
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

      // Save reset token to user (optional, for additional security)
      user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      // Send reset email
      try {
        await emailUtils.sendPasswordReset(user, resetUrl);
      } catch (error) {
        console.error('Failed to send reset email:', error.message);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        return res.status(500).json({
          success: false,
          message: 'Không thể gửi email reset. Vui lòng thử lại sau'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Link reset mật khẩu đã được gửi vào email'
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server. Vui lòng thử lại sau'
      });
    }
  }

  /**
   * Reset password
   */
  async resetPassword(req, res) {
    try {   
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Token và mật khẩu mới là bắt buộc'
        });
      }

      // Verify reset token
      const decoded = jwtUtils.verifyPasswordResetToken(token);

      // Find user
      const user = await User.findById(decoded.id).select('+passwordResetToken +passwordResetExpires');

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Token không hợp lệ hoặc đã hết hạn'
        });
      }

      // Verify token hash (if stored)
      if (user.passwordResetToken) {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        if (user.passwordResetToken !== hashedToken || user.passwordResetExpires < new Date()) {
          return res.status(400).json({
            success: false,
            message: 'Token không hợp lệ hoặc đã hết hạn'
          });
        }
      }

      // Update password
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      // Remove all refresh tokens (force re-login)
      await user.removeAllRefreshTokens();

      res.status(200).json({
        success: true,
        message: 'Reset mật khẩu thành công. Vui lòng đăng nhập lại'
      });

    } catch (error) {
      console.error('Reset password error:', error);

      if (error.message.includes('expired') || error.message.includes('invalid')) {
        return res.status(400).json({
          success: false,
          message: 'Token không hợp lệ hoặc đã hết hạn'
        });
      }

      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi server. Vui lòng thử lại sau'
      });
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(req, res) {
    try {
      console.log('🔍 Verify email started');
      const { token } = req.body;
      console.log('📧 Token received:', token ? 'Yes' : 'No');

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token xác thực là bắt buộc'
        });
      }

      // Verify email token
      console.log('🔐 Verifying JWT token...');
      const decoded = jwtUtils.verifyEmailToken(token);
      console.log('✅ Token decoded:', decoded);

      // Find user
      console.log('👤 Finding user with ID:', decoded.id);
      const user = await User.findById(decoded.id);
      console.log('👤 User found:', user ? 'Yes' : 'No');

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Token không hợp lệ'
        });
      }

      // Check if already verified
      console.log('✉️ User email verified status:', user.isEmailVerified);
      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email đã được xác thực trước đó'
        });
      }

      // Mark email as verified
      console.log('💾 Saving user verification status...');
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();
      console.log('✅ User saved successfully');

      // Send welcome email
      try {
        await emailUtils.sendWelcomeEmail(user);
      } catch (error) {
        console.error('Failed to send welcome email:', error.message);
        // Don't fail verification if welcome email fails
      }

      res.status(200).json({
        success: true,
        message: 'Xác thực email thành công'
      });

    } catch (error) {
      console.error('❌ Verify email error:', error);
      console.error('📋 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      if (error.message.includes('expired') || error.message.includes('invalid')) {
        return res.status(400).json({
          success: false,
          message: 'Token xác thực không hợp lệ hoặc đã hết hạn'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi server. Vui lòng thử lại sau'
      });
    }
  }

  /**
   * Resend email verification
   */
  async resendEmailVerification(req, res) {
    try {
      const user = req.user;

      // Check if already verified
      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email đã được xác thực'
        });
      }

      // Generate new email verification token
      const emailToken = jwtUtils.generateEmailToken({
        id: user._id,
        email: user.email
      });

      // Generate verification URL
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${emailToken}`;

      // Send verification email
      await emailUtils.sendEmailVerification(user, verificationUrl);

      res.status(200).json({
        success: true,
        message: 'Email xác thực đã được gửi lại'
      });

    } catch (error) {
      console.error('Resend email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể gửi email xác thực. Vui lòng thử lại sau'
      });
    }
  }

  /**
   * Delete User Account
   */
  async deleteAccount(req, res) {
    try {
      const userId = req.user.id;
      const { password, confirmDelete } = req.body;

      // Kiểm tra xác nhận xóa tài khoản
      if (confirmDelete !== 'DELETE_MY_ACCOUNT') {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng xác nhận xóa tài khoản bằng cách gõ "DELETE_MY_ACCOUNT"'
        });
      }

      // Lấy thông tin user với password để verify
      const user = await User.findById(userId).select('+password');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Người dùng không tồn tại'
        });
      }

      // Kiểm tra mật khẩu hiện tại
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập mật khẩu để xác nhận'
        });
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu không chính xác'
        });
      }

      // Không cho phép admin tự xóa tài khoản
      if (user.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Không thể xóa tài khoản admin. Vui lòng liên hệ quản trị viên khác'
        });
      }

      // Log thông tin trước khi xóa (cho audit)
      console.log(`🗑️  Account deletion requested for user: ${user.email} (${user.name}) at ${new Date().toISOString()}`);

      // Xóa tài khoản user
      await User.findByIdAndDelete(userId);

      // Log xóa thành công
      console.log(`✅ Account successfully deleted for user: ${user.email} (${user.name}) at ${new Date().toISOString()}`);

      res.status(200).json({
        success: true,
        message: 'Tài khoản đã được xóa thành công'
      });

    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server. Vui lòng thử lại sau'
      });
    }
  }

  /**
   * Admin Delete User
   */
  async adminDeleteUser(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.user.id;

      // Kiểm tra quyền admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Không có quyền thực hiện hành động này'
        });
      }

      // Kiểm tra user tồn tại
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'Người dùng không tồn tại'
        });
      }

      // Không cho phép admin xóa admin khác
      if (targetUser.role === 'admin' && targetUser._id.toString() !== adminId) {
        return res.status(403).json({
          success: false,
          message: 'Không thể xóa tài khoản admin khác'
        });
      }

      // Không cho phép admin tự xóa chính mình
      if (targetUser._id.toString() === adminId) {
        return res.status(403).json({
          success: false,
          message: 'Không thể tự xóa tài khoản của chính mình'
        });
      }

      // Log thông tin trước khi xóa (cho audit)
      console.log(`🗑️  Admin deletion: Admin ${req.user.email} deleting user ${targetUser.email} (${targetUser.name}) at ${new Date().toISOString()}`);

      // Xóa tài khoản user
      await User.findByIdAndDelete(userId);

      // Log xóa thành công
      console.log(`✅ Admin deletion successful: User ${targetUser.email} (${targetUser.name}) deleted by admin ${req.user.email} at ${new Date().toISOString()}`);

      res.status(200).json({
        success: true,
        message: `Đã xóa tài khoản người dùng: ${targetUser.name}`
      });

    } catch (error) {
      console.error('Admin delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server. Vui lòng thử lại sau'
      });
    }
  }
}

module.exports = new AuthController();
