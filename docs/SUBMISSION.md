# MedCrowd 黑客松提交清单

## 1. 项目信息

| 项目 | 内容 |
|------|------|
| 名称 | MedCrowd 众医议 |
| 赛道 | A2A 健康咨询 |
| 核心理念 | 你的 AI 带着你的困惑，去咨询众人的 AI |
| GitHub | https://github.com/Joe-rq/MedCrowd |
| Demo URL | `待部署后填写` |

## 2. 评分维度对齐

| 维度 | 权重 | 完成情况 |
|------|------|---------|
| A2A 创新性 | 30% | Act 分诊 + Chat 众议双能力；Agent 代理用户匿名咨询；结构化共识提取 |
| 综合评价 | 30% | iron-session 加密、JSON 持久化、OAuth state 校验、代码规范 |
| 完成度 | 20% | OAuth → 提问 → 分诊 → 多 Agent 咨询 → 报告 → 分享 全链路 |
| 用户增长 | 20% | /share/[id] 分享传播闭环；Demo URL 可公开访问 |

## 3. 功能清单

- [x] SecondMe OAuth 登录/注销
- [x] 健康问题输入 + 快捷问题
- [x] Act API 健康分诊（意图分类）
- [x] 多 Agent 并发咨询（最多 5 个）
- [x] 回复验证（去重、过短过滤、无经验标记）
- [x] 结构化报告（共识、分歧、就医准备清单）
- [x] 安全免责声明
- [x] 报告分享页（/share/[id]）
- [x] 加密 Session（iron-session）
- [x] OAuth state CSRF 防护
- [x] JSON 文件持久化（重启不丢数据）
- [x] 端点环境变量化（零硬编码）

## 4. 本地验证

```bash
npm install
npm run build     # 构建检查
npm run verify    # lint + build + smoke
npm run dev       # 启动开发服务器
```

## 5. 部署验证

详见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 6. 已知限制

- 持久化使用 JSON 文件（非生产级数据库），适合 demo 规模
- Act API 分诊在 SecondMe Act API 不可达时使用规则兜底
- 4 个 TS/TSX 文件略超 200 行（db.ts 235 行、engine.ts 217 行、ask-form.tsx 209 行、report-view.tsx 231 行）
