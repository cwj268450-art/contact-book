/**
 * app.js —— 前端交互层
 * 只通过 api.js 访问后端，不直接接触数据文件。
 */
'use strict';

const TYPES = {
  phone: '手机',
  email: '邮箱',
  wechat: '微信',
  qq: 'QQ',
  address: '地址',
  other: '其他',
};

const AVATAR_COLORS = [
  'linear-gradient(140deg,#8fb4ff,#2f6fed)',
  'linear-gradient(140deg,#7fe0d0,#14b8a6)',
  'linear-gradient(140deg,#ffc98b,#f0a020)',
  'linear-gradient(140deg,#ffa9b0,#e0484d)',
  'linear-gradient(140deg,#b6a6ff,#7c5cf0)',
  'linear-gradient(140deg,#9fd6ff,#2aa8e0)',
];

const state = {
  contacts: [],
  stats: { total: 0, starred: 0, groups: 0, methods: 0, groupList: [] },
  filter: 'all',
  group: '',
  q: '',
  sort: 'starred',
  detailId: null,
  editing: null,
  draftMethods: [],
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initialOf(name) {
  const text = String(name || '').trim();
  if (!text) return '?';
  const first = text[0];
  return /[a-zA-Z]/.test(first) ? first.toUpperCase() : first;
}

function colorOf(name) {
  let hash = 0;
  for (const ch of String(name || '')) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function formatTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* ---------------- 提示条 ---------------- */
function toast(message, kind = '') {
  const wrap = $('#toastWrap');
  const node = document.createElement('div');
  node.className = 'toast' + (kind ? ` is-${kind}` : '');
  node.textContent = message;
  wrap.appendChild(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity .25s ease';
    setTimeout(() => node.remove(), 260);
  }, 3200);
}

/* ---------------- 数据加载 ---------------- */
async function refresh() {
  const params = { q: state.q, filter: state.filter, group: state.group, sort: state.sort };
  const [list, stats] = await Promise.all([API.list(params), API.stats()]);
  state.contacts = list.data || [];
  state.stats = stats;
  renderSidebar();
  renderList();
}

function renderSidebar() {
  $('#countAll').textContent = state.stats.total;
  $('#countStar').textContent = state.stats.starred;
  $('#statMethods').textContent = state.stats.methods;
  $('#statGroups').textContent = state.stats.groups;

  $$('#nav .nav-item').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.filter === state.filter && !state.group);
  });

  const groupList = $('#groupList');
  const groups = state.stats.groupList || [];
  groupList.innerHTML = groups
    .map(
      (group) => `
      <li>
        <button class="group-item ${state.group === group.name ? 'is-active' : ''}" data-group="${escapeHtml(group.name)}">
          <span class="group-dot"></span>
          <span class="group-name">${escapeHtml(group.name)}</span>
          <span class="group-count">${group.count}</span>
        </button>
      </li>`
    )
    .join('');

  const options = $('#groupOptions');
  options.innerHTML = groups.map((g) => `<option value="${escapeHtml(g.name)}"></option>`).join('');
}

