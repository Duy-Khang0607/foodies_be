const emailUtils = require('../utils/emailUtils');

class PortfolioController {
  /**
   * Send contact email from portfolio
   * Public endpoint - không cần authentication
   */
  async sendContactEmail(req, res) {
    try {
      const { 
        name, 
        email, 
        message
      } = req.body;

      // Validation - chỉ cần 3 trường bắt buộc
      if (!name || !email || !message) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng điền đầy đủ thông tin bắt buộc',
          errors: {
            name: !name ? 'Tên không được để trống' : null,
            email: !email ? 'Email không được để trống' : null,
            message: !message ? 'Nội dung không được để trống' : null
          }
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Email không hợp lệ'
        });
      }

      // Validate message length
      if (message.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Nội dung phải có ít nhất 10 ký tự'
        });
      }

      if (message.length > 2000) {
        return res.status(400).json({
          success: false,
          message: 'Nội dung không được quá 2000 ký tự'
        });
      }

      // Tạo nội dung email gửi đến bạn
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #333; text-align: center; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
            📧 Liên hệ từ Portfolio
          </h2>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #4CAF50; margin-top: 0;">Thông tin người gửi:</h3>
            <p><strong>👤 Họ tên:</strong> ${name}</p>
            <p><strong>📧 Email:</strong> ${email}</p>
          </div>

          <div style="background-color: #fff; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">💬 Nội dung:</h3>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; line-height: 1.6;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>

          <div style="text-align: center; margin-top: 30px; padding: 15px; background-color: #e8f5e8; border-radius: 5px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              📅 Thời gian: ${new Date().toLocaleString('vi-VN')}
            </p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
              🌐 Gửi từ: Portfolio Website
            </p>
          </div>
        </div>
      `;

      // Email options gửi đến bạn
      const mailOptions = {
        to: process.env.PORTFOLIO_EMAIL || 'khangdev26@gmail.com', // Email cá nhân của bạn
        subject: `[Portfolio] Liên hệ từ ${name}`,
        html: emailContent,
        replyTo: email // Cho phép reply trực tiếp về email người gửi
      };

      // Gửi email
      const emailResult = await emailUtils.sendEmail(mailOptions);

      // Nếu đến đây nghĩa là email đã gửi thành công (không throw error)
      console.log('✅ Main email sent successfully:', emailResult.messageId || 'simulated');

      // Gửi email xác nhận cho người gửi (optional)
      const confirmationEmail = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #2c3e50; text-align: center; border-bottom: 2px solid #3498db; padding-bottom: 15px; margin-bottom: 25px;">
            Thư mời phỏng vấn Frontend Developer
          </h2>
          
          <p style="font-size: 16px; line-height: 1.6;">Xin chào <strong>${name}</strong>,</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db; margin: 25px 0;">
            <div style="color: #2c3e50; line-height: 1.8; font-size: 15px;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6;">
            Vui lòng phản hồi lại qua địa chỉ email: 
            <a href="mailto:${email}" style="color: #3498db; text-decoration: none; font-weight: bold;">${email}</a> 
            để xác nhận lịch phỏng vấn hoặc nếu bạn cần thêm thông tin.
          </p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 5px;">Trân trọng,</p>
            <p style="font-size: 16px; font-weight: bold; color: #2c3e50; margin: 0;">Nhà tuyển dụng</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding: 15px; background-color: #ecf0f1; border-radius: 5px;">
            <p style="margin: 0; color: #7f8c8d; font-size: 13px;">
              📅 Thời gian gửi: ${new Date().toLocaleString('vi-VN')}
            </p>
          </div>
        </div>
      `;

      // Gửi email xác nhận (không bắt buộc phải thành công)
      try {
        await emailUtils.sendEmail({
          to: email,
          subject: 'Thư mời phỏng vấn Frontend Developer - IDB',
          html: confirmationEmail
        });
        console.log('✅ Confirmation email sent successfully');
      } catch (confirmError) {
        console.log('⚠️  Warning: Could not send confirmation email:', confirmError.message);
        // Không return error vì email chính đã gửi thành công
      }

      return res.status(200).json({
        success: true,
        message: 'Tin nhắn đã được gửi thành công! Tôi sẽ phản hồi bạn sớm nhất có thể.',
        data: {
          sentAt: new Date().toISOString(),
          from: email,
          name: name,
          messageId: emailResult.messageId || 'simulated'
        }
      });

    } catch (error) {
      console.error('Portfolio contact email error:', error);

      // Check if it's a timeout or connection error
      if (error.message.includes('timeout') || error.message.includes('Connection')) {
        return res.status(503).json({
          success: false,
          message: 'Dịch vụ email tạm thời không khả dụng. Vui lòng thử lại sau hoặc liên hệ trực tiếp qua email: khangdev26@gmail.com',
          error: 'Email service temporarily unavailable',
          contactInfo: {
            email: 'khangdev26@gmail.com',
            message: 'Bạn có thể gửi email trực tiếp đến địa chỉ này'
          }
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi gửi tin nhắn. Vui lòng thử lại sau hoặc liên hệ trực tiếp qua email: khangdev26@gmail.com',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        contactInfo: {
          email: 'khangdev26@gmail.com',
          message: 'Bạn có thể gửi email trực tiếp đến địa chỉ này'
        }
      });
    }
  }

  /**
   * Get contact info - public endpoint
   */
  async getContactInfo(req, res) {
    try {
      const contactInfo = {
        name: 'Duy Khang',
        email: 'khangdev26@gmail.com',
        portfolio: process.env.PORTFOLIO_URL || '#',
        github: process.env.GITHUB_URL || '#',
        linkedin: process.env.LINKEDIN_URL || '#',
        phone: process.env.CONTACT_PHONE || null,
        location: 'Việt Nam',
        available: true,
        preferredContact: 'email',
        responseTime: '24-48 giờ'
      };

      res.status(200).json({
        success: true,
        message: 'Thông tin liên hệ',
        data: contactInfo
      });

    } catch (error) {
      console.error('Get contact info error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Không thể lấy thông tin liên hệ'
      });
    }
  }
}

module.exports = new PortfolioController();
