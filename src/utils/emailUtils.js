// Import nodemailer
const nodemailer = require('nodemailer');

class EmailUtils {
  constructor() {
    this.transporter = this.createTransporter();
  }

  createTransporter() {
    // Use environment variables for email configuration
    const emailConfig = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true' || false,
      connectionTimeout: 30000, // 30 seconds - reduced for cloud
      greetingTimeout: 15000, // 15 seconds - reduced for cloud
      socketTimeout: 30000, // 30 seconds - reduced for cloud
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false, // For development/testing
        ciphers: 'SSLv3' // Force SSLv3 for better compatibility
      },
      // Additional options for cloud environments
      pool: true,
      maxConnections: 1,
      maxMessages: 1,
      rateDelta: 20000,
      rateLimit: 5
    };

    // Debug: Log email configuration (without sensitive data)
    console.log('📧 Email config check:');
    console.log('   HOST:', emailConfig.host);
    console.log('   PORT:', emailConfig.port);
    console.log('   USER:', emailConfig.auth.user ? 'SET' : 'NOT SET');
    console.log('   PASS:', emailConfig.auth.pass ? 'SET' : 'NOT SET');

    // If no email credentials, create a test account with ethereal
    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      console.log('⚠️  No email credentials found. Email features will be simulated.');
      console.log('   Missing EMAIL_USER:', !emailConfig.auth.user);
      console.log('   Missing EMAIL_PASS:', !emailConfig.auth.pass);
      return null;
    }

    try {
      const transporter = nodemailer.createTransport(emailConfig);
      
      // Verify connection configuration
      transporter.verify((error, success) => {
        if (error) {
          console.log('❌ Email transporter verification failed:', error.message);
        } else {
          console.log('✅ Email transporter is ready');
        }
      });
      
      return transporter;
    } catch (error) {
      console.error('❌ Failed to create email transporter:', error.message);
      return null;
    }
  }

  async sendEmail(options, retries = 3) {
    if (!this.transporter) {
      console.log('📧 Email simulation - Would send email to:', options.to);
      console.log('Subject:', options.subject);
      console.log('Content:', options.html || options.text);
      return { messageId: 'simulated-' + Date.now() };
    }

    // Check if we're in a cloud environment (Render, Heroku, etc.)
    const isCloudEnvironment = process.env.NODE_ENV === 'production' && 
      (process.env.RENDER || process.env.HEROKU || process.env.VERCEL);
    
    if (isCloudEnvironment) {
      console.log('☁️  Cloud environment detected - using optimized settings');
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`📧 Sending email attempt ${attempt}/${retries}...`);
        
        const mailOptions = {
          from: process.env.EMAIL_FROM || `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
          replyTo: options.replyTo
        };

        // Add timeout to the send operation - shorter timeout for cloud
        const timeoutDuration = isCloudEnvironment ? 15000 : 30000;
        const result = await Promise.race([
          this.transporter.sendMail(mailOptions),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Email send timeout')), timeoutDuration)
          )
        ]);
        
        console.log(`✅ Email sent successfully on attempt ${attempt}:`, result.messageId);
        return result;
        
      } catch (error) {
        console.error(`❌ Email attempt ${attempt} failed:`, error.message);
        
        if (attempt === retries) {
          // Last attempt failed - log the email instead of throwing error
          console.log('📧 Email sending failed, logging email content instead:');
          console.log('   To:', options.to);
          console.log('   Subject:', options.subject);
          console.log('   Content preview:', (options.html || options.text).substring(0, 200) + '...');
          
          // Return a simulated success for cloud environments
          if (isCloudEnvironment) {
            console.log('☁️  Cloud environment: Email logged instead of sent');
            return { messageId: 'logged-' + Date.now(), logged: true };
          }
          
          throw new Error(`Failed to send email after ${retries} attempts: ${error.message}`);
        }
        
        // Wait before retry (exponential backoff)
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  generateEmailVerificationTemplate(name, verificationUrl) {
    return {
      subject: 'Xác thực tài khoản Foodies',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Xác thực tài khoản</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff6b35; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .button { display: inline-block; background-color: #ff6b35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🍜 Foodies App</h1>
            </div>
            <div class="content">
              <h2>Chào ${name}!</h2>
              <p>Cảm ơn bạn đã đăng ký tài khoản Foodies. Để hoàn tất quá trình đăng ký, vui lòng xác thực email của bạn bằng cách nhấp vào nút bên dưới:</p>
              
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Xác thực Email</a>
              </div>
              
              <p>Hoặc copy và paste link sau vào trình duyệt:</p>
              <p style="word-break: break-all; background-color: #e9e9e9; padding: 10px; border-radius: 3px;">
                ${verificationUrl}
              </p>
              
              <p><strong>Lưu ý:</strong> Link này sẽ hết hạn sau 24 giờ.</p>
              
              <p>Nếu bạn không tạo tài khoản này, vui lòng bỏ qua email này.</p>
            </div>
            <div class="footer">
              <p>© 2024 Foodies App. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Chào ${name}!
        
        Cảm ơn bạn đã đăng ký tài khoản Foodies. Để hoàn tất quá trình đăng ký, vui lòng xác thực email bằng cách truy cập link sau:
        
        ${verificationUrl}
        
        Link này sẽ hết hạn sau 24 giờ.
        
        Nếu bạn không tạo tài khoản này, vui lòng bỏ qua email này.
        
        Trân trọng,
        Foodies Team
      `
    };
  }

  generatePasswordResetTemplate(name, resetUrl) {
    return {
      subject: 'Reset mật khẩu Foodies',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Reset mật khẩu</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .button { display: inline-block; background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Foodies App</h1>
            </div>
            <div class="content">
              <h2>Chào ${name}!</h2>
              <p>Chúng tôi nhận được yêu cầu reset mật khẩu cho tài khoản của bạn. Nhấp vào nút bên dưới để tạo mật khẩu mới:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Mật Khẩu</a>
              </div>
              
              <p>Hoặc copy và paste link sau vào trình duyệt:</p>
              <p style="word-break: break-all; background-color: #e9e9e9; padding: 10px; border-radius: 3px;">
                ${resetUrl}
              </p>
              
              <div class="warning">
                <strong>⚠️ Lưu ý bảo mật:</strong>
                <ul>
                  <li>Link này sẽ hết hạn sau 1 giờ</li>
                  <li>Chỉ sử dụng link này nếu bạn đã yêu cầu reset mật khẩu</li>
                  <li>Không chia sẻ link này với bất kỳ ai</li>
                </ul>
              </div>
              
              <p>Nếu bạn không yêu cầu reset mật khẩu, vui lòng bỏ qua email này và tài khoản của bạn sẽ không bị ảnh hưởng.</p>
            </div>
            <div class="footer">
              <p>© 2024 Foodies App. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Chào ${name}!
        
        Chúng tôi nhận được yêu cầu reset mật khẩu cho tài khoản của bạn. Truy cập link sau để tạo mật khẩu mới:
        
        ${resetUrl}
        
        QUAN TRỌNG:
        - Link này sẽ hết hạn sau 1 giờ
        - Chỉ sử dụng nếu bạn đã yêu cầu reset mật khẩu
        - Không chia sẻ link này với ai
        
        Nếu bạn không yêu cầu reset mật khẩu, vui lòng bỏ qua email này.
        
        Trân trọng,
        Foodies Team
      `
    };
  }

  generateWelcomeTemplate(name) {
    return {
      subject: 'Chào mừng đến với Foodies! 🍜',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Chào mừng đến với Foodies</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .feature { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #28a745; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🍜 Chào mừng đến với Foodies!</h1>
            </div>
            <div class="content">
              <h2>Xin chào ${name}!</h2>
              <p>Tài khoản của bạn đã được xác thực thành công! Bây giờ bạn có thể tận hưởng tất cả tính năng của Foodies:</p>
              
              <div class="feature">
                <h3>🔍 Khám phá món ăn</h3>
                <p>Tìm kiếm hàng ngàn món ăn ngon từ khắp nơi</p>
              </div>
              
              <div class="feature">
                <h3>⭐ Đánh giá & Review</h3>
                <p>Chia sẻ trải nghiệm và đọc review từ cộng đồng</p>
              </div>
              
              <div class="feature">
                <h3>📝 Tạo danh sách yêu thích</h3>
                <p>Lưu lại những món ăn bạn yêu thích</p>
              </div>
              
              <div class="feature">
                <h3>📱 Ứng dụng di động</h3>
                <p>Sử dụng Foodies mọi lúc, mọi nơi</p>
              </div>
              
              <p>Hãy bắt đầu khám phá ngay hôm nay!</p>
              
              <p>Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi.</p>
            </div>
            <div class="footer">
              <p>© 2024 Foodies App. All rights reserved.</p>
              <p>Bạn nhận được email này vì đã đăng ký tài khoản Foodies.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Xin chào ${name}!
        
        Chào mừng đến với Foodies! Tài khoản của bạn đã được xác thực thành công.
        
        Bây giờ bạn có thể:
        - Khám phá hàng ngàn món ăn ngon
        - Đánh giá và review món ăn
        - Tạo danh sách yêu thích
        - Sử dụng ứng dụng di động
        
        Hãy bắt đầu khám phá ngay hôm nay!
        
        Trân trọng,
        Foodies Team
      `
    };
  }

  async sendEmailVerification(user, verificationUrl) {
    const template = this.generateEmailVerificationTemplate(user.name, verificationUrl);
    return await this.sendEmail({
      to: user.email,
      ...template
    });
  }

  async sendPasswordReset(user, resetUrl) {
    const template = this.generatePasswordResetTemplate(user.name, resetUrl);
    return await this.sendEmail({
      to: user.email,
      ...template
    });
  }

  async sendWelcomeEmail(user) {
    const template = this.generateWelcomeTemplate(user.name);
    return await this.sendEmail({
      to: user.email,
      ...template
    });
  }
}

// Export singleton instance
module.exports = new EmailUtils();
