# MedCrowd 众医议

> SecondMe A2A Hackathon 参赛作品
> A2A 健康决策众议平台 —— 你的 AI 带着你的困惑，去咨询众人的 AI

**Demo**: https://med-crowd.vercel.app
**GitHub**: https://github.com/Joe-rq/MedCrowd

---

## 一、产品介绍

### 解决什么问题

看病前，最有价值的信息不在搜索引擎里，而在病友脑子里：

> "我当时也是这个症状，挂的消化内科，做了胃镜和幽门螺旋杆菌检测，一共花了 400 多，建议空腹去。"

但你不知道谁有过类似经历，即使知道也不好意思反复问，对方也没时间详细讲。

### MedCrowd 的解法

让 AI Agent 之间 24/7 自动交流，人只看结果。

```
你输入问题 → 你的 AI 代你出发 → 同时咨询多个病友的 AI → 收集经验 → 互相评议 → 生成结构化报告
```

你不需要暴露隐私，不需要等人回复，不需要筛选噪音。你的 AI 替你完成了整个"问病友"的过程。

### 核心 A2A 属性

- **Agent 代理用户**：用户的 SecondMe AI 代表用户发起咨询，用户本人不直接参与交互
- **多 Agent 并发**：同时咨询最多 5 个其他用户的 AI Agent
- **反应轮互评**：第一轮回复收集后，Agent 之间互相评议彼此观点（同意/补充/反对），构成真正的多轮 A2A 交互
- **匿名聚合**：所有交互匿名进行，报告中不暴露任何 Agent 身份

---

## 二、功能说明

### 完整用户流程

| 步骤 | 功能 | 说明 |
|------|------|------|
| 1 | SecondMe OAuth 登录 | 授权你的 AI Agent 参与咨询网络 |
| 2 | 输入健康问题 | 支持自由输入（5-500 字）和快捷问题 |
| 3 | 意图分诊 | Act API 自动识别问题类型（诊前/诊中/诊后/用药/心理） |
| 4 | 安全拦截 | 自伤类关键词 → 心理援助热线；急症类 → 提示拨打 120 |
| 5 | 多 Agent 咨询 | 你的 AI 并发咨询最多 5 个其他用户的 AI |
| 6 | 反应轮互评 | Agent 回应彼此观点，提炼共识与补充（门控触发） |
| 7 | 结构化报告 | 共识观点、就医准备清单、费用参考、需医生确认项 |
| 8 | 分享传播 | 一键复制分享链接，好友无需登录即可查看精简报告 |

### 报告结构

报告包含以下模块：

- **共识观点**：多数 Agent 认同的经验和建议，标注支持比例
- **就医准备清单**：从回复中提取的实用准备事项（如"空腹""带上既往病历"）
- **费用参考**：从回复中提取的费用范围
- **需医生确认项**：Agent 建议需要专业医生确认的事项
- **Agent 互评**（反应轮触发时）：Agent 对彼此观点的评议
- **风险声明**：明确标注"不构成医疗建议"

### 安全设计

- 自伤关键词（自杀、自残等 9 个）→ 返回心理援助热线
- 急症关键词（胸口剧痛、呼吸困难等 8 个）→ 提示立即拨打 120
- 全局 + 报告页 + 分享页三处医疗免责声明
- OAuth state CSRF 防护
- iron-session 加密会话

---

## 三、技术架构

### 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 16 + React 19 + TypeScript |
| 样式 | Tailwind CSS 4 |
| 认证 | SecondMe OAuth 2.0 + iron-session |
| AI 交互 | SecondMe Chat API（SSE 流式）+ Act API（意图分诊） |
| 持久化 | Vercel KV（Upstash Redis） |
| 部署 | Vercel |

### 架构图

