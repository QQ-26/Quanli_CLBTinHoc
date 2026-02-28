/* ============================================================
   sidebar.js
   ============================================================ */

const _SIDEBAR_MENU = [
  {
    section: 'Quản lý',
    items: [
      { page: 'dashboard',     icon: '📊', label: 'Tổng quan',               href: 'dashboard.html',     adminOnly: false },
      { page: 'members',       icon: '👥', label: 'Thành viên',              href: 'members.html',       adminOnly: false },
      { page: 'sessions',      icon: '📅', label: 'Buổi sinh hoạt',          href: 'sessions.html',      adminOnly: false },
      { page: 'role-sessions', icon: '🎭', label: 'Vai trò buổi sinh hoạt', href: 'role-sessions.html', adminOnly: true  },
    ],
  },
];

/* ── Tạo URL ảnh từ avatarPath bất kể định dạng DB trả về ── */
function _resolveAvatarUrl(avatarPath) {
  if (!avatarPath) return null;
  // Base64 data URL → dùng thẳng không cần ghép gì
  if (avatarPath.startsWith('data:')) return avatarPath;
  // URL đầy đủ
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) return avatarPath;
  // Path tương đối → ghép base server
  const base = 'https://website-qlclb.onrender.com';
  return base + (avatarPath.startsWith('/') ? avatarPath : '/' + avatarPath);
}

/* ── Build HTML thẻ avatar (ảnh hoặc chữ tắt) ── */
function _buildAvatarHtml(avatarUrl, initials, size = 'sm') {
  const dim = size === 'lg' ? '42px' : '34px';
  const fs  = size === 'lg' ? '1rem'  : '0.78rem';
  if (avatarUrl) {
    return `<img src="${avatarUrl}" alt="Avatar"
      style="width:${dim};height:${dim};border-radius:50%;object-fit:cover;display:block;"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
      <span style="display:none;width:${dim};height:${dim};border-radius:50%;
        background:linear-gradient(135deg,var(--primary),#6c8fef);
        align-items:center;justify-content:center;font-size:${fs};font-weight:800;color:#fff;">
        ${initials}
      </span>`;
  }
  // Luôn trả về avatar chữ cái đầu nếu không có avatarUrl
  return `<span style="width:${dim};height:${dim};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${fs};font-weight:800;color:#fff;background:linear-gradient(135deg,var(--primary),#6c8fef);">${initials}</span>`;
}

