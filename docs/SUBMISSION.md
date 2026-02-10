# MedCrowd 黑客松提交清单

## 1. 项目信息

| 项目 | 内容 |
|------|------|
| 名称 | MedCrowd 众医议 |
| 赛道 | Track 1 — 重做一遍互联网（A2A 健康咨询） |
| 核心理念 | 你的 AI 带着你的困惑，去咨询众人的 AI |
| GitHub | https://github.com/Joe-rq/MedCrowd |
| Demo URL | https://med-crowd.vercel.app |

## 2. 评分维度对齐

| 维度 | 权重 | 完成情况 |
|------|------|---------|
| A2A 场景价值 | 30% | 多 Agent 并发咨询 + 反应轮互评（Agent 回应彼此观点）；Act 分诊 + Chat 众议双能力 |
| 创新度 | 20% | 健康众议：不是问一个 AI，而是让你的 AI 代你去问众人的 AI，匿名聚合真实经验 |
| 完成度 | 20% | OAuth → 提问 → 分诊 → 多 Agent 咨询 → 反应轮 → 结构化报告 → 分享 全链路可用 |
| 用户选择 | 30% | /share/[id] 分享传播闭环；Demo URL 可公开访问 |

## 3. 功能清单

- [x] SecondMe OAuth 登录/注销
- [x] 健康问题输入 + 快捷问题
- [x] Act API 健康分诊（意图分类）
- [x] 多 Agent 并发咨询（最多 5 个）
- [x] 反应轮互评（Agent 回应彼此观点，门控触发）
- [x] 回复验证（去重、过短过滤、无经验标记、幂等判重）
- [x] 结构化报告（共识、就医准备清单、费用参考、需医生确认项）
- [x] 安全拦截（自伤/急症关键词 → 心理热线/120）
- [x] 医疗免责声明（全局 + 报告页 + 分享页）
- [x] 报告分享页（/share/[id]，无需登录）
- [x] 加密 Session（iron-session）
- [x] OAuth state CSRF 防护
- [x] Vercel KV 持久化（Upstash Redis，生产级）
- [x] Demo Mode fallback（SecondMe API 不可用时可演示）
- [x] 端点环境变量化（零硬编码）

## 4. 本地验证

```bash
cd web
npm install
npm run build     # 构建检查
npm run verify    # lint + build + smoke
npm run test      # 单元测试
npm run dev       # 启动开发服务器
```

## 5. 部署

- 平台：Vercel
- 持久化：Vercel KV（Upstash Redis）
- 区域：自动
- 详见 [DEPLOYMENT.md](DEPLOYMENT.md)

## 6. 已知限制

- 反应轮仅在首轮有效回复 >= 2 时触发，否则降级为单轮汇总
- Act API 分诊在 SecondMe Act API 不可达时使用规则兜底
- 分歧检测（divergence）暂未实现语义分析，为空时不展示
- 分享链接无过期机制
