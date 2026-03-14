/* ============================================================
 * sessions.js — Quản lý buổi sinh hoạt CLB Tin Học
 * Phụ thuộc: api.js, utils.js, sidebar.js
 * ============================================================ */

'use strict';

// ─── State ───────────────────────────────────────────────────
let _sessions         = [];
let _members          = [];
let _roleSessions     = [];
let _attendanceMap    = {};
let _currentSessionId = null;
let _deleteId         = null;
let _searchKeyword    = '';
let _filterType       = 'registered'; // 'registered' | 'all' | 'regular' | 'other' | 'instructor'
let _currentPage      = 1;
const PAGE_SIZE       = 8;
let _participateSet   = {};      // { sessionId: Set<memberId> }
let _registerSet      = {};      // { sessionId: bool } — user hiện tại đã đăng ký chưa
let _attSearchKeyword = '';      // tìm kiếm trong bảng điểm danh
let _attSortAZ        = true;    // sắp xếp A-Z theo tên (mặc định bật)
let _statusCache      = {};      // { memberId: status } — cache toàn bộ, không phụ thuộc filter DOM
let _attCurrentPage   = 1;       // trang hiện tại của bảng điểm danh
const ATT_PAGE_SIZE   = 10;      // số người mỗi trang điểm danh

// ─── Permission: kiểm tra có quyền quản lý điểm danh không ──
// Chỉ người phụ trách (instructor) của buổi đó mới được điểm danh / đăng ký cho người khác
// Admin KHÔNG tự động có quyền nếu không phải instructor của buổi đó
function isInstructor(sessionId) {
    const user = getCurrentUser();
    if (!user) return false;
    const session = _sessions.find(s => s._id === sessionId);
    if (!session) return false;
    const populated = _populateInstructors(session.instructors);
    return populated.some(i => {
        const mid = i.memberId?._id || i.memberId;
        return mid === user.id;
    });
}

function canManageAttendance(sessionId) {
    return isInstructor(sessionId || _currentSessionId);
}


// ─── SessionType local persistence ───────────────────────────
// Backend chưa có field sessionType → lưu vào localStorage
const _TYPE_KEY = 'clb_session_types';

function _saveTypeMap() {
    const map = {};
    _sessions.forEach(s => { if (s.sessionType) map[s._id] = s.sessionType; });
    try { localStorage.setItem(_TYPE_KEY, JSON.stringify(map)); } catch(e) {}
}

function _loadTypeMap() {
    try { return JSON.parse(localStorage.getItem(_TYPE_KEY) || '{}'); } catch(e) { return {}; }
}

function _applyTypeMap(sessions) {
    const map = _loadTypeMap();
    sessions.forEach(s => {
        if (!s.sessionType || s.sessionType === 'regular') {
            s.sessionType = map[s._id] || 'regular';
        }
    });
}

// ─── Register local persistence ───────────────────────────────
function _getRegKey() {
    const user = getCurrentUser();
    return `clb_register_${user?.id || 'guest'}`;
}
function _loadRegisterSet() {
    try { return JSON.parse(localStorage.getItem(_getRegKey()) || '{}'); } catch(e) { return {}; }
}
function _saveRegisterSet() {
    try { localStorage.setItem(_getRegKey(), JSON.stringify(_registerSet)); } catch(e) {}
}
function _isRegistered(sessionId) {
    return !!_registerSet[sessionId];
}
document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();
    initLayout('sessions');
    initRoleRestrictions();

    if (!isAdmin()) {
        document.getElementById('btnAddSession')?.remove();
    }

    document.getElementById('searchInput').addEventListener('input', (e) => {
        _searchKeyword = e.target.value.trim().toLowerCase();
        _currentPage = 1;
        renderSessions();
    });

    // Tab filter buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _filterType = btn.dataset.type;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _currentPage = 1;
            renderSessions();
        });
    });

    await loadAll();

    // Chỉ đóng detailModal khi bấm nút X, không đóng khi click nền overlay
    document.getElementById('detailModal')?.addEventListener('click', (e) => {
        e.stopPropagation();
    });
});

// ─── Load data ────────────────────────────────────────────────
// Sync _registerSet từ attendance server
// Nếu user đã có attendance record (dù không bấm đăng ký) thì mark là registered
async function _syncRegisterFromAttendance() {
    const user = getCurrentUser();
    if (!user) return;
    try {
        // Lấy tất cả attendance records của user hiện tại
        const allAtt = await AttendanceAPI.getAll();
        if (!Array.isArray(allAtt)) return;
        allAtt.forEach(a => {
            const memberId = a.memberId?._id || a.memberId;
            if (memberId === user.id) {
                const sessionId = a.sessionId?._id || a.sessionId;
                if (sessionId) {
                    _registerSet[sessionId] = true;
                    // Cache vào attendanceMap luôn
                    if (!_attendanceMap[sessionId]) _attendanceMap[sessionId] = [];
                    const exists = _attendanceMap[sessionId].find(x => x._id === a._id);
                    if (!exists) _attendanceMap[sessionId].push(a);
                }
            }
        });
        _saveRegisterSet();
    } catch(e) {
        // Không block nếu API lỗi
    }
}

