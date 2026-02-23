/* ============================================================
   dashboard.js — Logic trang Tổng quan
   Phụ thuộc: api.js, utils.js, sidebar.js (load trước)
   Biến global duy nhất: _dashState (prefix _ để tránh conflict)
   ============================================================ */

// State nội bộ, prefix _ để tránh conflict với file khác
const _dashState = {
  sessions: [],
  members:  [],
  memberStats: null,
  attendanceAll: [],
};

/* ════════════════════════════════════════
   INIT
   ════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  initLayout('dashboard');
  initRoleRestrictions();

  _renderTopbar();
  _renderStatsSkeleton();

  await _loadAll();
});

/* ── Top bar: lời chào + ngày ── */
function _renderTopbar() {
  const el = document.getElementById('dash-topbar');
  if (!el) return;

  const user     = getCurrentUser();
  const greeting = getGreeting();
  const name     = user ? escapeHtml(user.fullName || user.mssv || 'bạn') : 'bạn';
  const now      = new Date();
  const dateStr  = now.toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });

  el.innerHTML = `
    <div class="dash-topbar-greeting">
      <h2>${greeting}, ${name}! 👋</h2>
      <p>Đây là tổng quan hoạt động của câu lạc bộ.</p>
    </div>
    <div class="dash-topbar-meta">
      <div class="dash-date-chip">📅 ${escapeHtml(dateStr)}</div>
    </div>`;
}

/* ── Skeleton cards trong khi chờ API ── */
function _renderStatsSkeleton() {
  const grid = document.getElementById('dash-stats-grid');
  if (!grid) return;
  grid.innerHTML = Array(4).fill(`
    <div class="card" style="padding:1.25rem; display:flex; gap:1rem; align-items:center;">
      <div class="skeleton" style="width:50px;height:50px;border-radius:50%;flex-shrink:0;"></div>
      <div style="flex:1">
        <div class="skeleton" style="height:10px;width:55%;margin-bottom:.55rem;"></div>
        <div class="skeleton" style="height:28px;width:40%;"></div>
      </div>
    </div>`).join('');
}

/* ════════════════════════════════════════
   DATA LOADING
   ════════════════════════════════════════ */
async function _loadAll() {
  showLoading();
  try {
    // Gọi song song tất cả API
    const [memberStatsRes, sessionsRes, membersRes, attendanceRes] = await Promise.allSettled([
      MemberAPI.getStats(),
      SessionAPI.getAll(),
      MemberAPI.getAll(1, 6),
      AttendanceAPI.getAll(),
    ]);

    _dashState.memberStats   = memberStatsRes.status   === 'fulfilled' ? memberStatsRes.value   : null;
    _dashState.sessions      = sessionsRes.status      === 'fulfilled' ? (sessionsRes.value || [])      : [];
    _dashState.members       = membersRes.status       === 'fulfilled' ? (membersRes.value?.members || []) : [];
    _dashState.attendanceAll = attendanceRes.status    === 'fulfilled' ? (attendanceRes.value || [])   : [];

    _renderStatCards();
    _renderRecentSessions();
    _renderRecentMembers();
    _renderAttendanceBreakdown();
    _renderMemberStatusBreakdown();

  } catch (err) {
    console.error('[Dashboard]', err);
    showToast('Lỗi tải dữ liệu tổng quan.', 'danger');
  } finally {
    hideLoading();
  }
}

/* ════════════════════════════════════════
   RENDER: STAT CARDS
   ════════════════════════════════════════ */
function _renderStatCards() {
  const grid = document.getElementById('dash-stats-grid');
  if (!grid) return;

  const stats = _dashState.memberStats;

  // Tổng thành viên
  const totalMembers = stats?.total ?? '—';

  // Thành viên "Hoạt động"
  const activeCount = stats?.detail?.find(d => d._id === 'Hoạt động')?.count ?? '—';

  // Tổng buổi sinh hoạt
  const totalSessions = _dashState.sessions.length;

  // Tỉ lệ có mặt
  const allAtt = _dashState.attendanceAll;
  let attendRate = '—';
  if (allAtt.length > 0) {
    const present = allAtt.filter(a => a.status === 'Có mặt').length;
    attendRate = Math.round((present / allAtt.length) * 100) + '%';
  }

  const cards = [
    {
      variant: 'dash-primary',
      icon: '👥',
      label: 'Tổng thành viên',
      value: totalMembers,
      sub: activeCount !== '—' ? `${activeCount} đang hoạt động` : '',
    },
    {
      variant: 'dash-success',
      icon: '📅',
      label: 'Buổi sinh hoạt',
      value: totalSessions,
      sub: 'Tổng cộng',
    },
    {
      variant: 'dash-info',
      icon: '✅',
      label: 'Tỉ lệ có mặt',
      value: attendRate,
      sub: 'Trung bình toàn CLB',
    },
    {
      variant: 'dash-warning',
      icon: '📋',
      label: 'Lượt điểm danh',
      value: allAtt.length || '—',
      sub: 'Tổng bản ghi',
    },
  ];

  grid.innerHTML = cards.map(c => `
    <div class="dash-stat-card ${escapeHtml(c.variant)}">
      <div class="dash-stat-icon">${c.icon}</div>
      <div class="dash-stat-body">
        <div class="dash-stat-label">${escapeHtml(c.label)}</div>
        <div class="dash-stat-value">${escapeHtml(String(c.value))}</div>
        ${c.sub ? `<div class="dash-stat-sub">${escapeHtml(c.sub)}</div>` : ''}
      </div>
    </div>`).join('');
}