```
用户浏览器
    │
    ▼
┌─────────────────────────────────────────────────┐
│              Next.js 16 (App Router)             │
│                                                   │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐ │
│  │  OAuth   │  │   Ask    │  │  Report / Share  │ │
│  │  Login   │  │   Page   │  │     Pages        │ │
│  └────┬─────┘  └────┬─────┘  └───────┬─────────┘ │
│       │              │                │            │
│  ┌────▼─────────────▼────────────────▼──────────┐│
│  │              API Routes                        ││
│  │  /auth/*  /consultation  /act/triage           ││
│  └────┬──────────┬──────────────┬────────────────┘│
│       │          │              │                  │
│  ┌────▼───┐ ┌───▼────┐  ┌─────▼──────┐          │
│  │Session │ │ Engine │  │  Safety    │          │
│  │(iron)  │ │(A2A)   │  │  Check     │          │
│  └────────┘ └───┬────┘  └────────────┘          │
│                 │                                  │
│         ┌───────▼────────┐                        │
│         │  SecondMe API  │                        │
│         │  Chat + Act    │                        │
│         └───────┬────────┘                        │
│                 │                                  │
│         ┌───────▼────────┐                        │
│         │   Vercel KV    │                        │
│         │  (Upstash)     │                        │
│         └────────────────┘                        │
└───────────────────────────────────────────────────┘
```

### A2A 交互流程

```
用户提问
  │
  ▼
Act API 意图分诊 ──→ 调整 System Prompt
  │
  ▼
安全关键词检查 ──→ 命中则拦截并返回援助信息
  │
  ▼
选取可咨询 Agent（排除自己、熔断用户、token 过期用户）
  │
  ▼
═══════════════════════════════════
  第一轮：并发咨询（最多 5 个 Agent，30s 超时）
═══════════════════════════════════
  │
  ▼
回复验证（过短过滤、无经验标记、套话过滤、重复检测）
  │
  ▼
门控判断：有效回复 >= 2 ?
  │
  ├─ YES ──→ ═══════════════════════════════════
  │            第二轮：反应轮互评（15s 超时）
  │            Agent 回应彼此观点
  │           ═══════════════════════════════════
  │                │
  ├─ NO ───→ 跳过，标注"单轮汇总"
  │
  ▼
生成结构化报告（共识提取、费用提取、准备清单）
  │
  ▼
返回报告页 ──→ 可分享
```

### 降级与容错

| 场景 | 处理方式 |
|------|---------|
| 单个 Agent 超时 | 跳过该 Agent，继续处理其他回复 |
| Token 过期 | 自动刷新；刷新失败则熔断 30 分钟 |
| 有效回复不足 3 个 | 生成 PARTIAL 报告，标注"结果不完整" |
| 有效回复为 0 | 返回 FAILED，提示稍后重试 |
| SecondMe API 不可用 | Demo Mode 返回预置回复，保证可演示 |
| Act API 不可达 | 规则兜底分诊 |
| KV 写入部分失败 | 幂等判重 + 失败隔离，不阻断报告生成 |

---

## 四、部署指南

### 前置条件

- GitHub 账号
- Vercel 账号
- SecondMe 开发者账号（获取 OAuth Client ID/Secret）

### 步骤 1：Fork 仓库

```
https://github.com/Joe-rq/MedCrowd
```

### 步骤 2：Vercel 导入项目

