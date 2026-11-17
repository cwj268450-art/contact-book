# 通讯录 Contact Book

> 福州大学 EE308FZ 软件工程 · 极限编程（Extreme Programming）作业
> 一个**前后端分离**的通讯录应用：收藏联系人 / 一个联系人多种联系方式 / Excel 导入导出。

| 项目 | 内容 |
| --- | --- |
| 课程 | EE308FZ Software Engineering（2601_FZU-MU_SE） |
| 作业 | Extreme Programming（Address Book Application） |
| 仓库结构 | `frontend/` 前端静态页 + `backend/` Node.js REST API |
| 运行环境 | Node.js ≥ 16（无第三方运行时依赖） |

## 功能

- **收藏联系人（Bookmark）**：卡片右上角星标一键收藏/取消，收藏的联系人自动置顶、带 ★ 标记，并在左侧「收藏联系人」中独立归类。
- **多种联系方式（Multiple Contact Methods）**：一个联系人可挂任意多条手机、邮箱、微信、QQ、地址、其他联系方式，每条可加备注（如「本人」「工作」）。
- **Excel 导入导出**：导出一行一联系人、一列一种信息的标准 `.xlsx`；导入兼容中英文表头，自动拆分多值、跳过空姓名行、对重复记录去重。
- 搜索（姓名/号码/邮箱/备注）、按分组筛选、按姓名或修改时间排序、增删改、本地持久化。
- 支持 URL 深链，便于分享具体界面状态：`#detail=<id>` 详情、`#edit=<id>` 编辑、`#new` 新建、`#starred` 只看收藏。

## 目录结构

```
contact-book/
├── frontend/                  # 前端（纯静态，可独立部署）
│   ├── index.html
│   └── assets/
│       ├── css/style.css
│       └── js/
│           ├── api.js         # 唯一网络出口，封装后端 REST API
│           └── app.js         # 界面与交互
├── backend/                   # 后端（Node.js，零第三方依赖）
│   ├── src/
│   │   ├── server.js          # HTTP 服务 + 路由 + 静态资源托管
│   │   ├── store.js           # 数据层（JSON 文件持久化）
│   │   └── xlsx-io.js         # Excel 导入导出
│   ├── vendor/
│   │   └── xlsx.full.min.js   # SheetJS 0.18.5（Apache-2.0），仅后端使用
│   ├── data/contacts.json     # 运行时数据（首次启动自动生成）
│   ├── samples/               # 导入/导出样例文件
│   └── tests/smoke.test.js    # 冒烟测试
├── docs/api.md                # 接口文档
├── CODE_STANDARDS.md          # 代码规范
└── README.md
```

## 快速开始

```bash
# 1. 启动后端（同时托管 frontend 静态资源）
node backend/src/server.js
# 或
cd backend && npm start

# 2. 浏览器打开
#    http://127.0.0.1:3000
```

可选环境变量：`PORT`（默认 3000）、`HOST`（默认 0.0.0.0）。

> 前端也可以单独用任意静态服务器（如 `python -m http.server 8080 -d frontend`）运行，
> 后端已开启 CORS；如需指向其它后端地址，改 `frontend/assets/js/api.js` 里的 `BASE` 即可。

## Excel 格式

导出/导入统一使用以下列（导入时也接受 `name / phone / email / wechat / qq / address` 等英文表头）：

| 姓名 | 分组 | 收藏 | 备注 | 手机 | 邮箱 | 微信 | QQ | 地址 | 其他 | 创建时间 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 陈文俊 | 同学 | 是 | 软件工程课队友 | 13800001234（本人） | 832401202@fzu.edu.cn | cwj_268450 | | 福州大学旗山校区 3 号楼 512 | | 2026-… |

- 同一类型的多条信息写在同一格里，用 `；` 分隔（导入时会自动拆分）。
- 「号码（备注）」形式会被还原为 `value = 号码`、`label = 备注`。
- 页面上「模板」按钮可直接下载导入模板。

## 测试

```bash
# 先启动后端，再执行
node backend/tests/smoke.test.js
```

覆盖：健康检查、新建、多联系方式、收藏、编辑、Excel 导出字段、重复导入去重、删除、非法输入拦截。

## 相关链接

- 仓库：<https://github.com/cwj268450-art/contact-book>
- 代码规范：<CODE_STANDARDS.md>
- 接口文档：<docs/api.md>
- 作业博客：见仓库 `blog/` 目录
