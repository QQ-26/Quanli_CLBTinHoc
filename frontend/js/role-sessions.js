// ── State nội bộ ──
const _roleSessionState = {
  list:        [],     // toàn bộ vai trò từ server
  filtered:    [],     // sau khi lọc theo search
  editingId:   null,
  deletingId:  null,
  submitting:  false,
  currentPage: 1,
  pageSize:    10,
};

const PAGE_SIZE = 10;

/* ════════════════════════════════════════
   INIT
   ════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  initLayout('role-sessions');
  initRoleRestrictions();

  // Enter trong input → submit
  document.getElementById('role-input-name')
    .addEventListener('keydown', (e) => {
      if (e.key === 'Enter') roleSession_submit();
    });

  // Ngăn đóng modal khi click bên ngoài (chỉ đóng bằng nút X / Hủy / Thêm)
  document.getElementById('role-modal').addEventListener('click', (e) => {
    e.stopPropagation();
  });
  document.getElementById('role-confirm-modal').addEventListener('click', (e) => {
    e.stopPropagation();
  });

  await _roleSession_loadList();
});

/* ════════════════════════════════════════
   LOAD & RENDER DANH SÁCH
   ════════════════════════════════════════ */
async function _roleSession_loadList() {
  _roleSession_showSkeleton(true);

  try {
    const data = await RoleSessionAPI.getAll();
    // API trả về array trực tiếp (không wrap object)
    _roleSessionState.list = Array.isArray(data) ? data : [];
    // Sắp xếp A->Z mặc định
    _roleSession_sortList();
    _roleSession_applyFilter();
  } catch (err) {
    console.error('[RoleSession] loadList:', err);
    showToast('Không tải được danh sách vai trò.', 'danger');
    _roleSession_showEmpty();
  } finally {
    _roleSession_showSkeleton(false);
  }
}

/* Sắp xếp list A->Z theo roleSessionName */
function _roleSession_sortList() {
  _roleSessionState.list.sort((a, b) =>
    (a.roleSessionName || '').localeCompare(b.roleSessionName || '', 'vi', { sensitivity: 'base' })
  );
}

/* Lọc theo từ khóa tìm kiếm, reset về trang 1 nếu từ khóa thay đổi */
function _roleSession_applyFilter(resetPage = true) {
  const keyword = (document.getElementById('role-search-input')?.value || '').trim().toLowerCase();
  if (keyword) {
    _roleSessionState.filtered = _roleSessionState.list.filter(r =>
      (r.roleSessionName || '').toLowerCase().includes(keyword)
    );
  } else {
    _roleSessionState.filtered = [..._roleSessionState.list];
  }
  if (resetPage) _roleSessionState.currentPage = 1;
  _roleSession_renderTable();
}

