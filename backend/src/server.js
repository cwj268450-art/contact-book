/**
 * server.js —— HTTP 服务入口
 * 职责：
 *   1) 托管前端静态资源（frontend/），前后端同源部署但不共享代码
 *   2) 提供通讯录 REST API
 *   3) 提供 Excel 导出 / 模板下载 / 导入解析
 * 零第三方运行时依赖，`node src/server.js` 即可启动。
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const store = require('./store');
const xlsxIo = require('./xlsx-io');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
const MAX_BODY = 25 * 1024 * 1024; // 25MB，足够容纳较大的 Excel

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendFile(res, filePath, downloadName) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: '文件不存在' });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
    };
    if (downloadName) {
      headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(downloadName)}"`;
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('请求体过大'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(Object.assign(new Error('请求体不是合法 JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/** 静态资源：只允许访问 frontend 目录内的文件 */
function serveStatic(req, res, pathname) {
  const relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const target = path.join(FRONTEND_DIR, relative);

  if (!target.startsWith(FRONTEND_DIR)) {
    sendJson(res, 403, { error: '禁止访问该路径' });
    return;
  }
  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      // 前端是单页应用，未知路径回退到 index.html
      sendFile(res, path.join(FRONTEND_DIR, 'index.html'));
      return;
    }
    sendFile(res, target);
  });
}

async function handleApi(req, res, pathname, queryObj) {
  const method = req.method;
  const query = queryObj || {};
  const str = (value) => (Array.isArray(value) ? String(value[0] || '') : String(value == null ? '' : value));

  // 健康检查
  if (pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'contact-book-backend', version: '1.0.0', time: new Date().toISOString() });
    return;
  }

  if (pathname === '/api/stats') {
    sendJson(res, 200, store.stats());
    return;
  }

  // 列表
  if (pathname === '/api/contacts' && method === 'GET') {
    const q = str(query.q);
    const filter = str(query.filter) === 'starred' ? 'starred' : 'all';
    const group = str(query.group);
    const sort = str(query.sort) || 'starred';
    const list = store.query({ q, filter, group, sort });
    sendJson(res, 200, { total: list.length, data: list });
    return;
  }

  // 新建
  if (pathname === '/api/contacts' && method === 'POST') {
    const body = await readBody(req);
    sendJson(res, 201, store.create(body));
    return;
  }

  // 导出 xlsx
  if (pathname === '/api/export.xlsx' && method === 'GET') {
    const list = store.query({ sort: 'starred' });
    const buffer = xlsxIo.exportBuffer(list);
    const name = `contacts-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.writeHead(200, {
      'Content-Type': MIME['.xlsx'],
      'Content-Length': buffer.length,
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    });
    res.end(buffer);
    return;
  }

  // 导入模板
  if (pathname === '/api/template.xlsx' && method === 'GET') {
    const buffer = xlsxIo.templateBuffer();
    res.writeHead(200, {
      'Content-Type': MIME['.xlsx'],
      'Content-Length': buffer.length,
      'Content-Disposition': 'attachment; filename="contacts-template.xlsx"',
    });
    res.end(buffer);
    return;
  }

  // 导入（前端把 xlsx 文件转成 base64 放进 JSON，避免手工解析 multipart）
  if (pathname === '/api/import' && method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.contentBase64) {
      sendJson(res, 400, { error: '缺少文件内容（contentBase64）' });
      return;
    }
    const buffer = Buffer.from(String(body.contentBase64), 'base64');
    if (!buffer.length) {
      sendJson(res, 400, { error: '上传的文件为空' });
      return;
    }
    let parsed;
    try {
      parsed = xlsxIo.parseBuffer(buffer);
    } catch (err) {
      sendJson(res, 400, { error: '无法解析该 Excel 文件：' + err.message });
      return;
    }
    if (!parsed.length) {
      sendJson(res, 400, { error: '文件中没有可导入的联系人（请检查表头是否包含「姓名」）' });
      return;
    }
    const result = store.importMany(parsed);
    sendJson(res, 200, { ...result, parsed: parsed.length });
    return;
  }

  // 单个联系人
  const match = pathname.match(/^\/api\/contacts\/([A-Za-z0-9-]+)$/);
  if (match) {
    const id = match[1];
    if (method === 'GET') {
      const contact = store.getById(id);
      if (!contact) return sendJson(res, 404, { error: '联系人不存在' });
      return sendJson(res, 200, contact);
    }
    if (method === 'PUT') {
      const body = await readBody(req);
      return sendJson(res, 200, store.update(id, body));
    }
    if (method === 'PATCH') {
      const body = await readBody(req);
      // 仅允许更新收藏状态（其余字段走 PUT）
      const contact = store.toggleStar(id, typeof body.starred === 'boolean' ? body.starred : undefined);
      return sendJson(res, 200, contact);
    }
    if (method === 'DELETE') {
      store.remove(id);
      return sendJson(res, 200, { ok: true });
    }
  }

  sendJson(res, 404, { error: '未知接口：' + method + ' ' + pathname });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';

  // 前后端分离，开发时前端可用其它端口，这里统一放开 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname, parsed.query)
      .catch((err) => {
        const status = err.status || 500;
        sendJson(res, status, { error: err.message || '服务器内部错误' });
        if (status >= 500) console.error('[api]', pathname, err);
      });
    return;
  }

  serveStatic(req, res, pathname);
});

store.seedIfEmpty();

server.listen(PORT, HOST, () => {
  console.log(`通讯录后端已启动：http://127.0.0.1:${PORT}  (静态目录 ${FRONTEND_DIR})`);
  console.log(`数据文件：${store.DATA_FILE}`);
});
