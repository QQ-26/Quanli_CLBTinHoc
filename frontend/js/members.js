/* ============================================================
   members.js — Logic trang Thành viên
   Phụ thuộc: api.js, utils.js, sidebar.js (load trước)
   ============================================================ */

// ── State ──────────────────────────────────────────────────
const _memState = {
  members:        [],
  roles:          [],
  totalPages:     1,
  currentPage:    1,
  keyword:        '',
  deleteTargetId: null,
  avatarDataUrl:  null,   // base64 ảnh đang chọn trong modal
  LIMIT:          10,
};

/* ════════════════════════════════════════
   CHẶN ĐÓNG MODAL KHI CLICK NGOÀI
   Ghi đè listener của utils.js — capture phase chạy trước
   ════════════════════════════════════════ */
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.stopImmediatePropagation();
  }
}, true);

/* ════════════════════════════════════════
   INIT
   ════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  initLayout('members');
  initRoleRestrictions();

  await _loadRoles();
  await _loadMembers();
  _bindEvents();
});

/* ════════════════════════════════════════
   DATA LOADING
   ════════════════════════════════════════ */
async function _loadMembers(page = 1) {
  showLoading();
  try {
    const res = await MemberAPI.getAll(page, _memState.LIMIT, _memState.keyword);

    // Sắp xếp A-Z theo fullName (mặc định)
    const currentUser = getCurrentUser();
    const sorted = (res.members || [])
      .filter(m => {
        // Ẩn tài khoản của chính mình
        if (!currentUser) return true;
        return m._id !== currentUser.id && m.mssv !== currentUser.mssv;
      })
      .slice()
      .sort((a, b) => {
        const na = (a.fullName || a.mssv || '').toLowerCase();
        const nb = (b.fullName || b.mssv || '').toLowerCase();
        return na.localeCompare(nb, 'vi');
      });

    _memState.members     = sorted;
    _memState.totalPages  = res.totalPages  || 1;
    _memState.currentPage = res.currentPage || page;

    _renderTable();
    _renderPagination();
  } catch (err) {
    showToast(err.message || 'Lỗi tải danh sách thành viên.', 'danger');
  } finally {
    hideLoading();
  }
}

async function _loadRoles() {
  try {
    const roles = await RoleAPI.getAll();
    _memState.roles = roles || [];
  } catch {
    _memState.roles = [];
  }
}

/* ════════════════════════════════════════
   RENDER TABLE
   ════════════════════════════════════════ */