function _roleSession_renderTable() {
  const filtered  = _roleSessionState.filtered;
  const total     = filtered.length;
  const totalAll  = _roleSessionState.list.length;
  const page      = _roleSessionState.currentPage;
  const pageSize  = PAGE_SIZE;
  const totalPages = Math.ceil(total / pageSize);

  const tbody        = document.getElementById('role-table-body');
  const tableWrap    = document.getElementById('role-table-wrap');
  const emptyEl      = document.getElementById('role-empty');
  const emptySearch  = document.getElementById('role-empty-search');
  const countEl      = document.getElementById('role-count');

  // Badge đếm
  if (countEl) {
    const keyword = (document.getElementById('role-search-input')?.value || '').trim();
    countEl.textContent = keyword
      ? `${total} / ${totalAll} vai trò`
      : `${totalAll} vai trò`;
  }

  // Không có dữ liệu gốc
  if (!totalAll) {
    tableWrap.style.display   = 'none';
    emptyEl.style.display     = 'block';
    if (emptySearch) emptySearch.style.display = 'none';
    _roleSession_renderPagination();
    return;
  }

  emptyEl.style.display = 'none';

  // Có dữ liệu nhưng filter ra 0
  if (!total) {
    tableWrap.style.display   = 'none';
    if (emptySearch) emptySearch.style.display = 'block';
    _roleSession_renderPagination();
    return;
  }

  if (emptySearch) emptySearch.style.display = 'none';
  tableWrap.style.display = 'block';

  // Slice trang hiện tại
  const start    = (page - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);

  const ROW_COLORS = ['#6DC5D1','#FEF889','#FFA4A4','#94A2F2','#426EB4','#FFBDBD','#BADFDB','#F2E7A7'];

  tbody.innerHTML = pageData.map((role, idx) => {
    const globalIdx = start + idx;               // chỉ số trong filtered (để màu nhất quán)
    const name    = escapeHtml(role.roleSessionName || '—');
    const created = formatDate(role.createdAt);
    const id      = escapeHtml(role._id);
    const color   = ROW_COLORS[globalIdx % ROW_COLORS.length];
    const delay   = ((idx + 1) * 0.03).toFixed(2);
    const stt     = globalIdx + 1;               // STT liên tục qua các trang

    return `
      <tr class="role-table-row" data-id="${id}" style="animation-delay:${delay}s">
        <td class="role-cell-stt " style="box-shadow:inset 3px 0 0 0 ${color};">${stt}</td>
        <td>
          <div class="role-name-cell">
            <span class="role-chip">🎭</span>
            <span class="role-name-text">${name}</span>
          </div>
        </td>
        <td class="role-cell-date">${escapeHtml(created)}</td>
        <td class="admin-only role-cell-actions">
          <button
            class="btn btn-warning btn-sm role-btn-edit"
            onclick="roleSession_openEdit('${id}')"
            title="Sửa vai trò"
          >✏️ Sửa</button>
          <button
            class="btn btn-danger btn-sm role-btn-delete"
            onclick="roleSession_openDelete('${id}')"
            title="Xóa vai trò"
          >🗑️ Xóa</button>
        </td>
      </tr>`;
  }).join('');

  // Pagination
  _roleSession_renderPagination();
}

/* ════════════════════════════════════════
   PAGINATION (copy từ members.js)
   ════════════════════════════════════════ */
