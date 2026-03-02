/* ============================================================
   dashboard.js
   ============================================================ */

const _dashState = {
  sessions: [], members: [], memberStats: null, attendanceAll: [],
};

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  initLayout('dashboard');
  initRoleRestrictions();
  _renderTopbar();
  _renderStatsSkeleton();
  await _loadAll();
});

/* ── Top bar ── */
function _renderTopbar() {
  const el = document.getElementById('dash-topbar');
  if (!el) return;
  const user     = getCurrentUser();
  const greeting = getGreeting();
  const name     = user ? escapeHtml(user.fullName || user.mssv || 'bạn') : 'bạn';
  const now      = new Date();
  const dateStr  = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  el.innerHTML = `
    <div class="dash-topbar-greeting">
      <h2>${greeting}, ${name}! 👋</h2>
      <p>Đây là tổng quan hoạt động của câu lạc bộ.</p>
    </div>
    <div class="dash-topbar-meta">
      <div class="dash-date-chip">📅 ${escapeHtml(dateStr)}</div>
    </div>`;
}

function _renderStatsSkeleton() {
  const grid = document.getElementById('dash-stats-grid');
  if (!grid) return;
  grid.innerHTML = Array(2).fill(`
    <div class="card" style="padding:1.4rem;display:flex;gap:1rem;align-items:center;border-radius:12px;">
      <div class="skeleton" style="width:52px;height:52px;border-radius:14px;flex-shrink:0;"></div>
      <div style="flex:1">
        <div class="skeleton" style="height:10px;width:55%;margin-bottom:.55rem;"></div>
        <div class="skeleton" style="height:30px;width:40%;"></div>
      </div>
    </div>`).join('');
}

/* ── Load all ── */
async function _loadAll() {
  showLoading();
  try {
    const [memberStatsRes, sessionsRes, membersRes, attendanceRes] = await Promise.allSettled([
      MemberAPI.getStats(),
      SessionAPI.getAll(),
      MemberAPI.getAll(1, 100),
      AttendanceAPI.getAll(),
    ]);
    _dashState.memberStats   = memberStatsRes.status === 'fulfilled' ? memberStatsRes.value : null;
    _dashState.sessions      = sessionsRes.status    === 'fulfilled' ? (sessionsRes.value || []) : [];
    _dashState.members       = membersRes.status     === 'fulfilled' ? (membersRes.value?.members || []) : [];
    _dashState.attendanceAll = attendanceRes.status  === 'fulfilled' ? (attendanceRes.value || []) : [];

    _renderStatCards();
    _renderRecentSessions();
    _renderRecentMembers();
    _renderAttendanceChart();
  } catch (err) {
    console.error('[Dashboard]', err);
    showToast('Lỗi tải dữ liệu tổng quan.', 'danger');
  } finally {
    hideLoading();
  }
}

