

QUY TẮC BẮT BUỘC:
1. Chỉ sửa file tôi phụ trách, KHÔNG đụng file khác
2. Dùng api.js để gọi API (AuthAPI, MemberAPI, SessionAPI, AttendanceAPI)
3. Dùng sidebar.js để tạo sidebar (đã có sẵn, không viết lại)
4. Đặt tên class CSS theo prefix: [tên-module]-xxx
   VD: .member-table, .session-filter, .dash-chart
5. Không khai báo biến global trùng tên với file khác
6. Style chung (font, color, button) dùng class trong common.css
7. Chỉ được dùng html, css, javascript 

# QUY TẮC THIẾT KẾ - Frontend QLCLB

## Màu sắc (dùng biến CSS trong common.css)
- Primary: #6C63FF (nút chính, link active)
- Danger: #e74c3c (xóa, vắng)
- Success: #27ae60 (có mặt, hoạt động)
- Warning: #f39c12 (badge cảnh báo)
- Background: #f0f2f5
- Card background: #ffffff
- Text chính: #2c3e50
- Text phụ: #7f8c8d

## Font
- Font chính: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
- Tiêu đề trang: 24px, font-weight 700
- Tiêu đề card: 18px, font-weight 600
- Text bình thường: 14px
- Text nhỏ: 12px

## Bo góc
- Card: border-radius 16px
- Button: border-radius 8px
- Input: border-radius 8px
- Badge: border-radius 12px
- Avatar: border-radius 50%

## Bóng đổ
- Card: box-shadow 0 2px 12px rgba(0,0,0,0.08)
- Modal: box-shadow 0 20px 60px rgba(0,0,0,0.3)

## Khoảng cách
- Padding card: 24px
- Gap giữa các card: 24px
- Margin giữa các section: 24px

## Nút bấm
- Nút chính: background #6C63FF, chữ trắng, padding 10px 24px
- Nút phụ: background #e9ecef, chữ #333
- Nút nguy hiểm: background #e74c3c, chữ trắng
- Hover: opacity 0.85 hoặc translateY(-1px)

## Badge vai trò
- Admin: background #fff3cd, color #856404
- Thành viên: background #d4edda, color #155724

## Bảng (table)
- Header: background #f8f9fa, chữ in hoa, font-weight 600, font-size 11px
- Row hover: background #f8f9fa
- Border: 1px solid #f0f0f0

## Modal
- Overlay: background rgba(0,0,0,0.5)
- Content: max-width 600px, border-radius 16px, padding 32px
- Animation: fadeIn + slideUp

## Responsive
- Mobile: dưới 768px sidebar ẩn, bảng cuộn ngang
- Tablet: 768px-1024px sidebar thu nhỏ


## 1. Bảng màu (Color Palette)

Tất cả màu sắc **PHẢI** dùng biến CSS đã định nghĩa trong `css/common.css`. **KHÔNG** được hardcode mã màu.

| Biến CSS | Giá trị | Dùng khi |
|----------|---------|----------|
| `--primary` | `#4e73df` | Nút chính, link, sidebar active, tiêu đề |
| `--secondary` | `#1cc88a` | Trạng thái thành công, badge "Hoạt động" |
| `--danger` | `#e74a3b` | Nút xóa, badge "Không hoạt động", lỗi |
| `--warning` | `#f6c23e` | Cảnh báo, badge "Có phép" |
| `--info` | `#36b9cc` | Thông tin phụ, icon gợi ý |
| `--light` | `#f8f9fc` | Nền trang, nền header bảng |
| `--dark` | `#5a5c69` | Màu chữ chính |
| `--white` | `#ffffff` | Nền card, nền modal |
| `--sidebar-bg` | `#343a40` | Nền sidebar |
| `--sidebar-hover` | `#23272b` | Hover item sidebar |
| `--border-color` | `#e3e6f0` | Viền bảng, viền input, đường kẻ |

### Cách dùng đúng
```css
/* ✅ ĐÚNG */
.btn-primary { background-color: var(--primary); }
.badge-success { background-color: var(--secondary); }

/* ❌ SAI — không hardcode màu */
.btn-primary { background-color: #4e73df; }
.my-custom-green { background-color: #2ecc71; }  /* màu không trong bảng */
```

---

## 2. Typography (Chữ)