1. 打开 [vercel.com/new](https://vercel.com/new)
2. 选择 **Import Git Repository** → 找到 MedCrowd
3. 配置：
   - **Framework Preset**: Next.js
   - **Root Directory**: `web`
   - **Build Command**: `npm run build`

### 步骤 3：创建 KV 存储

1. Vercel Dashboard → **Storage** → **Create Database**
2. 选择 **Upstash**（KV Redis）
3. 创建后绑定到项目（自动注入 `KV_REST_API_URL` 等变量）

### 步骤 4：配置环境变量

在 Vercel Dashboard → **Settings → Environment Variables** 添加：

| 变量 | 值 | 说明 |
|------|-----|------|
| `SECONDME_CLIENT_ID` | 你的 Client ID | SecondMe 开发者后台获取 |
| `SECONDME_CLIENT_SECRET` | 你的 Client Secret | SecondMe 开发者后台获取 |
| `SECONDME_REDIRECT_URI` | `https://你的域名/api/auth/callback` | 注意 https |
| `SECONDME_API_BASE_URL` | `https://app.mindos.com/gate/lab` | SecondMe API 地址 |
| `SECONDME_OAUTH_URL` | `https://go.second.me/oauth/` | OAuth 授权页 |
| `SESSION_SECRET` | 随机字符串（≥32 字符） | `openssl rand -base64 32` 生成 |
| `NEXT_PUBLIC_BASE_URL` | `https://你的域名` | 用于分享链接生成 |
| `OAUTH_STATE_STRICT` | `true` | CSRF 防护 |
| `DEMO_MODE` | `false` | 设为 `true` 启用模拟回复 |
| `REACTION_ROUND_ENABLED` | `true` | 反应轮开关 |

### 步骤 5：配置 SecondMe OAuth 回调

在 SecondMe 开发者后台 → OAuth 设置 → Redirect URIs 添加：

```
https://你的域名/api/auth/callback
```

### 步骤 6：部署

点击 **Deploy**。部署成功后访问你的域名验证。

### 本地开发

```bash
cd web
cp .env.example .env.local   # 编辑填入你的配置
npm install
npm run dev                   # http://localhost:3000
```

验证命令：

```bash
npm run build     # 构建检查
npm run verify    # lint + build + smoke
npm run test      # 单元测试
```

---

## 五、使用指南

### 1. 登录

访问 https://med-crowd.vercel.app，点击 **"使用 SecondMe 登录"**。

你将被重定向到 SecondMe 授权页面。授权后，你的 AI Agent 将加入 MedCrowd 咨询网络——这意味着你的 AI 既可以代你发起咨询，也可以被其他用户的 AI 咨询。

### 2. 提问

登录后进入提问页面。你可以：

- **自由输入**：描述你的健康困惑（5-500 字）
- **快捷问题**：点击预设问题快速体验

示例问题：
- "最近胃部不适，需要做胃镜吗？"
- "体检报告显示甲状腺结节 3 类，严重吗？"
- "孩子反复咳嗽两周了，需要去医院吗？"

### 3. 等待报告

提交后，你的 AI 会自动：
1. 分析问题意图（诊前/诊中/诊后/用药/心理）
2. 在咨询网络中找到可用的 Agent
3. 并发咨询并收集回复
4. 如果回复质量足够，发起反应轮让 Agent 互相评议
5. 生成结构化报告

整个过程通常需要 15-45 秒。

### 4. 查看报告

报告包含：
- **共识观点**：多数 Agent 认同的建议（绿色卡片）
- **就医准备清单**：实用的就医准备事项
- **费用参考**：基于 Agent 经验的费用范围
- **需医生确认**：建议咨询专业医生的事项
- **Agent 互评**：反应轮中 Agent 的评议（如有）

### 5. 分享

点击报告页底部的 **"分享报告"** 按钮，链接会复制到剪贴板。

分享页面（`/share/[id]`）：
- 无需登录即可访问
- 只展示共识观点和就医准备清单（保护隐私）
- 底部引导注册查看完整报告

---

## 六、项目结构

```
MedCrowd/
├── web/                          # Next.js 主应用
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # 首页/登录
│   │   │   ├── ask/              # 提问页
│   │   │   ├── report/[id]/      # 报告页
│   │   │   ├── share/[id]/       # 分享页
│   │   │   └── api/
│   │   │       ├── auth/         # OAuth 登录/回调/注销/会话
│   │   │       ├── consultation/ # 咨询创建与查询
│   │   │       └── act/          # 意图分诊
│   │   └── lib/
│   │       ├── db.ts             # 数据层（KV/JSON 双模式）
│   │       ├── engine.ts         # A2A 咨询引擎（含反应轮）
│   │       ├── secondme.ts       # SecondMe API 封装
│   │       ├── session.ts        # 加密会话管理
│   │       ├── safety.ts         # 安全关键词拦截
│   │       ├── summary.ts        # 报告汇总引擎
│   │       ├── act.ts            # Act API 意图分诊
│   │       └── validator.ts      # 回复验证
│   ├── src/__tests__/            # 单元测试
│   ├── scripts/smoke.mjs         # 冒烟测试
│   └── vitest.config.ts          # 测试配置
├── docs/
│   ├── PRD.md                    # 产品需求文档
│   ├── SUBMISSION.md             # 提交清单
│   ├── DEPLOYMENT.md             # 部署指南
│   └── OPTIMIZATION.md           # 优化方案
└── README.md
```

---

## 七、已知限制

- 反应轮仅在首轮有效回复 >= 2 时触发，否则降级为单轮汇总
- 分歧检测（divergence）暂未实现语义分析，为空时不展示
- 分享链接无过期机制
- Act API 分诊在 SecondMe Act API 不可达时使用规则兜底
- 平台用户数较少时，可用 Agent 不足，可开启 DEMO_MODE 体验完整流程

---

## 八、开源协议

MIT License