function renderList() {
  const grid = $('#cardGrid');
  const empty = $('#emptyState');
  const list = state.contacts;

  $('#resultInfo').innerHTML = state.q
    ? `搜索「${escapeHtml(state.q)}」找到 <strong>${list.length}</strong> 位联系人`
    : `共 <strong>${list.length}</strong> 位联系人${state.filter === 'starred' ? '（收藏）' : ''}${state.group ? '（' + escapeHtml(state.group) + '）' : ''}`;

  if (!list.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = list
    .map((contact) => {
      const methods = contact.methods || [];
      const shown = methods.slice(0, 3);
      const lines = shown
        .map(
          (method) => `
          <li class="method-line">
            <span class="method-tag">${TYPES[method.type] || '其他'}</span>
            <span class="method-value" title="${escapeHtml(method.value)}">${escapeHtml(method.value)}</span>
          </li>`
        )
        .join('');
      const more = methods.length > shown.length ? `<p class="card-more">还有 ${methods.length - shown.length} 条联系方式</p>` : '';

      return `
      <article class="card ${contact.starred ? 'is-starred' : ''}" data-id="${contact.id}">
        <button class="star-btn ${contact.starred ? 'is-on' : ''}" data-star="${contact.id}" title="${contact.starred ? '取消收藏' : '加入收藏'}">
          <svg viewBox="0 0 24 24"><path d="M12 3.4l2.6 5.4 5.9.8-4.3 4.2 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.2 5.9-.8z"/></svg>
        </button>
        <div class="card-head">
          <div class="avatar" style="background:${colorOf(contact.name)}">${escapeHtml(initialOf(contact.name))}</div>
          <div class="card-title">
            <h3 class="card-name">${escapeHtml(contact.name)}</h3>
            <div class="card-chips">
              <span class="chip">${escapeHtml(contact.group || '未分组')}</span>
              ${contact.starred ? '<span class="chip chip-star">★ 收藏</span>' : ''}
            </div>
          </div>
        </div>
        ${lines ? `<ul class="card-methods">${lines}</ul>` : '<p class="card-more">暂无联系方式</p>'}
        ${more}
        <div class="card-foot">
          <span>${methods.length} 条信息</span>
          <span>更新于 ${formatTime(contact.updatedAt)}</span>
        </div>
      </article>`;
    })
    .join('');
}

/* ---------------- 详情 ---------------- */
function currentContact() {
  return state.contacts.find((c) => c.id === state.detailId) || null;
}

async function openDetail(id) {
  state.detailId = id;
  let contact = currentContact();
  if (!contact) {
    contact = await API.detail(id).catch(() => null);
  }
  if (!contact) return;

  $('#detailAvatar').textContent = initialOf(contact.name);
  $('#detailAvatar').style.background = colorOf(contact.name);
  $('#detailName').textContent = contact.name;
  $('#detailGroup').textContent = contact.group || '未分组';
  $('#detailStar').hidden = !contact.starred;
  $('#detailNote').textContent = contact.note ? contact.note : '无备注';
  $('#btnToggleStar').textContent = contact.starred ? '取消收藏' : '收藏';

  const methods = contact.methods || [];
  $('#detailMethods').innerHTML = methods.length
    ? methods
        .map(
          (m) => `
        <li class="detail-method">
          <span class="tag">${TYPES[m.type] || '其他'}</span>
          <span class="val">${escapeHtml(m.value)}</span>
          ${m.label ? `<span class="lab">${escapeHtml(m.label)}</span>` : ''}
        </li>`
        )
        .join('')
        : '<li class="detail-method"><span class="val">暂无联系方式，点击「编辑」添加。</span></li>';

  $('#detailMeta').textContent = `创建于 ${formatTime(contact.createdAt)}　·　更新于 ${formatTime(contact.updatedAt)}`;
  showModal('detail');
}

/* ---------------- 表单 ---------------- */
function renderMethodEditor() {
  const editor = $('#methodEditor');
  if (!state.draftMethods.length) {
    editor.innerHTML = '<p class="form-tip">还没有联系方式，可在下方添加手机、邮箱、微信等。</p>';
    return;
  }
  editor.innerHTML = state.draftMethods
    .map(
      (m, index) => `
      <div class="method-row" data-index="${index}">
        <select data-key="type">
          ${Object.entries(TYPES)
            .map(([key, label]) => `<option value="${key}" ${m.type === key ? 'selected' : ''}>${label}</option>`)
            .join('')}
        </select>
        <input data-key="label" value="${escapeHtml(m.label || '')}" placeholder="备注" maxlength="20" />
        <input data-key="value" value="${escapeHtml(m.value || '')}" placeholder="号码 / 邮箱 / 地址…" maxlength="120" />
        <button type="button" class="method-del" data-del="${index}" title="删除这一条">×</button>
      </div>`
    )
    .join('');
}

function openForm(contact) {
  state.editing = contact ? contact.id : null;
  $('#formTitle').textContent = contact ? '编辑联系人' : '新建联系人';
  $('#fName').value = contact ? contact.name : '';
  $('#fGroup').value = contact ? contact.group || '' : '';
  $('#fNote').value = contact ? contact.note || '' : '';
  $('#fStar').checked = contact ? Boolean(contact.starred) : false;
  state.draftMethods = contact
    ? (contact.methods || []).map((m) => ({ type: m.type, label: m.label || '', value: m.value }))
    : [{ type: 'phone', label: '', value: '' }];
  renderMethodEditor();
  $('#newMethodValue').value = '';
  hideModal('detail');
  showModal('form');
  setTimeout(() => $('#fName').focus(), 60);
}

function addMethodRow(type, value, label = '') {
  state.draftMethods.push({ type: type || 'phone', label, value: value || '' });
  renderMethodEditor();
  const rows = $$('#methodEditor .method-row');
  const last = rows[rows.length - 1];
  if (last) last.querySelector('[data-key="value"]').focus();
}

/* ---------------- 弹层控制 ---------------- */
function showModal(name) {
  $('#' + name + 'Modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function hideModal(name) {
  $('#' + name + 'Modal').hidden = true;
  if ($('#detailModal').hidden && $('#formModal').hidden) document.body.style.overflow = '';
}

/* ---------------- 事件绑定 ---------------- */
function bindEvents() {
  // 侧边筛选
  $('#nav').addEventListener('click', (event) => {
    const button = event.target.closest('.nav-item');
    if (!button) return;
    state.filter = button.dataset.filter;
    state.group = '';
    refresh();
  });

  $('#groupList').addEventListener('click', (event) => {
    const button = event.target.closest('.group-item');
    if (!button) return;
    const group = button.dataset.group;
    state.group = state.group === group ? '' : group;
    state.filter = 'all';
    refresh();
  });

  // 搜索（防抖）
  let timer = null;
  $('#searchInput').addEventListener('input', (event) => {
    clearTimeout(timer);
    const value = event.target.value.trim();
    timer = setTimeout(() => {
      state.q = value;
      refresh();
    }, 220);
  });

  $('#sortSelect').addEventListener('change', (event) => {
    state.sort = event.target.value;
    refresh();
  });

  // 卡片交互
  $('#cardGrid').addEventListener('click', async (event) => {
    const star = event.target.closest('[data-star]');
    if (star) {
      event.stopPropagation();
      const id = star.dataset.star;
      const contact = state.contacts.find((c) => c.id === id);
      try {
        const updated = await API.toggleStar(id, !(contact && contact.starred));
        toast(updated.starred ? `已收藏「${updated.name}」` : `已取消收藏「${updated.name}」`, 'ok');
        await refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }
    const card = event.target.closest('.card');
    if (card) openDetail(card.dataset.id);
  });

  // 详情操作
  $('#detailModal').addEventListener('click', async (event) => {
    if (event.target.closest('[data-close="detail"]')) {
      hideModal('detail');
      return;
    }
    if (event.target.closest('#btnEdit')) {
      const contact = currentContact();
      if (contact) openForm(contact);
      return;
    }
    if (event.target.closest('#btnToggleStar')) {
      const contact = currentContact();
      if (!contact) return;
      try {
        const updated = await API.toggleStar(contact.id, !contact.starred);
        toast(updated.starred ? '已加入收藏' : '已取消收藏', 'ok');
        hideModal('detail');
        await refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }
    if (event.target.closest('#btnDelete')) {
      const contact = currentContact();
      if (!contact) return;
      if (!window.confirm(`确定删除「${contact.name}」吗？此操作不可撤销。`)) return;
      try {
        await API.remove(contact.id);
        hideModal('detail');
        toast('已删除联系人', 'ok');
        await refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });

  // 表单
  $('#formModal').addEventListener('click', (event) => {
    if (event.target.closest('[data-close="form"]')) hideModal('form');
    const del = event.target.closest('[data-del]');
    if (del) {
      state.draftMethods.splice(Number(del.dataset.del), 1);
      renderMethodEditor();
    }
  });

  $('#methodEditor').addEventListener('change', (event) => {
    const row = event.target.closest('.method-row');
    if (!row) return;
    const index = Number(row.dataset.index);
    const key = event.target.dataset.key;
    if (!key || !state.draftMethods[index]) return;
    state.draftMethods[index][key] = event.target.value;
  });

  $('#methodEditor').addEventListener('input', (event) => {
    const row = event.target.closest('.method-row');
    if (!row) return;
    const index = Number(row.dataset.index);
    const key = event.target.dataset.key;
    if (!key || !state.draftMethods[index]) return;
    state.draftMethods[index][key] = event.target.value;
  });

  $('#btnAddMethod').addEventListener('click', () => {
    const value = $('#newMethodValue').value.trim();
    const type = $('#newMethodType').value;
    if (!value) {
      toast('请先输入联系方式内容', 'error');
      return;
    }
    addMethodRow(type, value);
    $('#newMethodValue').value = '';
    $('#newMethodValue').focus();
  });

  $('#newMethodValue').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      $('#btnAddMethod').click();
    }
  });

  $('#contactForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = $('#fName').value.trim();
    if (!name) {
      toast('姓名不能为空', 'error');
      return;
    }
    const methods = state.draftMethods
      .map((m) => ({ type: m.type, label: (m.label || '').trim(), value: (m.value || '').trim() }))
      .filter((m) => m.value);

    const payload = {
      name,
      group: $('#fGroup').value.trim(),
      note: $('#fNote').value.trim(),
      starred: $('#fStar').checked,
      methods,
    };

    try {
      if (state.editing) {
        await API.update(state.editing, payload);
        toast('联系人已更新', 'ok');
      } else {
        await API.create(payload);
        toast('联系人已创建', 'ok');
      }
      hideModal('form');
      await refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('#btnNew').addEventListener('click', () => openForm(null));

  // Excel
  $('#btnExport').addEventListener('click', () => {
    window.location.href = API.exportUrl;
    toast('正在导出 Excel…', 'ok');
  });

  $('#btnTemplate').addEventListener('click', () => {
    window.location.href = API.templateUrl;
  });

  $('#btnImport').addEventListener('click', () => $('#fileInput').click());

  $('#fileInput').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const result = await API.importXlsx(file);
      const parts = [`导入成功 ${result.imported} 条`];
      if (result.skipped) parts.push(`跳过重复 ${result.skipped} 条`);
      if (result.errors && result.errors.length) parts.push(`失败 ${result.errors.length} 条`);
      toast(parts.join('，'), result.imported ? 'ok' : 'error');
      await refresh();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      event.target.value = '';
    }
  });

  // 快捷键
  window.addEventListener('keydown', (event) => {
    if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      event.preventDefault();
      $('#searchInput').focus();
    }
    if (event.key === 'Escape') {
      hideModal('detail');
      hideModal('form');
    }
  });

  $$('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target.classList.contains('modal-backdrop')) hideModal(modal.id.replace('Modal', ''));
    });
  });
}

/* ---------------- 启动 ---------------- */
async function boot() {
  bindEvents();
  try {
    await API.health();
  } catch (err) {
    toast('后端服务未响应，请确认已执行 node backend/src/server.js', 'error');
  }
  try {
    await refresh();
  } catch (err) {
    toast('加载通讯录失败：' + err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', boot);
