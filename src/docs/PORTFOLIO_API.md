# Portfolio API Documentation

API để xử lý liên hệ từ Portfolio website. Các endpoint này là **public** (không cần authentication) để nhà tuyển dụng có thể gửi email liên hệ.

## Base URL
```
http://localhost:3000/api/portfolio
```

## Endpoints

### 1. Gửi email liên hệ

**POST** `/contact`

**Access:** Public (không cần token)

**Body:**
```json
{
  "name": "Nguyễn Văn A",
  "email": "recruiter@company.com",
  "company": "ABC Company",
  "position": "HR Manager",
  "subject": "Cơ hội việc làm Frontend Developer",
  "message": "Chào bạn, chúng tôi có một vị trí Frontend Developer phù hợp với profile của bạn...",
  "phone": "0123456789"
}
```

**Required fields:** `name`, `email`, `subject`, `message`

**Optional fields:** `company`, `position`, `phone`

**Response Success:**
```json
{
  "success": true,
  "message": "Tin nhắn đã được gửi thành công! Tôi sẽ phản hồi bạn sớm nhất có thể.",
  "data": {
    "sentAt": "2025-01-20T10:30:00.000Z",
    "from": "recruiter@company.com",
    "subject": "Cơ hội việc làm Frontend Developer"
  }
}
```

**Response Error:**
```json
{
  "success": false,
  "message": "Vui lòng điền đầy đủ thông tin bắt buộc",
  "errors": {
    "name": "Tên không được để trống",
    "email": null,
    "subject": null,
    "message": "Nội dung không được để trống"
  }
}
```

### 2. Lấy thông tin liên hệ

**GET** `/contact-info`

**Access:** Public

**Response:**
```json
{
  "success": true,
  "message": "Thông tin liên hệ",
  "data": {
    "name": "Duy Khang",
    "email": "khangdev26@gmail.com",
    "portfolio": "https://your-portfolio.com",
    "github": "https://github.com/yourusername",
    "linkedin": "https://linkedin.com/in/yourusername",
    "phone": "+84123456789",
    "location": "Việt Nam",
    "available": true,
    "preferredContact": "email",
    "responseTime": "24-48 giờ"
  }
}
```

### 3. Health check

**GET** `/health`

**Access:** Public

**Response:**
```json
{
  "success": true,
  "message": "Portfolio API is running",
  "timestamp": "2025-01-20T10:30:00.000Z",
  "version": "1.0.0"
}
```

## Validation Rules

### Email Contact Form
- **name**: Bắt buộc, không được để trống
- **email**: Bắt buộc, phải đúng format email
- **subject**: Bắt buộc, không được để trống
- **message**: Bắt buộc, tối thiểu 10 ký tự, tối đa 2000 ký tự
- **company**: Tùy chọn
- **position**: Tùy chọn
- **phone**: Tùy chọn

## Email Template

Khi gửi email thành công, bạn sẽ nhận được:

1. **Email chính** gửi đến địa chỉ được cấu hình trong `PORTFOLIO_EMAIL`
2. **Email xác nhận** gửi lại cho người gửi (tùy chọn)

### Email Template Features:
- ✅ Responsive HTML design
- ✅ Thông tin người gửi đầy đủ
- ✅ Nội dung được format đẹp
- ✅ Timestamp và metadata
- ✅ Reply-to address tự động

## Environment Variables

Cần cấu hình trong file `.env`:

```env
# Portfolio Configuration
PORTFOLIO_EMAIL=khangdev26@gmail.com
PORTFOLIO_URL=https://your-portfolio.com
GITHUB_URL=https://github.com/yourusername
LINKEDIN_URL=https://linkedin.com/in/yourusername
CONTACT_PHONE=+84123456789

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## Usage Examples

### Frontend Integration (React/Vue/Angular)

```javascript
// Gửi email liên hệ
const sendContactEmail = async (formData) => {
  try {
    const response = await fetch('/api/portfolio/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('Tin nhắn đã được gửi thành công!');
    } else {
      alert(result.message);
    }
  } catch (error) {
    alert('Có lỗi xảy ra khi gửi tin nhắn');
  }
};

// Lấy thông tin liên hệ
const getContactInfo = async () => {
  try {
    const response = await fetch('/api/portfolio/contact-info');
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching contact info:', error);
  }
};
```

### HTML Form Example

```html
<form id="contactForm">
  <input type="text" name="name" placeholder="Họ tên *" required>
  <input type="email" name="email" placeholder="Email *" required>
  <input type="text" name="company" placeholder="Công ty">
  <input type="text" name="position" placeholder="Vị trí">
  <input type="text" name="subject" placeholder="Tiêu đề *" required>
  <textarea name="message" placeholder="Nội dung *" required></textarea>
  <input type="tel" name="phone" placeholder="Số điện thoại">
  <button type="submit">Gửi tin nhắn</button>
</form>

<script>
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  
  try {
    const response = await fetch('/api/portfolio/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    alert(result.message);
    
    if (result.success) {
      e.target.reset();
    }
  } catch (error) {
    alert('Có lỗi xảy ra khi gửi tin nhắn');
  }
});
</script>
```

## Error Codes

- **400**: Bad Request - Thiếu thông tin bắt buộc hoặc dữ liệu không hợp lệ
- **500**: Internal Server Error - Lỗi server hoặc không thể gửi email

## Security Notes

- API này là public nhưng nên implement rate limiting trong production
- Validate và sanitize tất cả input từ client
- Sử dụng HTTPS trong production
- Cấu hình CORS phù hợp cho domain của bạn
