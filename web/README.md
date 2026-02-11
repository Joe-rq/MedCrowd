# MedCrowd Web App

MedCrowd 的 Next.js 16 全栈应用。

当前包含两条业务链路：

- A2A 健康经验咨询（核心）
- 个人健康数据周报与异常提醒（新增）

---

## 快速开始

```bash
npm install
npm run dev
```

默认地址：`http://localhost:3000`

---

## 常用命令

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run verify
```

`verify` = lint + build + smoke。

---

## 主要路由

### 页面

- `/` 登录与入口
- `/ask` 提问页
- `/report/[id]` A2A 报告页
- `/share/[id]` 分享页
- `/health-report/[id]` 健康周报页
- `/settings/health-consent` 健康数据同意管理页

### API

- `/api/auth/*` OAuth + session
- `/api/act/triage` 分诊
- `/api/consultation` 发起咨询
- `/api/consultation/[id]` 轮询结果
- `/api/health/ingest` 健康指标接入
- `/api/health/anomaly` 异常检测
- `/api/health/consent` 同意/撤销/审计

---

## 关键模块

- `src/lib/engine/` A2A 编排
- `src/lib/summary/` 报告提炼
- `src/lib/db/` 数据持久化
- `src/lib/health-connectors/` A/B/C 接入策略
- `src/lib/health-report/` 周报生成
- `src/lib/anomaly/` 异常检测与文案
- `src/lib/consent/` 同意状态与审计
- `src/lib/health-brief/` 异常触发咨询桥接协议

---

## 环境变量

`web/.env.local` 示例：

```bash
SECONDME_CLIENT_ID=
SECONDME_CLIENT_SECRET=
SECONDME_REDIRECT_URI=http://localhost:3000/api/auth/callback
SECONDME_API_BASE_URL=https://app.mindos.com/gate/lab
SECONDME_OAUTH_URL=https://go.second.me/oauth/
SESSION_SECRET=
OAUTH_STATE_STRICT=true
NEXT_PUBLIC_BASE_URL=http://localhost:3000
DEMO_MODE=false
REACTION_ROUND_ENABLED=true
```

在 Vercel 部署时需要绑定 KV（`KV_REST_API_URL`、`KV_REST_API_TOKEN`）。

---

## 测试说明

- 推荐提交前执行：`npm run verify`
- 部分 DB 相关测试在 Windows 上可能偶发文件锁（`EPERM/ENOENT`）；
  如遇到可按模块执行 Vitest 用例复核。
