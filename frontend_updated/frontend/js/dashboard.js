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
  grid.innerHTML = Array(2).fill(`
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
      MemberAPI.getAll(1, 100),
      AttendanceAPI.getAll(),
    ]);

    _dashState.memberStats   = memberStatsRes.status   === 'fulfilled' ? memberStatsRes.value   : null;
    _dashState.sessions      = sessionsRes.status      === 'fulfilled' ? (sessionsRes.value || [])      : [];
    _dashState.members       = membersRes.status       === 'fulfilled' ? (membersRes.value?.members || []) : [];
    _dashState.attendanceAll = attendanceRes.status    === 'fulfilled' ? (attendanceRes.value || [])   : [];

    _renderStatCards();
    _renderRecentSessions();
    _renderRecentMembers();
    _renderAttendanceLineChart();

  } catch (err) {
    console.error('[Dashboard]', err);
    showToast('Lỗi tải dữ liệu tổng quan.', 'danger');
  } finally {
    hideLoading();
  }
}

/* ════════════════════════════════════════
   RENDER: STAT CARDS (chỉ 2 thẻ)
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
   RENDER: RECENT MEMBERS (3 ngày gần nhất)
   ════════════════════════════════════════ */
function _renderRecentMembers() {
  const container = document.getElementById('dash-members-list');
  if (!container) return;

  // Lọc thành viên tạo trong 3 ngày gần nhất
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  const recentMembers = _dashState.members.filter(m => {
    const createdAt = new Date(m.createdAt);
    return createdAt >= threeDaysAgo && createdAt <= now;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!recentMembers.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">👤</span>
        <p>Chưa có thành viên mới trong 3 ngày gần nhất.</p>
      </div>`;
    return;
  }

  container.innerHTML = recentMembers.map(m => {
    const initials = getInitials(m.fullName || m.mssv || '?');
    return `
      <div class="dash-member-item">
        <div class="dash-member-avatar">${escapeHtml(initials)}</div>
        <div class="dash-member-body">
          <div class="dash-member-name">${escapeHtml(m.fullName || '—')}</div>
          <div class="dash-member-mssv">${escapeHtml(m.mssv || '—')}</div>
          <div class="dash-member-created">${formatDateTime(m.createdAt)}</div>
        </div>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════
   RENDER: ATTENDANCE LINE CHART
   ════════════════════════════════════════ */
function _renderAttendanceLineChart() {
  const container = document.getElementById('dash-attendance-chart');
  if (!container) return;

  // Sắp xếp buổi sinh hoạt theo ngày
  const sortedSessions = [..._dashState.sessions]
    .sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate));

  if (!sortedSessions.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <span class="empty-state-icon">📭</span>
        <p>Chưa có buổi sinh hoạt nào để thống kê.</p>
      </div>`;
    return;
  }

  // Tính số lượng thành viên có mặt cho mỗi buổi
  const sessionAttendance = sortedSessions.map(session => {
    const sessionAttendances = _dashState.attendanceAll.filter(
      a => a.sessionId._id === session._id && a.status === 'Có mặt'
    );
    return {
      sessionId: session._id,
      sessionName: session.sessionName,
      sessionDate: new Date(session.sessionDate),
      presentCount: sessionAttendances.length,
    };
  });

  // Chuẩn bị dữ liệu cho Chart.js
  const labels = sessionAttendance.map(s => 
    s.sessionDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  );
  const data = sessionAttendance.map(s => s.presentCount);

  // Tính chiều rộng canvas dựa trên số lượng buổi
  const canvasWidth = Math.max(600, sortedSessions.length * 60);

  // Tạo canvas wrapper với scroll ngang
  container.innerHTML = `
    <div class="chart-wrapper" style="overflow-x: auto; width: 100%;">
      <canvas id="attendance-chart-canvas" style="min-width: ${canvasWidth}px; height: 300px;"></canvas>
    </div>`;

  // Đợi DOM render xong rồi tạo chart
  setTimeout(() => {
    const canvas = document.getElementById('attendance-chart-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Số thành viên có mặt',
          data: data,
          borderColor: 'var(--secondary)',
          backgroundColor: 'rgba(28, 200, 138, 0.1)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: 'var(--secondary)',
          pointBorderColor: 'var(--white)',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              font: { size: 13, weight: '600' },
              color: '#333',
              padding: 15,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 10,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            borderColor: 'var(--secondary)',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y} người`;
              }
            }
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Số thành viên',
            },
            ticks: {
              font: { size: 11 },
              color: '#666',
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
            },
          },
          x: {
            ticks: {
              font: { size: 11 },
              color: '#666',
            },
            grid: {
              display: false,
            },
          },
        },
      },
    });
  }, 100);
}
