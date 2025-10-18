# API Authentication Documentation

## Tổng quan

Bộ API Authentication cho ứng dụng Foodies cung cấp đầy đủ các tính năng xác thực và quản lý người dùng.

## Cài đặt dependencies

```bash
npm install bcryptjs jsonwebtoken nodemailer validator express-rate-limit
```

## Cấu hình Environment

Sao chép file `env.example` thành `.env` và cập nhật các giá trị:

```env
# JWT Configuration
JWT_ACCESS_SECRET=your-super-secret-access-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_EMAIL_SECRET=your-super-secret-email-key

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## Base URL

```
http://localhost:3000/api/auth
```

## Endpoints

### 1. Đăng ký (Register)

**POST** `/register`

```json
{
  "name": "nguyen_van_a",
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản",
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": "15m"
    }
  }
}
```

### 2. Đăng nhập (Login)

**POST** `/login`

```json
{
  "name": "nguyen_van_a",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": "15m"
    }
  }
}
```

### 3. Làm mới token (Refresh Token)

**POST** `/refresh-token`

```json
{
  "refreshToken": "eyJ..."
}
```

### 4. Đăng xuất (Logout)

**POST** `/logout`

**Headers:** `Authorization: Bearer <access_token>`

```json
{
  "refreshToken": "eyJ..." // optional
}
```

### 5. Đăng xuất tất cả thiết bị

**POST** `/logout-all`

**Headers:** `Authorization: Bearer <access_token>`

### 6. Lấy thông tin profile

**GET** `/profile`

**Headers:** `Authorization: Bearer <access_token>`

### 7. Cập nhật profile

**PUT** `/profile`

**Headers:** `Authorization: Bearer <access_token>`

```json
{
  "name": "newusername",
  "email": "newemail@example.com",
  "phone": "0987654321",
  "isActive": true,
  "isEmailVerified": false,
  "role": "user",
  "address": {
    "street": "123 Nguyễn Văn Linh",
    "city": "Hồ Chí Minh",
    "district": "Quận 7",
    "ward": "Phường Tân Phú"
  },
  "preferences": {
    "language": "vi",
    "notifications": {
      "email": true,
      "push": false
    }
  },
  "avatar": "https://example.com/avatar.jpg"
}
```

**Lưu ý:** 
- Có thể cập nhật tất cả các trường trừ `password` (sử dụng endpoint riêng `/change-password`)
- `name` và `email` phải unique - sẽ báo lỗi nếu đã được sử dụng
- Có thể cập nhật từng phần hoặc tất cả cùng lúc

### 8. Đổi mật khẩu

**PUT** `/change-password`

**Headers:** `Authorization: Bearer <access_token>`

```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

### 9. Quên mật khẩu

**POST** `/forgot-password`

```json
{
  "email": "user@example.com"
}
```

### 10. Reset mật khẩu

**POST** `/reset-password`

```json
{
  "token": "eyJ...",
  "newPassword": "newpassword123"
}
```

### 11. Xác thực email

**POST** `/verify-email`

```json
{
  "token": "eyJ..."
}
```

### 12. Gửi lại email xác thực

**POST** `/resend-verification`

**Headers:** `Authorization: Bearer <access_token>`

### 13. Kiểm tra token hợp lệ

**GET** `/validate-token`

**Headers:** `Authorization: Bearer <access_token>`

### 14. Lấy thông tin user ngắn gọn

**GET** `/me`

**Headers:** `Authorization: Bearer <access_token>`

### 15. Xóa tài khoản (User tự xóa)

**DELETE** `/delete-account`

**Headers:** `Authorization: Bearer <access_token>`

```json
{
  "password": "current_password",
  "confirmDelete": "DELETE_MY_ACCOUNT"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tài khoản đã được xóa thành công"
}
```

**Lưu ý:**
- Cần nhập đúng mật khẩu hiện tại
- Phải gõ chính xác "DELETE_MY_ACCOUNT" để xác nhận
- Admin không thể tự xóa tài khoản của mình
- Hành động này không thể hoàn tác

### 16. Xóa tài khoản user (Admin)

**DELETE** `/admin/users/:userId`

**Headers:** `Authorization: Bearer <access_token>`

**Params:** `userId` - ID của user cần xóa

**Response:**
```json
{
  "success": true,
  "message": "Đã xóa tài khoản người dùng: tên_user"
}
```

**Lưu ý:**
- Chỉ admin mới có quyền
- Không thể xóa admin khác
- Không thể tự xóa chính mình
- Có audit log đầy đủ

## Rate Limiting

- **Login:** 5 lần / 5 phút
- **Register:** 3 lần / 1 giờ
- **Forgot Password:** 3 lần / 1 giờ
- **Email Verification:** 5 lần / 1 giờ

## Error Codes

| Code | Ý nghĩa |
|------|---------|
| 400 | Bad Request - Dữ liệu không hợp lệ |
| 401 | Unauthorized - Token không hợp lệ hoặc hết hạn |
| 403 | Forbidden - Không có quyền truy cập |
| 409 | Conflict - Name/Email đã tồn tại |
| 423 | Locked - Tài khoản bị khóa |
| 429 | Too Many Requests - Vượt quá rate limit |
| 500 | Server Error |

## Tính năng bảo mật

1. **Mã hóa mật khẩu:** Sử dụng bcrypt với cost 12
2. **JWT Security:** Access token (15 phút), Refresh token (7 ngày)
3. **Account Locking:** Khóa tài khoản sau 5 lần đăng nhập sai (5 phút)
4. **Rate Limiting:** Giới hạn số lần request
5. **Email Verification:** Xác thực email bắt buộc
6. **Device Management:** Quản lý refresh token theo thiết bị
7. **Password Reset:** Secure token với thời hạn 1 giờ

## Sử dụng Authentication trong routes khác

```javascript
const { authenticate, authorize } = require('../middleware/auth');

// Route yêu cầu đăng nhập
router.get('/protected', authenticate, (req, res) => {
  // req.user chứa thông tin user
  res.json({ user: req.user });
});

// Route chỉ admin mới truy cập được
router.get('/admin-only', authenticate, authorize('admin'), (req, res) => {
  res.json({ message: 'Admin only content' });
});

// Route cho phép nhiều roles
router.get('/moderator-admin', authenticate, authorize('admin', 'moderator'), (req, res) => {
  res.json({ message: 'Admin or moderator content' });
});
```

## Testing với Postman/cURL

1. **Đăng ký:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"testuser","email":"test@example.com","password":"password123"}'
```

2. **Đăng nhập:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"testuser","password":"password123"}'
```

3. **Truy cập route bảo vệ:**
```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Troubleshooting

### Không nhận được email
- Kiểm tra cấu hình EMAIL_* trong file .env
- Với Gmail, cần sử dụng App Password thay vì mật khẩu thường
- Kiểm tra spam folder

### Token hết hạn
- Sử dụng refresh token để lấy access token mới
- Nếu refresh token cũng hết hạn, yêu cầu người dùng đăng nhập lại

### Rate limiting
- Đợi hết thời gian limit hoặc đổi IP/clear cookies
- Điều chỉnh rate limit trong middleware nếu cần

### MongoDB connection issues
- API sẽ hoạt động với JSON file storage nếu MongoDB không kết nối được
- Kiểm tra MONGO_URI trong .env
