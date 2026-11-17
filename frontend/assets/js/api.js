/**
 * api.js —— 前端与后端 REST API 的唯一通道
 * 所有网络细节集中在这里，app.js 只负责界面与交互。
 */
'use strict';

const API = (() => {
  const BASE = '';

  async function request(path, options = {}) {
    const response = await fetch(BASE + path, {
      headers: options.body ? { 'Content-Type': 'application/json' } : {},
      ...options,
    });
    const type = response.headers.get('content-type') || '';
    if (!response.ok) {
      let message = `请求失败（${response.status}）`;
      if (type.includes('application/json')) {
        const payload = await response.json().catch(() => null);
        if (payload && payload.error) message = payload.error;
      }
      throw new Error(message);
    }
    return type.includes('application/json') ? response.json() : response;
  }

  function toQuery(params) {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') search.set(key, value);
    });
    const text = search.toString();
    return text ? `?${text}` : '';
  }

  function readAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(new Error('读取本地文件失败'));
      reader.readAsDataURL(file);
    });
  }

  return {
    health: () => request('/api/health'),
    stats: () => request('/api/stats'),
    list: (params) => request('/api/contacts' + toQuery(params)),
    detail: (id) => request(`/api/contacts/${id}`),
    create: (payload) => request('/api/contacts', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    toggleStar: (id, starred) => request(`/api/contacts/${id}`, { method: 'PATCH', body: JSON.stringify({ starred }) }),
    remove: (id) => request(`/api/contacts/${id}`, { method: 'DELETE' }),
    importXlsx: async (file) => {
      const contentBase64 = await readAsBase64(file);
      return request('/api/import', { method: 'POST', body: JSON.stringify({ filename: file.name, contentBase64 }) });
    },
    exportUrl: '/api/export.xlsx',
    templateUrl: '/api/template.xlsx',
  };
})();