function _renderTable() {
  const tbody  = document.getElementById('mem-tbody');
  const offset = (_memState.currentPage - 1) * _memState.LIMIT;

  if (!_memState.members.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="mem-empty">Không tìm thấy thành viên nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = _memState.members.map((m, i) => {
    const roleName    = m.roleId?.roleName || '—';
    const isActive    = m.status === 'Hoạt động';
    const statusBadge = `<span class="badge ${isActive ? 'badge-success' : 'badge-secondary'}">${escapeHtml(m.status || '—')}</span>`;

    // Avatar: dùng ảnh thật nếu có, ngược lại dùng màu nền dựa vào tên
    const avatarHtml = _buildAvatarHtml(m, 36);

    const adminActions = isAdmin() ? `
      <div class="mem-actions">
        <button class="btn btn-sm btn-warning"
          data-id="${m._id}"
          onclick="_openEditModal(this.dataset.id)">✏️ Sửa</button>
        <button class="btn btn-sm btn-danger"
          data-id="${m._id}"
          data-name="${escapeHtml(m.fullName || m.mssv)}"
          onclick="_openDeleteModal(this.dataset.id, this.dataset.name)">🗑️ Xóa</button>
      </div>` : '';

    return `
      <tr>
        <td class="td-stt">${offset + i + 1}</td>
        <td>
          <div class="mem-name-cell">
            ${avatarHtml}
            <span class="mem-fullname">${escapeHtml(m.fullName || '—')}</span>
          </div>
        </td>
        <td>${escapeHtml(m.mssv || '—')}</td>
        <td>${escapeHtml(m.className || '—')}</td>
        <td style="color:#5a5c69;">${escapeHtml(m.email || '—')}</td>
        <td><span class="badge badge-info">${escapeHtml(roleName)}</span></td>
        <td>${statusBadge}</td>
        <td class="td-action admin-only">${adminActions}</td>
      </tr>`;
  }).join('');
}

/**
 * Tạo HTML avatar cho bảng
 * Ưu tiên: avatarPath từ server → avatarDataUrl local → màu + chữ đầu tên
 */
function _buildAvatarHtml(member, size = 36) {
  const src = member.avatarPath || member.avatar || null;
  if (src) {
    return `<div class="mem-avatar-wrap" style="width:${size}px;height:${size}px;">
      <img src="${escapeHtml(src)}" alt="" onerror="this.parentElement.innerHTML='<span class=mem-avatar-initials>${escapeHtml(_getColorInitials(member.fullName || member.mssv))}</span>';this.parentElement.style.background='${_nameToColor(member.fullName || member.mssv)}';" />
    </div>`;
  }
  const color    = _nameToColor(member.fullName || member.mssv || '');
  const initials = _getColorInitials(member.fullName || member.mssv || '?');
  return `<div class="mem-avatar-wrap" style="width:${size}px;height:${size}px;background:${color};">
    <span class="mem-avatar-initials">${escapeHtml(initials)}</span>
  </div>`;
}

/** Lấy chữ cái đầu (tối đa 2 ký tự) — không viết tắt kiểu NQ, VP */
function _getColorInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  // Lấy chữ đầu của từ đầu và từ cuối
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Tạo màu nền từ tên (nhất quán, không random) */
function _nameToColor(name) {
  const colors = [
    '#4e73df','#1cc88a','#36b9cc','#e74a3b','#f6c23e',
    '#6f42c1','#fd7e14','#20c9a6','#5a5c69','#858796',
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/* ════════════════════════════════════════
   RENDER PAGINATION
   ════════════════════════════════════════ */
function _renderPagination() {
  const container = document.getElementById('mem-pagination');
  const { currentPage, totalPages } = _memState;

  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="_goToPage(${currentPage - 1})">‹</button>`;

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end   = Math.min(totalPages, start + 4);

  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="_goToPage(${p})">${p}</button>`;
  }

  html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="_goToPage(${currentPage + 1})">›</button>`;
  container.innerHTML = html;
}

function _goToPage(page) {
  if (page < 1 || page > _memState.totalPages) return;
  _loadMembers(page);
}

/* ════════════════════════════════════════
   EVENTS
   ════════════════════════════════════════ */
function _bindEvents() {
  // Tìm kiếm debounce 400ms
  let searchTimer;
  document.getElementById('mem-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      _memState.keyword = e.target.value.trim();
      _loadMembers(1);
    }, 400);
  });

  // Nút Thêm
  const btnAdd = document.getElementById('btn-add-member');
  if (btnAdd) btnAdd.addEventListener('click', _openAddModal);

  // Nút Lưu
  const btnSave = document.getElementById('btn-save-member');
  if (btnSave) btnSave.addEventListener('click', _handleSave);

  // Nút Xóa xác nhận
  const btnDel = document.getElementById('btn-confirm-delete');
  if (btnDel) btnDel.addEventListener('click', _handleDelete);

  // Avatar file input — preview realtime
  const avatarInput = document.getElementById('field-avatar');
  if (avatarInput) avatarInput.addEventListener('change', _handleAvatarChange);

  // Avatar preview cập nhật khi gõ tên (chế độ thêm mới, chưa chọn ảnh)
  const nameInput = document.getElementById('field-fullName');
  if (nameInput) nameInput.addEventListener('input', () => {
    if (!_memState.avatarDataUrl) _updateModalAvatarPlaceholder();
  });
}

/* ════════════════════════════════════════
   AVATAR: xử lý chọn ảnh từ máy
   ════════════════════════════════════════ */
function _handleAvatarChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('Ảnh quá lớn! Vui lòng chọn ảnh dưới 2MB.', 'warning');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    _memState.avatarDataUrl = ev.target.result;
    _setModalAvatarImage(ev.target.result);
  };
  reader.readAsDataURL(file);
}

function _setModalAvatarImage(src) {
  const box = document.getElementById('avatar-preview-box');
  if (!box) return;
  box.innerHTML = `<img src="${src}" alt="avatar" style="width:62px;height:62px;border-radius:50%;object-fit:cover;" />`;
}

function _updateModalAvatarPlaceholder() {
  const box  = document.getElementById('avatar-preview-box');
  if (!box) return;
  const name  = document.getElementById('field-fullName').value.trim();
  const init  = _getColorInitials(name || '?');
  const color = _nameToColor(name);
  box.style.background = color;
  box.innerHTML = `<span style="color:#fff;font-size:1.2rem;font-weight:700;">${escapeHtml(init)}</span>`;
}

function _resetAvatarPreview(member = null) {
  const box = document.getElementById('avatar-preview-box');
  if (!box) return;
  _memState.avatarDataUrl = null;
  document.getElementById('field-avatar').value = '';

  if (member?.avatarPath || member?.avatar) {
    _setModalAvatarImage(member.avatarPath || member.avatar);
  } else {
    const name  = member?.fullName || member?.mssv || '';
    const init  = _getColorInitials(name || '?');
    const color = _nameToColor(name);
    box.style.background = color;
    box.innerHTML = `<span style="color:#fff;font-size:1.2rem;font-weight:700;">${escapeHtml(init)}</span>`;
  }
}

/* ════════════════════════════════════════
   MODAL: THÊM MỚI
   ════════════════════════════════════════ */
function _openAddModal() {
  document.getElementById('modal-member-title').textContent = 'Thêm thành viên';
  document.getElementById('form-member').reset();
  document.getElementById('field-id').value = '';
  document.getElementById('hint-password').textContent = 'Bắt buộc khi tạo mới.';
  document.getElementById('hint-password').style.color = '#999';
  document.getElementById('password-required').style.display = 'inline';

  _resetAvatarPreview(null);
  _populateRoleDropdown(null);
  openModal('modal-member');
}

/* ════════════════════════════════════════
   MODAL: SỬA
   ════════════════════════════════════════ */
function _openEditModal(id) {
  const member = _memState.members.find(m => m._id === id);
  if (!member) return;

  document.getElementById('modal-member-title').textContent = 'Sửa thành viên';
  document.getElementById('field-id').value        = member._id;
  document.getElementById('field-fullName').value  = member.fullName  || '';
  document.getElementById('field-mssv').value      = member.mssv      || '';
  document.getElementById('field-className').value = member.className  || '';
  document.getElementById('field-email').value     = member.email      || '';
  document.getElementById('field-status').value    = member.status     || 'Hoạt động';
  document.getElementById('field-password').value  = '';
  document.getElementById('hint-password').innerHTML = 'Để trống nếu không đổi mật khẩu. Nếu đổi: phải gồm chữ thường (a–z) và chữ số (0–9). Ví dụ: <strong>member12345</strong>';
  document.getElementById('hint-password').style.color = '#999';
  document.getElementById('password-required').style.display = 'none';

  _resetAvatarPreview(member);
  _populateRoleDropdown(member.roleId?._id || member.roleId || null);
  openModal('modal-member');
}

/* ════════════════════════════════════════
   MODAL: XÓA
   ════════════════════════════════════════ */
function _openDeleteModal(id, name) {
  _memState.deleteTargetId = id;
  document.getElementById('delete-member-name').textContent = name;
  openModal('modal-delete');
}

/* ════════════════════════════════════════
   POPULATE ROLE DROPDOWN
   ════════════════════════════════════════ */
function _populateRoleDropdown(selectedId) {
  const select = document.getElementById('field-roleId');
  select.innerHTML = '<option value="">-- Chọn vai trò --</option>';
  _memState.roles.forEach(r => {
    const opt = document.createElement('option');
    opt.value       = r._id;
    opt.textContent = r.roleName;
    if (selectedId && r._id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}

/* ════════════════════════════════════════
   HANDLE SAVE (Thêm / Sửa)
   ════════════════════════════════════════ */
async function _handleSave() {
  const id       = document.getElementById('field-id').value.trim();
  const fullName = document.getElementById('field-fullName').value.trim();
  const mssv     = document.getElementById('field-mssv').value.trim();
  const password = document.getElementById('field-password').value.trim();

  if (!fullName) { showToast('Vui lòng nhập họ tên.', 'warning'); return; }
  if (!mssv)     { showToast('Vui lòng nhập MSSV.', 'warning'); return; }
  if (!id && !password) { showToast('Vui lòng nhập mật khẩu cho thành viên mới.', 'warning'); return; }

  // Validate định dạng mật khẩu: phải có ít nhất 1 chữ thường và 1 chữ số
  const pwdPattern = /^(?=.*[a-z])(?=.*[0-9])[a-z0-9]+$/;
  if (password && !pwdPattern.test(password)) {
    const hint = document.getElementById('hint-password');
    hint.style.color = '#e74a3b';
    showToast('Mật khẩu chỉ gồm chữ thường (a–z) và chữ số (0–9). Ví dụ: member12345', 'danger');
    document.getElementById('field-password').focus();
    return;
  }
  // Reset màu hint nếu hợp lệ
  if (password) document.getElementById('hint-password').style.color = '#999';

  const payload = {
    fullName,
    mssv,
    className: document.getElementById('field-className').value.trim() || undefined,
    email:     document.getElementById('field-email').value.trim()     || undefined,
    roleId:    document.getElementById('field-roleId').value           || undefined,
    status:    document.getElementById('field-status').value,
  };
  if (password)                  payload.passwordHash = password;
  if (_memState.avatarDataUrl)   payload.avatarPath   = _memState.avatarDataUrl;

  showLoading();
  try {
    if (id) {
      await MemberAPI.update(id, payload);
      showToast('Cập nhật thành viên thành công!', 'success');
    } else {
      await MemberAPI.create(payload);
      showToast('Thêm thành viên thành công!', 'success');
    }
    closeModal('modal-member');
    await _loadMembers(_memState.currentPage);
  } catch (err) {
    showToast(err.message || 'Lỗi lưu thành viên.', 'danger');
  } finally {
    hideLoading();
  }
}

/* ════════════════════════════════════════
   HANDLE DELETE
   ════════════════════════════════════════ */
async function _handleDelete() {
  const id = _memState.deleteTargetId;
  if (!id) return;

  showLoading();
  try {
    await MemberAPI.delete(id);
    showToast('Xóa thành viên thành công!', 'success');
    closeModal('modal-delete');
    const targetPage = _memState.members.length === 1 && _memState.currentPage > 1
      ? _memState.currentPage - 1
      : _memState.currentPage;
    await _loadMembers(targetPage);
  } catch (err) {
    showToast(err.message || 'Lỗi xóa thành viên.', 'danger');
  } finally {
    hideLoading();
    _memState.deleteTargetId = null;
  }
}
