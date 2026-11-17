# 代码规范 CODE STANDARDS

本项目为双人协作的软件工程作业，以下规范在编码前约定，并在 Code Review 时逐条检查。

## 1. 分支与提交

| 场景 | 约定 |
| --- | --- |
| 主分支 | `main` 保持随时可运行 |
| 功能开发 | `feature/<模块名>`，例如 `feature/xlsx-import` |
| 修复 | `fix/<问题>` |
| 提交信息 | `<type>(<scope>): <说明>`，type 取 `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore` |
| 提交粒度 | 一次提交只做一件事，例如「feat(backend): 增加 Excel 导出接口」 |
| 合并方式 | Pull Request + 至少一次自查，禁止直接 push 到 `main` |

## 2. 目录边界（前后端分离）

- `frontend/` 只放 HTML / CSS / JS，**不得**出现数据库、文件读写、Excel 解析等逻辑。
- `backend/` 只处理数据、校验、Excel、HTTP；**不得**拼接 HTML。
- `frontend/assets/js/api.js` 是前端**唯一**的网络出口，其它 JS 只能调用 `API.*`。
- 跨端契约统一在 `docs/api.md` 中维护，改接口必须同步改文档。

## 3. 命名

| 对象 | 规范 | 示例 |
| --- | --- | --- |
| 文件（前端） | 小写 + 中划线或单词 | `style.css`、`api.js` |
| 文件（后端） | 小写 + 中划线 | `xlsx-io.js`、`store.js` |
| JS 变量/函数 | lowerCamelCase | `normalizeContact`、`renderList` |
| 常量 | UPPER_SNAKE_CASE | `METHOD_TYPES`、`HEADERS` |
| JSON 字段（API） | lowerCamelCase | `createdAt`、`updatedAt` |
| Excel 列名（面向用户） | 中文业务名 | `姓名`、`手机` |

命名必须能自解释：`a1`、`tmp2`、`data1` 一律不允许。

## 4. 后端约定

- 统一 `'use strict'`；模块导出用 `module.exports = { ... }`。
- 所有对外数据必须先经过 `store.normalize*` 校验/清洗（长度、类型、去重）。
- 抛错使用带 `status` 的 `Error`（400 参数错误 / 404 不存在 / 409 冲突 / 413 过大），由 `server.js` 统一转 JSON。
- 文件读写集中在一处（`store.persist`），先写 `.tmp` 再 `rename`，避免半写损坏。
- 禁止在代码中硬编码绝对路径，一律基于 `__dirname` 计算。

## 5. 前端约定

- 不使用框架、不引入构建工具；原生 ES6+ 模块化 IIFE。
- DOM 文本一律通过 `escapeHtml()` 或 `textContent` 输出，**禁止**直接拼接未转义的用户数据。
- 事件统一走委托（`addEventListener` 绑在容器上），避免为每张卡片单独绑定。
- 异步请求必须 `try/catch`，失败给出可读的中文提示（`toast`）。
- 样式集中在 `style.css`，使用 CSS 变量管理颜色，禁止行内写死主题色。

## 6. Excel 相关

- 列名常量唯一来源：`backend/src/xlsx-io.js` 的 `HEADERS`。
- 导出保证「一行一联系人」；同类型多值合并进同一单元格，用 `；` 分隔。
- 导入必须先校验表头、跳过空姓名行，再入库；重复判重规则为「姓名 + 联系方式集合」。

## 7. 注释与文档

- 文件头写职责说明（一段话），公共函数写 JSDoc。
- 复杂分支（如导入判重、编码兼容）必须写「为什么」，而不是「做了什么」。
- 接口变更同步更新 `docs/api.md` 与 `README.md`。

## 8. 提交前自检清单

- [ ] `node backend/src/server.js` 能启动，页面无 404/500。
- [ ] `node backend/tests/smoke.test.js` 全部 PASS。
- [ ] 新增/修改的中文文案无乱码（Excel 导出用 Excel 打开检查）。
- [ ] 没有残留 `console.log` 调试输出、临时文件、个人绝对路径。
- [ ] 提交信息符合第 1 节格式。
