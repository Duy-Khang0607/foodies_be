const express = require('express');
const authController = require('../controllers/authController');
const {
  authenticate,
  validateRefreshToken,
  extractDeviceInfo,
  loginRateLimit,
  registerRateLimit,
  forgotPasswordRateLimit,
  verifyEmailRateLimit
} = require('../middleware/auth');

const router = express.Router();

// Apply device info extraction to all routes
router.use(extractDeviceInfo);

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { name, email, password }
 */
router.post('/register', registerRateLimit, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 * @body    { name, password }
 */
router.post('/login', loginRateLimit, authController.login);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @body    { refreshToken }
 */
router.post('/refresh-token', validateRefreshToken, authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (remove refresh token)
 * @access  Private
 * @body    { refreshToken? }
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post('/logout-all', authenticate, authController.logoutAll);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 * @body    { phone?, address?, preferences? }
 * @note    Cannot update name or email (unique identifiers)
 */
router.put('/profile', authenticate, authController.updateProfile);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 * @body    { currentPassword, newPassword }
 */
router.put('/change-password', authenticate, authController.changePassword);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 * @body    { email }
 */
router.post('/forgot-password', forgotPasswordRateLimit, authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 * @body    { token, newPassword }
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email using token
 * @access  Public
 * @body    { token }
 */
router.post('/verify-email', authController.verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification
 * @access  Private
 */
router.post('/resend-verification', verifyEmailRateLimit, authenticate, authController.resendEmailVerification);

/**
 * @route   GET /api/auth/validate-token
 * @desc    Validate if current access token is valid
 * @access  Private
 */
router.get('/validate-token', authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Token hợp lệ',
    data: {
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        isEmailVerified: req.user.isEmailVerified
      }
    }
  });
});

/**
 * @route   GET /api/auth/me
 * @desc    Get minimal user info (alias for profile with less data)
 * @access  Private
 */
router.get('/me', authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        isEmailVerified: req.user.isEmailVerified,
        avatar: req.user.avatar
      }
    }
  });
});

/**
 * @route   DELETE /api/auth/delete-account
 * @desc    Delete user account (self-deletion)
 * @access  Private
 * @body    { password, confirmDelete }
 */
router.delete('/delete-account', authenticate, authController.deleteAccount);

/**
 * @route   DELETE /api/auth/admin/users/:userId
 * @desc    Admin delete user account
 * @access  Private (Admin only)
 */
router.delete('/admin/users/:userId', authenticate, authController.adminDeleteUser);

module.exports = router;
