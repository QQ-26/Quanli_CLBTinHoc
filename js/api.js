/* ============================================================
 * api.js — API layer cho Frontend CLB Tin Học
 * Base URL: https://website-qlclb.onrender.com/api
 *
 * CÁCH DÙNG:
 *   const data = await AuthAPI.login(mssv, password);
 *   const { members } = await MemberAPI.getAll(1, 10, 'keyword');
 *
 * XỬ LÝ LỖI: tất cả hàm đều throw Error nếu thất bại,
 *   dùng try/catch ở nơi gọi.
 * ============================================================ */

const BASE_URL = 'https://website-qlclb.onrender.com/api';

// ─────────────────────────────────────────────
// INTERNAL: gọi fetch với token tự động
// ─────────────────────────────────────────────
async function _request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };

    const token = localStorage.getItem('accessToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    let res;
    try {
        res = await fetch(`${BASE_URL}${path}`, options);
    } catch (networkErr) {
        throw new Error('Không thể kết nối đến server. Vui lòng kiểm tra mạng.');
    }

    // Token hết hạn → thử refresh
    if (res.status === 403) {
        const refreshed = await _tryRefreshToken();
        if (refreshed) {
            // Thử lại request với token mới
            headers['Authorization'] = `Bearer ${localStorage.getItem('accessToken')}`;
            res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : null });
        } else {
            // Refresh thất bại → đăng xuất
            _forceLogout();
            throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        }
    }

    // Chưa đăng nhập — KHÔNG redirect nếu đang ở trang login (tránh reload xóa alert lỗi)
    if (res.status === 401) {
        const _onLoginPage = window.location.pathname.endsWith('index.html')
            || window.location.pathname === '/'
            || window.location.pathname.endsWith('/');
        if (!_onLoginPage) _forceLogout();
        const errData = await res.clone().json().catch(() => ({}));
        throw new Error(errData.message || 'Sai thông tin đăng nhập. Vui lòng thử lại.');
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.message || `Lỗi ${res.status}`);
    }

    return data;
}

// Thử refresh access token bằng refresh token
async function _tryRefreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
        const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: refreshToken })
        });
        if (!res.ok) return false;
        const data = await res.json();
        localStorage.setItem('accessToken', data.accessToken);
        return true;
    } catch {
        return false;
    }
}

// Xóa thông tin đăng nhập và chuyển về trang login
function _forceLogout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}


// ─────────────────────────────────────────────
// AuthAPI
//
// POST /api/auth/login
//   body: { mssv, password }
//   response: { message, accessToken, refreshToken, member: { id, fullName, mssv, roleId } }
//
// POST /api/auth/refresh-token
//   body: { token: refreshToken }
//   response: { accessToken }
// ─────────────────────────────────────────────
const AuthAPI = {
    /**
     * Đăng nhập.
     * Tự động lưu accessToken, refreshToken, currentUser vào localStorage.
     * @param {string} mssv
     * @param {string} password
     * @returns {{ message, accessToken, refreshToken, member }}
     */
    async login(mssv, password) {
        const data = await _request('POST', '/auth/login', { mssv, password });
        // Lưu token và thông tin user
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        // Đảm bảo member có roleName và isAdmin
        let member = data.member;
        if (member && member.roleId && member.roleId.roleName) {
            member.roleName = member.roleId.roleName;
            member.isAdmin = member.roleId.roleName.toLowerCase().includes('admin');
        }
        localStorage.setItem('currentUser', JSON.stringify(member));
        return data;
    },

    /**
     * Làm mới access token thủ công (thường không cần gọi, _request tự xử lý).
     * @param {string} refreshToken
     * @returns {{ accessToken }}
     */
    async refreshToken(refreshToken) {
        return _request('POST', '/auth/refresh-token', { token: refreshToken });
    },

    /**
     * Đổi mật khẩu thành viên (admin gọi thay cho member).
     * Thử gọi endpoint riêng nếu backend có hỗ trợ.
     * @param {string} memberId
     * @param {string} newPassword
     */
    async changePassword(memberId, newPassword) {
        return _request('POST', `/auth/change-password`, { memberId, newPassword, password: newPassword });
    },
};


