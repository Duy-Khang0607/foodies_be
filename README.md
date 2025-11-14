# Foodies Backend API

Backend API cho ứng dụng quản lý thực phẩm với các tính năng CRUD đầy đủ.

## 🚀 Cài đặt và chạy

### Yêu cầu
- Node.js (version 14 trở lên)
- npm

### Cài đặt
```bash
# Clone repository
git clone <repository-url>
cd foodies_backend

# Cài đặt dependencies
npm install

# Chạy server
npm start

# Hoặc chạy với nodemon (development)
npm run dev
```

Server sẽ chạy tại: `http://localhost:3000`

## 📡 API Endpoints

### Base URL
```
http://localhost:3000/api
```

### 1. Lấy tất cả sản phẩm
**GET** `/products`

**Response:**
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "name": "Glycogen",
      "description": "description 1",
      "price": "25",
      "category": "Amino K.E.M. EAA",
      "file": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
      "createdAt": "2023-...",
      "updatedAt": "2023-..."
    }
  ],
  "count": 1
}
```

### 2. Lấy sản phẩm theo ID
**GET** `/products/:id`

**Response:**
```json
{
  "success": true,
  "message": "Product retrieved successfully",
  "data": {
    "id": "uuid",
    "name": "Glycogen",
    "description": "description 1",
    "price": "25",
    "category": "Amino K.E.M. EAA",
    "file": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "createdAt": "2023-...",
    "updatedAt": "2023-..."
  }
}
```

### 3. Tạo sản phẩm mới
**POST** `/products`

**Request Body:**
```json
{
  "name": "Glycogen",
  "description": "description 1",
  "price": "25",
  "category": "Amino K.E.M. EAA",
  "file": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": "generated-uuid",
    "name": "Glycogen",
    "description": "description 1",
    "price": "25",
    "category": "Amino K.E.M. EAA",
    "file": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "createdAt": "2023-...",
    "updatedAt": "2023-..."
  }
}
```

### 4. Cập nhật sản phẩm
**PUT** `/products/:id`

**Request Body** (các trường là optional):
```json
{
  "name": "Updated Glycogen",
  "description": "Updated description",
  "price": "30",
  "category": "Updated Category",
  "file": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "id": "uuid",
    "name": "Updated Glycogen",
    "description": "Updated description",
    "price": "30",
    "category": "Updated Category",
    "file": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "createdAt": "2023-...",
    "updatedAt": "2023-..."
  }
}
```

### 5. Xóa sản phẩm
**DELETE** `/products/:id`

**Response:**
```json
{
  "success": true,
  "message": "Product deleted successfully",
  "data": {
    "id": "uuid",
    "name": "Glycogen",
    "description": "description 1",
    "price": "25",
    "category": "Amino K.E.M. EAA",
    "file": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "createdAt": "2023-...",
    "updatedAt": "2023-..."
  }
}
```

### 6. Health Check
**GET** `/health`

**Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2023-..."
}
```

## 🖼️ Xử lý ảnh thông minh (Base64)

### ✨ Tính năng nâng cao:
- **Tự động tối ưu hóa chất lượng**: Quality 95% để đảm bảo ảnh rõ nét nhất
- **Intelligent resizing**: Tự động resize về 1920x1080 giữ nguyên tỷ lệ
- **Smart compression**: Giảm dung lượng mà không mất chất lượng
- **Metadata extraction**: Lưu thông tin chi tiết về ảnh
- **Multi-format support**: JPEG, PNG, GIF, BMP, WebP
- **Validation nâng cao**: Kiểm tra format, size, và tính hợp lệ

### 📊 Thông tin được lưu trữ:
```json
{
  "imageMetadata": {
    "originalWidth": 2400,
    "originalHeight": 1600,
    "processedWidth": 1920,
    "processedHeight": 1280,
    "format": "jpeg",
    "size": 1234567,
    "compressionRatio": "45.2",
    "hasAlpha": false
  }
}
```