/* ════════════════════════════════════════
   RENDER: RECENT SESSIONS
   ════════════════════════════════════════ */
function _renderRecentSessions() {
  const container = document.getElementById('dash-sessions-list');
  if (!container) return;

  // Sắp xếp theo ngày mới nhất, lấy 5 cái
  const sessions = [..._dashState.sessions]
    .sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate))
    .slice(0, 5);

  if (!sessions.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📭</span>
        <p>Chưa có buổi sinh hoạt nào.</p>
      </div>`;
    return;
  }

  // Xác định trạng thái dựa trên ngày (backend không có field status)
  const now = Date.now();
  container.innerHTML = sessions.map(s => {
    const d = new Date(s.sessionDate);
    let dotClass, badgeClass, statusLabel;
    if (d > now) {
      dotClass = 'upcoming'; badgeClass = 'badge-info'; statusLabel = 'Sắp diễn ra';
    } else {
      dotClass = 'done';     badgeClass = 'badge-success'; statusLabel = 'Đã diễn ra';
    }
    return `
      <div class="dash-session-item">
        <div class="dash-session-dot ${dotClass}"></div>
        <div class="dash-session-info">
          <div class="dash-session-name">${escapeHtml(s.sessionName)}</div>
          <div class="dash-session-date">${formatDate(s.sessionDate)}${s.location ? ' · ' + escapeHtml(s.location) : ''}</div>
        </div>
        <span class="badge ${badgeClass}">${statusLabel}</span>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════
   RENDER: RECENT MEMBERS
   ════════════════════════════════════════ */
function _renderRecentMembers() {
  const container = document.getElementById('dash-members-list');
  if (!container) return;

  const members = _dashState.members;

  if (!members.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">👤</span>
        <p>Chưa có thành viên nào.</p>
      </div>`;
    return;
  }

  container.innerHTML = members.map(m => {
    const initials = getInitials(m.fullName || m.mssv || '?');
    const isActive = m.status === 'Hoạt động';
    return `
      <div class="dash-member-item">
        <div class="dash-member-avatar">${escapeHtml(initials)}</div>
        <div class="dash-member-body">
          <div class="dash-member-name">${escapeHtml(m.fullName || '—')}</div>
          <div class="dash-member-mssv">${escapeHtml(m.mssv || '—')}</div>
        </div>
        <span class="badge ${isActive ? 'badge-success' : 'badge-secondary'}">
          ${escapeHtml(m.status || '—')}
        </span>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════
   RENDER: ATTENDANCE BREAKDOWN
   ════════════════════════════════════════ */
function _renderAttendanceBreakdown() {
  const container = document.getElementById('dash-attend-list');
  if (!container) return;

  const all = _dashState.attendanceAll;

  if (!all.length) {
    container.innerHTML = `<p style="font-size:.82rem;color:#bbb;text-align:center;padding:1rem 0">Chưa có dữ liệu điểm danh.</p>`;
    return;
  }

  // Đếm theo status
  const total   = all.length;
  const present = all.filter(a => a.status === 'Có mặt').length;
  const excused = all.filter(a => a.status === 'Có phép').length;
  const absent  = all.filter(a => a.status === 'Vắng').length;

  const rows = [
    { label: 'Có mặt', count: present, color: 'var(--secondary)' },
    { label: 'Có phép', count: excused, color: 'var(--warning)' },
    { label: 'Vắng',   count: absent,  color: 'var(--danger)' },
  ];

  container.innerHTML = rows.map(r => {
    const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
    return `
      <div>
        <div class="dash-attend-row-label">
          <span>${escapeHtml(r.label)}</span>
          <strong>${r.count} lượt (${pct}%)</strong>
        </div>
        <div class="dash-attend-track">
          <div class="dash-attend-fill" style="width:${pct}%; background:${r.color};"></div>
        </div>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════
   RENDER: MEMBER STATUS BREAKDOWN
   ════════════════════════════════════════ */
function _renderMemberStatusBreakdown() {
  const container = document.getElementById('dash-member-status-list');
  if (!container) return;

  const stats = _dashState.memberStats;
  if (!stats?.total || !stats?.detail?.length) {
    container.innerHTML = `<p style="font-size:.82rem;color:#bbb;text-align:center;padding:1rem 0">Chưa có dữ liệu thành viên.</p>`;
    return;
  }

  const total = stats.total;
  const colors = {
    'Hoạt động':        'var(--secondary)',
    'Không hoạt động':  'var(--danger)',
  };

  container.innerHTML = stats.detail.map(d => {
    const pct   = Math.round((d.count / total) * 100);
    const color = colors[d._id] || 'var(--info)';
    return `
      <div>
        <div class="dash-attend-row-label">
          <span>${escapeHtml(d._id || 'Khác')}</span>
          <strong>${d.count} người (${pct}%)</strong>
        </div>
        <div class="dash-attend-track">
          <div class="dash-attend-fill" style="width:${pct}%; background:${color};"></div>
        </div>
      </div>`;
  }).join('');
}