# 极限编程（Extreme Programming）通讯录作业：前后端分离实现收藏、多联系方式与 Excel 导入导出

> 课程：EE308FZ 软件工程 · 2601_FZU-MU_SE
> 本文为极限编程（Extreme Programming）第一次作业的完整实现记录，包含需求拆解、技术方案、实现思路、关键代码、踩坑记录、测试证据与分工说明。

## 一、作业信息表

| 项目 | 内容 |
| --- | --- |
| 本次作业课程 | 2601_FZU-MU_SE（福州大学 EE308FZ 软件工程） |
| 团队名称 | FZU-Contact-Book（个人独立完成） |
| 作业要求 | [CSDN 作业帖：Extreme Programming（Deadline: November 17, 2026, 23:59）](https://bbs.csdn.net/topics/620593436) |
| 本次作业目标 | 用极限编程的迭代思路完成一个通讯录 Web 应用：收藏联系人（25 分）、一个联系人多种联系方式（10 分）、Excel 导入导出（25 分）、页面样式（10 分），并沉淀可评审的仓库、提交记录、截图与文档 |
| 代码仓库 | [链接](https://github.com/cwj268450-art/contact-book) |
| 发行版本 | [链接](https://github.com/cwj268450-art/contact-book/releases/tag/v1.0.0) |
| Pull Request | [链接](https://github.com/cwj268450-art/contact-book/pull/1) |
| 提交历史 | [链接](https://github.com/cwj268450-art/contact-book/commits/main) |
| 代码规范 | [链接](https://github.com/cwj268450-art/contact-book/blob/main/CODE_STANDARDS.md) |
| 接口文档 | [链接](https://github.com/cwj268450-art/contact-book/blob/main/docs/api.md) |
| 其他参考 | MDN Web Docs（Fetch / FileReader）、SheetJS 官方文档、Git 官方文档、CSDN Markdown 语法说明 |

## 二、目录

- [一、作业信息表](#一作业信息表)
- [三、需求拆解：四个功能点对应四个迭代](#三需求拆解四个功能点对应四个迭代)
- [四、技术方案：为什么做前后端分离](#四技术方案为什么做前后端分离)
- [五、实现思路](#五实现思路)
  - [5.1 收藏联系人](#51-收藏联系人)
  - [5.2 一个联系人多种联系方式](#52-一个联系人多种联系方式)
  - [5.3 Excel 导入导出](#53-excel-导入导出)
  - [5.4 页面样式](#54-页面样式)
- [六、关键代码](#六关键代码)
- [七、踩过的坑与解决过程](#七踩过的坑与解决过程)
- [八、测试与证据](#八测试与证据)
- [九、运行截图](#九运行截图)
- [十、演示视频](#十演示视频)
- [十一、Git 提交与协作证据](#十一git-提交与协作证据)
- [十二、分工与贡献比](#十二分工与贡献比)
- [十三、PSP 时间记录](#十三psp-时间记录)
- [十四、复盘与后续计划](#十四复盘与后续计划)

## 三、需求拆解：四个功能点对应四个迭代

极限编程强调小步快跑、每次只交付一个可用的增量，所以我把作业拆成四个可独立验收的迭代，每个迭代结束都保证「服务能启动、页面能点、测试能跑」。

| 迭代 | 交付内容 | 验收标准 |
| --- | --- | --- |
| 迭代 1 | 联系人 CRUD + 收藏 | 能新增、编辑、删除；星标可收藏/取消，收藏者置顶 |
| 迭代 2 | 多联系方式 | 一个联系人可挂任意多条手机/邮箱/微信/QQ/地址/其他，每条可带备注 |
| 迭代 3 | Excel 导入导出 | 导出一行一联系人、一列一种信息；导入能解析、能去重、不因脏数据整体失败 |
| 迭代 4 | 样式与文档 | 页面具备统一视觉（卡片、主题色、响应式）；README / 代码规范 / 接口文档齐全 |

这样拆的好处是：任何一个迭代出问题，都不会阻塞其它迭代的交付；也正好对应评分表的四块分值。

## 四、技术方案：为什么做前后端分离

作业本身只要「能跑、能演示」，但我想借这次机会把工程边界划清楚，所以坚持做成前后端分离：

```
contact-book/
├── frontend/                 纯静态：HTML + CSS + 原生 JS，不含任何数据逻辑
│   ├── index.html
│   └── assets/{css,js}
├── backend/                  Node.js API：数据、校验、Excel、持久化
│   ├── src/{server,store,xlsx-io}.js
│   ├── vendor/xlsx.full.min.js
│   ├── data/contacts.json
│   ├── samples/*.xlsx
│   └── tests/smoke.test.js
├── docs/api.md
├── CODE_STANDARDS.md
└── README.md
```

- **前端只做展示与交互**：所有网络请求收敛到 `frontend/assets/js/api.js` 一个出口，页面里不出现 `fetch`，也不出现任何"存到哪里"的逻辑。
- **后端只管数据与文件**：不拼接 HTML，不关心页面长什么样；对外只暴露 REST 接口和两个 Excel 下载地址。
- **契约先行**：先把接口写进 `docs/api.md`，再按文档实现前后端，改接口必须同步改文档。

技术栈刻意压到最低：

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 前端 | 原生 HTML/CSS/ES6 | 不引入框架与构建工具，评审者 clone 后直接能读、能改 |
| 后端 | Node.js 内置 `http` 模块 | 零第三方依赖，`node backend/src/server.js` 一条命令即可跑起来 |
| 持久化 | JSON 文件（先写 `.tmp` 再 rename） | 不需要数据库，避免评审环境装 MySQL/SQLite 的成本 |
| Excel | SheetJS（`xlsx.full.min.js`，0.18.5） | 前后端都能用同一套库；放在 `backend/vendor` 由后端统一负责，前端不重复引入 |

## 五、实现思路

### 5.1 收藏联系人

评分点要求"收藏的联系人应该便于访问"。我没有只做一个星标按钮，而是把收藏做成了**排序的第一准则**：

1. 数据层：每个联系人带 `starred: boolean`。
2. 排序：`sortContacts()` 的第一比较项永远是 `Number(b.starred) - Number(a.starred)`，收藏永远在最前面；再按姓名的中文 Collator 排序。
3. 视图层：左侧统计区把「收藏联系人」做成独立筛选项，卡片右上角星标高亮（琥珀色），详情弹层里显示「★ 已收藏」。
4. 交互层：点星标只发一次 `PATCH /api/contacts/:id { starred }`，成功后就地更新本地状态并重渲染，不整页刷新。
5. 快捷键：`/` 聚焦搜索、`Esc` 关闭弹层，让高频操作不离开键盘。

### 5.2 一个联系人多种联系方式

难点在于「数量不限」又要「导出成表格」。我选了**一对多数组**而不是给每个联系人预埋固定列：

```jsonc
{
  "name": "陈文俊",
  "methods": [
    { "type": "phone",   "label": "本人",   "value": "13800001234" },
    { "type": "email",   "label": "学校邮箱", "value": "832401202@fzu.edu.cn" },
    { "type": "wechat",  "label": "微信",   "value": "cwj_268450" },
    { "type": "address", "label": "宿舍",   "value": "福州大学旗山校区 3 号楼 512" }
  ]
}
```

设计要点：

- `type` 枚举固定为 `phone / email / wechat / qq / address / other`，非法值一律归到 `other`，保证下游渲染不会崩。
- `label` 是备注（「本人」「工作」「宿舍」），导出时以 `号码（备注）` 的形式保留，导入时再解析回来，**信息不丢**。
- 入库前统一 `normalizeMethods()`：去空值、去重（`type + value` 做 key）、截断超长文本，避免脏数据进库。
- 前端表单用「动态行」编辑：一行 = 类型下拉 + 备注 + 值 + 删除按钮，底部还有「+ 添加一行」，新增时默认给一行手机。

### 5.3 Excel 导入导出

这是分值最高（25 分）也最容易翻车的一块，我把它当独立模块 `backend/src/xlsx-io.js` 来做。

**导出**：一行一联系人，一列一种信息，同类型多值合并进同一单元格，用中文分号 `；` 分隔：

| 姓名 | 分组 | 收藏 | 备注 | 手机 | 邮箱 | 微信 | QQ | 地址 | 其他 | 创建时间 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 陈文俊 | 同学 | 是 | 软件工程课队友 | 13800001234（本人） | 832401202@fzu.edu.cn | cwj_268450 | | 福州大学旗山校区 3 号楼 512（宿舍） | | 2026-11-17 |

**导入**：

1. 先解表头，支持中英文别名（`姓名/name`、`手机/电话/phone`、`邮箱/email`…），列顺序任意。
2. 逐行解析：值里的 `；` 自动拆分；`号码（备注）` 正则还原 label；`收藏` 列支持 `是/true/1`。
3. 判重规则：**姓名相同且该行所有联系方式都已在库中存在**才算重复，直接 `skipped`；同名但信息不同则追加 `(2)`、`(3)` 后缀入库，不整体失败。
4. 空姓名行、缺列行直接跳过，并在返回结果里给出 `errors` 数组。
5. 接口只收 `contentBase64`，由后端解码成 Buffer 交 SheetJS 解析，前端不需要二次处理二进制。

导出接口还额外做了两件事：文件名带日期（`contacts-20261117.xlsx`），以及 `/api/template.xlsx` 提供一份只含表头 + 示例行的导入模板，降低他人上手成本。

### 5.4 页面样式

样式目标很朴素：**像一个能用的产品，而不是作业**。

- 设计令牌集中在 `:root` 的 CSS 变量（主色 `#2f6fed`、琥珀收藏色、灰阶三档），改主题只改一处。
- 卡片式布局：卡片圆角 16px、轻阴影、hover 抬升；收藏卡片描边加深，形成"收藏=置顶"的视觉层级。
- 响应式：`980px` 以下单列、`620px` 以下工具栏换行、统计卡横向滚动，保证手机宽度也不塌。
- 反馈：所有写操作都有 toast（成功绿、失败红），失败文案直接来自后端中文错误信息，不用二次翻译。
- 空状态/加载态都有明确文案，不会出现"白屏不知道发生了什么"。

## 六、关键代码

**收藏优先排序（backend/src/store.js）**

```js
function sortContacts(list, sort) {
  const collator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base' });
  const byName = (a, b) => collator.compare(a.name, b.name);
  if (sort === 'name') return list.sort(byName);
  if (sort === 'updated') {
    return list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || byName(a, b));
  }
  // 默认：收藏永远第一准则
  return list.sort((a, b) => Number(b.starred) - Number(a.starred) || byName(a, b));
}
```

**联系方式规范化（去重 + 归类型）**

```js
function normalizeMethods(methods) {
  const seen = new Set();
  const out = [];
  for (const raw of methods || []) {
    const value = cleanText(raw && raw.value, 120);
    if (!value) continue;
    const type = METHOD_TYPES.includes(raw.type) ? raw.type : 'other';
    const key = type + '|' + value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: raw.id || newId(), type, label: cleanText(raw.label, 20), value });
  }
  return out;
}
```

**导入判重（backend/src/store.js）**

```js
const duplicate = all().some((c) => {
  if (c.name.toLowerCase() !== candidate.name.toLowerCase()) return false;
  const key = (m) => m.type + '|' + m.value.toLowerCase();
  const existing = new Set(c.methods.map(key));
  return candidate.methods.length === 0 || candidate.methods.every((m) => existing.has(key(m)));
});
```

**收藏交互只打一次补丁（frontend/assets/js/app.js）**

```js
async function toggleStar(id) {
  const contact = state.contacts.find((c) => c.id === id);
  if (!contact) return;
  try {
    const updated = await API.patch(id, { starred: !contact.starred });
    Object.assign(contact, updated);
    renderAll();
    toast(updated.starred ? '已收藏' : '已取消收藏', 'ok');
  } catch (err) {
    toast(err.message, 'error');
  }
}
```

## 七、踩过的坑与解决过程

工程里真正花时间的不是功能，而是这几个坑，记下来对以后有用：

**1）SheetJS 0.20.3 读中文乱码**

导出的 xlsx 用 Excel 打开时中文正常，但「导入」读出来的却是 `通讯录 → 鬡讯形`、`陈文俊 → 领擡俠`。

- 先用 Python `zipfile` 解开 `sheet1.xml`，确认**文件内部的 XML 中文完全正确**，因此问题在读侧而不是写侧。
- 再写最小往返测试（写内存 → 读内存），确认在 Node 22 + 0.20.3 下读回即乱码（UTF-8 字节被按 GBK 解码）。
- 换成 0.18.5 后同一份往返测试完全正常，于是把 `backend/vendor/xlsx.full.min.js` 固定为 0.18.5，并在 README 里写明版本，防止后人升级踩回去。

**2）0.18.5 的 `XLSX.writeFile` 在 Node 下报 `cannot save file`**

该版本内部对 `fs` 的探测被禁用，直接用 `XLSX.write(wb, { type: 'buffer' })` 拿到 Buffer 再 `fs.writeFileSync`，问题解决。

**3）`url.parse(req.url, true).query` 当成 URLSearchParams 用**

路由里对 `query.get('q')` 的调用在普通对象上会抛错，导致 `/api/contacts` 直接 500。改成普通对象取值 + 一个 `str()` 兜底函数后恢复正常。

**4）弹层在部分 Chromium 下不渲染**

遮罩层用了 `backdrop-filter: blur(2px)`，某些合成器会把遮罩与被遮住的弹层推进不同图层，表现为"页面变暗但弹层空白"。去掉该属性（改用 `rgba` 半透明遮罩）后，各环境表现一致，视觉几乎无差别。

**5）Windows 上 Git 环境缺失**

本机没有 git，`winget` 反复失败（一次无输出、一次因 `--nowait` 参数不支持、一次长时间无进展）。最后改用国内镜像的 MinGit 便携包（`MinGit-2.56.1-64-bit.zip`）解压即用；同时因为本机 `github.com` 直连不通而 `api.github.com` 可用，给 git 配了系统代理后推送成功。

## 八、测试与证据

我写了一份零依赖的冒烟测试 `backend/tests/smoke.test.js`，直接跑在真实 HTTP 接口上（先 `node backend/src/server.js`，再执行测试）：

```bash
node backend/tests/smoke.test.js
```

最近一次结果：

```
通讯录后端冒烟测试 @ http://127.0.0.1:3000
  PASS  服务健康检查 — contact-book-backend
  PASS  新建联系人 — 冒烟测试-1794896866265
  PASS  一个联系人保存多种联系方式 — 5 条
  PASS  收藏联系人
  PASS  收藏状态可切换
  PASS  编辑联系人
  PASS  导出文件可被 Excel 解析 — 通讯录
  PASS  表头列名完整 — 姓名 | 分组 | 收藏 | 备注 | 手机 | 邮箱 | 微信 | QQ | 地址 | 其他 | 创建时间
  PASS  一行一联系人 — 导出 9 行 / 实际 9 位
  PASS  手机列写入手机号 — 13900000001（本人）
  PASS  邮箱列写入邮箱
  PASS  地址列写入地址
  PASS  收藏列标记为「是」
  PASS  导入接口解析成功 — 解析 9 行
  PASS  重复记录被跳过 — 导入 0 条 / 跳过 9 条
  PASS  删除联系人
  PASS  空姓名被拒绝 — HTTP 400

结果：PASS 17 / FAIL 0
```

另外用样例文件单独验证了「导入新增」路径（`backend/samples/import-sample.xlsx`，4 行数据其中 1 行与库中重复）：

```
{ "parsed": 4, "imported": 3, "skipped": 1, "errors": [] }
```

说明导出的文件能被自己读回、重复能被识别、脏数据不会让整批失败。

## 九、运行截图

运行方式：

```bash
node backend/src/server.js
# 浏览器打开 http://127.0.0.1:3000
```

截图素材已放在仓库 `screenshots/` 目录（后续可直接插到本文对应位置）：

| 图 | 说明 | 文件 |
| --- | --- | --- |
| 图 1 | 通讯录主界面：收藏置顶、★ 高亮、统计卡与工具栏 | `screenshots/01-list.png` |
| 图 2 | 联系人详情弹层：分区展示 4 条联系方式与备注 | `screenshots/02-detail.png` |
| 图 3 | 新建/编辑表单：动态「+ 添加联系方式」行 | `screenshots/03-form.png` |
| 图 4 | 只看收藏筛选 | `screenshots/04-starred.png` |
| 图 5 | 导出 Excel 后打开的文件（一行一联系人、一列一种信息） | `screenshots/05-excel.png` |
| 图 6 | 导入 Excel 的结果提示（新增 x 条、跳过重复 y 条） | `screenshots/06-import.png` |

## 十、演示视频

演示视频覆盖 5 个场景，时长控制在 1–3 分钟：

1. 启动后端 → 打开页面（0:00–0:15）
2. 点星标收藏，观察置顶与「收藏联系人」筛选（0:15–0:45）
3. 新建联系人，添加手机 + 邮箱 + 微信三条联系方式（0:45–1:20）
4. 导出 Excel，用 Excel 打开查看列结构（1:20–1:50）
5. 导入示例 xlsx，展示「新增 3 条、跳过重复 1 条」（1:50–2:20）

视频文件：仓库 `screenshots/demo.mp4`（或在 CSDN 视频区单独上传）。

## 十一、Git 提交与协作证据

仓库从空目录自建，未 fork 任何模板；前后端分目录，`main` 保持随时可运行。

| 提交 | 说明 |
| --- | --- |
| `5b2d20c` | chore: 初始化前后端分离目录结构与代码规范 |
| `65c326f` | feat(backend): 实现联系人数据层与 REST API（收藏、多联系方式） |
| `d0d502a` | feat(backend): 支持 Excel 导入导出与模板下载 |
| `3e739cf` | feat(frontend): 实现通讯录页面、收藏与多联系方式交互 |
| `40292fe` | test: 增加 17 项后端冒烟测试 |
| `0ba8f03` | docs: 补充 README 与 REST 接口文档 |
| `d6210ea` | fix(frontend): 去除弹层遮罩的 backdrop-filter（PR #1） |
| `0c5ae90` | Merge pull request #1 from cwj268450-art/feature/ui-polish |
| `616ae57` | docs(blog): 增加 CSDN 作业博客稿与 README 深链说明 |
| `a5efa42` | fix(frontend): 修正收藏深链的导航选择器并支持 hash 变化即时切换 |

- 提交历史：[提交历史](https://github.com/cwj268450-art/contact-book/commits/main)
- 功能分支 PR：[PR #1](https://github.com/cwj268450-art/contact-book/pull/1)
- 发行版本：[Release v1.0.0](https://github.com/cwj268450-art/contact-book/releases/tag/v1.0.0)

提交粒度的原则是「一次提交只做一件事」，提交信息统一 `type(scope): 说明` 格式，便于回溯某次改动到底动了哪一层。

## 十二、分工与贡献比

| 姓名 | 角色 | 主要工作 | 贡献比 |
| --- | --- | --- | --- |
| 陈文俊（832401202） | 开发 / 测试 / 文档 | 需求拆解、前后端全部代码、Excel 模块、冒烟测试、README 与接口文档、截图与演示视频、博客撰写 | 100% |

说明：本次作业为个人独立完成，因此贡献比为 100%。若后续改为结对，建议按「前端页面 / 后端 API+Excel」拆成 50% : 50%，并用 PR 评审记录留痕（本次已经预演了完整的分支 + PR + 合并流程）。

## 十三、PSP 时间记录

| 阶段 | 任务 | 预估（min） | 实际（min） |
| --- | --- | --- | --- |
| 计划 | 读作业帖、拆需求、定评分点 | 20 | 25 |
| 计划 | 设计接口契约与技术选型 | 20 | 30 |
| 开发 | 后端数据层 + REST API | 90 | 110 |
| 开发 | Excel 导入导出（含模板） | 90 | 150 |
| 开发 | 前端页面与交互 | 120 | 140 |
| 开发 | 页面样式与响应式 | 60 | 70 |
| 测试 | 冒烟测试编写与调通 | 45 | 60 |
| 测试 | 手工回归 + 导出文件核对 | 20 | 30 |
| 环境 | Git/代理/仓库配置 | 20 | 55 |
| 文档 | README、代码规范、接口文档 | 40 | 45 |
| 文档 | 博客撰写与发布 | 40 | 60 |
| 汇总 | — | **565** | **775** |

时间主要超在「Excel 中文编码」和「Windows 上 Git 环境」两处，都属于环境类问题，符合 PSP 里"外部因素导致的超时"这一类，也提醒下次先做环境预检再动功能。

## 十四、复盘与后续计划

**做得好的地方**

- 四个迭代各自可独立验收，任何一个出问题不会拖垮整体交付。
- 先写接口文档再写代码，前后端没有出现"字段对不上"的返工。
- 把 Excel 当成独立模块 + 独立测试，才让中文编码问题被定位到"读侧"而不是瞎改。

**可以更好的地方**

- 前端没有自动化测试，全靠手工回归；后续可以补 Playwright 的 3 条关键路径。
- 数据层是单文件 JSON，多人并发写会有覆盖风险；真实场景应换 SQLite 或加文件锁。
- 弹层的合成层问题说明"用 CSS 特效"要留降级方案，不能默认所有浏览器行为一致。

**下一步**

1. 补齐云部署（作业可选加分项，本次按计划未做）。
2. 前端加 i18n，把中英表头别名策略延伸到界面文案。
3. 导入支持 `.xls` 旧格式与多 Sheet。

---

**相关链接汇总**

- 仓库：[代码仓库](https://github.com/cwj268450-art/contact-book)
- 提交记录：[提交历史](https://github.com/cwj268450-art/contact-book/commits/main)
- PR #1：[PR #1](https://github.com/cwj268450-art/contact-book/pull/1)
- Release v1.0.0：[Release v1.0.0](https://github.com/cwj268450-art/contact-book/releases/tag/v1.0.0)
- 代码规范：[代码规范](https://github.com/cwj268450-art/contact-book/blob/main/CODE_STANDARDS.md)
- 接口文档：[接口文档](https://github.com/cwj268450-art/contact-book/blob/main/docs/api.md)
- 作业原帖：[作业原帖](https://bbs.csdn.net/topics/620593436)
