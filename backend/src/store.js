/**
 * store.js —— 通讯录数据层
 * 使用本地 JSON 文件持久化（backend/data/contacts.json），不引入数据库依赖，
 * 保证任何评审者 clone 后都能直接 `node src/server.js` 跑起来。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'contacts.json');

/** 允许的联系方式类型 */
const METHOD_TYPES = ['phone', 'email', 'wechat', 'qq', 'address', 'other'];

let state = null;

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    state = { contacts: [] };
    persist();
  }
}

function persist() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function load() {
  if (state) return state;
  ensureFile();
  if (!state) {
    try {
      state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
      // 文件损坏时保留原文件并重新初始化，避免服务直接 500
      const backup = DATA_FILE + '.corrupt-' + Date.now();
      try { fs.copyFileSync(DATA_FILE, backup); } catch (_) {}
      state = { contacts: [] };
      persist();
    }
  }
  if (!state || !Array.isArray(state.contacts)) state = { contacts: [] };
  return state;
}

function newId() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function cleanText(value, max = 120) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

/**
 * 规范化联系方式：过滤空值，类型非法时归为 other
 */
function normalizeMethods(methods) {
  if (!Array.isArray(methods)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of methods) {
    if (!raw) continue;
    const value = cleanText(raw.value, 120);
    if (!value) continue;
    const type = METHOD_TYPES.includes(raw.type) ? raw.type : 'other';
    const label = cleanText(raw.label, 20);
    const key = type + '|' + value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: raw.id || newId(), type, label, value });
  }
  return out;
}

function normalizeContact(input) {
  const name = cleanText(input.name, 40);
  if (!name) {
    const err = new Error('联系人姓名不能为空');
    err.status = 400;
    throw err;
  }
  return {
    id: input.id || newId(),
    name,
    group: cleanText(input.group, 20) || '未分组',
    note: cleanText(input.note, 200),
    starred: Boolean(input.starred),
    methods: normalizeMethods(input.methods),
    createdAt: input.createdAt || now(),
    updatedAt: now(),
  };
}

function all() {
  return load().contacts;
}

function getById(id) {
  return all().find((c) => c.id === id) || null;
}

/**
 * 排序：收藏优先始终是第一准则（需求 2.1：收藏联系人应易被访问）
 */
function sortContacts(list, sort) {
  const collator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base' });
  const byName = (a, b) => collator.compare(a.name, b.name);
  if (sort === 'name') return list.sort(byName);
  if (sort === 'updated') {
    return list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || byName(a, b));
  }
  return list.sort((a, b) => Number(b.starred) - Number(a.starred) || byName(a, b));
}

function searchText(contact) {
  return [contact.name, contact.group, contact.note]
    .concat(contact.methods.map((m) => m.value + ' ' + m.label))
    .join(' ')
    .toLowerCase();
}

/**
 * @param {{q?:string, filter?:'all'|'starred', group?:string, sort?:string}} query
 */
function query({ q = '', filter = 'all', group = '', sort = 'starred' } = {}) {
  let list = all().slice();
  if (filter === 'starred') list = list.filter((c) => c.starred);
  if (group) list = list.filter((c) => c.group === group);
  const keyword = String(q || '').trim().toLowerCase();
  if (keyword) list = list.filter((c) => searchText(c).includes(keyword));
  sortContacts(list, sort);
  return list;
}

function create(input) {
  const contact = normalizeContact(input);
  ensureUniqueName(contact.name);
  load().contacts.push(contact);
  persist();
  return contact;
}

function ensureUniqueName(name, exceptId) {
  const exists = all().some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    const err = new Error('已存在同名联系人：' + name);
    err.status = 409;
    throw err;
  }
}

function update(id, input) {
  const target = getById(id);
  if (!target) {
    const err = new Error('联系人不存在');
    err.status = 404;
    throw err;
  }
  const next = normalizeContact({ ...target, ...input, id });
  ensureUniqueName(next.name, id);
  Object.assign(target, next);
  persist();
  return target;
}

function toggleStar(id, starred) {
  const target = getById(id);
  if (!target) {
    const err = new Error('联系人不存在');
    err.status = 404;
    throw err;
  }
  target.starred = typeof starred === 'boolean' ? starred : !target.starred;
  target.updatedAt = now();
  persist();
  return target;
}

function remove(id) {
  const contacts = load().contacts;
  const index = contacts.findIndex((c) => c.id === id);
  if (index < 0) {
    const err = new Error('联系人不存在');
    err.status = 404;
    throw err;
  }
  const [removed] = contacts.splice(index, 1);
  persist();
  return removed;
}

