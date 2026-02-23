# 🌟 Website Quản Lý Câu Lạc Bộ (Club Management System)

---

## ✨ Tính năng chính

- 🔐 **Hệ thống Xác thực**: Đăng ký, Đăng nhập với JWT (JSON Web Token) và bảo mật mật khẩu bằng `bcryptjs`.
- 👥 **Quản lý Thành viên**: Thêm, sửa, xóa và tìm kiếm thành viên theo MSSV, tên, lớp.
- 🎭 **Phân quyền (Roles)**: Quản lý các vai trò trong câu lạc bộ (Ban điều hành, Thành viên, v.v.).
- 📅 **Quản lý Buổi sinh hoạt (Sessions)**: Lên lịch và quản lý nội dung các buổi gặp mặt.
- 📝 **Hệ thống Điểm danh (Attendance)**: Theo dõi sự hiện diện của thành viên trong từng buổi sinh hoạt.

---

## 🛠️ Công nghệ sử dụng

- **Backend**: [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) & [Mongoose](https://mongoosejs.com/)
- **Authentication**: [JWT](https://jwt.io/)
- **Security**: [bcryptjs](https://www.npmjs.com/package/bcryptjs)
- **Deployment**: Sẵn sàng cho [Render](https://render.com/) và [MongoDB Atlas](https://cloud.mongodb.com/).

---

## 📂 Cấu trúc thư mục

```text
Website_QLCLB/
├── src/
│   ├── config/       # Cấu hình Database
│   ├── controllers/  # Xử lý Logic nghiệp vụ
│   ├── middleware/   # Auth & Validation Middlewares
│   ├── models/       # Mongoose Schemas (Member, Session, Attendance, etc.)
│   ├── routes/       # API Endpoints
│   └── app.js        # Cấu hình Express chính
├── .env              # Biến môi trường (Secret)
├── server.js         # Điểm khởi đầu ứng dụng
└── README.md         # Tài liệu dự án
```

---

## 🚀 Hướng dẫn cài đặt

### 1. Clone repository
```bash
git clone https://github.com/TuanKiet1774/Website_QLCLB.git
cd Website_QLCLB
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Cấu hình môi trường (`.env`)
Tạo file `.env` ở thư mục gốc và cấu hình các thông số sau:
```env
MONGODB_URI=your_mongodb_connection_string
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
PORT=3000
```

### 4. Chạy ứng dụng
```bash
# Chạy ứng dụng
node server.js
```

---

## 📡 Danh sách API Endpoints chính

| Endpoint | Method | Mô tả | Yêu cầu Auth |
| :--- | :--- | :--- | :--- |
| `/api/auth/login` | POST | Đăng nhập hệ thống | ❌ |
| `/api/members` | GET/POST/PUT/DELETE | Quản lý danh sách thành viên | ✅ |
| `/api/sessions` | GET/POST/PUT/DELETE | Lên lịch các buổi sinh hoạt | ✅ |
| `/api/attendance` | GET/POST | Điểm danh thành viên | ✅ |
| `/api/roles` | GET/POST | Quản lý các vai trò | ✅ |

---

## 📚 Hướng dẫn khởi tạo Project từ đầu

### 1️⃣ Tạo thư mục chứa project
```bash
mkdir my-project
cd my-project
```

### 2️⃣ Khởi tạo project Node.js
```bash
npm init -y
```

### 3️⃣ Cài đặt các thư viện cần thiết
```bash
# Ba thư viện chính: express mongoose dotenv 
npm install express mongoose dotenv

# Thêm thư viện bcryptjs
npm install bcryptjs
    
# Thư viện hỗ trợ phát triển (dev)
npm install nodemon --save-dev
```

### 4️⃣ Các công cụ cần thiết
- **MongoDB Atlas**: [Đăng ký và tạo database](https://cloud.mongodb.com/)
- **Render**: [Đăng ký và tạo server](https://render.com/)
- **Github**: [Đăng ký và tạo repository](https://github.com/)
