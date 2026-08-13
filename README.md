# AI 选粮助手 · 宠物粮食跨境电商面试作业

> 本仓库作为面试作业交付物，包含 Part 1 案例文档、Part 2 可运行 Demo、Part 3 AI 协作记录与一键交付门禁。

## 🎯 项目定位

为宠物粮食跨境电商场景设计的 AI 工具：

- **① 个性化选粮推荐**：输入宠物画像（物种 / 品种 / **月龄** / 阶段 / 体重 / 过敏 / 预算 / 目的地）→ 推荐 3-5 款主粮
- **② 配料表对比**：挑选 2-3 款商品 → 营养 / 添加剂 / 过敏原 / **适配度评分** 结构化对比
- **三层数据回退**：live（爬虫占位）→ cache（本地快照）→ mock（31 款内置商品）
- **演示模式**：默认 `DEMO_MODE=1`，**无需 API Key** 即可完整体验
- **真实模式**：填入 `.env.local` 即切换为真实大模型（OpenAI 兼容协议）

## 🚀 一键运行

```bash
# 1. 安装依赖（推荐 pnpm；npm / yarn 亦可）
pnpm install

# 2.（可选）复制环境变量模板，用于填写真实 Key
cp .env.example .env.local

# 3. 启动开发服务器
pnpm dev
# → 浏览器打开 http://localhost:3000
# → 体验 /recommend 与 /compare，零成本

# 4.（可选）启用真实大模型：编辑 .env.local，填入 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
#    并把 DEMO_MODE / LLM_MOCK 改为 0 或删除该行
```

> 仓库默认提交了 `.env`（仅含 `DEMO_MODE=1 / LLM_MOCK=1`），即使用户不创建 `.env.local`，Demo 也能完整跑通。

## ✅ 一键验证（交付门禁）

```bash
pnpm run verify
```

依次执行：
1. `tsc --noEmit` —— TypeScript 零错误
2. `next lint` —— 代码风格零错误
3. `vitest run` —— Unit + API 测试全部通过
4. `next build` —— 生产构建成功
5. Playwright —— E2E 三个 spec 通过（首页 / 推荐 / 对比），自动启动 dev
6. 安全检查 —— `.gitignore` 含 `.env.local` / 仓库无明文 Key

末尾打印 `✅ 可交付` 或 `❌ 不可交付 + 失败项`。

> 首次运行 verify 时会下载 Playwright Chromium 浏览器（~150MB），请耐心等待。

可选跳过：
```bash
node scripts/verify.mjs --skip-e2e     # 跳过 E2E（节省时间）
node scripts/verify.mjs --skip-build   # 跳过生产构建
node scripts/verify.mjs --skip-lint    # 跳过 lint
```

## 🗂️ 目录结构

```
.
├── README.md
├── docs/
│   ├── case-study.md         # Part 1：AI 制表平台五层架构
│   └── ai-collaboration.md   # Part 3：AI 协作记录
├── .env                      # 默认配置（DEMO_MODE=1）
├── .env.example              # 模板（含全部变量说明，不含真实 Key）
├── src/
│   ├── app/                  # Next.js 14 App Router
│   │   ├── page.tsx          # 首页
│   │   ├── recommend/        # ① 推荐页
│   │   ├── compare/          # ② 对比页
│   │   └── api/
│   │       ├── recommend/route.ts
│   │       └── compare/route.ts
│   ├── components/           # 共享组件
│   ├── lib/                  # 核心逻辑（llm / prompts / recommender / comparator / mock）
│   ├── data/products.json    # 内置 10 款商品（覆盖猫/狗 × 幼/成/老）
│   └── types/index.ts        # Zod schema + TS 类型（单一来源）
├── tests/
│   ├── unit/                 # 纯逻辑 + schema 校验
│   ├── api/                  # API Route 单元化测试
│   └── e2e/                  # Playwright（自动起 dev）
├── scripts/verify.mjs        # 串行门禁脚本
├── playwright.config.ts
├── vitest.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
├── package.json
└── .gitignore                # 含 .env.local / node_modules / .next
```

## 🔐 安全注意

- **永远不要** 把 API Key 写进任何被提交的文件。
- `.env.local` 已加入 `.gitignore`，本地真实 Key 放这里。
- `.env.example` 仅含变量名 + 占位 Key（`sk-replace-with-your-real-key`）。
- 演示模式（`DEMO_MODE=1` / `LLM_MOCK=1`）下不会发起任何外部网络请求。
- **部署时 Key 只走 Vercel 控制台**：不进仓库、不进 bundle、不进对话历史。详见下方「部署到 Vercel」章节。

> 强烈建议：交付作业前为该项目**签发一次性 / 受限额度**的子 Key；或在交付完成后**轮换 Key**。

## 🌐 部署到 Vercel

本项目零配置即可部署到 Vercel。`vercel.json` 已声明 framework / buildCommand / regions。

### 方式一：GitHub 集成（推荐长期维护）