function buildSidebar(activePage) {
  const user      = getCurrentUser();
  const adminFlag = isAdmin();

  let initials = 'U';
  let userName = 'User';
  if (user) {
    if (user.fullName && user.fullName.trim()) {
      initials = getInitials(user.fullName);
      userName = escapeHtml(user.fullName);
    } else if (user.mssv && user.mssv.trim()) {
      initials = getInitials(user.mssv);
      userName = escapeHtml(user.mssv);
    } else if (user.username && user.username.trim()) {
      initials = getInitials(user.username);
      userName = escapeHtml(user.username);
    }
    // Đảm bảo initials không rỗng
    if (!initials || initials === '?') initials = 'U';
  } else {
    // Nếu không có user, ép đăng xuất
    if (typeof logout === 'function') logout();
  }
  const userMssv = user ? escapeHtml(user.mssv  || '—') : '—';
  const userEmail= user ? escapeHtml(user.email || '—') : '—';
  let roleLabel  = 'Thành viên';
  if (user?.roleName?.toLowerCase().includes('admin')) roleLabel = 'Admin';
  else if (user?.roleName) roleLabel = user.roleName;

  const avatarUrl   = _resolveAvatarUrl(user?.avatarPath);
  const avatarSmHtml = _buildAvatarHtml(avatarUrl, escapeHtml(initials), 'sm');
  const avatarLgHtml = _buildAvatarHtml(avatarUrl, escapeHtml(initials), 'lg');

  /* ── Build nav HTML ── */
  const navHTML = _SIDEBAR_MENU.map(group => {
    const items = group.items.map(item => {
      if (item.adminOnly && !adminFlag) return '';
      const activeClass = item.page === activePage ? 'active' : '';
      const adminClass  = item.adminOnly ? 'admin-only' : '';
      return `
        <a href="${item.href}"
           class="sidebar-nav-item ${activeClass} ${adminClass}"
           data-page="${item.page}"
           data-tooltip="${escapeHtml(item.label)}">
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
      <div class="sidebar-brand-row">
        <a class="sidebar-brand" href="dashboard.html">
          <img src="img/logoCLBTin.jpg" alt="Logo CLB Tin Học" class="sidebar-logo">
          <div class="sidebar-brand-text">
            <div class="sidebar-brand-name">CLB Tin Học</div>
            <div class="sidebar-brand-sub">Quản lý thành viên</div>
          </div>
        </a>
      </div>

      <!-- Nav -->
      <nav class="sidebar-nav">
        ${navHTML}
      </nav>

      <!-- Footer: user info → dark mode → đăng xuất -->
      <div class="sidebar-footer">

        <!-- User info -->
        <div class="sidebar-user" id="sidebarUserInfo" role="button" tabindex="0"
             title="Xem thông tin tài khoản" data-tooltip="${userName}">
          <div class="sidebar-user-avatar" id="sidebarAvatar">${avatarSmHtml}</div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${userName}</div>
            <div class="sidebar-user-role">${escapeHtml(roleLabel)}</div>
          </div>
          <span class="sidebar-user-arrow nav-label">›</span>
        </div>

        <!-- Dark mode -->
        <div class="sidebar-darkmode-row">
          <span class="sidebar-darkmode-label">🌙 Dark mode</span>
          <label class="dm-switch">
            <input type="checkbox" id="darkModeToggle">
            <span class="dm-slider"></span>
          </label>
        </div>

        <hr class="sidebar-divider">

        <a class="sidebar-nav-item nav-logout" role="button" tabindex="0"
           data-tooltip="Đăng xuất"
           onclick="logout()" onkeydown="if(event.key==='Enter')logout()">
          <span class="nav-icon">🚪</span>
          <span class="nav-label">Đăng xuất</span>
        </a>
      </div>
    </aside>

    <!-- Nút collapse lòi ra ngoài cạnh phải sidebar -->
    <button class="sidebar-collapse-btn" id="sidebarCollapseBtn"
            title="Thu gọn/Mở rộng menu" aria-label="Thu gọn menu">
      <span id="sidebarCollapseIcon">&#x276E;</span>
    </button>

    <!-- Mobile backdrop -->
    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

    <!-- Mobile toggle -->
    <button class="sidebar-toggle" id="sidebarToggle" aria-label="Mở/đóng menu" aria-expanded="false">
      ☰
    </button>

    <!-- Popup thông tin tài khoản -->
    <div class="user-popup" id="userPopup" role="dialog" aria-modal="true">
      <div class="user-popup-header">
        <div class="user-popup-avatar" id="popupAvatar">${avatarLgHtml}</div>
        <div class="user-popup-meta">
          <div class="user-popup-name">${userName}</div>
          <div class="user-popup-role">${escapeHtml(roleLabel)}</div>
        </div>
        <button class="user-popup-close" id="userPopupClose" aria-label="Đóng">✕</button>
      </div>
      <div class="user-popup-body">
        <div class="user-popup-row">
          <span class="user-popup-lbl">MSSV</span>
          <span class="user-popup-val">${userMssv}</span>
        </div>
        <div class="user-popup-row">
          <span class="user-popup-lbl">Email</span>
          <span class="user-popup-val">${userEmail}</span>
        </div>
        <div class="user-popup-row">
          <span class="user-popup-lbl">Vai trò</span>
          <span class="user-popup-val">${escapeHtml(roleLabel)}</span>
        </div>
      </div>
      <div class="user-popup-footer">
        <button class="user-popup-logout btn btn-danger btn-sm" onclick="logout()">🚪 Đăng xuất</button>
      </div>
    </div>
    <div class="user-popup-backdrop" id="userPopupBackdrop"></div>`;

  const wrapper = document.querySelector('.layout-wrapper');
  if (wrapper) wrapper.insertAdjacentHTML('afterbegin', sidebarHTML);
  else document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div'); tc.id = 'toast-container';
    document.body.appendChild(tc);
  }
  if (!document.getElementById('loading-overlay')) {
    const lo = document.createElement('div'); lo.id = 'loading-overlay';
    lo.innerHTML = '<div class="spinner"></div>'; document.body.appendChild(lo);
  }

  _initSidebarLogic();

  // Luôn fetch avatar mới nhất từ API (cập nhật khi DB thay đổi mà không cần re-login)
  _fetchAndUpdateAvatar(user);
}

/* ── Fetch avatar từ API và cập nhật DOM + localStorage ── */
function _fetchAndUpdateAvatar(user) {
  if (!user) return;
  const uid = user.id || user._id;
  if (!uid) return;

  // Tính initials trước để dùng trong cả success và catch
  let initials = 'U';
  if (user.fullName || user.mssv) {
    initials = getInitials(user.fullName || user.mssv || 'U');
  }
  if (!initials || initials === '?') initials = 'U';
  initials = escapeHtml(initials);

  const token = localStorage.getItem('accessToken');
  if (!token) return;

  // Dùng fetch trực tiếp (KHÔNG qua MemberAPI) để tránh _forceLogout khi token hết hạn
  fetch(`https://website-qlclb.onrender.com/api/members/${uid}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  }).then(res => {
    if (!res.ok) throw new Error('fetch avatar failed: ' + res.status);
    return res.json();
  }).then(detail => {
    if (!detail) return;
    const newPath = detail.avatarPath || null;

    // Cập nhật user trong localStorage với thông tin mới nhất
    user.avatarPath = newPath;
    if (detail.fullName) user.fullName = detail.fullName;
    if (detail.mssv)     user.mssv     = detail.mssv;
    if (detail.email)    user.email    = detail.email;
    localStorage.setItem('currentUser', JSON.stringify(user));

    const avatarUrl = _resolveAvatarUrl(newPath);
    let updatedInitials = initials;
    if (detail.fullName || detail.mssv) {
      const raw = getInitials(detail.fullName || detail.mssv || 'U');
      updatedInitials = escapeHtml(raw && raw !== '?' ? raw : 'U');
    }

    const sidebarAv = document.getElementById('sidebarAvatar');
    if (sidebarAv) sidebarAv.innerHTML = _buildAvatarHtml(avatarUrl, updatedInitials, 'sm');

    const popupAv = document.getElementById('popupAvatar');
    if (popupAv) popupAv.innerHTML = _buildAvatarHtml(avatarUrl, updatedInitials, 'lg');
  }).catch(() => {
    // Silent fail — chỉ cập nhật chữ cái đầu, không redirect
    const sidebarAv = document.getElementById('sidebarAvatar');
    if (sidebarAv) sidebarAv.innerHTML = _buildAvatarHtml(null, initials, 'sm');
    const popupAv = document.getElementById('popupAvatar');
    if (popupAv) popupAv.innerHTML = _buildAvatarHtml(null, initials, 'lg');
  });
}

function _initSidebarLogic() {
  const sidebar      = document.getElementById('sidebar');
  const backdrop     = document.getElementById('sidebarBackdrop');
  const toggle       = document.getElementById('sidebarToggle');
  const collapseBtn  = document.getElementById('sidebarCollapseBtn');
  const collapseIcon = document.getElementById('sidebarCollapseIcon');
  const wrapper      = document.querySelector('.layout-wrapper');
  const dmToggle     = document.getElementById('darkModeToggle');
  const userInfo     = document.getElementById('sidebarUserInfo');
  const userPopup    = document.getElementById('userPopup');
  const userPopupBd  = document.getElementById('userPopupBackdrop');
  const userPopupClose = document.getElementById('userPopupClose');

  if (!sidebar) return;

  /* ════ Desktop collapse ════ */
  const COLLAPSED_KEY = 'sidebar_collapsed';
  const SIDEBAR_W = 260, COLLAPSED_W = 62;

  function _updateCollapseBtn(collapsed) {
    if (!collapseBtn) return;
    collapseBtn.style.left = ((collapsed ? COLLAPSED_W : SIDEBAR_W) - 14) + 'px';
    if (collapseIcon) collapseIcon.style.transform = collapsed ? 'rotate(180deg)' : '';
  }
  function collapseSidebar() {
    sidebar.classList.add('is-collapsed');
    wrapper?.classList.add('sidebar-collapsed');
    localStorage.setItem(COLLAPSED_KEY, '1');
    _updateCollapseBtn(true);
  }
  function expandSidebar() {
    sidebar.classList.remove('is-collapsed');
    wrapper?.classList.remove('sidebar-collapsed');
    localStorage.setItem(COLLAPSED_KEY, '0');
    _updateCollapseBtn(false);
  }

  if (localStorage.getItem(COLLAPSED_KEY) === '1') collapseSidebar();
  else _updateCollapseBtn(false);

  collapseBtn?.addEventListener('click', () => {
    sidebar.classList.contains('is-collapsed') ? expandSidebar() : collapseSidebar();
  });

  /* ════ Dark mode ════ */
  const DARK_KEY = 'dark_mode';
  function applyDark(on) {
    document.body.classList.toggle('dark-mode', on);
    if (dmToggle) dmToggle.checked = on;
    localStorage.setItem(DARK_KEY, on ? '1' : '0');
  }
  applyDark(localStorage.getItem(DARK_KEY) === '1');
  dmToggle?.addEventListener('change', () => applyDark(dmToggle.checked));

  /* ════ User popup ════ */
  const openPopup  = () => { userPopup?.classList.add('active');    userPopupBd?.classList.add('active'); };
  const closePopup = () => { userPopup?.classList.remove('active'); userPopupBd?.classList.remove('active'); };

  userInfo?.addEventListener('click', openPopup);
  userInfo?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openPopup(); });
  userPopupClose?.addEventListener('click', closePopup);
  userPopupBd?.addEventListener('click', closePopup);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePopup(); });

  /* ════ Mobile toggle ════ */
  if (!toggle) return;
  const openSidebar  = () => { sidebar.classList.add('is-open');    backdrop?.classList.add('active');    toggle.textContent = '✕'; toggle.setAttribute('aria-expanded','true'); };
  const closeSidebar = () => { sidebar.classList.remove('is-open'); backdrop?.classList.remove('active'); toggle.textContent = '☰'; toggle.setAttribute('aria-expanded','false'); };

  toggle.addEventListener('click', () => sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar());
  backdrop?.addEventListener('click', closeSidebar);
  sidebar.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.addEventListener('click', () => { if (window.innerWidth <= 768) closeSidebar(); });
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 768) closeSidebar(); });
}