function _roleSession_renderPagination() {
  const container = document.getElementById('role-pagination');
  if (!container) return;
  const { currentPage } = _roleSessionState;
  const totalPages = Math.ceil(_roleSessionState.filtered.length / PAGE_SIZE) || 1;

  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="roleSession_goPage(${currentPage - 1})">‹</button>`;

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end   = Math.min(totalPages, start + 4);

  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="roleSession_goPage(${p})">${p}</button>`;
  }

  html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="roleSession_goPage(${currentPage + 1})">›</button>`;
  container.innerHTML = html;
}

function roleSession_goPage(page) {
  const totalPages = Math.ceil(_roleSessionState.filtered.length / PAGE_SIZE) || 1;
  if (page < 1 || page > totalPages) return;
  _roleSessionState.currentPage = page;
  _roleSession_renderTable();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ════════════════════════════════════════
   TÌM KIẾM
   ════════════════════════════════════════ */
function roleSession_onSearch() {
  _roleSession_applyFilter(true);
}

/* ════════════════════════════════════════
   THÊM — mở modal rỗng
   ════════════════════════════════════════ */
function roleSession_openAdd() {
  _roleSessionState.editingId = null;
  _roleSession_resetForm();

  document.getElementById('role-modal-title').textContent  = '➕ Thêm vai trò';
  document.getElementById('role-modal-submit').textContent = 'Thêm';

  openModal('role-modal');
  // Focus input sau animation
  setTimeout(() => document.getElementById('role-input-name').focus(), 80);
}

/* ════════════════════════════════════════
   SỬA — mở modal với data có sẵn
   ════════════════════════════════════════ */
function roleSession_openEdit(id) {
  const role = _roleSessionState.list.find(r => r._id === id);
  if (!role) {
    showToast('Không tìm thấy vai trò.', 'danger');
    return;
  }

  _roleSessionState.editingId = id;
  _roleSession_resetForm();

  document.getElementById('role-modal-title').textContent  = '✏️ Sửa vai trò';
  document.getElementById('role-modal-submit').textContent = 'Cập nhật';
  document.getElementById('role-input-name').value         = role.roleSessionName || '';

  openModal('role-modal');
  setTimeout(() => {
    const input = document.getElementById('role-input-name');
    input.focus();
    input.select(); // bôi đen toàn bộ để dễ sửa
  }, 80);
}

/* ════════════════════════════════════════
   SUBMIT: Thêm hoặc Sửa
   ════════════════════════════════════════ */
async function roleSession_submit() {
  // Chặn double-submit
  if (_roleSessionState.submitting) return;

  const input     = document.getElementById('role-input-name');
  const submitBtn = document.getElementById('role-modal-submit');
  const errorEl   = document.getElementById('role-input-error');

  const name = input.value.trim();

  // ── Validate ──
  if (!name) {
    _roleSession_showInputError('Tên vai trò không được để trống.');
    input.focus();
    return;
  }
  if (name.length > 100) {
    _roleSession_showInputError('Tên vai trò tối đa 100 ký tự.');
    input.focus();
    return;
  }

  // ── Kiểm tra trùng tên (client-side) ──
  const duplicate = _roleSessionState.list.find(r =>
    r.roleSessionName?.toLowerCase() === name.toLowerCase() &&
    r._id !== _roleSessionState.editingId
  );
  if (duplicate) {
    _roleSession_showInputError('Tên vai trò này đã tồn tại.');
    input.focus();
    return;
  }

  _roleSession_hideInputError();

  // ── Gọi API ──
  _roleSessionState.submitting = true;
  submitBtn.disabled    = true;
  submitBtn.textContent = 'Đang lưu...';

  try {
    if (_roleSessionState.editingId) {
      // === SỬA ===
      await RoleSessionAPI.update(_roleSessionState.editingId, { roleSessionName: name });
      showToast('Cập nhật vai trò thành công!', 'success');
    } else {
      // === THÊM MỚI ===
      await RoleSessionAPI.create({ roleSessionName: name });
      showToast('Thêm vai trò thành công!', 'success');
    }

    roleSession_closeModal();
    await _roleSession_loadList(); // reload để lấy data mới nhất từ server

  } catch (err) {
    console.error('[RoleSession] submit:', err);
    _roleSession_showInputError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    input.focus();
  } finally {
    _roleSessionState.submitting = false;
    submitBtn.disabled    = false;
    submitBtn.textContent = _roleSessionState.editingId ? 'Cập nhật' : 'Thêm';
  }
}

/* ════════════════════════════════════════
   XÓA — mở confirm dialog
   ════════════════════════════════════════ */
function roleSession_openDelete(id) {
  const role = _roleSessionState.list.find(r => r._id === id);
  if (!role) return;

  _roleSessionState.deletingId = id;
  document.getElementById('role-confirm-name').textContent =
    `"${role.roleSessionName || 'Không rõ tên'}"`;

  openModal('role-confirm-modal');
}

async function roleSession_confirmDelete() {
  const id  = _roleSessionState.deletingId;
  if (!id) return;

  const btn = document.getElementById('role-confirm-delete-btn');
  btn.disabled    = true;
  btn.textContent = 'Đang xóa...';

  try {
    await RoleSessionAPI.delete(id);
    showToast('Đã xóa vai trò.', 'success');
    closeModal('role-confirm-modal');
    _roleSessionState.deletingId = null;
    await _roleSession_loadList();
  } catch (err) {
    console.error('[RoleSession] delete:', err);
    showToast(err.message || 'Xóa thất bại. Vui lòng thử lại.', 'danger');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Xóa';
  }
}

/* ════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════ */
function roleSession_closeModal() {
  closeModal('role-modal');
  _roleSession_resetForm();
  _roleSessionState.editingId = null;
}

function _roleSession_resetForm() {
  document.getElementById('role-input-name').value = '';
  _roleSession_hideInputError();
}

function _roleSession_showInputError(msg) {
  const el = document.getElementById('role-input-error');
  el.textContent    = msg;
  el.style.display  = 'block';
  document.getElementById('role-input-name').classList.add('role-input-invalid');
}

function _roleSession_hideInputError() {
  const el = document.getElementById('role-input-error');
  el.style.display = 'none';
  el.textContent   = '';
  document.getElementById('role-input-name').classList.remove('role-input-invalid');
}

function _roleSession_showSkeleton(show) {
  const sk = document.getElementById('role-skeleton');
  if (sk) sk.style.display = show ? 'block' : 'none';
}

function _roleSession_showEmpty() {
  document.getElementById('role-table-wrap').style.display = 'none';
  document.getElementById('role-empty').style.display      = 'block';
  const countEl = document.getElementById('role-count');
  if (countEl) countEl.textContent = '0 vai trò';
  const paginEl = document.getElementById('role-pagination');
  if (paginEl) paginEl.innerHTML = '';
}