| Thuộc tính | Giá trị |
|------------|---------|
| Font chính | `'Nunito', 'Segoe UI', Arial, sans-serif` |
| Cỡ chữ body | `1rem` (16px) |
| Tiêu đề trang (h1) | `1.75rem`, `font-weight: 700` |
| Tiêu đề card (h2) | `1.25rem`, `font-weight: 700` |
| Label / Text nhỏ | `0.875rem` |
| Text rất nhỏ (caption) | `0.75rem` |

```css
/* Dùng biến font */
font-family: var(--font-family);
```

---

## 3. Spacing & Layout (Khoảng cách)

| Thành phần | Giá trị |
|------------|---------|
| Padding card | `1.5rem` |
| Padding nút | `0.5rem 1rem` |
| Padding ô bảng | `0.75rem` |
| Padding input | `0.5rem` |
| Gap giữa các card | `2rem` |
| Gap giữa form-group | `1rem` |
| Sidebar width | `250px` |
| Main content margin-left | `250px` |
| Container max-width | `1200px` |

---

## 4. Border & Shadow (Viền & Bóng)

| Thuộc tính | Giá trị |
|------------|---------|
| Border radius chung | `0.35rem` → dùng `var(--border-radius)` |
| Border radius badge | `0.25rem` |
| Border input | `1px solid var(--border-color)` |
| Box shadow card | `0 0.15rem 1.75rem 0 rgba(58,59,69,.15)` |
| Box shadow modal | `0 0.5rem 1rem rgba(0,0,0,.15)` |
| Transition chung | `all 0.2s ease-in-out` → dùng `var(--transition)` |

---

## 5. Component Standards (Chuẩn component)

### 5.1 Nút (Buttons)

```html
<button class="btn">Nút mặc định (xanh primary)</button>
<button class="btn btn-danger">Xóa</button>
<button class="btn btn-warning">Cảnh báo</button>
<button class="btn btn-info">Thông tin</button>
<button class="btn btn-secondary">Hành động phụ</button>
```

Quy tắc:
- Nút chính dùng class `btn` (nền `--primary`)
- **Không** tạo class nút mới — dùng các variant có sẵn
- Hover: đổi sang tone đậm hơn, có transition
- Cursor: `pointer`

### 5.2 Bảng (Tables)

```html
<table class="table">
  <thead>
    <tr>
      <th>STT</th>
      <th>Tên</th>
      <th class="admin-only">Thao tác</th>  <!-- Ẩn nếu không phải admin -->
    </tr>
  </thead>
  <tbody id="tableBody">
    <!-- JS render từng <tr> -->
  </tbody>
</table>
```

Quy tắc:
- Luôn dùng class `table`
- Header: nền `var(--light)`, font bold
- Hàng chẵn: nền `#f2f2f2`
- Hover: nền `#e9ecef`
- Cột "Thao tác" luôn có class `admin-only`

### 5.3 Card (Thẻ)

```html
<div class="card">
  <div class="card-header">Tiêu đề</div>
  <div class="card-body">Nội dung</div>
</div>
```

Quy tắc:
- Nền trắng, bo góc `var(--border-radius)`, có shadow
- Dùng cho: thống kê dashboard, form, bảng

### 5.4 Badge (Nhãn trạng thái)

```html
<span class="badge badge-success">Hoạt động</span>
<span class="badge badge-danger">Không hoạt động</span>
<span class="badge badge-warning">Có phép</span>
<span class="badge badge-info">Có mặt</span>
<span class="badge badge-secondary">Vắng</span>
```

Quy tắc:
- Font size `0.75rem`, padding `0.25rem 0.5rem`, border-radius `0.25rem`
- Màu nền theo biến CSS

### 5.5 Modal (Popup)

```html
<div class="modal-overlay" id="myModal">
  <div class="modal">
    <div class="modal-header">
      <h3>Tiêu đề</h3>
      <button class="modal-close" onclick="closeModal('myModal')">&times;</button>
    </div>
    <div class="modal-body">
      <!-- Form/content -->
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="save()">Lưu</button>
      <button class="btn btn-secondary" onclick="closeModal('myModal')">Hủy</button>
    </div>
  </div>
</div>
```

Quy tắc:
- `modal-overlay`: nền đen mờ `rgba(0,0,0,0.5)`, position fixed, z-index 1001
- `modal`: nền trắng, max-width `600px`, bo góc, có shadow
- Đóng/mở: dùng `openModal(id)`, `closeModal(id)` từ `utils.js`

### 5.6 Form

```html
<div class="form-group">
  <label>Tên thành viên</label>
  <input type="text" class="form-control" id="fullName" required>
</div>
```

