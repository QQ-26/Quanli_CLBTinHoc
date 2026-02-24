document.addEventListener('DOMContentLoaded', async () => { 
requireAuth();
initLayout('members'); 
initRoleRestrictions();  });

const _memState = {
  members:    [],
  roles:      [],
  totalPages: 1,
  currentPage: 1,
  keyword:    '',
  deleteTargetId: null,
  LIMIT: 10,
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
    const res = await MemberAPI.getAll(page, _memState.LIMIT, _memState.keyword);
    _memState.members     = res.members     || [];
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
    const roleName  = m.roleId?.roleName || '—';
    const isActive  = m.status === 'Hoạt động';
    const statusBadge = `<span class="badge ${isActive ? 'badge-success' : 'badge-secondary'}">${escapeHtml(m.status || '—')}</span>`;

    const adminActions = `
      <div class="mem-actions admin-only">
        <button class="btn btn-sm btn-warning" onclick="_openEditModal('${m._id}')">✏️ Sửa</button>
        <button class="btn btn-sm btn-danger"  onclick="_openDeleteModal('${m._id}', '${escapeHtml(m.fullName || m.mssv)}')">🗑️ Xóa</button>
      </div>`;

    return `
      <tr>
        <td class="mem-stt">${offset + i + 1}</td>
        <td>
          <div class="mem-name-cell">
            <div class="mem-avatar">${escapeHtml(getInitials(m.fullName || m.mssv || '?'))}</div>
            <span>${escapeHtml(m.fullName || '—')}</span>
          </div>
        </td>
        <td>${escapeHtml(m.mssv || '—')}</td>
        <td>${escapeHtml(m.className || '—')}</td>
        <td>${escapeHtml(m.email || '—')}</td>
        <td><span class="badge badge-info">${escapeHtml(roleName)}</span></td>
        <td>${statusBadge}</td>
        <td class="admin-only" style="text-align:center;">${adminActions}</td>
      </tr>`;
  }).join('');


  // Ẩn cột & nút admin-only nếu không phải admin
  if (!isAdmin()) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
}

/* ════════════════════════════════════════
   RENDER PAGINATION
   ════════════════════════════════════════ */
function _renderPagination() {
  const container = document.getElementById('mem-pagination');
  const { currentPage, totalPages } = _memState;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  // Prev
  html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="_goToPage(${currentPage - 1})">‹</button>`;

  // Pages (window of 5)
  const start = Math.max(1, currentPage - 2);
  const end   = Math.min(totalPages, start + 4);

  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="_goToPage(${p})">${p}</button>`;
  }

  // Next
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
  // Tìm kiếm (debounce 400ms)
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

  // Nút Lưu trong modal
  document.getElementById('btn-save-member').addEventListener('click', _handleSave);

  // Nút Xóa xác nhận
  document.getElementById('btn-confirm-delete').addEventListener('click', _handleDelete);
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
  document.getElementById('hint-password').textContent  = 'Để trống nếu không đổi mật khẩu.';
  document.getElementById('password-required').style.display = 'none';

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

  // Validation cơ bản
  if (!fullName) { showToast('Vui lòng nhập họ tên.', 'warning'); return; }
  if (!mssv)     { showToast('Vui lòng nhập MSSV.', 'warning'); return; }
  if (!id && !password) { showToast('Vui lòng nhập mật khẩu cho thành viên mới.', 'warning'); return; }

  const payload = {
    fullName,
    mssv,
    className: document.getElementById('field-className').value.trim() || undefined,
    email:     document.getElementById('field-email').value.trim()     || undefined,
    roleId:    document.getElementById('field-roleId').value           || undefined,
    status:    document.getElementById('field-status').value,
  };
  if (password) payload.passwordHash = password;

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
    // Nếu xóa hết trang cuối → về trang trước
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