/**
 * 批量导入：按「姓名 + 该条记录的全部联系方式」判重
 * @returns {{imported:number, skipped:number, errors:string[]}}
 */
function importMany(items) {
  load();
  const result = { imported: 0, skipped: 0, errors: [] };
  if (!Array.isArray(items)) return result;

  for (const raw of items) {
    try {
      const candidate = normalizeContact(raw);
      const duplicate = all().some((c) => {
        if (c.name.toLowerCase() !== candidate.name.toLowerCase()) return false;
        const key = (m) => m.type + '|' + m.value.toLowerCase();
        const existing = new Set(c.methods.map(key));
        return candidate.methods.length === 0 || candidate.methods.every((m) => existing.has(key(m)));
      });
      if (duplicate) {
        result.skipped += 1;
        continue;
      }
      // 导入时同名但信息不同的记录，追加序号避免整体失败
      let name = candidate.name;
      let i = 2;
      while (all().some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        name = candidate.name + '(' + i + ')';
        i += 1;
      }
      candidate.name = name;
      all().push(candidate);
      result.imported += 1;
    } catch (err) {
      result.errors.push(err.message + '：' + (raw && raw.name ? raw.name : '未命名'));
    }
  }
  if (result.imported > 0) persist();
  return result;
}

function stats() {
  const contacts = all();
  const groups = new Set(contacts.map((c) => c.group).filter(Boolean));
  return {
    total: contacts.length,
    starred: contacts.filter((c) => c.starred).length,
    groups: groups.size,
    methods: contacts.reduce((sum, c) => sum + c.methods.length, 0),
    groupList: Array.from(groups).sort().map((name) => ({
      name,
      count: contacts.filter((c) => c.group === name).length,
    })),
  };
}

function replaceAll(contacts) {
  load().contacts = contacts.map(normalizeContact);
  persist();
  return load().contacts;
}

/** 首次运行写入演示数据，方便直接看到界面效果（可用 DELETE /api/contacts 清空） */
const SEED = [
  {
    name: '陈文俊',
    group: '同学',
    starred: true,
    note: '软件工程课队友，负责前端页面',
    methods: [
      { type: 'phone', label: '本人', value: '13800001234' },
      { type: 'email', label: '学校邮箱', value: '832401202@fzu.edu.cn' },
      { type: 'wechat', label: '微信', value: 'cwj_268450' },
      { type: 'address', label: '宿舍', value: '福州大学旗山校区 3 号楼 512' },
    ],
  },
  {
    name: '林嘉怡',
    group: '同学',
    starred: true,
    note: '小组汇报搭档',
    methods: [
      { type: 'phone', label: '本人', value: '13911112222' },
      { type: 'qq', label: 'QQ', value: '1180012345' },
    ],
  },
  {
    name: 'Dr. Mueller',
    group: '老师',
    starred: false,
    note: 'EE308FZ 课程教师',
    methods: [
      { type: 'email', label: 'Office', value: 'mueller@fzu-mu.edu' },
      { type: 'phone', label: 'Office', value: '+86 591 2286 0000' },
    ],
  },
  {
    name: '张伟',
    group: '朋友',
    starred: false,
    methods: [
      { type: 'phone', label: '本人', value: '13655556666' },
      { type: 'wechat', label: '微信', value: 'zhangwei_88' },
      { type: 'address', label: '家庭', value: '福州市仓山区金山街道 12 号' },
    ],
  },
  {
    name: '王思远',
    group: '同事',
    starred: false,
    note: '实习期间的项目联系人',
    methods: [
      { type: 'phone', label: '工作', value: '13722223333' },
      { type: 'email', label: '工作邮箱', value: 'siyuan.wang@example.com' },
    ],
  },
  {
    name: '李静',
    group: '家人',
    starred: true,
    methods: [
      { type: 'phone', label: '手机', value: '13512345678' },
      { type: 'wechat', label: '微信', value: 'lijing_family' },
    ],
  },
];

function seedIfEmpty() {
  load();
  if (all().length === 0) {
    SEED.forEach((item) => {
      const contact = normalizeContact(item);
      contact.createdAt = now();
      all().push(contact);
    });
    persist();
  }
}

module.exports = {
  METHOD_TYPES,
  all,
  query,
  getById,
  create,
  update,
  toggleStar,
  remove,
  importMany,
  stats,
  replaceAll,
  seedIfEmpty,
  DATA_FILE,
};

