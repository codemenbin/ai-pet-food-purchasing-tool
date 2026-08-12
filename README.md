# AI 选粮助手 · 宠物粮食跨境电商面试作业

> 本仓库作为面试作业交付物，包含 Part 1 案例文档、Part 2 可运行 Demo、Part 3 AI 协作记录与一键交付门禁。

## 🎯 项目定位

为宠物粮食跨境电商场景设计的 AI 工具：

- **① 个性化选粮推荐**：输入宠物画像 → 推荐 3-5 款主粮（结构化 + LLM 摘要）
- **② 配料表对比**：挑选 2-3 款商品 → 营养 / 添加剂 / 过敏原 / 适配度结构化对比
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

> 强烈建议：交付作业前为该项目**签发一次性 / 受限额度**的子 Key；或在交付完成后**轮换 Key**。

## 📦 内置商品库

`src/data/products.json` 含 10 款跨境常见宠物主粮，覆盖：

- 物种：猫 / 狗
- 阶段：幼年 / 成年 / 老年 / 全阶段
- 过敏原：含鸡 / 含鱼 / 含谷物 等多类
- 跨境可用性：≥2 款不支持（演示红黄绿提示）

可通过直接编辑 `products.json` 扩展，无需改代码（schema 校验在 `tests/unit/schema.test.ts`）。

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
