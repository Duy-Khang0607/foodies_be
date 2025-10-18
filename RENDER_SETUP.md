# 🚀 Hướng dẫn Deploy lên Render

## 📧 Cấu hình Email trên Render

### 1. **Environment Variables cần thiết:**

Trên Render Dashboard → Settings → Environment Variables, thêm:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM="Portfolio Contact <your-gmail@gmail.com>"

# Portfolio Configuration  
PORTFOLIO_EMAIL=khangdev26@gmail.com

# Database
MONGODB_URI=your-mongodb-connection-string

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_REFRESH_EXPIRES_IN=30d

# Server
NODE_ENV=production
PORT=10000
```

### 2. **Tạo App Password cho Gmail:**

1. Đăng nhập Gmail → Google Account Settings
2. Security → 2-Step Verification (bật nếu chưa có)
3. App passwords → Generate password cho "Mail"
4. Copy password và dùng làm `EMAIL_PASS`

### 3. **Alternative Email Providers:**

Nếu Gmail không hoạt động, thử:

**SendGrid:**
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your-sendgrid-api-key
```

**Mailgun:**
```env
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USER=your-mailgun-username
EMAIL_PASS=your-mailgun-password
```

## 🔧 Troubleshooting

### Lỗi "Connection timeout":

1. **Kiểm tra Environment Variables** có đúng không
2. **Test với email provider khác** (SendGrid, Mailgun)
3. **Kiểm tra logs** trên Render Dashboard
4. **Verify email credentials** bằng cách test local

### Fallback khi email fail:

API sẽ trả về thông tin liên hệ backup:
```json
{
  "success": false,
  "message": "Dịch vụ email tạm thời không khả dụng...",
  "contactInfo": {
    "email": "khangdev26@gmail.com",
    "message": "Bạn có thể gửi email trực tiếp đến địa chỉ này"
  }
}
```

## 🧪 Test sau khi deploy:

```bash
# Test health check
curl https://your-app.onrender.com/api/portfolio/health

# Test contact API
curl -X POST https://your-app.onrender.com/api/portfolio/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com", 
    "message": "Test message from production"
  }'
```

## 📝 Logs để debug:

Trên Render Dashboard → Logs, tìm:
- `✅ Email transporter is ready` - Email config OK
- `📧 Sending email attempt 1/3...` - Đang gửi email
- `❌ Email attempt X failed:` - Lỗi gửi email
- `⏳ Waiting Xms before retry...` - Đang retry

## 🎯 Production Ready Features:

✅ **Retry mechanism** (3 lần với exponential backoff)  
✅ **Timeout handling** (30s timeout per attempt)  
✅ **Better error messages** cho user  
✅ **Fallback contact info** khi email fail  
✅ **Email verification** khi khởi tạo transporter  
✅ **Graceful degradation** - API vẫn hoạt động khi email fail
