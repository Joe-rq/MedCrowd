# MedCrowd 众医议

> SecondMe A2A Hackathon 项目，已扩展为「A2A 咨询 + 个人健康数据周报」闭环。

**Demo**: https://med-crowd.vercel.app  
**GitHub**: https://github.com/Joe-rq/MedCrowd

---

## 项目现在在做什么

MedCrowd 现在有两条能力并且已打通：

1. **A2A 经验咨询**：你的 AI 代理你去咨询多个用户的 AI，输出结构化共识报告。
2. **持续健康追踪**：接入个人健康指标，生成每周健康周报，触发异常提醒。

核心闭环：

```
Detect(指标检测) -> Consult(异常触发咨询) -> Track(下周继续跟踪)
```

其中咨询触发策略默认是 `anomaly_only`，即仅在异常条件满足时触发。

---

## 已实现能力

### A2A 咨询主链路

- SecondMe OAuth 登录
- 健康问题输入 + Act 分诊
- 多 Agent 并发咨询（最多 5 个）
- 反应轮互评（满足门控条件时）
- 结构化报告（共识/分歧/准备事项/风险提示）
- 分享页 `/share/[id]`

### 健康数据闭环（新增）

- 健康数据接入 API：`/api/health/ingest`
- 异常检测 API：`/api/health/anomaly`
- 同意管理 API：`/api/health/consent`
- 周报页面：`/health-report/[id]`
- 同意设置页面：`/settings/health-consent`
- 数据类型：`weight`, `bmi`, `sleep`, `heartRate`, `hrv`
- 连接器策略：Tier A/B/C fallback
- 隐私合规：授权同意、撤销、审计事件

---

## 技术栈

- Framework: Next.js 16 (App Router) + React 19 + TypeScript
- Styling: Tailwind CSS 4
- Auth: SecondMe OAuth 2.0 + iron-session
- AI: SecondMe Chat API (SSE) + Act API
- Storage: Vercel KV (Upstash Redis)
- Testing: Vitest
- Deploy: Vercel

---

## 目录结构

```
MedCrowd/
├─ web/                      # Next.js 应用
│  └─ src/
│     ├─ app/
│     │  ├─ api/
│     │  │  ├─ consultation/
│     │  │  └─ health/       # ingest / anomaly / consent
│     │  ├─ report/[id]/
│     │  ├─ health-report/[id]/
│     │  └─ settings/health-consent/
│     └─ lib/
│        ├─ engine/          # A2A 编排
│        ├─ summary/         # 报告生成
│        ├─ db/              # 持久化
│        ├─ health-connectors/
│        ├─ health-report/
│        ├─ anomaly/
│        ├─ consent/
│        └─ health-brief/
└─ docs/                     # 产品、架构、策略文档
```

---

## 本地开发

```bash
cd web
npm install
npm run dev
```

常用命令：

```bash
cd web && npm run build
cd web && npm run verify
cd web && npm run test
```

---

## 环境变量

`web/.env.local` 至少需要：

```bash
SECONDME_CLIENT_ID=
SECONDME_CLIENT_SECRET=
SECONDME_REDIRECT_URI=
SECONDME_API_BASE_URL=https://app.mindos.com/gate/lab
SECONDME_OAUTH_URL=https://go.second.me/oauth/
SESSION_SECRET=
OAUTH_STATE_STRICT=true
NEXT_PUBLIC_BASE_URL=http://localhost:3000
DEMO_MODE=false
REACTION_ROUND_ENABLED=true
```

Vercel 还需绑定 KV（自动注入 `KV_REST_API_URL`、`KV_REST_API_TOKEN`）。

---

## 文档索引

- 部署：`docs/DEPLOYMENT.md`
- 提交清单：`docs/SUBMISSION.md`
- 项目总览：`docs/PROJECT_PROFILE.md`
- V1 范围与策略：`docs/v1-scope-in-out.md`, `docs/v1-health-data-policy.md`
- 安全文案：`docs/safety-wording-checklist.md`
- HealthBrief 协议：`docs/health-brief-contract.md`
- V2 架构：`docs/v2-medical-docs-architecture.md`, `docs/v2-data-model-extensions.md`
- 分析事件字典：`docs/analytics/event-dictionary.md`

---

## 已知事项

- 当前在 Windows 本地执行 `npm run test` 时，少量 DB 相关测试可能偶发文件锁（`EPERM/ENOENT`）问题；
  建议按模块单测复核并结合 `npm run verify` 作为提交前门禁。

---

MIT License
