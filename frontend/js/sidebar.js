/* ============================================================
   sidebar.js — Xây dựng sidebar và xử lý mobile toggle
   Hàm global duy nhất export: buildSidebar(activePage)
   Được gọi bởi utils.js → initLayout(pageName)
   ============================================================ */

// Cấu hình menu — chỉ sửa ở đây nếu cần thêm/bớt mục
const _SIDEBAR_MENU = [
  {
    section: 'Quản lý',
    items: [
      { page: 'dashboard',      icon: '📊', label: 'Tổng quan',               href: 'dashboard.html',     adminOnly: false },
      { page: 'members',        icon: '👥', label: 'Thành viên',              href: 'members.html',       adminOnly: false },
      { page: 'sessions',       icon: '📅', label: 'Buổi sinh hoạt',          href: 'sessions.html',      adminOnly: false },
      { page: 'activities',     icon: '🏆', label: 'Hoạt động khác',          href: 'activities.html',    adminOnly: false },
      { page: 'role-sessions',  icon: '🎭', label: 'Vai trò buổi sinh hoạt', href: 'role-sessions.html', adminOnly: true  },
    ],
  },
];

/**
 * Inject sidebar + mobile toggle vào .layout-wrapper.
 * Gọi bởi initLayout() trong utils.js.
 *
 * @param {string} activePage  — page key hiện tại, VD: 'dashboard'
 */
function buildSidebar(activePage) {
  const user      = getCurrentUser();           // từ utils.js
  const adminFlag = isAdmin();                  // từ utils.js

  const initials = user ? getInitials(user.fullName || user.mssv || 'U') : '?';
  const userName = user ? escapeHtml(user.fullName || user.mssv || 'Người dùng') : 'Người dùng';
  const roleLabel = adminFlag ? 'Admin' : 'Thành viên';

  /* ── Build nav HTML ── */
  const navHTML = _SIDEBAR_MENU.map(group => {
    const items = group.items.map(item => {
      if (item.adminOnly && !adminFlag) return '';
      const activeClass  = item.page === activePage ? 'active' : '';
      const adminClass   = item.adminOnly ? 'admin-only' : '';
      return `
        <a href="${item.href}"
           class="sidebar-nav-item ${activeClass} ${adminClass}"
           data-page="${item.page}">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${escapeHtml(item.label)}</span>
        </a>`;
    }).join('');

    return `
      <span class="sidebar-section-label">${escapeHtml(group.section)}</span>
      ${items}`;
  }).join('');

  /* ── Full sidebar HTML ── */
  const sidebarHTML = `
    <aside class="sidebar" id="sidebar" role="navigation" aria-label="Menu chính">

      <!-- Brand -->
      <a class="sidebar-brand" href="dashboard.html">
        <img src="img/logoCLBTin.jpg" alt="Logo CLB Tin Học" class="sidebar-logo">
        <div class="sidebar-brand-text">
          <div class="sidebar-brand-name">CLB Tin Học</div>
          <div class="sidebar-brand-sub">Quản lý thành viên</div>
        </div>
      </a>

      <!-- User info -->
      <div class="sidebar-user">
        <div class="sidebar-user-avatar">${escapeHtml(initials)}</div>
        <div>
          <div class="sidebar-user-name">${userName}</div>
          <div class="sidebar-user-role">${escapeHtml(roleLabel)}</div>
        </div>
      </div>

      <!-- Nav -->
      <nav class="sidebar-nav">
        ${navHTML}
      </nav>

      <!-- Footer / logout -->
      <div class="sidebar-footer">
        <hr class="sidebar-divider">
        <a class="sidebar-nav-item nav-logout" role="button" tabindex="0"
           onclick="logout()" onkeydown="if(event.key==='Enter')logout()">
          <span class="nav-icon">🚪</span>
          <span class="nav-label">Đăng xuất</span>
        </a>
      </div>
    </aside>

    <!-- Mobile backdrop -->
    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

    <!-- Mobile toggle -->
    <button class="sidebar-toggle" id="sidebarToggle" aria-label="Mở/đóng menu" aria-expanded="false">
      ☰
    </button>`;

  // Inject vào đầu .layout-wrapper
  const wrapper = document.querySelector('.layout-wrapper');
  if (wrapper) {
    wrapper.insertAdjacentHTML('afterbegin', sidebarHTML);
  } else {
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
  }

  // Tạo #toast-container nếu chưa có
  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    document.body.appendChild(tc);
  }

  // Tạo #loading-overlay nếu chưa có
  if (!document.getElementById('loading-overlay')) {
    const lo = document.createElement('div');
    lo.id = 'loading-overlay';
    lo.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(lo);
  }

  _initMobileToggle();
}

/* ── Mobile toggle logic ── */
function _initMobileToggle() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const toggle   = document.getElementById('sidebarToggle');

  if (!sidebar || !toggle) return;

  function openSidebar() {
    sidebar.classList.add('is-open');
    backdrop.classList.add('active');
    toggle.textContent = '✕';
    toggle.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('active');
    toggle.textContent = '☰';
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar();
  });

  backdrop.addEventListener('click', closeSidebar);

  // Tự đóng khi click nav item trên mobile
  sidebar.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  // Đóng khi resize về desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeSidebar();
  });
}