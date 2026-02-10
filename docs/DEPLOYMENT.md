# MedCrowd 部署指南

## 前置要求

- [Vercel 账号](https://vercel.com)（免费版即可）
- GitHub 仓库已推送最新代码
- SecondMe 开发者平台已创建应用（[develop.second.me](https://develop.second.me/)）

## 部署步骤

### 1. 导入项目到 Vercel

```bash
# 方式 A: CLI 部署
npm i -g vercel
vercel login
vercel --prod

# 方式 B: 网页导入
# 访问 https://vercel.com/new → Import Git Repository → 选择 MedCrowd 仓库
```

### 2. 配置环境变量

在 Vercel Dashboard → 项目 → Settings → Environment Variables 中添加：

| 变量名 | 值 | 说明 |
|--------|---|------|
| `SECONDME_CLIENT_ID` | 从 SecondMe 开发者平台获取 | OAuth 客户端 ID |
| `SECONDME_CLIENT_SECRET` | 从 SecondMe 开发者平台获取 | OAuth 客户端密钥 |
| `SECONDME_REDIRECT_URI` | `https://<your-domain>.vercel.app/api/auth/callback` | 生产回调地址 |
| `SECONDME_API_BASE_URL` | `https://app.mindos.com/gate/lab` | SecondMe API 基础地址 |
| `SECONDME_OAUTH_URL` | `https://go.second.me/oauth/` | SecondMe OAuth 地址 |
| `SESSION_SECRET` | 随机 32+ 字符串 | 生成: `openssl rand -base64 32` |
| `OAUTH_STATE_STRICT` | `true` | OAuth state 严格校验 |
| `NEXT_PUBLIC_BASE_URL` | `https://<your-domain>.vercel.app` | 应用公开 URL |

### 3. 在 SecondMe 后台添加回调地址

在 [develop.second.me](https://develop.second.me/) 的应用设置中：
- **添加**生产回调: `https://<your-domain>.vercel.app/api/auth/callback`
- **保留**本地回调: `http://localhost:3000/api/auth/callback`（防止本地开发失效）

### 4. 触发部署

环境变量配置完成后，在 Deployments 页面点击 Redeploy（或推送新 commit 自动触发）。

### 5. 验证部署

```bash
# 检查首页可达
curl -sL https://<your-domain>.vercel.app | head -20

# 检查 API 路由
curl -s https://<your-domain>.vercel.app/api/auth/session

# 检查 Act 分诊
curl -s -X POST https://<your-domain>.vercel.app/api/act/triage \
  -H "Content-Type: application/json" \
  -d '{"message":"头疼怎么办"}'
```

## 常见问题

### 构建失败
- 确认 `npm run build` 在本地通过
- 检查 Vercel Build Logs 中的具体错误

### OAuth 回调失败
- 确认 `SECONDME_REDIRECT_URI` 与 SecondMe 后台配置一致
- 确认包含 `https://` 协议前缀
- 确认 SecondMe 后台**同时保留**了本地和生产两个回调地址

### Session 问题
- 确认 `SESSION_SECRET` 已设置且长度 ≥ 32 字符
- 如出现 "SESSION_SECRET is required" 错误，重新配置 env 并 Redeploy
