# 接口文档 API

Base URL：`http://127.0.0.1:3000/api`（端口可用环境变量 `PORT` 覆盖）
所有请求/响应均为 `application/json`（Excel 下载除外），`charset=utf-8`。

## 数据模型

```jsonc
{
  "id": "1b0c…",                  // 服务端生成的 UUID
  "name": "陈文俊",                // 必填，≤40 字，全局唯一
  "group": "同学",                // 默认「未分组」
  "note": "软件工程课队友",          // 备注，≤200 字
  "starred": true,                // 是否收藏
  "methods": [                    // 联系方式，数量不限
    { "id": "…", "type": "phone",  "label": "本人",   "value": "13800001234" },
    { "id": "…", "type": "email",  "label": "学校邮箱", "value": "832401202@fzu.edu.cn" }
  ],
  "createdAt": "2026-11-16T09:00:00.000Z",
  "updatedAt": "2026-11-16T09:00:00.000Z"
}
```

`methods[].type` 取值：`phone` | `email` | `wechat` | `qq` | `address` | `other`
（传其它值会被归为 `other`，空 `value` 的条目会被丢弃，同类型同值自动去重）。

## 接口一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/contacts` | 查询联系人列表 |
| POST | `/api/contacts` | 新建联系人 |
| GET | `/api/contacts/:id` | 查询单个联系人 |
| PUT | `/api/contacts/:id` | 全量更新联系人 |
| PATCH | `/api/contacts/:id` | 局部更新（如收藏状态） |
| DELETE | `/api/contacts/:id` | 删除联系人 |
| GET | `/api/stats` | 统计信息（总数/收藏数/分组数/联系方式数） |
| GET | `/api/export.xlsx` | 导出 Excel |
| GET | `/api/template.xlsx` | 下载导入模板 |
| POST | `/api/import` | 导入 Excel（base64） |

---

### GET /api/health

```json
{ "ok": true, "service": "contact-book-backend", "time": "2026-11-16T09:00:00.000Z" }
```

### GET /api/contacts

| 查询参数 | 说明 | 默认 |
| --- | --- | --- |
| `q` | 关键字，匹配姓名、分组、备注、各联系方式的值与备注 | 空 |
| `filter` | `all` 或 `starred`（只看收藏） | `all` |
| `group` | 按分组精确筛选 | 空 |
| `sort` | `starred`（收藏优先再按姓名）/ `name` / `updated` | `starred` |

```json
{ "total": 6, "data": [ /* 联系人数组，收藏者置顶 */ ] }
```

### POST /api/contacts

请求体即联系人对象（`id`、`createdAt` 可省略）。成功返回 `201` 与新对象。

| 情况 | 返回 |
| --- | --- |
| 姓名重复 | `409 { "error": "已存在同名联系人：陈文俊" }` |
| 姓名为空 | `400 { "error": "联系人姓名不能为空" }` |

### PUT /api/contacts/:id

整体替换（未传的字段按模型默认值处理），`createdAt` 保留。`404` = 不存在，`409` = 与其它联系人重名。

### PATCH /api/contacts/:id

支持局部字段，最常用的是切换收藏：

```json
{ "starred": true }
```

不传 `starred` 时执行「取反」。

### DELETE /api/contacts/:id

```json
{ "ok": true, "removed": { /* 被删除的联系人 */ } }
```

### GET /api/stats

```json
{
  "total": 6, "starred": 3, "groups": 5, "methods": 16,
  "groupList": [ { "name": "同学", "count": 2 } ]
}
```

### GET /api/export.xlsx

`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
`Content-Disposition: attachment; filename="contacts-20261116.xlsx"`

列：`姓名 | 分组 | 收藏 | 备注 | 手机 | 邮箱 | 微信 | QQ | 地址 | 其他 | 创建时间`
同一联系人的多条联系方式合并进对应单元格，用 `；` 分隔，并保留备注：`13800001234（本人）`。

### GET /api/template.xlsx

返回仅含表头 + 两行示例的导入模板。

### POST /api/import

```json
{
  "filename": "contacts.xlsx",
  "contentBase64": "UEsDBBQ…"
}
```

```json
{ "parsed": 4, "imported": 3, "skipped": 1, "errors": [] }
```

- `parsed`：文件中的有效数据行数
- `skipped`：与库中已有记录重复而跳过的条数（判重规则：姓名相同且全部联系方式已存在）
- 同名但联系方式不同的记录会自动追加 `(2)`、`(3)` 后缀，不会整体失败
- 表头支持中英文别名（`姓名/name`、`手机/电话/phone`、`邮箱/email`…），列顺序任意

## 错误格式

```json
{ "error": "可读的中文错误说明" }
```

状态码：`400` 参数错误 · `404` 资源不存在 · `405` 方法不支持 · `409` 冲突 · `413` 上传过大 · `500` 服务端错误。
