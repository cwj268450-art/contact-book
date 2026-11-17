/**
 * xlsx-io.js —— Excel 导入导出
 *
 * 导出格式（一行一联系人，一列一种信息）：
 *   姓名 | 分组 | 收藏 | 备注 | 手机 | 邮箱 | 微信 | QQ | 地址 | 其他 | 创建时间
 * 同一类型的多条信息用「；」分隔写在同一格，保证「每个联系人占一行」。
 *
 * 导入：兼容上面这种导出格式，也兼容常见的中英文表头（name / phone / email ...）。
 */
'use strict';

const XLSX = require('../vendor/xlsx.full.min.js');
const { METHOD_TYPES } = require('./store');

const HEADERS = ['姓名', '分组', '收藏', '备注', '手机', '邮箱', '微信', 'QQ', '地址', '其他', '创建时间'];

const TYPE_LABEL = {
  phone: '手机',
  email: '邮箱',
  wechat: '微信',
  qq: 'QQ',
  address: '地址',
  other: '其他',
};

/** 表头别名 -> 内部字段 */
const HEADER_ALIAS = {
  姓名: 'name', name: 'name', 名字: 'name', 联系人: 'name', 名字name: 'name',
  分组: 'group', group: 'group', 分类: 'group', 标签: 'group',
  收藏: 'starred', starred: 'starred', favorite: 'starred', 收藏联系人: 'starred',
  备注: 'note', note: 'note', 说明: 'note',
  手机: 'phone', 电话: 'phone', phone: 'phone', mobile: 'phone', tel: 'phone', 手机号: 'phone',
  邮箱: 'email', email: 'email', mail: 'email', e_mail: 'email',
  微信: 'wechat', wechat: 'wechat', weixin: 'wechat',
  qq: 'qq', QQ: 'qq', qq号: 'qq',
  地址: 'address', address: 'address', addr: 'address', 住址: 'address',
  其他: 'other', other: 'other', 其他方式: 'other',
  创建时间: 'createdAt', createdAt: 'createdAt', created_at: 'createdAt',
};

function normalizeHeader(value) {
  return String(value || '').replace(/\s+/g, '').replace(/[（）()]/g, '').toLowerCase();
}

function fieldOf(header) {
  const key = normalizeHeader(header);
  if (!key) return null;
  if (HEADER_ALIAS[key]) return HEADER_ALIAS[key];
  for (const alias of Object.keys(HEADER_ALIAS)) {
    if (normalizeHeader(alias) === key) return HEADER_ALIAS[alias];
  }
  return null;
}

function splitValues(cell) {
  return String(cell == null ? '' : cell)
    .split(/[;；\n\r、,，\/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 导出为 xlsx Buffer
 * @param {Array} contacts
 */
function buildWorkbook(contacts) {
  const rows = [HEADERS.slice()];

  for (const contact of contacts) {
    const buckets = { phone: [], email: [], wechat: [], qq: [], address: [], other: [] };
    for (const method of contact.methods || []) {
      const type = METHOD_TYPES.includes(method.type) ? method.type : 'other';
      const label = method.label ? `${method.value}（${method.label}）` : method.value;
      buckets[type].push(label);
    }
    rows.push([
      contact.name,
      contact.group || '未分组',
      contact.starred ? '是' : '否',
      contact.note || '',
      buckets.phone.join('；'),
      buckets.email.join('；'),
      buckets.wechat.join('；'),
      buckets.qq.join('；'),
      buckets.address.join('；'),
      buckets.other.join('；'),
      contact.createdAt || '',
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 14 }, { wch: 10 }, { wch: 6 }, { wch: 30 },
    { wch: 22 }, { wch: 28 }, { wch: 18 }, { wch: 14 },
    { wch: 34 }, { wch: 22 }, { wch: 22 },
  ];
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '通讯录');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

function exportBuffer(contacts) {
  return buildWorkbook(contacts);
}

/** 导入模板：只有表头 + 两行示例 */
function templateBuffer() {
  return buildWorkbook([
    {
      name: '示例·张三',
      group: '同学',
      starred: true,
      note: '导入后可直接删除这一行示例',
      methods: [
        { type: 'phone', label: '本人', value: '13800001111' },
        { type: 'email', label: '学校邮箱', value: 'zhangsan@example.com' },
        { type: 'wechat', label: '微信', value: 'zhangsan_wx' },
      ],
      createdAt: '',
    },
  ]);
}

/**
 * 解析上传的 xlsx Buffer，返回联系人草稿数组
 * @param {Buffer} buffer
 */
function parseBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', blankrows: false });

  // 找到表头行（第一行包含「姓名/name」的行）
  let headerIndex = matrix.findIndex((row) =>
    row.some((cell) => ['name', '姓名', '名字'].includes(normalizeHeader(cell)))
  );
  if (headerIndex < 0) headerIndex = 0;

  const headers = matrix[headerIndex] || [];
  const mapping = headers.map((h) => fieldOf(h));
  const contacts = [];

  for (let r = headerIndex + 1; r < matrix.length; r += 1) {
    const row = matrix[r] || [];
    const record = { methods: [] };
    let hasValue = false;

    headers.forEach((_, c) => {
      const field = mapping[c];
      const cell = row[c] == null ? '' : String(row[c]).trim();
      if (!cell) return;
      hasValue = true;
      if (!field) return;

      if (field === 'name') record.name = cell;
      else if (field === 'group') record.group = cell;
      else if (field === 'note') record.note = cell;
      else if (field === 'createdAt') record.createdAt = cell;
      else if (field === 'starred') record.starred = /^(是|y|yes|true|1|★)/i.test(cell);
      else if (METHOD_TYPES.includes(field)) {
        splitValues(cell).forEach((value) => {
          // 支持「号码（备注）」形式，还原 label
          const match = value.match(/^(.+?)（(.+?)）$/);
          record.methods.push({
            type: field,
            label: match ? match[2] : '',
            value: match ? match[1].trim() : value,
          });
        });
      }
    });

    if (!hasValue) continue;
    if (!record.name) continue; // 空姓名行直接跳过，避免脏数据
    contacts.push(record);
  }

  return contacts;
}

module.exports = { HEADERS, TYPE_LABEL, exportBuffer, templateBuffer, parseBuffer };