Quy tắc:
- Dùng class `form-group` bọc mỗi field
- Input dùng class `form-control`
- Focus: viền đổi sang `var(--primary)`

### 5.7 Toast (Thông báo)

```javascript
showToast('Thêm thành viên thành công!', 'success');   // xanh lá
showToast('Đã xóa', 'danger');                          // đỏ
showToast('Đang xử lý...', 'info');                     // xanh dương nhạt
```

Quy tắc:
- Toast tự biến mất sau 3 giây
- Vị trí: góc trên phải
- Không tự tạo alert — luôn dùng `showToast()`

---

## 6. Sidebar

| Thuộc tính | Giá trị |
|------------|---------|
| Width | `250px` |
| Background | `var(--sidebar-bg)` = `#343a40` |
| Chữ | Trắng |
| Active item | Nền `var(--primary)` |
| Hover | Nền `var(--sidebar-hover)` |
| Logo | `img/logoCLBTin.jpg`, width `60px`, border-radius `50%` |

Menu items:
1. Tổng quan → `dashboard.html`
2. Thành viên → `members.html`
3. Buổi sinh hoạt → `sessions.html`
4. Hoạt động khác → `activities.html`
5. Vai trò buổi sinh hoạt → `role-sessions.html` *(admin-only)*
6. Đăng xuất

---

## 7. Responsive (Mobile)

| Breakpoint | Hành vi |
|-----------|---------|
| `> 768px` | Sidebar cố định bên trái, main-content có margin-left |
| `≤ 768px` | Sidebar ẩn, hiện nút hamburger, bảng cuộn ngang (`overflow-x: auto`) |

---

## 8. CSS Class Naming (Đặt tên class)

### Prefix theo module — tránh xung đột

| Module | Prefix ví dụ | Ví dụ class |
|--------|-------------|-------------|
| Dashboard | `dash-` | `dash-stat-card`, `dash-chart-container` |
| Members | `member-` | `member-table`, `member-search` |
| Sessions | `session-` | `session-card`, `session-filter` |
| Login | `login-` | `login-form`, `login-bg` |
| Roles | `role-` | `role-table`, `role-modal` |

### Quy tắc đặt tên
- Dùng **kebab-case**: `member-search-bar` ✅, `memberSearchBar` ❌
- Class dùng chung (btn, card, table, badge, form-control, modal) → **KHÔNG thêm prefix**
- Class riêng mỗi trang → **PHẢI thêm prefix module**
- Class phân quyền: `admin-only` (ẩn khi non-admin)

---

## 9. Quy tắc JavaScript

### Gọi API
```javascript
// ✅ ĐÚNG — dùng object api
const members = await MemberAPI.getAll(page, limit, keyword);

// ❌ SAI — không gọi fetch trực tiếp
const res = await fetch('https://website-qlclb.onrender.com/api/members');
```

### Khởi tạo trang (template bắt buộc)
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();                // Kiểm tra đăng nhập
    initLayout('ten-page');       // Khởi tạo sidebar + highlight menu
    initRoleRestrictions();       // Ẩn phần tử admin-only nếu non-admin

    // ... load dữ liệu
});
```

### Render HTML
```javascript
// Luôn escape dữ liệu người dùng
`<td>${escapeHtml(member.fullName)}</td>`
```

### Loading state
```javascript
showLoading();
try {
    const data = await SomeAPI.getAll();
    // render data
} catch (err) {
    showToast('Lỗi tải dữ liệu', 'danger');
} finally {
    hideLoading();
}
```

---

## 10. Checklist trước khi commit

- [ ] Có dùng biến CSS cho màu, border-radius, transition không?
- [ ] Có thêm class `admin-only` cho phần tử chỉ admin thấy không?
- [ ] Có gọi API qua `api.js` không (không fetch trực tiếp)?
- [ ] Có `requireAuth()` + `initLayout()` + `initRoleRestrictions()` không?
- [ ] Có `escapeHtml()` cho dữ liệu hiển thị không?
- [ ] Có dùng `showToast()` thay vì alert() không?
- [ ] Có dùng `openModal()`/`closeModal()` thay vì tự toggle không?
- [ ] Tên class có đúng prefix module không?
- [ ] Có sửa file ngoài phạm vi phân công không? (**KHÔNG ĐƯỢC**)
- [ ] Responsive: sidebar ẩn dưới 768px, bảng cuộn ngang?
