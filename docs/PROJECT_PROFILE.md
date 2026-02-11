# MedCrowd（众医议）项目详情

## 项目定位

- 赛事：SecondMe A2A Hackathon
- 项目：MedCrowd（众医议）
- 定位：A2A 健康经验咨询平台，已扩展个人健康数据周报闭环

一句话：

> 你的 AI 去问众人的 AI，再结合你的健康指标，每周给你更可执行的健康决策参考。

---

## 当前产品结构

### 能力 A：A2A 经验众议

- 用户提问 -> 多 Agent 并发咨询 -> 结构化报告
- 支持反应轮互评、分诊、安全拦截、分享传播

### 能力 B：健康数据跟踪

- 指标接入（weight/bmi/sleep/heartRate/hrv）
- 异常检测与提示
- 每周健康报告
- 同意管理（授权/撤销/审计）

### 两者关系

通过 HealthBrief 协议串联：

```
Detect -> Consult -> Track
```

默认策略为 `anomaly_only`，即仅异常触发咨询。

---

## 技术要点

- Next.js 16 + React 19 + TypeScript
- Vercel KV 持久化
- SecondMe OAuth + Chat API + Act API
- 模块化服务层：`engine/summary/db/health-*`

新增核心 API：

- `/api/health/ingest`
- `/api/health/anomaly`
- `/api/health/consent`

新增核心页面：

- `/health-report/[id]`
- `/settings/health-consent`

---

## 交付文档索引

- `docs/v1-health-data-policy.md`
- `docs/v1-scope-in-out.md`
- `docs/safety-wording-checklist.md`
- `docs/health-brief-contract.md`
- `docs/analytics/event-dictionary.md`
- `docs/v2-medical-docs-architecture.md`
- `docs/v2-data-model-extensions.md`

---

## 已知事项

- 分享链接暂无过期机制
- Windows 本地全量 Vitest 可能偶发 DB 测试文件锁（`EPERM/ENOENT`）