// ─────────────────────────────────────────────
// MemberAPI
//
// GET    /api/members/stats
//   response: { total, detail: [{ _id: status, count }] }
//
// GET    /api/members?page&limit&keyword
//   response: { members, totalPages, currentPage, totalMembers }
//   member shape: { _id, mssv, fullName, className, email, avatarPath,
//                   roleId: { _id, roleName }, status, createdAt, updatedAt }
//
// GET    /api/members/:id
//   response: member (với roleId populate đầy đủ)
//
// POST   /api/members
//   body: { mssv, fullName, className?, email?, passwordHash, roleId?, status? }
//   response: member đã tạo
//
// PUT    /api/members/:id
//   body: các field cần cập nhật (không cần passwordHash nếu không đổi mật khẩu)
//   response: member đã cập nhật
//
// DELETE /api/members/:id
//   response: { message }
//
// DELETE /api/members   ← XÓA TẤT CẢ (admin only, cẩn thận!)
//   response: { message }
// ─────────────────────────────────────────────
const MemberAPI = {
    /**
     * Thống kê thành viên theo status.
     * @returns {{ total: number, detail: Array<{ _id: string, count: number }> }}
     */
    getStats() {
        return _request('GET', '/members/stats');
    },

    /**
     * Lấy danh sách thành viên có phân trang và tìm kiếm.
     * @param {number} page     - trang hiện tại (bắt đầu từ 1)
     * @param {number} limit    - số bản ghi mỗi trang (mặc định 10)
     * @param {string} keyword  - tìm theo fullName hoặc mssv
     * @returns {{ members: Member[], totalPages: number, currentPage: number, totalMembers: number }}
     */
    getAll(page = 1, limit = 10, keyword = '') {
        const q = new URLSearchParams({ page, limit, ...(keyword && { keyword }) }).toString();
        return _request('GET', `/members?${q}`);
    },

    /**
     * Lấy chi tiết 1 thành viên (roleId được populate đầy đủ).
     * @param {string} id - MongoDB ObjectId
     * @returns {Member}
     */
    getById(id) {
        return _request('GET', `/members/${id}`);
    },

    /**
     * Tạo thành viên mới.
     * Lưu ý: trường mật khẩu gửi lên là `passwordHash` (backend sẽ tự hash).
     * @param {{ mssv, fullName, passwordHash, className?, email?, roleId?, status? }} memberData
     * @returns {Member}
     */
    create(memberData) {
        return _request('POST', '/members', memberData);
    },

    /**
     * Cập nhật thông tin thành viên.
     * @param {string} id
     * @param {Partial<Member>} updateData
     * @returns {Member}
     */
    update(id, updateData) {
        return _request('PUT', `/members/${id}`, updateData);
    },

    /**
     * Xóa 1 thành viên.
     * @param {string} id
     * @returns {{ message: string }}
     */
    delete(id) {
        return _request('DELETE', `/members/${id}`);
    },

    /**
     * Xóa TẤT CẢ thành viên (dùng cẩn thận).
     * @returns {{ message: string }}
     */
    deleteAll() {
        return _request('DELETE', '/members');
    },
};


// ─────────────────────────────────────────────
// SessionAPI
//
// GET    /api/sessions
//   response: Session[]
//   session shape: { _id, sessionName, sessionDate, location, maxParticipants,
//                    instructors: [{ memberId: Member, roleSessionId: RoleSession }],
//                    createdAt, updatedAt }
//
// GET    /api/sessions/:id
//   response: Session (populate đầy đủ)
//
// POST   /api/sessions
//   body: { sessionName, sessionDate?, location?, maxParticipants?, instructors? }
//   response: Session đã tạo
//
// PUT    /api/sessions/:id
//   body: các field cần cập nhật
//   response: Session đã cập nhật (populate đầy đủ)
//
// DELETE /api/sessions/:id
//   response: { message }   ← cũng cascade delete attendance của buổi đó
// ─────────────────────────────────────────────
const SessionAPI = {
    /**
     * Lấy tất cả buổi sinh hoạt (có populate instructors).
     * @returns {Session[]}
     */
    getAll() {
        return _request('GET', '/sessions');
    },

    /**
     * Lấy chi tiết 1 buổi sinh hoạt.
     * @param {string} id
     * @returns {Session}
     */
    getById(id) {
        return _request('GET', `/sessions/${id}`);
    },

    /**
     * Tạo buổi sinh hoạt mới.
     * @param {{ sessionName, sessionDate?, location?, maxParticipants?, instructors? }} sessionData
     * @returns {Session}
     */
    create(sessionData) {
        return _request('POST', '/sessions', sessionData);
    },

    /**
     * Cập nhật buổi sinh hoạt.
     * @param {string} id
     * @param {Partial<Session>} updateData
     * @returns {Session}
     */
    update(id, updateData) {
        return _request('PUT', `/sessions/${id}`, updateData);
    },

    /**
     * Xóa buổi sinh hoạt (tự động xóa cả điểm danh liên quan).
     * @param {string} id
     * @returns {{ message: string }}
     */
    delete(id) {
        return _request('DELETE', `/sessions/${id}`);
    },
};


