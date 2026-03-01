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
    // Fetch tất cả để sort toàn bộ rồi mới phân trang — tránh sort từng trang riêng lẻ
    const res = await MemberAPI.getAll(1, 9999, _memState.keyword);

    const getSortName = m => {
      if (!m.fullName) return (m.mssv || '').toLowerCase();
      const parts = m.fullName.trim().split(/\s+/);
      return (parts[parts.length - 1] || '').toLowerCase();
    };
    const allSorted = (res.members || []).slice().sort((a, b) => {
      const na = getSortName(a);
      const nb = getSortName(b);
      return na.localeCompare(nb, 'vi');
    });

    // Phân trang thủ công ở frontend
    const total      = allSorted.length;
    const totalPages = Math.ceil(total / _memState.LIMIT) || 1;
    const curPage    = Math.min(page, totalPages);
    const start      = (curPage - 1) * _memState.LIMIT;
    const end        = start + _memState.LIMIT;

    _memState.allMembers  = allSorted;          // lưu toàn bộ để dùng khi chuyển trang
    _memState.members     = allSorted.slice(start, end);
    _memState.totalPages  = totalPages;
    _memState.currentPage = curPage;

    _renderTable();
    _renderPagination();
  } catch (err) {
    const tbody = document.getElementById('mem-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="mem-empty">⚠️ ${escapeHtml(err.message || 'Lỗi tải danh sách thành viên.')}</td></tr>`;
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
          onclick="event.stopPropagation();_openEditModal(this.dataset.id)">✏️ Sửa</button>
        <button class="btn btn-sm btn-danger"
          data-id="${m._id}"
          data-name="${escapeHtml(m.fullName || m.mssv)}"
          onclick="event.stopPropagation();_openDeleteModal(this.dataset.id, this.dataset.name)">🗑️ Xóa</button>
      </div>` : '';

    return `
      <tr class="row-clickable" data-id="${m._id}" onclick="_openViewModal('${m._id}')">
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
  const start = (page - 1) * _memState.LIMIT;
  const end   = start + _memState.LIMIT;
  _memState.members     = (_memState.allMembers || []).slice(start, end);
  _memState.currentPage = page;
  _renderTable();
  _renderPagination();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Nút Sửa trong modal xem thông tin
  const btnViewEdit = document.getElementById('btn-view-edit');
  if (btnViewEdit) btnViewEdit.addEventListener('click', () => {
    const id = btnViewEdit.dataset.memberId;
    if (id) { closeModal('modal-view'); _openEditModal(id); }
  });
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
  document.getElementById('password-required').style.display = 'inline';
  document.getElementById('className-required').style.display = 'inline';

  // Hiện ô xác nhận mật khẩu
  const confirmGroup = document.getElementById('confirm-password-group');
  if (confirmGroup) confirmGroup.style.display = 'block';
  document.getElementById('hint-password-confirm').style.display = 'none';

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
  document.getElementById('field-password-confirm').value = '';
  document.getElementById('hint-password').textContent = 'Để trống nếu không đổi mật khẩu.';
  document.getElementById('password-required').style.display = 'none';
  document.getElementById('className-required').style.display = 'none';

  // Khi sửa, ô xác nhận chỉ hiện nếu người dùng nhập mật khẩu mới
  const confirmGroup = document.getElementById('confirm-password-group');
  if (confirmGroup) confirmGroup.style.display = 'none';
  document.getElementById('hint-password-confirm').style.display = 'none';

  // Khi nhập password thì hiện ô xác nhận
  const pwField = document.getElementById('field-password');
  const _showConfirmIfNeeded = () => {
    if (confirmGroup) confirmGroup.style.display = pwField.value ? 'block' : 'none';
  };
  pwField.removeEventListener('input', pwField._confirmToggle);
  pwField._confirmToggle = _showConfirmIfNeeded;
  pwField.addEventListener('input', pwField._confirmToggle);

  _resetAvatarPreview(member);
  _populateRoleDropdown(member.roleId?._id || member.roleId || null);
  openModal('modal-member');
}

/* ════════════════════════════════════════
   MODAL: XEM THÔNG TIN
   ════════════════════════════════════════ */
function _openViewModal(id) {
  const m = _memState.members.find(x => x._id === id);
  if (!m) return;

  // Avatar
  const avatarBox = document.getElementById('view-avatar');
  const src = m.avatarPath || m.avatar || null;
  if (src) {
    avatarBox.style.background = 'transparent';
    avatarBox.innerHTML = `<img src="${escapeHtml(src)}" alt="" onerror="this.parentElement.style.background='${_nameToColor(m.fullName||m.mssv)}';this.remove();" />`;
  } else {
    avatarBox.style.background = _nameToColor(m.fullName || m.mssv || '');
    avatarBox.innerHTML = `<span>${escapeHtml(_getColorInitials(m.fullName || m.mssv || '?'))}</span>`;
  }

  // Tên + vai trò
  document.getElementById('view-fullname').textContent = m.fullName || m.mssv || '—';
  const roleName = m.roleId?.roleName || '—';
  document.getElementById('view-role-badge').innerHTML =
    `<span class="badge badge-info" style="font-size:.8rem;">${escapeHtml(roleName)}</span>`;

  // Thông tin chi tiết
  document.getElementById('view-mssv').textContent    = m.mssv      || '—';
  document.getElementById('view-class').textContent   = m.className || '—';
  document.getElementById('view-email').textContent   = m.email     || '—';

  const isActive = m.status === 'Hoạt động';
  document.getElementById('view-status').innerHTML =
    `<span class="badge ${isActive ? 'badge-success' : 'badge-secondary'}">${escapeHtml(m.status || '—')}</span>`;

  // Gán id cho nút Sửa
  const btnViewEdit = document.getElementById('btn-view-edit');
  if (btnViewEdit) btnViewEdit.dataset.memberId = m._id;

  openModal('modal-view');
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
  const id        = document.getElementById('field-id').value.trim();
  const fullName  = document.getElementById('field-fullName').value.trim();
  const mssv      = document.getElementById('field-mssv').value.trim();
  const className = document.getElementById('field-className').value.trim();
  const password  = document.getElementById('field-password').value;
  const confirm   = document.getElementById('field-password-confirm').value;

  if (!fullName)  { showToast('Vui lòng nhập họ tên.', 'warning'); return; }
  if (!mssv)      { showToast('Vui lòng nhập MSSV.', 'warning'); return; }
  if (!id && !className) { showToast('Vui lòng nhập lớp học (bắt buộc khi tạo mới).', 'warning'); return; }
  if (!id && !password)  { showToast('Vui lòng nhập mật khẩu cho thành viên mới.', 'warning'); return; }

  // Kiểm tra xác nhận mật khẩu khi có nhập mật khẩu
  if (password) {
    if (password !== confirm) {
      document.getElementById('hint-password-confirm').style.display = 'block';
      showToast('Mật khẩu xác nhận không khớp!', 'warning');
      return;
    }
    document.getElementById('hint-password-confirm').style.display = 'none';
  }

  const payload = {
    fullName,
    mssv,
    className: className || undefined,
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

/* ════════════════════════════════════════
   TOGGLE PASSWORD VISIBILITY
   ════════════════════════════════════════ */
function _togglePassword(fieldId, btn) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
    btn.title = 'Ẩn mật khẩu';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
    btn.title = 'Hiện mật khẩu';
  }
}
