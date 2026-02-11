# MedCrowd 提交与版本说明

## 1. 项目信息

| 项目 | 内容 |
|------|------|
| 名称 | MedCrowd 众医议 |
| 赛道 | Track 1 — 重做一遍互联网（A2A 健康咨询） |
| 核心理念 | 你的 AI 带着你的困惑，去咨询众人的 AI |
| GitHub | https://github.com/Joe-rq/MedCrowd |
| Demo URL | https://med-crowd.vercel.app |

---

## 2. 当前版本能力（v1.1）

在黑客松原始 A2A 能力基础上，已新增个人健康数据闭环。

### A2A 咨询能力

- [x] SecondMe OAuth 登录/注销
- [x] 健康问题输入 + Act API 分诊
- [x] 多 Agent 并发咨询（最多 5 个）
- [x] 反应轮互评（门控触发）
- [x] 结构化报告（共识、分歧、准备清单、风险声明）
- [x] 分享传播（`/share/[id]`）

### 健康数据能力（新增）

- [x] 健康数据接入 API（`/api/health/ingest`）
- [x] 异常检测 API（`/api/health/anomaly`）
- [x] 同意管理 API（`/api/health/consent`）
- [x] 健康周报页面（`/health-report/[id]`）
- [x] 授权管理页面（`/settings/health-consent`）
- [x] HealthBrief 协议（异常触发咨询，默认 `anomaly_only`）

---

## 3. 技术实现状态

- [x] Vercel KV 持久化（Upstash Redis）
- [x] OAuth state CSRF 防护
- [x] iron-session 加密会话
- [x] Demo Mode fallback
- [x] Tier A/B/C 接入策略与降级
- [x] 非诊断文案边界（报告、提醒、策略文档）

---

## 4. 本地验证命令

```bash
cd web
npm install
npm run build
npm run verify
npm run test
npm run dev
```

---

## 5. 部署

- 平台：Vercel
- 持久化：Vercel KV（Upstash Redis）
- 区域：自动
- 详细步骤：`docs/DEPLOYMENT.md`

---

## 6. 已知限制

- 反应轮仅在首轮有效回复 >= 2 时触发，否则降级为单轮汇总。
- Act API 不可达时使用规则兜底分诊。
- 分享链接当前无过期机制。
- Windows 本地运行全量 Vitest 时，少量 DB 用例可能出现测试文件锁（`EPERM/ENOENT`）噪音；建议结合 `npm run verify` 与模块化单测复核。
