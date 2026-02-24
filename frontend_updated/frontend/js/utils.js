/* ============================================================
 * utils.js — Tiện ích dùng chung cho toàn bộ Frontend CLB
 *
 * CÁC HÀM EXPORT (global, dùng được ở mọi file):
 *
 *  Auth:
 *    requireAuth()           — redirect về login nếu chưa đăng nhập
 *    getCurrentUser()        — lấy thông tin user đang đăng nhập
 *    isAdmin()               — true nếu roleId có roleName chứa "admin" (case-insensitive)
 *    logout()                — xóa token, redirect login
 *
 *  Layout:
 *    initLayout(pageName)    — gọi buildSidebar() + highlight menu active
 *    initRoleRestrictions()  — ẩn .admin-only nếu không phải admin
 *
 *  Toast:
 *    showToast(msg, type)    — type: 'success'|'danger'|'warning'|'info'
 *
 *  Modal:
 *    openModal(id)
 *    closeModal(id)
 *
 *  Loading:
 *    showLoading()
 *    hideLoading()
 *
 *  Helpers:
 *    escapeHtml(str)
 *    formatDate(dateStr)      — dd/mm/yyyy
 *    formatDateTime(dateStr)  — dd/mm/yyyy hh:mm
 *    getInitials(fullName)    — 'Nguyễn Văn A' → 'NA'
 *    getGreeting()            — 'Chào buổi sáng/chiều/tối'
 * ============================================================ */


// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

/**
 * Kiểm tra đã đăng nhập chưa.
 * Nếu chưa → redirect về index.html ngay lập tức.
 */
function requireAuth() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        window.location.href = 'index.html';
    }
}

/**
 * Lấy thông tin user đang đăng nhập từ localStorage.
 * Shape: { id, fullName, mssv, roleId }
 * roleId ở đây là ObjectId string (từ lúc login).
 * @returns {object|null}
 */
function getCurrentUser() {
    try {
        const raw = localStorage.getItem('currentUser');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/**
 * Kiểm tra user hiện tại có phải admin không.
 * Backend trả roleName, nhưng sau login chỉ có roleId (ObjectId).
 * → Dùng flag 'isAdmin' lưu kèm trong currentUser (xem AuthAPI.login).
 *
 * Để trang login lưu đúng, sau khi gọi AuthAPI.login() thành công,
 * js/login.js cần lấy thêm role rồi lưu vào currentUser, hoặc
 * backend trả thêm trường isAdmin. Tạm thời hàm này đọc field `isAdmin`.
 *
 * @returns {boolean}
 */
function isAdmin() {
    const user = getCurrentUser();
    if (!user) return false;
    // Hỗ trợ cả 2 cách backend có thể trả: boolean isAdmin hoặc string roleName
    if (typeof user.isAdmin === 'boolean') return user.isAdmin;
    if (user.roleName) return user.roleName.toLowerCase().includes('admin');
    return false;
}

/**
 * Đăng xuất: xóa toàn bộ dữ liệu đăng nhập, về trang login.
 */
function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}


// ─────────────────────────────────────────────
// LAYOUT
// ─────────────────────────────────────────────

/**
 * Khởi tạo layout: inject sidebar + highlight menu item của trang hiện tại.
 * Phải gọi sau khi DOM ready và sau requireAuth().
 *
 * @param {string} pageName — key của trang, khớp với data-page trong sidebar.js
 *   Các giá trị hợp lệ: 'dashboard' | 'members' | 'sessions' | 'activities' | 'role-sessions'
 */
function initLayout(pageName) {
    if (typeof buildSidebar === 'function') {
        buildSidebar(pageName);
    } else {
        console.warn('[utils] buildSidebar() chưa được load. Kiểm tra thứ tự script trong HTML.');
    }
}

/**
 * Ẩn tất cả phần tử có class .admin-only nếu user không phải admin.
 * Gọi SAU initLayout() (vì sidebar cũng có .admin-only).
 */
function initRoleRestrictions() {
    if (!isAdmin()) {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });
    }
}


// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────

/**
 * Hiển thị thông báo toast góc trên phải, tự biến mất sau 3 giây.
 * KHÔNG dùng alert() — luôn dùng hàm này.
 *
 * @param {string} message
 * @param {'success'|'danger'|'warning'|'info'} type
 */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const iconMap = {
        success: '✅',
        danger:  '❌',
        warning: '⚠️',
        info:    'ℹ️',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
        <span>${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);

    // Tự xóa sau 3 giây
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


// ─────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────

/**
 * Mở modal bằng id.
 * @param {string} id — id của phần tử .modal-overlay
 */
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

/**
 * Đóng modal bằng id.
 * @param {string} id
 */
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

// Đóng modal khi click vào overlay (vùng tối bên ngoài)
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});


// ─────────────────────────────────────────────
// LOADING
// ─────────────────────────────────────────────

/**
 * Hiện overlay loading toàn màn hình.
 * Dùng cặp showLoading() / hideLoading() bọc quanh các lời gọi API.
 */
function showLoading() {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(overlay);
    }
    overlay.classList.add('active');
}

/** Ẩn overlay loading. */
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
}


// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Escape HTML để tránh XSS khi render dữ liệu từ server/user.
 * LUÔN dùng hàm này khi chèn dữ liệu vào innerHTML.
 *
 * @param {*} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#039;');
}

/**
 * Format ngày thành dd/mm/yyyy (theo múi giờ local).
 * @param {string|Date} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d)) return '—';
        return d.toLocaleDateString('vi-VN', {
            day:   '2-digit',
            month: '2-digit',
            year:  'numeric'
        });
    } catch {
        return String(dateStr);
    }
}

/**
 * Format ngày giờ thành dd/mm/yyyy hh:mm.
 * @param {string|Date} dateStr
 * @returns {string}
 */
function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d)) return '—';
        return d.toLocaleString('vi-VN', {
            day:    '2-digit',
            month:  '2-digit',
            year:   'numeric',
            hour:   '2-digit',
            minute: '2-digit'
        });
    } catch {
        return String(dateStr);
    }
}

/**
 * Lấy chữ cái đầu của tên (dùng cho avatar).
 * Ví dụ: 'Nguyễn Văn An' → 'NA', 'admin' → 'A'
 * @param {string} fullName
 * @returns {string}
 */
function getInitials(fullName) {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    // Lấy chữ đầu từ đầu và từ cuối
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Lời chào theo giờ hiện tại.
 * @returns {'Chào buổi sáng'|'Chào buổi chiều'|'Chào buổi tối'}
 */
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
}