### 🎯 Cấu hình tối ưu:
- **Max resolution**: 1920x1080 (Full HD)
- **Quality**: 95% (Chất lượng cao nhất)
- **Format**: JPEG (Tối ưu cho photos)
- **Aspect ratio**: Preserved (Giữ nguyên tỷ lệ)
- **Metadata removal**: Enabled (Bảo mật)

### 📝 Ví dụ request và response:

#### Request với URL ảnh:
```json
POST /api/products
{
  "name": "Glycogen",
  "description": "description 1",
  "price": "25",
  "category": "Amino K.E.M. EAA",
  "file": "https://www.evogennutrition.com/cdn/shop/files/Masterrenderwhitebottleblkberryxtremefront.png"
}
```

#### Request với Base64:
```json
POST /api/products
{
  "name": "Glycogen", 
  "description": "description 1",
  "price": "25",
  "category": "Amino K.E.M. EAA",
  "file": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA..."
}
```

#### Response:
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {...},
  "imageProcessing": {
    "originalSize": 2048000,
    "processedSize": 1122334,
    "compressionRatio": "45.2",
    "source": "url",
    "originalInput": "https://example.com/image.png"
  }
}
```

### 🛠️ API xử lý ảnh riêng biệt:

#### 1. Validate ảnh
```
POST /api/images/validate
{
  "image": "data:image/jpeg;base64,..."
}
```

#### 2. Xử lý ảnh với tùy chọn
```
POST /api/images/process
{
  "image": "data:image/jpeg;base64,...",
  "options": {
    "maxWidth": 1920,
    "maxHeight": 1080,
    "quality": 95,
    "format": "jpeg"
  }
}
```

#### 3. Convert URL sang Base64
```
POST /api/images/convert-url
{
  "url": "https://example.com/image.png"
}
```

#### 4. Lấy metadata ảnh
```
POST /api/images/metadata
{
  "image": "data:image/jpeg;base64,..." // hoặc URL
}
```

### 🌐 Hỗ trợ URL ảnh
- ✅ **Tự động fetch** ảnh từ URL
- ✅ **Convert sang Base64** tự động
- ✅ **Timeout 30s** để đảm bảo không bị treo
- ✅ **User-Agent header** để tránh bị block
- ✅ **Error handling** chi tiết cho các lỗi network
- ✅ **Support headers**: Content-Type detection
- ✅ **Size limit**: 10MB maximum

## 🔍 Validation

### Các trường bắt buộc khi tạo mới (POST):
- `name`: Không được rỗng
- `description`: Không được rỗng  
- `price`: Phải là số hợp lệ
- `category`: Không được rỗng

### Các trường optional:
- `file`: Có thể để trống hoặc phải là base64 image hợp lệ

### Khi cập nhật (PUT):
- Tất cả các trường đều optional
- Chỉ cập nhật các trường được gửi lên

## 📦 Cấu trúc dữ liệu

Dữ liệu được lưu trữ trong file `data/products.json` với cấu trúc:

```json
[
  {
    "id": "unique-uuid",
    "name": "Tên sản phẩm",
    "description": "Mô tả sản phẩm",
    "price": "Giá (string)",
    "category": "Danh mục",
    "file": "Base64 encoded image",
    "createdAt": "ISO timestamp",
    "updatedAt": "ISO timestamp"
  }
]
```

## 🛠️ Scripts

- `npm start`: Chạy server production
- `npm run dev`: Chạy server development với nodemon
- `npm test`: Chạy tests (chưa implement)

## 🔧 Configuration

- **Port**: Default 3000 (có thể thay đổi qua environment variable `PORT`)
- **CORS**: Enabled cho tất cả origins
- **Body Parser**: Limit 50MB để xử lý base64 images
- **Data Storage**: JSON file trong thư mục `data/`

## 📝 Error Handling

API trả về các status codes sau:
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `500`: Internal Server Error

Tất cả response đều có format:
```json
{
  "success": boolean,
  "message": "string",
  "data": object (optional),
  "errors": array (optional),
  "error": string (optional)
}
```