// ─────────────────────────────────────────────
// AttendanceAPI
//
// GET    /api/attendance
//   response: Attendance[] (populate sessionId, memberId)
//
// GET    /api/attendance/:id
//   response: Attendance (populate sessionId, memberId)
//
// GET    /api/attendance/session/:sessionId
//   response: Attendance[] của buổi đó (populate memberId)
//   attendance shape: { _id, sessionId, memberId: Member,
//                       status: 'Có mặt'|'Vắng'|'Có phép', note, createdAt, updatedAt }
//
// POST   /api/attendance
//   body: { sessionId, memberId, status?, note? }
//   response: Attendance đã tạo
//
// PUT    /api/attendance/:id
//   body: { status?, note? }
//   response: Attendance đã cập nhật
//
// DELETE /api/attendance/:id
//   response: { message }
// ─────────────────────────────────────────────
const AttendanceAPI = {
    /**
     * Lấy toàn bộ điểm danh.
     * @returns {Attendance[]}
     */
    getAll() {
        return _request('GET', '/attendance');
    },

    /**
     * Lấy điểm danh theo buổi sinh hoạt.
     * @param {string} sessionId
     * @returns {Attendance[]}  — mỗi item có memberId là object Member đầy đủ
     */
    getBySession(sessionId) {
        return _request('GET', `/attendance/session/${sessionId}`);
    },

    /**
     * Lấy chi tiết 1 bản ghi điểm danh.
     * @param {string} id
     * @returns {Attendance}
     */
    getById(id) {
        return _request('GET', `/attendance/${id}`);
    },

    /**
     * Điểm danh (tạo mới 1 bản ghi).
     * @param {{ sessionId: string, memberId: string, status?: string, note?: string }} data
     *   status: 'Có mặt' | 'Vắng' | 'Có phép'  (mặc định 'Vắng')
     * @returns {Attendance}
     */
    mark(data) {
        return _request('POST', '/attendance', data);
    },

    /**
     * Cập nhật trạng thái / ghi chú điểm danh.
     * @param {string} id
     * @param {{ status?: string, note?: string }} updateData
     * @returns {Attendance}
     */
    update(id, updateData) {
        return _request('PUT', `/attendance/${id}`, updateData);
    },

    /**
     * Xóa 1 bản ghi điểm danh.
     * @param {string} id
     * @returns {{ message: string }}
     */
    delete(id) {
        return _request('DELETE', `/attendance/${id}`);
    },
};


// ─────────────────────────────────────────────
// RoleAPI  (vai trò thành viên: Admin, Thành viên, v.v.)
//
// GET    /api/roles          → Role[]   { _id, roleName, createdAt, updatedAt }
// GET    /api/roles/:id      → Role
// POST   /api/roles          body: { roleName }  → Role
// PUT    /api/roles/:id      body: { roleName }  → Role
// DELETE /api/roles/:id      → { message }
// ─────────────────────────────────────────────
const RoleAPI = {
    getAll()            { return _request('GET',    '/roles'); },
    getById(id)         { return _request('GET',    `/roles/${id}`); },
    create(data)        { return _request('POST',   '/roles', data); },
    update(id, data)    { return _request('PUT',    `/roles/${id}`, data); },
    delete(id)          { return _request('DELETE', `/roles/${id}`); },
};


// ─────────────────────────────────────────────
// RoleSessionAPI  (vai trò trong buổi sinh hoạt: Chủ trì, Thư ký, v.v.)
//
// GET    /api/role-sessions          → RoleSession[]   { _id, roleSessionName, createdAt, updatedAt }
// GET    /api/role-sessions/:id      → RoleSession
// POST   /api/role-sessions          body: { roleSessionName }  → RoleSession
// PUT    /api/role-sessions/:id      body: { roleSessionName }  → RoleSession
// DELETE /api/role-sessions/:id      → { message }
// ─────────────────────────────────────────────
const RoleSessionAPI = {
    getAll()            { return _request('GET',    '/role-sessions'); },
    getById(id)         { return _request('GET',    `/role-sessions/${id}`); },
    create(data)        { return _request('POST',   '/role-sessions', data); },
    update(id, data)    { return _request('PUT',    `/role-sessions/${id}`, data); },
    delete(id)          { return _request('DELETE', `/role-sessions/${id}`); },
};