1. 把代码推到 GitHub 仓库（建议私有）
2. 登录 [vercel.com](https://vercel.com) → Add New Project → 选仓库
3. Framework Preset 自动识别为 Next.js
4. Settings → Environment Variables 添加下方 5 个变量（仅 Production）
5. 点 Deploy，约 90 秒构建完成 → 得到 `https://<project>.vercel.app`

### 方式二：vercel CLI（一次性快速）

```bash
npm i -g vercel               # PowerShell 需先 Set-ExecutionPolicy RemoteSigned
cd ai-pet-food-purchasing-tool
vercel login                  # 弹浏览器授权
vercel link                   # 首次会让你输入 project name

# 交互式添加环境变量（粘贴轮换后的 Key，不会进 git）
vercel env add LLM_API_KEY production
vercel env add LLM_BASE_URL production
vercel env add LLM_MODEL production
vercel env add DEMO_MODE production
vercel env add LLM_MOCK production

vercel --prod                 # 一键部署到 Production
```

### 环境变量清单（Production）

| 变量 | 值 | 说明 |
|---|---|---|
| `DEMO_MODE` | `0` | 关闭演示模式 |
| `LLM_MOCK` | `0` | 关闭 mock LLM |
| `LLM_BASE_URL` | `https://api.minimax.chat/v1` | MiniMax OpenAI 兼容 endpoint |
| `LLM_API_KEY` | `<轮换后的新 Key>` | 在 Vercel 控制台直接填入，**不经对话** |
| `LLM_MODEL` | `MiniMax-M3` | 模型名 |

> Preview / Development 环境建议留 `DEMO_MODE=1` 默认，避免预览构建消耗真实 Key 额度。

### 部署后验收

- 浏览器访问 `/`、`/recommend`、`/compare` 三页均能渲染，无 console error
- `/recommend` 选「狗」→ 推荐结果全部是狗粮（验证物种预过滤）
- `/recommend` 提交后，Vercel Function logs 显示 `source: "llm"`（不是 mock / rule）
- `/compare` 多选 → 出现 LLM 给的 ≤120 字 verdict
- 冷启动首访 1–3 秒属正常

### 回滚 / 域名

- 任意历史部署可在 Vercel 控制台 → Deployments → Promote 一键回滚
- 子域名可在 Settings → Domains 修改（如 `pet-food-demo.vercel.app`）
- 绑定自定义域名同样在该页面操作

### 本地先跑通（推荐）

部署前务必在本地跑一遍 `pnpm run verify`，确保零错误后再推。
```bash
pnpm install
pnpm run verify         # 期望：✅ 可交付
pnpm build              # 确保生产构建无错
```

更详细的故障排查见 [`docs/deployment.md`](./docs/deployment.md)。

---
## 📦 数据获取架构（三层回退）

商品数据按以下顺序回退（详见 `src/lib/scraper.ts`）：

```
fetchProducts()
    │
    ├── DEMO_MODE=1 ──► mock   （默认；零成本、确定性）
    │
    └── DEMO_MODE=0 ──► live  ──► 失败/空 ──► cache ──► 失败/空 ──► mock
```

| 层 | 实现 | 状态 |
|---|---|---|
| **live** | `scrapeLive()` 占位 | 当前返回空 + 错误；接入真实 API（京东国际 / Chewy 等）即可 |
| **cache** | `data/products.cache.json` | 缓存文件；存在时使用，每次 live 成功后建议落盘 |
| **mock** | `src/data/products.json` | **31 款**（15 猫 + 16 狗），永远可用 |

返回结构含 `source: "live" | "cache" | "mock"` 与 `errors: string[]`，前端可透明展示。

### 内置商品库

`src/data/products.json` 含 **31 款**（15 猫 + 16 狗）跨境常见宠物主粮，覆盖：

- 物种：猫 / 狗
- 阶段：幼年 / 成年 / 老年 / 全阶段
- 品牌：Acana / Orijen / Royal Canin / Hill's / Blue Buffalo / Wellness / Taste of the Wild / Ziwi / Purina Pro Plan / Pedigree / Nutro / Meow Mix / Fancy Feast / PureLuxe / 麦富迪
- 过敏原：含鸡 / 含鱼 / 含谷物 等多类
- 跨境可用性：4 款不支持（演示红黄绿提示）

可直接编辑 `products.json` 扩展，无需改代码（schema 校验在 `tests/unit/schema.test.ts`）。

## 📝 案例文档

- **Part 1**：见 [`docs/case-study.md`](./docs/case-study.md) —— AI 制表平台（前端负责人 + 部分后端）的五层架构复盘
- **Part 3**：见 [`docs/ai-collaboration.md`](./docs/ai-collaboration.md) —— AI 协作痕迹与 ≥2 处工程化调优点

## 🛠️ 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | Next.js 14 (App Router) | SSR + Server Actions + 一体化路由 |
| 语言 | TypeScript 5.6 strict | 类型即文档，编译期捕获错误 |
| 样式 | Tailwind CSS 3 | 节奏快、零运行时开销 |
| 数据 | Zod | 前后端共享 schema（types/index.ts 即校验） |
| 测试 | Vitest + Playwright + next-test-api-route-handler | 单测 / API / E2E 三件套 |
| 编排 | 自建 `scripts/verify.mjs` | 跨工具统一门禁 + 人类可读输出 |

## 🎓 验收清单（"直接可用"定义）

| 项 | 验证方法 |
|---|---|
| `pnpm install && pnpm run verify` 通过 | 终端输出 `✅ 可交付` |
| `pnpm dev` 后 `/recommend` 完整流程 | 浏览器可见推荐卡片 |
| `pnpm dev` 后 `/compare` 完整流程 | 浏览器可见对比表 + 评分 + 裁决 |
| 无 Key 时也能跑 | `DEMO_MODE=1` 默认开启 |
| 填 Key 后切真实模型 | 修改 `.env.local` 后重启 dev |
| 仓库无 Key 泄露 | `git log -p | grep sk-` 应为空 |
| Part 1 / Part 3 文档齐备 | 见 `docs/` |

## 📄 License

仅作为个人面试作品交付，不附带开源 License。
