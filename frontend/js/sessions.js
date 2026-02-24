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
let _filterType       = 'all';   // 'all' | 'regular' | 'other'
let _currentPage      = 1;
const PAGE_SIZE       = 8;
let _participateSet   = {};      // { sessionId: Set<memberId> }


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

// ─── Init ─────────────────────────────────────────────────────
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
});

// ─── Load data ────────────────────────────────────────────────
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

        renderStats();
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

    let filtered = _sessions.filter(s => {
        const matchSearch = !_searchKeyword ||
            s.sessionName.toLowerCase().includes(_searchKeyword) ||
            (s.location || '').toLowerCase().includes(_searchKeyword);

        const matchType =
            _filterType === 'all'     ? true :
            _filterType === 'regular' ? s.sessionType !== 'other' :
            _filterType === 'other'   ? s.sessionType === 'other' : true;

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
    document.getElementById('sessionId').value       = '';
    document.getElementById('sessionName').value     = '';
    document.getElementById('sessionDate').value     = '';
    document.getElementById('sessionLocation').value = '';
    document.getElementById('sessionMaxParticipants').value = '';
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
    const sType = s.sessionType || 'regular';
    document.querySelectorAll('input[name="sessionType"]').forEach(r => r.checked = r.value === sType);
    document.querySelectorAll('.type-radio-option').forEach(o => o.classList.toggle('selected', o.querySelector('input').value === sType));

    if (s.sessionDate) {
        const d = new Date(s.sessionDate);
        const pad = n => String(n).padStart(2,'0');
        document.getElementById('sessionDate').value =
            `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else {
        document.getElementById('sessionDate').value = '';
    }

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
        instructors,
    };
    const dateVal = document.getElementById('sessionDate').value;
    if (dateVal) payload.sessionDate = new Date(dateVal).toISOString();

    showLoading();
    try {
        if (id) {
            const updated = await SessionAPI.update(id, payload);
            // Backend có thể không lưu sessionType (chưa có trong model) → ép lại từ form
            updated.sessionType  = payload.sessionType;
            updated.instructors  = _mergeInstructorObjects(updated.instructors, instructors);
            const idx = _sessions.findIndex(s => s._id === id);
            if (idx !== -1) _sessions[idx] = updated;
            _saveTypeMap();
            showToast('Cập nhật buổi sinh hoạt thành công!', 'success');
        } else {
            const created = await SessionAPI.create(payload);
            // Backend có thể không lưu sessionType → ép lại từ form
            created.sessionType  = payload.sessionType;
            created.instructors  = _mergeInstructorObjects(created.instructors, instructors);
            _sessions.unshift(created);
            _saveTypeMap();
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

// ─── Delete ───────────────────────────────────────────────────
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
    document.getElementById('sessionDetailInfo').innerHTML = `
        <div class="detail-info-grid">
            <div class="detail-info-item">
                <span class="detail-info-label">📅 Ngày tổ chức</span>
                <span class="detail-info-value">${formatDateTime(session.sessionDate)}</span>
            </div>
            <div class="detail-info-item">
                <span class="detail-info-label">📍 Địa điểm</span>
                <span class="detail-info-value">${escapeHtml(session.location || '—')}</span>
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
        </div>
    `;

    openModal('detailModal');
    await loadAttendance(sessionId);
}

async function loadAttendance(sessionId) {
    document.getElementById('attendanceBody').innerHTML =
        `<tr><td colspan="6" style="text-align:center;color:#bbb;padding:1.5rem;">Đang tải điểm danh...</td></tr>`;
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
        });

        if (!_participateSet[sessionId]) {
            _participateSet[sessionId] = new Set(Object.keys(attByMember));
        }

        renderAttendanceTable(attByMember);
    } catch (err) {
        document.getElementById('attendanceBody').innerHTML =
            `<tr><td colspan="6" style="text-align:center;color:var(--danger);padding:1.5rem;">
                Lỗi tải điểm danh: ${escapeHtml(err.message)}
             </td></tr>`;
    }
}

// ─── Render attendance table ──────────────────────────────────
function renderAttendanceTable(attByMember) {
    const tbody = document.getElementById('attendanceBody');
    const admin = isAdmin();
    const pSet  = _participateSet[_currentSessionId] || new Set();

    if (!_members.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#bbb;padding:1.5rem;">Không có thành viên nào.</td></tr>`;
        updateAttendanceStats();
        renderAttendanceChart();
        return;
    }

    tbody.innerHTML = _members.map((m, idx) => {
        const mid      = m._id;
        const isJoined = pSet.has(mid);
        const rec      = attByMember[mid];
        const status   = rec?.status || 'Vắng';
        const note     = rec?.note   || '';

        const participateCell = admin
            ? `<label class="participate-toggle" title="${isJoined ? 'Tham gia' : 'Không tham gia'}">
                    <input type="checkbox" class="att-participate" data-member="${mid}"
                        ${isJoined ? 'checked' : ''}
                        onchange="onParticipateChange(this)" />
                    <span class="participate-slider"></span>
               </label>`
            : isJoined
                ? `<span class="badge badge-success">✅ Có</span>`
                : `<span class="badge badge-secondary">— Không</span>`;

        const statusColor = status === 'Có mặt' ? 'badge-success' : status === 'Có phép' ? 'badge-warning' : 'badge-danger';
        let statusCell;
        if (!isJoined) {
            statusCell = `<span class="att-na">—</span>`;
        } else if (admin) {
            statusCell = `<select class="form-control form-control-sm att-status" data-member="${mid}">
                    <option value="Có mặt"  ${status==='Có mặt' ?'selected':''}>✅ Có mặt</option>
                    <option value="Vắng"    ${status==='Vắng'   ?'selected':''}>❌ Vắng</option>
                    <option value="Có phép" ${status==='Có phép'?'selected':''}>📋 Có phép</option>
                </select>`;
        } else {
            statusCell = `<span class="badge ${statusColor}">${status}</span>`;
        }

        const noteCell = !isJoined
            ? `<span class="att-na">—</span>`
            : admin
                ? `<input type="text" class="form-control form-control-sm att-note" data-member="${mid}" value="${escapeHtml(note)}" placeholder="Ghi chú..." />`
                : `<span>${escapeHtml(note) || '—'}</span>`;

        return `
        <tr class="${!isJoined ? 'row-not-joined' : ''}">
            <td>${idx + 1}</td>
            <td><code>${escapeHtml(m.mssv)}</code></td>
            <td>
                <div class="member-cell">
                    <div class="member-avatar-sm">${getInitials(m.fullName || m.mssv)}</div>
                    <span>${escapeHtml(m.fullName || m.mssv)}</span>
                </div>
            </td>
            <td class="td-center">${participateCell}</td>
            <td>${statusCell}</td>
            <td>${noteCell}</td>
        </tr>`;
    }).join('');

    updateAttendanceStats();
    renderAttendanceChart();

    const checkAll = document.getElementById('checkAllParticipate');
    if (checkAll) {
        const all  = _members.every(m => pSet.has(m._id));
        const some = _members.some(m  => pSet.has(m._id));
        checkAll.checked       = all;
        checkAll.indeterminate = !all && some;
    }

    if (admin) {
        tbody.querySelectorAll('.att-status').forEach(sel => {
            sel.addEventListener('change', () => { updateAttendanceStats(); renderAttendanceChart(); });
        });
    }
}

// ─── Participate toggle ───────────────────────────────────────
function onParticipateChange(checkbox) {
    const mid  = checkbox.dataset.member;
    const pSet = _participateSet[_currentSessionId] || new Set();
    checkbox.checked ? pSet.add(mid) : pSet.delete(mid);
    _participateSet[_currentSessionId] = pSet;

    const attendance  = _attendanceMap[_currentSessionId] || [];
    const attByMember = {};
    attendance.forEach(a => {
        const id = a.memberId?._id || a.memberId;
        attByMember[id] = a;
    });

    const row      = checkbox.closest('tr');
    const rec      = attByMember[mid];
    const status   = rec?.status || 'Vắng';
    const note     = rec?.note   || '';
    const isJoined = pSet.has(mid);
    const tds      = row.querySelectorAll('td');

    tds[4].innerHTML = isJoined
        ? `<select class="form-control form-control-sm att-status" data-member="${mid}">
                <option value="Có mặt"  ${status==='Có mặt' ?'selected':''}>✅ Có mặt</option>
                <option value="Vắng"    ${status==='Vắng'   ?'selected':''}>❌ Vắng</option>
                <option value="Có phép" ${status==='Có phép'?'selected':''}>📋 Có phép</option>
           </select>`
        : `<span class="att-na">—</span>`;

    tds[5].innerHTML = isJoined
        ? `<input type="text" class="form-control form-control-sm att-note" data-member="${mid}" value="${escapeHtml(note)}" placeholder="Ghi chú..." />`
        : `<span class="att-na">—</span>`;

    row.className = isJoined ? '' : 'row-not-joined';

    if (isJoined) {
        tds[4].querySelector('.att-status')?.addEventListener('change', () => {
            updateAttendanceStats(); renderAttendanceChart();
        });
    }

    const checkAll = document.getElementById('checkAllParticipate');
    if (checkAll) {
        const all  = _members.every(m => pSet.has(m._id));
        const some = _members.some(m  => pSet.has(m._id));
        checkAll.checked       = all;
        checkAll.indeterminate = !all && some;
    }

    updateAttendanceStats();
    renderAttendanceChart();
}

function toggleAllParticipate(checked) {
    const pSet = _participateSet[_currentSessionId] || new Set();
    if (checked) _members.forEach(m => pSet.add(m._id));
    else         pSet.clear();
    _participateSet[_currentSessionId] = pSet;

    const attendance  = _attendanceMap[_currentSessionId] || [];
    const attByMember = {};
    attendance.forEach(a => {
        const id = a.memberId?._id || a.memberId;
        attByMember[id] = a;
    });
    renderAttendanceTable(attByMember);
}

// ─── Stats ────────────────────────────────────────────────────
function _getStats() {
    const pSet = _participateSet[_currentSessionId] || new Set();
    let present = 0, absent = 0, excused = 0;

    const selectMemberIds = new Set();
    document.querySelectorAll('.att-status').forEach(sel => {
        if (!pSet.has(sel.dataset.member)) return;
        selectMemberIds.add(sel.dataset.member);
        if      (sel.value === 'Có mặt')  present++;
        else if (sel.value === 'Có phép') excused++;
        else                               absent++;
    });

    // Người tham gia nhưng chưa có select = mặc định Vắng
    pSet.forEach(mid => {
        if (!selectMemberIds.has(mid)) absent++;
    });

    return { joined: pSet.size, present, absent, excused, total: _members.length };
}

function updateAttendanceStats() {
    const { joined, present, absent, excused, total } = _getStats();
    document.getElementById('attCountJoined').textContent  = joined;
    document.getElementById('attCountPresent').textContent = present;
    document.getElementById('attCountAbsent').textContent  = absent;
    document.getElementById('attCountExcused').textContent = excused;
    document.getElementById('attCountTotal').textContent   = total;
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
    const pSet = _participateSet[_currentSessionId] || new Set();
    document.querySelectorAll('.att-status').forEach(sel => {
        if (pSet.has(sel.dataset.member)) sel.value = 'Có mặt';
    });
    updateAttendanceStats();
    renderAttendanceChart();
    showToast('Đã chọn "Có mặt" cho tất cả người tham gia. Nhớ nhấn Lưu!', 'info');
}

async function saveAllAttendance() {
    if (!_currentSessionId) return;

    const pSet       = _participateSet[_currentSessionId] || new Set();
    const selects    = document.querySelectorAll('.att-status');
    const noteInputs = document.querySelectorAll('.att-note');

    if (!_members.length) { showToast('Không có thành viên nào.', 'warning'); return; }

    showLoading();

    const existing    = _attendanceMap[_currentSessionId] || [];
    const existingMap = {};
    existing.forEach(a => {
        const mid = a.memberId?._id || a.memberId;
        existingMap[mid] = a;
    });

    const noteMap = {};
    noteInputs.forEach(inp => { noteMap[inp.dataset.member] = inp.value.trim(); });

    const promises = [];

    selects.forEach(sel => {
        const memberId = sel.dataset.member;
        if (!pSet.has(memberId)) return;
        const status = sel.value;
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