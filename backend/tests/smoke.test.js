/**
 * smoke.test.js —— 冒烟测试
 * 覆盖：健康检查 / 新建 / 多联系方式 / 收藏 / 编辑 / 导出 Excel / 重复导入 / 删除
 * 用法：先启动后端，再执行 `node backend/tests/smoke.test.js`
 */
'use strict';

const XLSX = require('../vendor/xlsx.full.min.js');

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const HEADERS = ['姓名', '分组', '收藏', '备注', '手机', '邮箱', '微信', 'QQ', '地址', '其他', '创建时间'];

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function call(path, options) {
  const response = await fetch(BASE + path, {
    headers: options && options.body ? { 'Content-Type': 'application/json' } : {},
    ...(options || {}),
  });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('json') ? await response.json() : await response.arrayBuffer();
  if (!response.ok) throw new Error(`${path} -> ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

async function main() {
  console.log('通讯录后端冒烟测试 @ ' + BASE);

  // 1. 健康检查
  const health = await call('/api/health');
  check('服务健康检查', health.ok === true, health.service);

  // 2. 新建联系人（5 种联系方式）
  const created = await call('/api/contacts', {
    method: 'POST',
    body: JSON.stringify({
      name: '冒烟测试-' + Date.now(),
      group: '自动化测试',
      note: '由 smoke.test.js 创建',
      starred: false,
      methods: [
        { type: 'phone', label: '本人', value: '13900000001' },
        { type: 'email', label: '学校', value: 'smoke@fzu.edu.cn' },
        { type: 'wechat', label: '微信', value: 'smoke_wx' },
        { type: 'qq', label: 'QQ', value: '10001234' },
        { type: 'address', label: '宿舍', value: '福州大学 3 号楼' },
      ],
    }),
  });
  check('新建联系人', Boolean(created.id), created.name);
  check('一个联系人保存多种联系方式', created.methods.length === 5, `${created.methods.length} 条`);

  // 3. 收藏
  const starred = await call(`/api/contacts/${created.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ starred: true }),
  });
  check('收藏联系人', starred.starred === true);

  // 4. 再次取消收藏后重新收藏，验证幂等
  await call(`/api/contacts/${created.id}`, { method: 'PATCH', body: JSON.stringify({ starred: false }) });
  const reStarred = await call(`/api/contacts/${created.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ starred: true }),
  });
  check('收藏状态可切换', reStarred.starred === true);

  // 5. 编辑
  const updated = await call(`/api/contacts/${created.id}`, {
    method: 'PUT',
    body: JSON.stringify({ note: '已通过编辑接口更新', group: '自动化测试' }),
  });
  check('编辑联系人', updated.note === '已通过编辑接口更新');

  // 6. 导出 Excel
  const buffer = Buffer.from(await call('/api/export.xlsx'));
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  check('导出文件可被 Excel 解析', workbook.SheetNames.length > 0, workbook.SheetNames[0]);
  check('表头列名完整', HEADERS.every((h, i) => String(rows[0][i]) === h), rows[0].join(' | '));
  const list = await call('/api/contacts');
  check('一行一联系人', rows.length - 1 === list.total, `导出 ${rows.length - 1} 行 / 实际 ${list.total} 位`);

  const exportRow = rows.find((row) => String(row[0]) === created.name);
  check('手机列写入手机号', String(exportRow[4]).includes('13900000001'), String(exportRow[4]));
  check('邮箱列写入邮箱', String(exportRow[5]).includes('smoke@fzu.edu.cn'));
  check('地址列写入地址', String(exportRow[8]).includes('福州大学 3 号楼'));
  check('收藏列标记为「是」', String(exportRow[2]) === '是');

  // 7. 导入（把刚导出的文件原样导回，应该全部判重跳过）
  const base64 = buffer.toString('base64');
  const imported = await call('/api/import', {
    method: 'POST',
    body: JSON.stringify({ filename: 'export-sample.xlsx', contentBase64: base64 }),
  });
  check('导入接口解析成功', imported.parsed >= list.total, `解析 ${imported.parsed} 行`);
  check('重复记录被跳过', imported.skipped >= 1 && imported.imported === 0,
    `导入 ${imported.imported} 条 / 跳过 ${imported.skipped} 条`);

  // 8. 删除
  await call(`/api/contacts/${created.id}`, { method: 'DELETE' });
  const afterDelete = await call('/api/contacts');
  check('删除联系人', !afterDelete.data.some((c) => c.id === created.id));

  // 9. 非法输入
  const bad = await fetch(BASE + '/api/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '' }),
  });
  check('空姓名被拒绝', bad.status === 400, 'HTTP ' + bad.status);

  console.log(`\n结果：PASS ${passed} / FAIL ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('测试异常：', err.message);
  process.exit(1);
});