async function loadAll() {
    showLoading();
    try {
        const [sessions, membersRes, roleSessions] = await Promise.all([
            SessionAPI.getAll(),
            MemberAPI.getAll(1, 1000),
            RoleSessionAPI.getAll(),
        ]);
        _sessions     = sessions || [];
        _members      = (membersRes && membersRes.members)
            ? membersRes.members
            : (Array.isArray(membersRes) ? membersRes : []);
        _roleSessions = roleSessions || [];

        // Khôi phục sessionType từ localStorage (vì backend chưa lưu field này)
        _applyTypeMap(_sessions);

        // Khôi phục trạng thái đăng ký từ localStorage
        _registerSet = _loadRegisterSet();

        // Sync _registerSet từ attendance data thực tế trên server
        // (trường hợp admin đã điểm danh nhưng user chưa bấm đăng ký)
        await _syncRegisterFromAttendance();

        renderStats();

        // Hiện/ẩn tab "Đứng lớp" tuỳ theo user có buổi nào đứng lớp không
        const user = getCurrentUser();
        const btnInstructor = document.getElementById('btnFilterInstructor');
        if (user && btnInstructor) {
            const hasInstructorSession = _sessions.some(s =>
                _populateInstructors(s.instructors).some(i =>
                    (i.memberId?._id || i.memberId) === user.id)
            );
            btnInstructor.style.display = hasInstructorSession ? '' : 'none';
        }

        // Render sau khi _registerSet đã sync đầy đủ → tab "Đã đăng ký" mặc định đúng
        renderSessions();
    } catch (err) {
        showToast('Không thể tải dữ liệu: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}

// ─── Helper: populate instructors từ _members/_roleSessions ──
// Backend có thể trả về instructor chưa populate (chỉ là ObjectId string)
// => ta tự map lại từ cache local
function _populateInstructors(instructors) {
    return (instructors || []).map(i => {
        const memberIdRaw     = i.memberId?._id     || i.memberId;
        const roleSessionIdRaw = i.roleSessionId?._id || i.roleSessionId;

        const memberObj     = (i.memberId && typeof i.memberId === 'object')
            ? i.memberId
            : _members.find(m => m._id === memberIdRaw) || null;

        const roleObj       = (i.roleSessionId && typeof i.roleSessionId === 'object')
            ? i.roleSessionId
            : _roleSessions.find(r => r._id === roleSessionIdRaw) || null;

        return { memberId: memberObj, roleSessionId: roleObj };
    });
}

// ─── Render stats ─────────────────────────────────────────────
function renderStats() {
    const total    = _sessions.length;
    const regular  = _sessions.filter(s => s.sessionType !== 'other').length;
    const other    = _sessions.filter(s => s.sessionType === 'other').length;
    const now      = new Date();
    const upcoming = _sessions.filter(s => new Date(s.sessionDate) > now).length;

    document.getElementById('sessionStats').innerHTML = `
        <div class="stat-chip">
            <span class="stat-chip-icon">📅</span>
            <div>
                <div class="stat-chip-value">${total}</div>
                <div class="stat-chip-label">Tổng buổi</div>
            </div>
        </div>
        <div class="stat-chip stat-chip-blue">
            <span class="stat-chip-icon">📌</span>
            <div>
                <div class="stat-chip-value">${regular}</div>
                <div class="stat-chip-label">Sinh hoạt cố định</div>
            </div>
        </div>
        <div class="stat-chip stat-chip-orange">
            <span class="stat-chip-icon">🎯</span>
            <div>
                <div class="stat-chip-value">${other}</div>
                <div class="stat-chip-label">Hoạt động khác</div>
            </div>
        </div>
        <div class="stat-chip stat-chip-green">
            <span class="stat-chip-icon">🔜</span>
            <div>
                <div class="stat-chip-value">${upcoming}</div>
                <div class="stat-chip-label">Sắp diễn ra</div>
            </div>
        </div>
    `;
}

// ─── Render session cards ──────────────────────────────────────
function renderSessions() {
    const grid  = document.getElementById('sessionsGrid');
    const empty = document.getElementById('emptyState');

    const user = getCurrentUser();

    let filtered = _sessions.filter(s => {
        const matchSearch = !_searchKeyword ||
            s.sessionName.toLowerCase().includes(_searchKeyword) ||
            (s.location || '').toLowerCase().includes(_searchKeyword);

        let matchType = true;
        if (_filterType === 'registered') {
            matchType = _isRegistered(s._id);
        } else if (_filterType === 'instructor') {
            matchType = user && _populateInstructors(s.instructors).some(i =>
                (i.memberId?._id || i.memberId) === user.id);
        } else if (_filterType === 'regular') {
            matchType = s.sessionType !== 'other';
        } else if (_filterType === 'other') {
            matchType = s.sessionType === 'other';
        }
        // 'all' → matchType = true (giữ nguyên)

        return matchSearch && matchType;
    });

    filtered.sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate));

    if (!filtered.length) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        renderPagination(0, 0);
        return;
    }

    empty.style.display = 'none';

    // Clamp page
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (_currentPage > totalPages) _currentPage = totalPages;
    if (_currentPage < 1) _currentPage = 1;

    const start  = (_currentPage - 1) * PAGE_SIZE;
    const paged  = filtered.slice(start, start + PAGE_SIZE);
    const now    = new Date();

    grid.innerHTML = paged.map(s => {
        const date     = new Date(s.sessionDate);
        const isPast   = date < now;
        const dateStr  = formatDateTime(s.sessionDate);
        const isOther  = s.sessionType === 'other';

        // Populate instructors cục bộ nếu backend chưa trả về object
        const populatedInstrs = _populateInstructors(s.instructors);
        const instructorNames = populatedInstrs
            .map(i => {
                const m = i.memberId, r = i.roleSessionId;
                if (!m) return null;
                const name = m.fullName || m.mssv || '?';
                const role = r ? r.roleSessionName : '';
                return role
                    ? `${escapeHtml(name)} <span class="instr-role">(${escapeHtml(role)})</span>`
                    : escapeHtml(name);
            })
            .filter(Boolean).join(', ');

        const adminActions = isAdmin() ? `
            <button class="card-action-btn" title="Sửa" onclick="openEditModal('${s._id}')">✏️</button>
            <button class="card-action-btn danger" title="Xóa" onclick="openDeleteModal('${s._id}', '${escapeHtml(s.sessionName)}')">🗑️</button>
        ` : '';

        const typeBadge = isOther
            ? `<span class="type-badge type-other">🎯 Hoạt động khác</span>`
            : `<span class="type-badge type-regular">📌 Cố định</span>`;

        return `
        <div class="session-card ${isPast ? 'past' : 'upcoming'} ${isOther ? 'card-other' : 'card-regular'}"
             onclick="openDetailModal('${s._id}')">
            <div class="session-card-header">
                <div class="session-card-date">
                    <span class="date-day">${date.getDate().toString().padStart(2,'0')}</span>
                    <span class="date-month">Tháng ${date.getMonth() + 1}</span>
                    <span class="date-year">${date.getFullYear()}</span>
                </div>
                <div class="session-card-actions" onclick="event.stopPropagation()">
                    <button class="card-action-btn info" title="Xem điểm danh" onclick="openDetailModal('${s._id}')">👁️</button>
                    ${adminActions}
                </div>
            </div>
            <div class="session-card-body">
                <div class="session-card-name">${escapeHtml(s.sessionName)}</div>
                <div class="session-card-meta">
                    <span>🕐 ${dateStr}</span>
                    ${s.location ? `<span>📍 ${escapeHtml(s.location)}</span>` : ''}
                    ${s.maxParticipants ? `<span>👥 Tối đa ${s.maxParticipants} người</span>` : ''}
                </div>
                ${instructorNames ? `<div class="session-card-instructors">🎓 ${instructorNames}</div>` : ''}
            </div>
            <div class="session-card-footer">
                ${typeBadge}
                <span class="session-status-badge ${isPast ? 'badge-secondary' : 'badge-success'}">
                    ${isPast ? '✅ Đã diễn ra' : '🔜 Sắp diễn ra'}
                </span>
                ${!isPast ? `<button class="btn-register ${_isRegistered(s._id) ? 'registered' : ''}"
                    onclick="event.stopPropagation(); toggleRegister('${s._id}', this)"
                    onmouseenter="if(this.classList.contains('registered')){this.dataset.orig=this.textContent;this.textContent='❌ Hủy đăng ký';}"
                    onmouseleave="if(this.dataset.orig){this.textContent=this.dataset.orig;delete this.dataset.orig;}">
                    ${_isRegistered(s._id) ? '✅ Đã đăng ký' : '📝 Đăng ký'}
                </button>` : ''}
            </div>
        </div>`;
    }).join('');

    renderPagination(filtered.length, totalPages);
}

