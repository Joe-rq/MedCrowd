# MedCrowd 部署指南

## 前置要求

- Vercel 账号
- GitHub 仓库已推送最新代码
- SecondMe 开发者应用（OAuth）
- Vercel KV（Upstash）已创建并绑定项目

---

## 1. 导入项目

```bash
# CLI
npm i -g vercel
vercel login
vercel --prod
```

或在 Vercel 网页导入仓库，Root Directory 设为 `web`。

---

## 2. 配置环境变量

在 Vercel Dashboard -> Project -> Settings -> Environment Variables 配置：

| 变量名 | 说明 |
|--------|------|
| `SECONDME_CLIENT_ID` | SecondMe OAuth Client ID |
| `SECONDME_CLIENT_SECRET` | SecondMe OAuth Client Secret |
| `SECONDME_REDIRECT_URI` | `https://<domain>/api/auth/callback` |
| `SECONDME_API_BASE_URL` | `https://app.mindos.com/gate/lab` |
| `SECONDME_OAUTH_URL` | `https://go.second.me/oauth/` |
| `SESSION_SECRET` | 32+ 随机字符串 |
| `OAUTH_STATE_STRICT` | 建议 `true` |
| `NEXT_PUBLIC_BASE_URL` | `https://<domain>` |
| `DEMO_MODE` | 建议生产 `false` |
| `REACTION_ROUND_ENABLED` | 是否开启反应轮 |

KV 绑定后会自动注入：

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

---

## 3. SecondMe 回调地址

在 SecondMe 开发者后台添加：

- 生产：`https://<domain>/api/auth/callback`
- 本地：`http://localhost:3000/api/auth/callback`

---

## 4. 部署后验证

```bash
# 会话接口
curl -s https://<domain>/api/auth/session

# 分诊接口
curl -s -X POST https://<domain>/api/act/triage \
  -H "Content-Type: application/json" \
  -d '{"message":"头疼怎么办"}'

# 健康数据接入接口（鉴权后）
curl -s -X POST https://<domain>/api/health/ingest \
  -H "Content-Type: application/json" \
  -d '{"metricType":"weight","source":"manual_entry","data":{"timestamp":1739200000000,"value":70,"unit":"kg"}}'
```

关键页面检查：

- `/ask`
- `/report/[id]`
- `/health-report/[id]`
- `/settings/health-consent`

---

## 5. 常见问题

### 构建失败

- 先本地执行 `cd web && npm run verify`
- 查看 Vercel Build Logs 的第一条 TypeScript 或 ESLint 错误

### OAuth 回调失败

- 检查 `SECONDME_REDIRECT_URI` 与平台配置是否完全一致
- 必须包含 `https://`

### 健康接口 401/403

- 用户未登录或 session 失效
- 同意状态未授予（`/api/health/consent`）