/* ── Stat cards ── */
function _renderStatCards() {
  const grid = document.getElementById('dash-stats-grid');
  if (!grid) return;
  const stats        = _dashState.memberStats;
  const totalMembers = stats?.total ?? '—';
  const activeCount  = stats?.detail?.find(d => d._id === 'Hoạt động')?.count ?? '—';
  const totalSessions = _dashState.sessions.length;

  const cards = [
    { variant: 'dash-primary', icon: '👥', label: 'Tổng thành viên', value: totalMembers, sub: activeCount !== '—' ? `${activeCount} đang hoạt động` : '' },
    { variant: 'dash-success', icon: '📅', label: 'Buổi sinh hoạt',  value: totalSessions, sub: 'Tổng cộng' },
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

/* ── Recent sessions ── */
function _renderRecentSessions() {
  const container = document.getElementById('dash-sessions-list');
  if (!container) return;
  const sessions = [..._dashState.sessions]
    .sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate)).slice(0, 5);
  if (!sessions.length) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">📭</span><p>Chưa có buổi sinh hoạt nào.</p></div>`;
    return;
  }
  const now = Date.now();
  container.innerHTML = sessions.map(s => {
    const d = new Date(s.sessionDate);
    let dotClass, badgeClass, statusLabel;
    if (d > now) { dotClass = 'upcoming'; badgeClass = 'badge-info'; statusLabel = 'Sắp diễn ra'; }
    else         { dotClass = 'done'; badgeClass = 'badge-success'; statusLabel = 'Đã diễn ra'; }
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

/* ── Recent members ── */
function _renderRecentMembers() {
  const container = document.getElementById('dash-members-list');
  if (!container) return;
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const recentMembers = _dashState.members
    .filter(m => { const c = new Date(m.createdAt); return c >= threeDaysAgo && c <= now; })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!recentMembers.length) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">👤</span><p>Chưa có thành viên mới trong 3 ngày gần nhất.</p></div>`;
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

/* ════════════════════════════════
   CHART — thiết kế lại đẹp hơn
   ════════════════════════════════ */
function _renderAttendanceChart() {
  const container = document.getElementById('dash-attendance-chart');
  if (!container) return;

  const sortedSessions = [..._dashState.sessions]
    .sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate));

  if (!sortedSessions.length) {
    container.innerHTML = `<div class="empty-state" style="padding:2rem;"><span class="empty-state-icon">📭</span><p>Chưa có buổi sinh hoạt nào để thống kê.</p></div>`;
    return;
  }

  const sessionData = sortedSessions.map(session => {
    const present = _dashState.attendanceAll.filter(
      a => a.sessionId._id === session._id && a.status === 'Có mặt'
    ).length;
    return {
      label: new Date(session.sessionDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      name:  session.sessionName,
      count: present,
    };
  });

  const labels = sessionData.map(s => s.label);
  const data   = sessionData.map(s => s.count);
  const maxVal = Math.max(...data, 1);
  const avgVal = data.length ? Math.round(data.reduce((a, b) => a + b, 0) / data.length) : 0;
  const total  = data.reduce((a, b) => a + b, 0);

  const canvasWidth = Math.max(600, sortedSessions.length * 72);
  const isDark = document.body.classList.contains('dark-mode');

  container.innerHTML = `
    <div class="chart-outer">
      <div class="chart-wrapper">
        <canvas id="attendance-chart-canvas" style="min-width:${canvasWidth}px;height:280px;"></canvas>
      </div>
      <div class="dash-chart-summary">
        <div class="dash-chart-stat">
          <span class="dash-chart-stat-val">${total}</span>
          <span class="dash-chart-stat-lbl">Tổng lượt có mặt</span>
        </div>
        <div class="dash-chart-stat">
          <span class="dash-chart-stat-val">${avgVal}</span>
          <span class="dash-chart-stat-lbl">Trung bình / buổi</span>
        </div>
        <div class="dash-chart-stat">
          <span class="dash-chart-stat-val">${Math.max(...data)}</span>
          <span class="dash-chart-stat-lbl">Cao nhất</span>
        </div>
        <div class="dash-chart-stat">
          <span class="dash-chart-stat-val">${sortedSessions.length}</span>
          <span class="dash-chart-stat-lbl">Buổi sinh hoạt</span>
        </div>
      </div>
    </div>`;

  setTimeout(() => {
    const canvas = document.getElementById('attendance-chart-canvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)';
    const textColor = isDark ? '#8a95b8' : '#888';
    const ctx = canvas.getContext('2d');

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, 'rgba(78,115,223,.35)');
    gradient.addColorStop(1, 'rgba(78,115,223,.02)');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Thành viên có mặt',
          data,
          borderColor: '#4e73df',
          backgroundColor: gradient,
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#4e73df',
          pointBorderColor: isDark ? '#1a1f2e' : '#fff',
          pointBorderWidth: 2.5,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: '#4e73df',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#1a1f2e' : '#1a2236',
            padding: { x: 14, y: 10 },
            titleFont: { size: 12, weight: '700', family: "'Nunito', sans-serif" },
            bodyFont:  { size: 13, weight: '800', family: "'Nunito', sans-serif" },
            titleColor: '#a3bffa',
            bodyColor:  '#fff',
            borderColor: '#4e73df',
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              title: ctx => {
                const i = ctx[0].dataIndex;
                return sessionData[i]?.name || ctx[0].label;
              },
              label: ctx => `  ${ctx.parsed.y} người có mặt`,
              afterLabel: ctx => {
                const pct = maxVal > 0 ? Math.round((ctx.parsed.y / maxVal) * 100) : 0;
                return `  ${pct}% so với cao nhất`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: maxVal + 2,
            grid: { color: gridColor, drawBorder: false },
            border: { display: false },
            ticks: {
              font: { size: 11, family: "'Nunito', sans-serif" },
              color: textColor,
              padding: 8,
              stepSize: 1,
            },
          },
          x: {
            grid: { display: false, drawBorder: false },
            border: { display: false },
            ticks: {
              font: { size: 11, family: "'Nunito', sans-serif" },
              color: textColor,
              padding: 8,
            },
          },
        },
      },
    });
  }, 100);
}