// ─── Pagination ────────────────────────────────────────────────
function renderPagination(total, totalPages) {
    let container = document.getElementById('sessionsPagination');
    if (!container) {
        container = document.createElement('div');
        container.id = 'sessionsPagination';
        container.className = 'sessions-pagination';
        document.getElementById('sessionsGrid').after(container);
    }

    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const start = (_currentPage - 1) * PAGE_SIZE + 1;
    const end   = Math.min(_currentPage * PAGE_SIZE, total);

    let btns = '';

    // Prev
    btns += `<button class="pagination-btn" ${_currentPage === 1 ? 'disabled' : ''}
        onclick="gotoPage(${_currentPage - 1})">‹</button>`;

    // Page numbers with smart ellipsis
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || Math.abs(p - _currentPage) <= 1) {
            btns += `<button class="pagination-btn ${p === _currentPage ? 'active' : ''}"
                onclick="gotoPage(${p})">${p}</button>`;
        } else if (Math.abs(p - _currentPage) === 2) {
            btns += `<span class="pagination-ellipsis">…</span>`;
        }
    }

    // Next
    btns += `<button class="pagination-btn" ${_currentPage === totalPages ? 'disabled' : ''}
        onclick="gotoPage(${_currentPage + 1})">›</button>`;

    container.innerHTML = `
        <span class="pagination-info">Hiển thị ${start}–${end} / ${total} buổi</span>
        <div class="pagination">${btns}</div>`;
}

