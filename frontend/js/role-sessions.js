// ── State nội bộ ──
const _roleSessionState = {
  list:      [],        // mảng vai trò đã fetch về
  editingId: null,      // null = đang thêm mới, string = đang sửa
  deletingId: null,     // id đang chờ xác nhận xóa
  submitting: false,    // chặn double-submit
};

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
    _roleSession_renderTable();
  } catch (err) {
    console.error('[RoleSession] loadList:', err);
    showToast('Không tải được danh sách vai trò.', 'danger');
    _roleSession_showEmpty();
  } finally {
    _roleSession_showSkeleton(false);
  }
}

function _roleSession_renderTable() {
  const list      = _roleSessionState.list;
  const tbody     = document.getElementById('role-table-body');
  const tableWrap = document.getElementById('role-table-wrap');
  const emptyEl   = document.getElementById('role-empty');
  const countEl   = document.getElementById('role-count');

  // Cập nhật badge đếm
  if (countEl) {
    countEl.textContent = `${list.length} vai trò`;
  }

  if (!list.length) {
    tableWrap.style.display = 'none';
    emptyEl.style.display   = 'block';
    return;
  }

  tableWrap.style.display = 'block';
  emptyEl.style.display   = 'none';

  const ROW_COLORS = ['#4361ee','#f72585','#f8961e','#0ba222','#7209b7','#00b4d8','#e63946','#2a9d8f'];

  tbody.innerHTML = list.map((role, idx) => {
    const name    = escapeHtml(role.roleSessionName || '—');
    const created = formatDate(role.createdAt);
    const id      = escapeHtml(role._id);
    const color   = ROW_COLORS[idx % ROW_COLORS.length];
    const delay   = ((idx + 1) * 0.03).toFixed(2);

    return `
      <tr class="role-table-row" data-id="${id}" style="animation-delay:${delay}s">
        <td class="role-cell-stt" style="box-shadow:inset 4px 0 0 0 ${color}">${idx + 1}</td>
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
}
