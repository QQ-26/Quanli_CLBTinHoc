/* ============================================================
   login.js — Logic trang Đăng nhập
   Phụ thuộc: api.js, utils.js, sidebar.js (load trước)
   ============================================================ */

// ── Helpers dùng riêng cho trang login ──────────────────────────
function _showLoginAlert(msg, type = 'error') {
    const el = document.getElementById('loginAlert');
    if (!el) return;
    el.className = 'login-alert show ' + type;
    el.innerHTML = (type === 'error' ? '⚠️ ' : '✅ ') + msg;
}

function _hideLoginAlert() {
    const el = document.getElementById('loginAlert');
    if (el) el.className = 'login-alert';
}
// ────────────────────────────────────────────────────────────────

// Nếu đã đăng nhập, redirect
if (localStorage.getItem('accessToken')) {
    window.location.href = 'dashboard.html';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    _hideLoginAlert();

    const mssv = document.getElementById('mssv').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');

    if (!mssv || !password) {
        _showLoginAlert('Vui lòng nhập đầy đủ thông tin');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>Đang đăng nhập...</span>';

    try {
        const loginData = await AuthAPI.login(mssv, password);
        // Lấy thêm thông tin member để lấy roleName
        const memberId = loginData.member.id || loginData.member._id;
        const memberDetail = await MemberAPI.getById(memberId);
        let user = loginData.member;
        if (memberDetail && memberDetail.roleId && memberDetail.roleId.roleName) {
            user.roleName = memberDetail.roleId.roleName;
            user.isAdmin = memberDetail.roleId.roleName.toLowerCase().includes('admin');
        }
        localStorage.setItem('currentUser', JSON.stringify(user));
        showToast('Đăng nhập thành công!', 'success');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 500);
    } catch (error) {
        _showLoginAlert(error.message || 'Đăng nhập thất bại');
        btn.disabled = false;
        btn.innerHTML = '<span>Đăng nhập →</span>';
    }
});

// Toggle ẩn/hiện mật khẩu
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}