function gotoPage(p) {
    _currentPage = p;
    renderSessions();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Modal: Thêm/Sửa ──────────────────────────────────────────
function openAddModal() {
    document.getElementById('sessionModalTitle').textContent = 'Thêm buổi sinh hoạt';
    document.getElementById('sessionId').value               = '';
    document.getElementById('sessionName').value             = '';
    document.getElementById('sessionDateOnly').value         = '';
    document.getElementById('sessionStartTime').value        = '';
    document.getElementById('sessionEndTime').value          = '';
    document.getElementById('sessionLocation').value         = '';
    document.getElementById('sessionMaxParticipants').value  = '';
    document.getElementById('sessionDescription').value      = '';
    // reset radio to regular
    document.querySelectorAll('input[name="sessionType"]').forEach(r => r.checked = r.value === 'regular');
    document.querySelectorAll('.type-radio-option').forEach(o => o.classList.toggle('selected', o.querySelector('input').value === 'regular'));
    document.getElementById('instructorsList').innerHTML = '';
    openModal('sessionModal');
}

function openEditModal(id) {
    const s = _sessions.find(x => x._id === id);
    if (!s) return;

    document.getElementById('sessionModalTitle').textContent = 'Sửa buổi sinh hoạt';
    document.getElementById('sessionId').value              = s._id;
    document.getElementById('sessionName').value            = s.sessionName || '';
    document.getElementById('sessionLocation').value        = s.location || '';
    document.getElementById('sessionMaxParticipants').value = s.maxParticipants || '';
    document.getElementById('sessionDescription').value     = s.description || '';
    const sType = s.sessionType || 'regular';
    document.querySelectorAll('input[name="sessionType"]').forEach(r => r.checked = r.value === sType);
    document.querySelectorAll('.type-radio-option').forEach(o => o.classList.toggle('selected', o.querySelector('input').value === sType));

    const pad = n => String(n).padStart(2,'0');
    if (s.sessionDate) {
        const d = new Date(s.sessionDate);
        document.getElementById('sessionDateOnly').value  = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        document.getElementById('sessionStartTime').value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else {
        document.getElementById('sessionDateOnly').value  = '';
        document.getElementById('sessionStartTime').value = '';
    }
    const endMap = _loadEndTimeMap();
    document.getElementById('sessionEndTime').value = endMap[s._id] || '';

    const list = document.getElementById('instructorsList');
    list.innerHTML = '';
    (s.instructors || []).forEach(instr => {
        addInstructorRow(
            instr.memberId?._id || instr.memberId,
            instr.roleSessionId?._id || instr.roleSessionId
        );
    });

    openModal('sessionModal');
}

function addInstructorRow(memberId = '', roleSessionId = '') {
    const list = document.getElementById('instructorsList');
    const row  = document.createElement('div');
    row.className = 'instructor-row';

    const memberOptions = _members.map(m =>
        `<option value="${m._id}" ${m._id === memberId ? 'selected':''}>${escapeHtml(m.fullName || m.mssv)}</option>`
    ).join('');

    const roleOptions = _roleSessions.map(r =>
        `<option value="${r._id}" ${r._id === roleSessionId ? 'selected':''}>${escapeHtml(r.roleSessionName)}</option>`
    ).join('');

    row.innerHTML = `
        <select class="form-control instr-member">
            <option value="">-- Chọn thành viên --</option>
            ${memberOptions}
        </select>
        <select class="form-control instr-role-session">
            <option value="">-- Vai trò --</option>
            ${roleOptions}
        </select>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
    `;
    list.appendChild(row);
}

// ─── EndTime local persistence (backend chưa có field endTime) ──
const _END_KEY = 'clb_session_endtimes';
function _loadEndTimeMap() {
    try { return JSON.parse(localStorage.getItem(_END_KEY) || '{}'); } catch(e) { return {}; }
}
function _saveEndTime(sessionId, endTime) {
    const map = _loadEndTimeMap();
    if (endTime) map[sessionId] = endTime;
    else delete map[sessionId];
    try { localStorage.setItem(_END_KEY, JSON.stringify(map)); } catch(e) {}
}

async function saveSession() {
    const id   = document.getElementById('sessionId').value;
    const name = document.getElementById('sessionName').value.trim();

    if (!name) { showToast('Vui lòng nhập tên buổi sinh hoạt', 'warning'); return; }

    const instructors = [];
    document.querySelectorAll('.instructor-row').forEach(row => {
        const memberId      = row.querySelector('.instr-member').value;
        const roleSessionId = row.querySelector('.instr-role-session').value;
        if (memberId) {
            const obj = { memberId };
            if (roleSessionId) obj.roleSessionId = roleSessionId;
            instructors.push(obj);
        }
    });

    const payload = {
        sessionName:     name,
        location:        document.getElementById('sessionLocation').value.trim(),
        maxParticipants: Number(document.getElementById('sessionMaxParticipants').value) || 50,
        sessionType:     document.querySelector('input[name="sessionType"]:checked')?.value || 'regular',
        description:     document.getElementById('sessionDescription').value.trim(),
        instructors,
    };

    // Ghép ngày + giờ bắt đầu thành sessionDate
    const dateOnly  = document.getElementById('sessionDateOnly').value;
    const startTime = document.getElementById('sessionStartTime').value;
    const endTime   = document.getElementById('sessionEndTime').value;
    if (dateOnly) {
        const combined = startTime ? `${dateOnly}T${startTime}` : `${dateOnly}T00:00`;
        payload.sessionDate = new Date(combined).toISOString();
    }

    showLoading();
    try {
        if (id) {
            const updated = await SessionAPI.update(id, payload);
            updated.sessionType  = payload.sessionType;
            updated.description  = payload.description;
            updated.instructors  = _mergeInstructorObjects(updated.instructors, instructors);
            const idx = _sessions.findIndex(s => s._id === id);
            if (idx !== -1) _sessions[idx] = updated;
            _saveTypeMap();
            _saveEndTime(id, endTime);
            showToast('Cập nhật buổi sinh hoạt thành công!', 'success');
        } else {
            const created = await SessionAPI.create(payload);
            created.sessionType  = payload.sessionType;
            created.description  = payload.description;
            created.instructors  = _mergeInstructorObjects(created.instructors, instructors);
            _sessions.unshift(created);
            _saveTypeMap();
            _saveEndTime(created._id, endTime);
            showToast('Thêm buổi sinh hoạt thành công!', 'success');
        }
        closeModal('sessionModal');
        renderStats();
        renderSessions();
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}

// Merge: nếu backend trả về instructor chưa populate, ta tự map từ cache
function _mergeInstructorObjects(backendInstrs, formInstrs) {
    return (backendInstrs || formInstrs || []).map((instr, idx) => {
        const memberIdRaw      = instr.memberId?._id      || instr.memberId;
        const roleSessionIdRaw = instr.roleSessionId?._id || instr.roleSessionId;

        const memberObj  = (instr.memberId && typeof instr.memberId === 'object')
            ? instr.memberId
            : _members.find(m => m._id === memberIdRaw) || null;

        const roleObj    = (instr.roleSessionId && typeof instr.roleSessionId === 'object')
            ? instr.roleSessionId
            : _roleSessions.find(r => r._id === roleSessionIdRaw) || null;

        return { memberId: memberObj, roleSessionId: roleObj };
    });
}

// ─── Đăng ký tham gia ─────────────────────────────────────────
async function toggleRegister(sessionId, btn) {
    const user = getCurrentUser();
    if (!user) { showToast('Vui lòng đăng nhập lại.', 'warning'); return; }

    const alreadyReg = _isRegistered(sessionId);

    if (alreadyReg) {
        // Hủy đăng ký
        _registerSet[sessionId] = false;
        _saveRegisterSet();

        // Xóa khỏi participateSet local
        if (_participateSet[sessionId]) {
            _participateSet[sessionId].delete(user.id);
        }

        // Nếu có record attendance thì xóa trên server
        const existing = _attendanceMap[sessionId] || [];
        const rec = existing.find(a => (a.memberId?._id || a.memberId) === user.id);
        if (rec) {
            try { await AttendanceAPI.delete(rec._id); } catch(e) {}
            _attendanceMap[sessionId] = existing.filter(a => a._id !== rec._id);
        }

        btn.className = 'btn-register';
        btn.textContent = '📝 Đăng ký';
        showToast('Đã hủy đăng ký buổi sinh hoạt.', 'info');
    } else {
        // Đăng ký
        _registerSet[sessionId] = true;
        _saveRegisterSet();

        // Thêm vào participateSet local ngay
        if (!_participateSet[sessionId]) _participateSet[sessionId] = new Set();
        _participateSet[sessionId].add(user.id);

        // Tạo record attendance trên server (status mặc định Vắng — admin sẽ điểm danh sau)
        try {
            const existing = _attendanceMap[sessionId] || [];
            const alreadyHas = existing.find(a => (a.memberId?._id || a.memberId) === user.id);
            if (!alreadyHas) {
                const rec = await AttendanceAPI.mark({ sessionId, memberId: user.id, status: 'Vắng', note: '' });
                _attendanceMap[sessionId] = [...existing, rec];
            }
        } catch(e) {
            // Không block UX nếu API lỗi — local state vẫn lưu
        }

        btn.className = 'btn-register registered';
        btn.textContent = '✅ Đã đăng ký';
        showToast('Đăng ký tham gia thành công! 🎉', 'success');
    }
}


function openDeleteModal(id, name) {
    _deleteId = id;
    document.getElementById('deleteSessionName').textContent = name;
    openModal('deleteModal');
}

async function confirmDelete() {
    if (!_deleteId) return;
    showLoading();
    try {
        await SessionAPI.delete(_deleteId);
        _sessions = _sessions.filter(s => s._id !== _deleteId);
        delete _attendanceMap[_deleteId];
        delete _participateSet[_deleteId];
        _deleteId = null;
        closeModal('deleteModal');
        renderStats();
        renderSessions();
        showToast('Đã xóa buổi sinh hoạt!', 'success');
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}

// ─── Detail + Attendance ──────────────────────────────────────
async function openDetailModal(sessionId) {
    const session = _sessions.find(s => s._id === sessionId);
    if (!session) return;

    _currentSessionId = sessionId;
    _attSearchKeyword = '';
    _attSortAZ        = true;
    _statusCache      = {};
    _attCurrentPage   = 1;
    // Reset UI controls
    const attSearchInput = document.getElementById('attSearchInput');
    if (attSearchInput) attSearchInput.value = '';
    const btnSort = document.getElementById('btnAttSortAZ');
    if (btnSort) btnSort.classList.add('active');

    const populatedInstrs = _populateInstructors(session.instructors);
    const instructorHtml  = populatedInstrs.map(i => {
        const m = i.memberId, r = i.roleSessionId;
        if (!m) return '';
        const name = m.fullName || m.mssv || '?';
        const role = r ? r.roleSessionName : '';
        return `<span class="instr-tag">${escapeHtml(name)}${role ? ` <em>(${escapeHtml(role)})</em>` : ''}</span>`;
    }).join('');

    const isOther   = session.sessionType === 'other';
    const typeLabel = isOther
        ? `<span class="type-badge type-other" style="font-size:.8rem;">🎯 Hoạt động khác</span>`
        : `<span class="type-badge type-regular" style="font-size:.8rem;">📌 Sinh hoạt cố định</span>`;

    document.getElementById('detailModalTitle').textContent = session.sessionName;

    // Lấy giờ kết thúc từ localStorage
    const endMap  = _loadEndTimeMap();
    const endTime = endMap[session._id] || '';
    // Format ngày + giờ
    const sessionD = session.sessionDate ? new Date(session.sessionDate) : null;
    const pad = n => String(n).padStart(2,'0');
    const dateStr   = sessionD ? `${pad(sessionD.getDate())}/${pad(sessionD.getMonth()+1)}/${sessionD.getFullYear()}` : '—';
    const startStr  = sessionD ? `${pad(sessionD.getHours())}:${pad(sessionD.getMinutes())}` : '—';
    const endStr    = endTime || '—';

    document.getElementById('sessionDetailInfo').innerHTML = `
        <div class="detail-info-grid">
            <div class="detail-info-item">
                <span class="detail-info-label">📅 Ngày tổ chức</span>
                <span class="detail-info-value">${dateStr}</span>
            </div>
            <div class="detail-info-item">
                <span class="detail-info-label">📍 Địa điểm</span>
                <span class="detail-info-value">${escapeHtml(session.location || '—')}</span>
            </div>
            <div class="detail-info-item">
                <span class="detail-info-label">🕐 Giờ bắt đầu</span>
                <span class="detail-info-value">${startStr}</span>
            </div>
            <div class="detail-info-item">
                <span class="detail-info-label">🕔 Giờ kết thúc</span>
                <span class="detail-info-value">${endStr}</span>
            </div>
            <div class="detail-info-item">
                <span class="detail-info-label">👥 Số lượng tối đa</span>
                <span class="detail-info-value">${session.maxParticipants || '—'} người</span>
            </div>
            <div class="detail-info-item">
                <span class="detail-info-label">🏷️ Loại buổi</span>
                <span class="detail-info-value">${typeLabel}</span>
            </div>
            <div class="detail-info-item" style="grid-column: 1 / -1;">
                <span class="detail-info-label">🎓 Người phụ trách</span>
                <span class="detail-info-value">${instructorHtml || '—'}</span>
            </div>
            ${session.description ? `
            <div class="detail-info-item" style="grid-column: 1 / -1;">
                <span class="detail-info-label">📝 Mô tả</span>
                <span class="detail-info-value detail-description">${escapeHtml(session.description)}</span>
            </div>` : ''}
        </div>
    `;

    openModal('detailModal');

    // Hiện/ẩn nút quản lý điểm danh dựa trên quyền người phụ trách
    const canManage = canManageAttendance(sessionId);
    const actionsEl  = document.getElementById('attendanceActions');
    const footerBtn  = document.getElementById('footerSaveBtn');
    if (actionsEl)  actionsEl.style.display  = canManage ? 'flex' : 'none';
    if (footerBtn)  footerBtn.style.display  = canManage ? ''     : 'none';

    await loadAttendance(sessionId);
}

async function loadAttendance(sessionId) {
    document.getElementById('attendanceBody').innerHTML =
        `<tr><td colspan="5" style="text-align:center;color:#bbb;padding:1.5rem;">Đang tải điểm danh...</td></tr>`;
    document.getElementById('attendanceChartArea').innerHTML = '';

    try {
        let attendance = _attendanceMap[sessionId];
        if (!attendance) {
            attendance = await AttendanceAPI.getBySession(sessionId);
            _attendanceMap[sessionId] = attendance;
        }

        const attByMember = {};
        (attendance || []).forEach(a => {
            const mid = a.memberId?._id || a.memberId;
            attByMember[mid] = a;
            if (a.status) _statusCache[mid] = a.status;
        });

        if (!_participateSet[sessionId]) {
            _participateSet[sessionId] = new Set(Object.keys(attByMember));
        }

        // Nếu user hiện tại đã đăng ký thông thường, đảm bảo họ có trong participateSet
        const user = getCurrentUser();
        if (user && _isRegistered(sessionId)) {
            _participateSet[sessionId].add(user.id);
        }

        // ── Tự động đăng ký + điểm danh "Có mặt" cho tất cả người phụ trách ──
        const session = _sessions.find(s => s._id === sessionId);
        if (session) {
            const populated = _populateInstructors(session.instructors);
            for (const instr of populated) {
                const instrMember = instr.memberId;
                if (!instrMember) continue;
                const instrId = instrMember._id || instrMember;

                // Chỉ xử lý nếu chưa có attendance record
                if (!attByMember[instrId]) {
                    try {
                        const rec = await AttendanceAPI.mark({
                            sessionId,
                            memberId: instrId,
                            status: 'Có mặt',
                            note: ''
                        });
                        attByMember[instrId] = rec;
                        _attendanceMap[sessionId] = [...(_attendanceMap[sessionId] || []), rec];
                        _statusCache[instrId] = 'Có mặt';
                    } catch(e) {
                        // Không block nếu API lỗi
                    }
                } else if (attByMember[instrId].status !== 'Có mặt' && !_statusCache[instrId]) {
                    // Nếu đã có record nhưng status chưa được cache, ưu tiên giữ nguyên
                    _statusCache[instrId] = attByMember[instrId].status;
                }

                // Đảm bảo instructor luôn có trong participateSet
                _participateSet[sessionId].add(instrId);

                // Đánh dấu instructor đã đăng ký trong _registerSet nếu đây là user hiện tại
                if (user && instrId === user.id) {
                    _registerSet[sessionId] = true;
                    _saveRegisterSet();
                }
            }
        }

        renderAttendanceTable(attByMember);

        // Cập nhật lại nút đăng ký bên ngoài card nếu instructor tự động được thêm
        renderSessions();
    } catch (err) {
        document.getElementById('attendanceBody').innerHTML =
            `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:1.5rem;">
                Lỗi tải điểm danh: ${escapeHtml(err.message)}
             </td></tr>`;
    }
}

// ─── Render attendance table ──────────────────────────────────
function renderAttendanceTable(attByMember) {
    const tbody  = document.getElementById('attendanceBody');
    const canMgr = canManageAttendance();
    const pSet  = _participateSet[_currentSessionId] || new Set();

    // Chỉ hiển thị thành viên đã đăng ký (có trong pSet / attendance records)
    const registeredMembers = _members.filter(m => pSet.has(m._id));

    if (!registeredMembers.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#bbb;padding:2rem;">
            Chưa có thành viên nào đăng ký buổi này.
        </td></tr>`;
        updateAttendanceStats();
        renderAttendanceChart();
        renderAttendancePagination(0, 1);
        return;
    }

    // Trước khi render lại, lưu giá trị hiện tại của các select đang có trong DOM vào cache
    document.querySelectorAll('.att-status').forEach(sel => {
        _statusCache[sel.dataset.member] = sel.value;
    });

    // Lọc và sắp xếp
    let displayMembers = [...registeredMembers];
    if (_attSearchKeyword) {
        const kw = _attSearchKeyword.toLowerCase();
        displayMembers = displayMembers.filter(m =>
            (m.fullName || '').toLowerCase().includes(kw) ||
            (m.mssv || '').toLowerCase().includes(kw)
        );
    }
    if (_attSortAZ) {
        const getFirstName = name => {
            if (!name) return '';
            const parts = name.trim().split(/\s+/);
            return parts[parts.length - 1];
        };
        displayMembers = [...displayMembers].sort((a, b) =>
            getFirstName(a.fullName || a.mssv || '').localeCompare(
                getFirstName(b.fullName || b.mssv || ''), 'vi'
            )
        );
    }

    // ── Phân trang ──
    const attTotal      = displayMembers.length;
    const attTotalPages = Math.ceil(attTotal / ATT_PAGE_SIZE) || 1;
    if (_attCurrentPage > attTotalPages) _attCurrentPage = attTotalPages;
    if (_attCurrentPage < 1) _attCurrentPage = 1;
    const attStart     = (_attCurrentPage - 1) * ATT_PAGE_SIZE;
    const pagedMembers = displayMembers.slice(attStart, attStart + ATT_PAGE_SIZE);

    tbody.innerHTML = pagedMembers.map((m, idx) => {
        const mid    = m._id;
        const rec    = attByMember[mid];
        const status = _statusCache[mid] || rec?.status || 'Vắng';
        const note   = rec?.note || '';

        const statusColor = status === 'Có mặt' ? 'badge-success' : status === 'Có phép' ? 'badge-warning' : 'badge-danger';
        const statusCell  = canMgr
            ? `<select class="form-control form-control-sm att-status" data-member="${mid}">
                    <option value="Có mặt"  ${status==='Có mặt' ?'selected':''}>✅ Có mặt</option>
                    <option value="Vắng"    ${status==='Vắng'   ?'selected':''}>❌ Vắng</option>
                    <option value="Có phép" ${status==='Có phép'?'selected':''}>📋 Có phép</option>
               </select>`
            : `<span class="badge ${statusColor}">${status}</span>`;

        const noteCell = canMgr
            ? `<input type="text" class="form-control form-control-sm att-note" data-member="${mid}" value="${escapeHtml(note)}" placeholder="Ghi chú..." />`
            : `<span>${escapeHtml(note) || '—'}</span>`;

        // Nút hủy đăng ký (chỉ người phụ trách mới thấy)
        const cancelBtn = canMgr
            ? `<button class="btn-unregister" title="Hủy đăng ký" onclick="adminUnregisterMember('${mid}')">✕</button>`
            : '';

        return `
        <tr>
            <td>${attStart + idx + 1}</td>
            <td><code>${escapeHtml(m.mssv)}</code></td>
            <td>
                <div class="member-cell">
                    <div class="member-avatar-sm">${getInitials(m.fullName || m.mssv)}</div>
                    <span>${escapeHtml(m.fullName || m.mssv)}</span>
                    ${cancelBtn}
                </div>
            </td>
            <td>${statusCell}</td>
            <td>${noteCell}</td>
        </tr>`;
    }).join('');

    updateAttendanceStats();
    renderAttendanceChart();
    renderAttendancePagination(attTotal, attTotalPages);

    if (canMgr) {
        tbody.querySelectorAll('.att-status').forEach(sel => {
            sel.addEventListener('change', () => { updateAttendanceStats(); renderAttendanceChart(); });
        });
    }
}

// ─── Admin: Đăng ký cho người khác ───────────────────────────
let _adminRegisterSelected = new Set(); // memberId được chọn để đăng ký

function openAdminRegisterModal() {
    if (!_currentSessionId) return;
    if (!canManageAttendance()) { showToast('Bạn không có quyền đăng ký cho người khác.', 'warning'); return; }
    _adminRegisterSelected = new Set();

    // Tìm danh sách thành viên CHƯA đăng ký
    const pSet = _participateSet[_currentSessionId] || new Set();
    const unregistered = _members.filter(m => !pSet.has(m._id));

    document.getElementById('adminRegisterSearch').value = '';
    _renderAdminRegisterList(unregistered);
    openModal('adminRegisterModal');
}

function _renderAdminRegisterList(members) {
    const container = document.getElementById('adminRegisterList');
    if (!members.length) {
        container.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--muted);">Tất cả thành viên đã đăng ký rồi.</div>`;
        return;
    }
    container.innerHTML = members.map(m => {
        const checked = _adminRegisterSelected.has(m._id) ? 'checked' : '';
        return `
        <label class="admin-reg-item" style="display:flex;align-items:center;gap:.75rem;padding:.65rem 1rem;cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s;"
            onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background=''">
            <input type="checkbox" ${checked} value="${m._id}"
                onchange="toggleAdminRegisterItem('${m._id}', this.checked)"
                style="width:16px;height:16px;accent-color:var(--primary);flex-shrink:0;" />
            <div class="member-avatar-sm" style="flex-shrink:0;">${getInitials(m.fullName || m.mssv)}</div>
            <div>
                <div style="font-weight:600;font-size:.9rem;">${escapeHtml(m.fullName || m.mssv)}</div>
                <div style="font-size:.78rem;color:var(--muted);">MSSV: ${escapeHtml(m.mssv)}</div>
            </div>
        </label>`;
    }).join('');
}

function toggleAdminRegisterItem(memberId, checked) {
    checked ? _adminRegisterSelected.add(memberId) : _adminRegisterSelected.delete(memberId);
}

function filterAdminRegisterList(keyword) {
    const pSet = _participateSet[_currentSessionId] || new Set();
    const kw   = keyword.trim().toLowerCase();
    const unregistered = _members.filter(m => !pSet.has(m._id));
    const filtered = kw
        ? unregistered.filter(m =>
            (m.fullName || '').toLowerCase().includes(kw) ||
            (m.mssv || '').toLowerCase().includes(kw))
        : unregistered;
    _renderAdminRegisterList(filtered);
}

async function confirmAdminRegister() {
    if (!_adminRegisterSelected.size) {
        showToast('Vui lòng chọn ít nhất một thành viên.', 'warning');
        return;
    }
    showLoading();
    try {
        const existing    = _attendanceMap[_currentSessionId] || [];
        const existingMap = {};
        existing.forEach(a => {
            const mid = a.memberId?._id || a.memberId;
            existingMap[mid] = a;
        });

        const pSet = _participateSet[_currentSessionId] || new Set();
        const promises = [];

        _adminRegisterSelected.forEach(memberId => {
            pSet.add(memberId);
            if (!existingMap[memberId]) {
                promises.push(AttendanceAPI.mark({ sessionId: _currentSessionId, memberId, status: 'Vắng', note: '' }));
            }
        });
        _participateSet[_currentSessionId] = pSet;

        const newRecs = await Promise.all(promises);
        newRecs.forEach(rec => {
            if (rec) _attendanceMap[_currentSessionId] = [...(_attendanceMap[_currentSessionId] || []), rec];
        });

        closeModal('adminRegisterModal');
        showToast(`Đã đăng ký ${_adminRegisterSelected.size} thành viên thành công!`, 'success');
        _adminRegisterSelected = new Set();
        _reRenderAttendance();
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}

// Hủy đăng ký một thành viên (admin)
async function adminUnregisterMember(memberId) {
    if (!canManageAttendance()) { showToast('Bạn không có quyền hủy đăng ký.', 'warning'); return; }
    if (!confirm('Bạn có chắc muốn hủy đăng ký thành viên này khỏi buổi sinh hoạt?')) return;
    showLoading();
    try {
        const pSet = _participateSet[_currentSessionId] || new Set();
        pSet.delete(memberId);
        _participateSet[_currentSessionId] = pSet;
        delete _statusCache[memberId];

        const existing = _attendanceMap[_currentSessionId] || [];
        const rec = existing.find(a => (a.memberId?._id || a.memberId) === memberId);
        if (rec) {
            await AttendanceAPI.delete(rec._id);
            _attendanceMap[_currentSessionId] = existing.filter(a => a._id !== rec._id);
        }

        showToast('Đã hủy đăng ký thành viên.', 'info');
        _reRenderAttendance();
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}

// ─── Stats ────────────────────────────────────────────────────
function _getStats() {
    const pSet = _participateSet[_currentSessionId] || new Set();
    let present = 0, absent = 0, excused = 0;

    // Sync cache từ DOM
    document.querySelectorAll('.att-status').forEach(sel => {
        _statusCache[sel.dataset.member] = sel.value;
    });

    pSet.forEach(mid => {
        const status = _statusCache[mid] || 'Vắng';
        if      (status === 'Có mặt')  present++;
        else if (status === 'Có phép') excused++;
        else                            absent++;
    });

    // total = số người đã đăng ký
    return { joined: pSet.size, present, absent, excused, total: pSet.size };
}

function updateAttendanceStats() {
    const { joined, present, absent, excused } = _getStats();
    document.getElementById('attCountJoined').textContent  = joined;
    document.getElementById('attCountPresent').textContent = present;
    document.getElementById('attCountAbsent').textContent  = absent;
    document.getElementById('attCountExcused').textContent = excused;
}

// ─── Biểu đồ ──────────────────────────────────────────────────
function renderAttendanceChart() {
    const area = document.getElementById('attendanceChartArea');
    if (!area) return;

    const { joined, present, absent, excused, total } = _getStats();

    if (joined === 0) {
        area.innerHTML = `<div class="chart-empty">Chưa có thành viên được đánh dấu tham gia.</div>`;
        return;
    }

    const notPresent    = absent + excused;
    const pctPresent    = Math.round((present    / joined) * 100);
    const pctAbsent     = Math.round((absent     / joined) * 100);
    const pctExcused    = Math.round((excused    / joined) * 100);
    const pctNotPresent = Math.round((notPresent / joined) * 100);

    area.innerHTML = `
    <div class="chart-layout">
        <div class="chart-donut-wrap">
            <div class="chart-section-title">Tỉ lệ điểm danh</div>
            ${buildDonut(present, absent, excused, joined)}
            <div class="donut-legend">
                <span><span class="legend-dot" style="background:var(--secondary)"></span>Có mặt</span>
                <span><span class="legend-dot" style="background:var(--danger)"></span>Vắng</span>
                <span><span class="legend-dot" style="background:var(--warning)"></span>Có phép</span>
            </div>
        </div>
        <div class="chart-bars-wrap">
            <div class="chart-section-title">Số liệu chi tiết (${joined} người tham gia)</div>
            ${buildBar('✅ Có mặt', present, joined, pctPresent, 'bar-present')}
            ${buildBar('❌ Vắng', absent, joined, pctAbsent, 'bar-absent')}
            ${buildBar('📋 Có phép', excused, joined, pctExcused, 'bar-excused')}
            ${buildBar('🚫 Vắng + Có phép', notPresent, joined, pctNotPresent, 'bar-notpresent')}
            <div class="chart-summary-row">
                <div class="chart-summary-card summary-present">
                    <div class="summary-val">${pctPresent}%</div>
                    <div class="summary-lbl">Tỉ lệ có mặt</div>
                </div>
                <div class="chart-summary-card summary-absent">
                    <div class="summary-val">${pctNotPresent}%</div>
                    <div class="summary-lbl">Vắng + Có phép</div>
                </div>
                <div class="chart-summary-card summary-joined">
                    <div class="summary-val">${joined} / ${total}</div>
                    <div class="summary-lbl">Người tham gia</div>
                </div>
            </div>
        </div>
    </div>`;
}

function buildBar(label, count, joined, pct, cls) {
    return `
    <div class="chart-bar-group">
        <div class="chart-bar-label">
            <span>${label}</span>
            <span class="chart-bar-count">${count} người</span>
        </div>
        <div class="chart-bar-track">
            <div class="chart-bar-fill ${cls}" style="width:${pct}%">
                ${pct > 8 ? `<span>${pct}%</span>` : ''}
            </div>
        </div>
        ${pct <= 8 ? `<span class="chart-bar-pct-out">${pct}%</span>` : ''}
    </div>`;
}

function buildDonut(present, absent, excused, joined) {
    const r     = 54;
    const cx    = 70;
    const cy    = 70;
    const circ  = 2 * Math.PI * r;

    const segP = circ * (present / joined);
    const segA = circ * (absent  / joined);
    const segE = circ * (excused / joined);

    const offP = 0;
    const offA = segP;
    const offE = segP + segA;

    const mainPct = Math.round((present / joined) * 100);

    const makeArc = (stroke, seg, off) => seg > 0.5 ? `
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
            stroke="${stroke}" stroke-width="18"
            stroke-dasharray="${seg} ${circ - seg}"
            stroke-dashoffset="${circ - off}"
            transform="rotate(-90 ${cx} ${cy})" />` : '';

    return `
    <svg class="donut-svg" viewBox="0 0 140 140" width="140" height="140">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f0f2f5" stroke-width="18"/>
        ${makeArc('var(--secondary)', segP, offP)}
        ${makeArc('var(--danger)',    segA, offA)}
        ${makeArc('var(--warning)',   segE, offE)}
        <text x="${cx}" y="${cy - 7}" text-anchor="middle" font-size="20" font-weight="800" fill="var(--dark)">${mainPct}%</text>
        <text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="9" fill="#aaa" font-weight="700">CÓ MẶT</text>
    </svg>`;
}

// ─── Điểm danh helpers ────────────────────────────────────────
function markAllPresent() {
    // Chỉ cập nhật status của người đã đăng ký, không thêm mới
    document.querySelectorAll('.att-status').forEach(sel => {
        sel.value = 'Có mặt';
        _statusCache[sel.dataset.member] = 'Có mặt';
    });

    // Cập nhật cache cho toàn bộ pSet (kể cả trang không hiển thị)
    const pSet = _participateSet[_currentSessionId] || new Set();
    pSet.forEach(mid => { _statusCache[mid] = 'Có mặt'; });

    updateAttendanceStats();
    renderAttendanceChart();
    showToast('Đã chọn "Có mặt" cho tất cả người đã đăng ký. Nhớ nhấn Lưu!', 'info');
}

async function saveAllAttendance() {
    if (!_currentSessionId) return;
    if (!canManageAttendance()) { showToast('Bạn không có quyền lưu điểm danh.', 'warning'); return; }

    const pSet = _participateSet[_currentSessionId] || new Set();

    if (!_members.length) { showToast('Không có thành viên nào.', 'warning'); return; }

    // Sync DOM → cache trước khi lưu
    document.querySelectorAll('.att-status').forEach(sel => {
        _statusCache[sel.dataset.member] = sel.value;
    });
    const noteMap = {};
    document.querySelectorAll('.att-note').forEach(inp => {
        noteMap[inp.dataset.member] = inp.value.trim();
    });

    showLoading();

    const existing    = _attendanceMap[_currentSessionId] || [];
    const existingMap = {};
    existing.forEach(a => {
        const mid = a.memberId?._id || a.memberId;
        existingMap[mid] = a;
    });

    const promises = [];

    // Lưu tất cả người trong pSet, dù có đang hiển thị trên DOM hay không
    pSet.forEach(memberId => {
        const status = _statusCache[memberId] || 'Vắng';
        const note   = noteMap[memberId] || '';
        const rec    = existingMap[memberId];

        if (rec) {
            if (rec.status !== status || (rec.note || '') !== note) {
                promises.push(AttendanceAPI.update(rec._id, { status, note }));
            }
        } else {
            promises.push(AttendanceAPI.mark({ sessionId: _currentSessionId, memberId, status, note }));
        }
    });

    // Xóa record của người không tham gia
    _members.forEach(m => {
        if (!pSet.has(m._id) && existingMap[m._id]) {
            promises.push(AttendanceAPI.delete(existingMap[m._id]._id));
        }
    });

    try {
        await Promise.all(promises);
        const fresh = await AttendanceAPI.getBySession(_currentSessionId);
        _attendanceMap[_currentSessionId] = fresh;

        const newPSet     = new Set();
        const attByMember = {};
        fresh.forEach(a => {
            const mid = a.memberId?._id || a.memberId;
            newPSet.add(mid);
            attByMember[mid] = a;
        });
        _participateSet[_currentSessionId] = newPSet;
        renderAttendanceTable(attByMember);

        showToast('Lưu điểm danh thành công!', 'success');
    } catch (err) {
        showToast('Lỗi lưu điểm danh: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}
// ─── Attendance pagination ─────────────────────────────────────
function renderAttendancePagination(total, totalPages) {
    const container = document.getElementById('attendancePagination');
    if (!container) return;

    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const start = (_attCurrentPage - 1) * ATT_PAGE_SIZE + 1;
    const end   = Math.min(_attCurrentPage * ATT_PAGE_SIZE, total);

    let btns = '';
    btns += `<button class="att-pg-btn" ${_attCurrentPage === 1 ? 'disabled' : ''}
        onclick="gotoAttPage(${_attCurrentPage - 1})">‹</button>`;

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || Math.abs(p - _attCurrentPage) <= 1) {
            btns += `<button class="att-pg-btn ${p === _attCurrentPage ? 'active' : ''}"
                onclick="gotoAttPage(${p})">${p}</button>`;
        } else if (Math.abs(p - _attCurrentPage) === 2) {
            btns += `<span class="att-pg-ellipsis">…</span>`;
        }
    }

    btns += `<button class="att-pg-btn" ${_attCurrentPage === totalPages ? 'disabled' : ''}
        onclick="gotoAttPage(${_attCurrentPage + 1})">›</button>`;

    container.innerHTML = `
        <span class="att-pg-info">Hiển thị ${start}–${end} / ${total} người</span>
        <div class="att-pg-btns">${btns}</div>`;
}

function gotoAttPage(p) {
    // Sync DOM status/note trước khi chuyển trang để không mất dữ liệu
    document.querySelectorAll('.att-status').forEach(sel => {
        _statusCache[sel.dataset.member] = sel.value;
    });
    document.querySelectorAll('.att-note').forEach(inp => {
        if (!inp.dataset.member) return;
        const att = (_attendanceMap[_currentSessionId] || []).find(a =>
            (a.memberId?._id || a.memberId) === inp.dataset.member);
        if (att) att.note = inp.value;
    });
    _attCurrentPage = p;
    _reRenderAttendance();
}

// ─── Attendance search & sort ─────────────────────────────────
function onAttSearchInput(val) {
    _attSearchKeyword = val.trim().toLowerCase();
    _attCurrentPage   = 1;
    _reRenderAttendance();
}

function toggleAttSortAZ() {
    _attSortAZ      = !_attSortAZ;
    _attCurrentPage = 1;
    const btn = document.getElementById('btnAttSortAZ');
    if (btn) btn.classList.toggle('active', _attSortAZ);
    _reRenderAttendance();
}

function _reRenderAttendance() {
    const attendance  = _attendanceMap[_currentSessionId] || [];
    const attByMember = {};
    attendance.forEach(a => {
        const id = a.memberId?._id || a.memberId;
        attByMember[id] = a;
    });

    // Preserve current DOM values before re-render
    const statusMap = {};
    const noteMap   = {};
    document.querySelectorAll('.att-status').forEach(sel => { statusMap[sel.dataset.member] = sel.value; });
    document.querySelectorAll('.att-note').forEach(inp   => { noteMap[inp.dataset.member]   = inp.value; });

    // Merge DOM values into attByMember
    Object.keys(statusMap).forEach(mid => {
        if (attByMember[mid]) {
            attByMember[mid].status = statusMap[mid];
            attByMember[mid].note   = noteMap[mid] || attByMember[mid].note;
        } else {
            attByMember[mid] = { memberId: mid, status: statusMap[mid], note: noteMap[mid] || '' };
        }
    });

    renderAttendanceTable(attByMember);
}