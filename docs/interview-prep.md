# 面试准备 · 面试官追问速查

> 配套 Part 1（`case-study.md`）+ Part 2（Demo）+ Part 3（`ai-collaboration.md`）使用。
> 本文按「面试官可能怎么问 → 我该怎么答」组织，**每个问题都有具体代码位置可指**。

## 项目定位（30 秒讲清楚）

**我是谁**：6 年经验的前端开发（全栈）。

**项目是什么**：宠物粮食跨境电商的 AI 选粮助手 + 配料表对比工具，作为面试作业 Part 2 交付。

**核心能力**：

- **① 个性化推荐**：用户输入宠物画像（物种/品种/月龄/阶段/体重/过敏/预算/目的地）→ 推荐 3-5 款主粮
- **② 配料表对比**：挑选 2-3 款商品 → 输出营养 / 添加剂 / 过敏原 / 适配度评分 + AI 裁决

**技术亮点**：

- Next.js 14 App Router + TypeScript strict + Tailwind
- Zod 单源 schema（同时是 TS 类型 + 运行时校验）
- 演示模式（DEMO_MODE=1）零 Key 即可完整体验，三档渐进
- LLM 输出双层校验 + 物种预过滤 + rule-based fallback
- 自建 `scripts/verify.mjs` 一键门禁（typecheck / lint / vitest / build / Playwright / 安全扫描）
- Vercel 部署零配置 + 四道 Key 安全防线

**总代码量**：~2000 行（src ~1100 行 / tests ~700 行 / docs ~1500 行）。

---


## 第 1 部分 · 主动展示的核心设计决策

> 主动讲这些点，展示工程深度。每个决策都给出代码位置，面试官追问可直接翻代码。

### 1.1 架构分层清晰

API route → Schema 校验 → 候选池预过滤 → Prompt 构建 → LLM/Mock 调用 → 输出 Schema 校验 → 返回值二次校验 → Fallback。

**为什么**：每一层职责单一、易测、易替换。LLM 只做文字裁决，结构化计算全在纯代码里。

**代码**：`src/app/api/recommend/route.ts`、`src/app/api/compare/route.ts`

### 1.2 结构化计算 vs LLM 摘要严格分工

营养差异、过敏命中、适配度评分全部用纯 TS 计算（`comparator.ts`），LLM 只做 verdict / summary 文字。

**为什么**：

- LLM 做数值计算容易出错且不可解释；纯代码 100% 准确
- 即使 LLM 失败，回退到 `defaultVerdict()` 也能保证有结果
- 测试可以针对纯函数做边界用例，不必 mock LLM

**代码**：`src/lib/comparator.ts:64-130`（`scoreProducts`）、`:138-149`（`defaultVerdict`）

### 1.3 数据三层回退链

`scrapeLive()` → `readCache()` → `readMock()`，每一层带 `errors[]` 透明展示。

**为什么**：

- 生产接真实 API 时只改 `scrapeLive()` 一处
- 缓存层让开发 / 演示不用每次都爬
- mock 永远兜底，零外部依赖也能跑

**代码**：`src/lib/scraper.ts:91-122`（`fetchProducts`）、`:42-53`（`scrapeLive` 占位）

### 1.4 物种预过滤放在 API 层而非依赖 LLM

在 `/api/recommend` 里 `candidates = fetched.products.filter(p => p.species === pet.species)`，再喂给 LLM。

**为什么**：

- 防御 mock / LLM 跨物种推荐（之前真实出过 bug：用户选狗却返回猫粮）
- 候选池变小，prompt 更短，token 费用更低
- prompt 里只有同物种商品，LLM 不可能选错

**代码**：`src/app/api/recommend/route.ts:42-50`

### 1.5 LLM 输出双层校验

Zod schema 校验结构 + productId 必须在候选池内（防 hallucination ID）。

**为什么**：

- LLM 经常编造看起来合理但实际不存在的商品 ID
- 即便结构校验过了，ID 不在候选池就丢弃
- 给前端的数据保证「一定可渲染」

**代码**：`src/app/api/recommend/route.ts:67-86`

### 1.6 Mock 与真实 LLM 接口对齐

同一份 prompt、同一份 Zod schema，`llm.mock.ts` 返回 JSON 字符串。

**为什么**：

- 上层代码（API route）不知道也不关心是 mock 还是 LLM
- 测试时 mock 跑通 = 真实 LLM 跑通（接口契约对齐）
- 切换 `DEMO_MODE` / `LLM_MOCK` 不需要改任何业务代码

**代码**：`src/lib/llm.mock.ts`、`src/lib/llm.ts:50-58`（`callLLM` 短路）

### 1.7 演示模式三档渐进

`DEMO_MODE=1`（完全短路，零网络）/ `LLM_MOCK=1`（短路 LLM，UI 走真实表单）/ 默认真实模式。

**为什么**：

- 面试官 0 Key 即可完整体验（核心卖点）
- 切真实模式只需改 `.env.local`，不改代码
- Vercel 部署时把 env 关掉即可，无需重新构建

**代码**：`src/lib/llm.ts:36-38`（`isMockMode`）

### 1.8 Zod 单一来源

`types/index.ts` 既定义 TS 类型又定义运行时校验，前后端 / 测试共享同一份 schema。

**为什么**：

- `PetInfoSchema` 加一个字段，所有用到 `PetInfo` 的地方立刻报错（编译期 + 运行期）
- `safeParse` 返回 `{success, data, error}`，比 try/catch 优雅
- API route 用 `safeParse` 校验请求体，错误信息结构化返回

**代码**：`src/types/index.ts`（整个文件）

### 1.9 测试金字塔四层 + 自建门禁

单元（comparator/recommender/llm.mock/schema/scraper）→ API（next-test-api-route-handler）→ E2E（Playwright）→ `scripts/verify.mjs` 串行编排。

**为什么**：

- 单元测试覆盖纯逻辑，毫秒级反馈
- API 测试覆盖 HTTP 层契约，不用起 dev server
- E2E 覆盖完整 UI 流程（首页 / 推荐 / 对比）
- `verify.mjs` 一键串行，任意一步失败立即退出

**代码**：`scripts/verify.mjs`、`vitest.config.ts`、`playwright.config.ts`

### 1.10 部署安全四道防线

`.gitignore` + `.vercelignore` + `.env` 占位符 + Vercel 控制台填 Key。

**为什么**：

- Key 流转链路从「对话/截图/终端历史」压缩到「Vercel 控制台 HTTPS POST」单点
- 即使其中一层失效，Key 也不会进仓库历史 / bundle / 对话记录
- `.vercelignore` 防止 .env 进 serverless 函数包

**代码**：`.gitignore`、`.vercelignore`、`.env`、`docs/deployment.md`

---


## 第 2 部分 · 高频追问应对清单

> 面试官可能直接追问，也可能从某个细节切入。每个 Q 给「主答 + 深入 + 代码位置」。

### 2.1 为什么用 Next.js 而不是纯 React？

**主答**：Next.js 14 App Router 一体化搞定 SSR + API Routes + 文件路由 + 部署，零配置 Vercel 部署。

**深入**：

- API Routes 让我能在同一仓库写后端，省去独立服务
- App Router 支持嵌套 layout、streaming、Server Components
- 部署友好：`git push` 即可上线，不用配 Nginx / PM2
- 与 OpenAI SDK、Zod、Tailwind 生态无缝集成

**代码**：`next.config.mjs`（几乎为空，靠 Next.js 默认）

### 2.2 为什么用 Zod 而不是 Yup / io-ts？

**主答**：Zod 提供运行时校验 + 完美 TS 类型推断，前后端共享 schema 一份代码两处使用。

**深入**：

- `z.infer<typeof X>` 把 schema 直接派生 TS 类型，不用重复写 interface
- `safeParse` 返回结构化错误（`error.flatten()`），API 路由可直接返回给前端
- 链式 API 优雅（`.refine()`、`.optional()`、`.default()`）
- bundle 体积比 Yup 小（~10KB vs ~50KB）

**代码**：`src/types/index.ts:7-160`

### 2.3 为什么 LLM 不直接计算评分？

**主答**：数值任务交给纯代码（`comparator.ts`）保证 100% 准确；LLM 只做文字裁决（verdict / summary）。

**深入**：

- LLM 做 30+20+30+20 加总会算错（特别是 float 运算）
- 结构化计算结果塞进 prompt，让 LLM「基于已有评分给出 120 字裁决」
- 即便 LLM 失败，回退 `defaultVerdict()` 仍能给出合理结论
- 可解释性：每个扣分项都在 UI 上展开，用户能看到为什么

**代码**：`src/lib/comparator.ts:64-130`、`src/lib/prompts.ts:48-83`

### 2.4 为什么 mock 不随机，要做关键词检测？

**主答**：mock 走关键词（推荐/对比/过敏/物种）+ prompt 块检测，返回确定性 JSON。

**深入**：

- 测试可重复：CI 跑 vitest 时 mock 输出稳定
- prompt 改动可立刻看出 mock 是否漂移（关键词命中）
- 真实 LLM 不稳定时，CI 不会被随机结果影响
- `detectSpecies()` 只匹配【宠物信息】块，避免候选 ID 中 "cat"/"dog" 误判

**代码**：`src/lib/llm.mock.ts:16-23`（`detectSpecies`）

### 2.5 comparator 30+20+30+20 vs recommender 40+40+10+10，评分不一致？

**主答**：两套评分服务于不同场景——推荐偏个体（阶段+过敏最高权重）；对比偏横向（加体重维度）。

**深入**：

- 推荐场景：用户只有一个宠物，阶段 + 过敏是「能不能吃」的决定性因素（80%）
- 对比场景：用户已挑了 2-3 款候选，需要更细粒度（体重覆盖、跨境）
- 承认不一致；如果面试官要求统一，可抽到 `lib/scoring.ts` 用权重矩阵
- 评审时可补一句：「两套是为了表达优先级差异，统一会让对比场景丢信息」

**代码**：`src/lib/recommender.ts:39-58`、`src/lib/comparator.ts:64-118`

### 2.6 LLM 输出 JSON 不规范怎么兜底？

**主答**：四层兜底：fence 正则剥离 → `indexOf("{")` 找 JSON 段 → Zod `safeParse` 校验 → 整体 catch 走 rule-based。

**深入**：

- LLM 经常输出 ` ```json ... ``` ` markdown 代码块（即使 prompt 禁止）
- fence 正则容忍这种情况而不抛错
- `JSON.parse` 失败时 `safeParse` 进一步校验字段
- 任何环节失败 → `recommendByRules()` 兜底，响应 `source: "rule"`

**代码**：`src/app/api/recommend/route.ts:62-93`

### 2.7 没有 rate limiting，被刷怎么办？

**主答**：v1 demo 范围没加；生产应加 Vercel Edge Middleware + Upstash/Redis 做 token bucket。

**深入**：

- Vercel 自带边缘 DDoS 防护（粗粒度）
- 推荐方案：`@upstash/ratelimit` + Redis，按 IP 限 60 req/min
- 高级方案：按 API Key 配额 + 用户登录态限流
- demo 项目不做是因为会引入 Redis 依赖，部署复杂度上升

**代码**：无（明确说明是 demo 范围）

### 2.8 没有用户反馈循环，怎么评估推荐质量？

**主答**：v1 是 demo 范围；生产应加埋点 + 反馈按钮 + A/B test + 推荐反馈回 LLM 微调。

**深入**：

- 短期：埋点记录「展示 → 点击 → 试用 → 复购」漏斗
- 中期：让用户对推荐结果点赞/踩，收集偏好信号
- 长期：fine-tune LLM 或训练 rerank 模型
- 当前阶段：依赖 rule-based 兜底保证基本可用性

**代码**：无（v2 规划）

### 2.9 为什么不上 SSE streaming？

**主答**：v1 优先稳定 + 易测；流式引入 partial JSON 解析、错误处理复杂，v2 可上。

**深入**：

- 流式下 Zod schema 校验要等流结束才能跑
- 用户感知：等 2-3 秒一次性出 vs 流式慢慢出，对结构化结果差异不大
- 实现复杂度上升 3-5 倍（流式 + 解析 + 错误恢复）
- v2 可加：OpenAI SDK 原生支持 `stream: true`

**代码**：`src/lib/llm.ts:60-82`（非流式 `client.chat.completions.create`）

### 2.10 scrapeLive 是 stub，生产怎么接入？

**主答**：推荐走各家开放 API（京东国际 / Chewy / 淘宝全球购），不直接爬 HTML；接入点明确，改 `scrapeLive()` 一处即可。

**深入**：

- 京东国际有商家入驻 API；Chewy 有 affiliate API
- 爬 HTML 易被封、易破版；API 稳定
- 拿到原始数据后用 `ProductSchema.safeParse` 校验（`scraper.ts:71-82`）
- 失败时记录到 `errors[]`，上层走 cache / mock
- 速率限制：每家 API 都有自己的 QPS 限制，需要 token bucket

**代码**：`src/lib/scraper.ts:42-53`、`src/types/index.ts:33-58`

### 2.11 部署后怎么验证真的调用了真实 LLM 而不是 mock？

**主答**：看响应 JSON 的 `source` 字段（`"llm"` vs `"mock"` vs `"rule"`），看 Vercel Function Logs 有真实 LLM 请求。

**深入**：

- 浏览器 DevTools → Network → `/api/recommend` 响应体里 `source: "llm"`
- Vercel 控制台 → Logs → Functions 看 outbound HTTP 请求到 `api.minimax.chat`
- 故意删 `.env.local` 后看是否 fallback 到 `source: "rule"`
- 主动切换 mock / 真实模式做 A/B 对比

**代码**：`src/lib/llm.ts:36-38`（`isMockMode`）、`src/app/api/recommend/route.ts:71-86`

### 2.12 ageMonths 和 ageStage 重复，为什么两个都要？

**主答**：`ageMonths` 是事实（月龄数字），`ageStage` 是粗粒度枚举（商品匹配用）。

**深入**：

- 商品 `lifeStage` 是枚举（puppy/adult/senior/all），必须用枚举匹配
- 但 UI 展示、LLM 上下文需要细粒度（月龄差异 6 月和 18 月完全是两个喂养方案）
- `deriveStage(months)` 自动派生 stage（< 12 → puppy, < 84 → adult, 其余 senior）
- 用户可手动改 stage 覆盖派生（高优先级）
- 改月龄时自动同步 stage（事实优先）

**代码**：`src/components/PetForm.tsx:22-25`（`deriveStage`）、`src/types/index.ts:74-83`（`PetInfoSchema`）

---


## 第 3 部分 · 反弱点话术

> 面试官可能故意挑刺。准备好「承认 + 解释 + 怎么改」的答辩模板。

### 3.1 评分两套不一致

**弱点**：`recommender.ts` 用 40+40+10+10，`comparator.ts` 用 30+20+30+20。

**怎么辩护**：

- 两套服务于不同场景目标（推荐偏个体 vs 对比偏横向）
- 优先级表达不同：推荐场景阶段+过敏占比 80%，对比场景加入体重和跨境
- 公开承认不一致是有意识的取舍，不是疏忽
- **怎么改**：抽到 `lib/scoring.ts` 用权重矩阵 + 配置驱动，便于后续统一或调参

**代码**：`src/lib/recommender.ts:39-58`、`src/lib/comparator.ts:64-118`

### 3.2 scrapeLive 是 stub

**弱点**：`scrapeLive()` 返回空 + 错误，没真实爬虫。

**怎么辩护**：

- 架构就绪（live → cache → mock 三层），接入点明确
- 真实接入改 `scrapeLive()` 一处即可，调用方零改动
- demo 范围不实现是为了避免依赖特定电商的私有 API
- **怎么改**：根据目标电商（京东国际 / Chewy）写 fetch + Zod 校验 + 速率限制

**代码**：`src/lib/scraper.ts:42-53`

### 3.3 没有请求缓存

**弱点**：每次请求都重新调用 LLM，没有缓存。

**怎么辩护**：

- 宠物变量空间大（连续变量月龄/体重），缓存命中率低
- 同一用户短时间内多次请求时，重算比缓存命中更划算
- LLM 输出本就有随机性（temperature 0.4），缓存反而掩盖问题
- **怎么改**：加 pet hash + candidates hash LRU（5 分钟 TTL），可拦截幂等请求

**代码**：无（明确设计取舍）

### 3.4 没有 rate limiting

**弱点**：API 没有速率限制，可能被恶意刷。

**怎么辩护**：

- demo 范围 / 面试作业，不需要
- Vercel 自带边缘 DDoS 防护（粗粒度 IP 限流）
- 生产应加：`@upstash/ratelimit` + Redis，按 IP 限 60 req/min
- **怎么改**：加 `middleware.ts` 做边缘限流；登录态用户按 user_id 限流

**代码**：无（明确 demo 范围）

### 3.5 没有 i18n

**弱点**：纯中文 UI，英文面试官看不懂。

**怎么辩护**：

- v1 国内场景优先（跨境电商 + 宠物粮食）
- 中文字符串集中在 components 和 prompts，便于后续抽取
- **怎么改**：v2 接 `next-intl`，按 `locale` 切换文案
- LLM 部分天然支持多语言（prompt 可改英文）

**代码**：无（v2 规划）

### 3.6 PetForm 是 client component

**弱点**：表单用 `useState`，没有用 Server Action。

**怎么辩护**：

- 表单交互复杂：实时校验、月龄-阶段联动、过敏多选
- useState 直观、易调试、bundle 小
- 提交后才走 API route（fetch POST），没丢失 server-side 的好处
- Server Action 适合简单表单 + 跳转，本场景不适用

**代码**：`src/components/PetForm.tsx:42-185`

### 3.7 月龄改了 stage 会被覆盖

**弱点**：用户先改 stage 到 senior，又改月龄到 6 月，stage 又变回 puppy。

**怎么辩护**：

- 这是设计 trade-off：月龄是事实，stage 是派生
- 「事实优先」比「用户最后一次输入优先」更符合直觉
- UI 提示用户在月龄输入框旁显示「阶段自动同步」
- **怎么改**：加 toggle「锁定 stage」（手动模式 vs 自动模式）

**代码**：`src/components/PetForm.tsx:22-25`（`deriveStage`）

### 3.8 没有 SWR / React Query

**弱点**：每次 submit 都重新 fetch，没有客户端缓存/重试。

**怎么辩护**：

- v1 单次请求，无跨组件共享需求
- 引入只会增加 ~10KB bundle 和抽象复杂度
- 错误处理用 try/catch + UI error state 已足够
- **怎么改**：v2 多页面共享数据时上 SWR，加 `dedupingInterval: 5min`

**代码**：`src/app/recommend/page.tsx:14-33`（`submit`）

---


## 第 4 部分 · 技术栈细节深挖

> 这部分是「追问到底」会问到的纯技术问题。每个 Q 给出主答 + 深入 + 代码位置。

### 4.1 Next.js 14 App Router（5 条）

#### Q1. `layout.tsx` 为什么把 header/nav/footer 写在根 layout 而不是各页面重复？

**主答**：App Router 嵌套 layout 机制；根 layout 是必备（`<html>` + `<body>`），子页面共享 header/footer 自动包裹。

**深入**：

- 根 layout 必须包含 `<html>` 和 `<body>`，否则报错
- 子页面可以是纯内容（不需要再写 `<html>`），layout 自动嵌套
- 切换路由不会重新渲染 layout，只渲染 children（性能更好）
- 想让某个页面特殊布局（如全屏）可在子目录加 `layout.tsx` 覆盖

**代码**：`src/app/layout.tsx`

#### Q2. API 路由里的 `export const runtime = "nodejs"` 和 `export const dynamic = "force-dynamic"` 分别什么意思？

**主答**：`runtime` 选 Node.js 运行时（默认）；`dynamic` 强制每次请求都重新执行，禁用 SSG/ISR 缓存。

**深入**：

- `runtime: "nodejs"` 用 Node.js API（fs、net 等）；Edge Runtime 受限但启动快
- `dynamic = "force-dynamic"` 等价于每请求都跑，避免被 Next.js 静态优化
- LLM 调用必须 Node.js（有 `node:fs`、`node:crypto`），Edge 跑不动
- 默认值是 `"nodejs"` 和 `"auto"`，显式声明是「写给未来 reviewer 看」

**代码**：`src/app/api/recommend/route.ts:14-15`

#### Q3. 哪些文件加了 `"use client"`？为什么？

**主答**：4 个 page.tsx + 5 个 component，含 `useState` / 事件处理 / 表单交互的必须 client。

**深入**：

- 加了 `"use client"`：`recommend/page.tsx` / `compare/page.tsx` / `PetForm.tsx` / `ProductPicker.tsx` / `ComparisonTable.tsx` / `RecommendationList.tsx`
- 没加的：`layout.tsx`（静态布局）/ 首页 `page.tsx`（纯展示）/ API routes
- 「use client」是组件级边界，子组件自动继承父级
- Server Component 不能用 `useState` / `onClick` / `useEffect`

**代码**：上述 6 个文件首行

#### Q4. 没有 `loading.tsx` / `error.tsx`，怎么解释？

**主答**：API 路由内部已经 try/catch + fallback，不依赖页面级 error boundary；`loading.tsx` 用于 React Suspense fallback，本项目没用到 Suspense。

**深入**：

- `loading.tsx` 在 React Suspense fallback 时显示；本项目不用 `await`/Suspense
- `error.tsx` 是页面级 Error Boundary；当前 API 错误已 catch + setState + UI 提示
- **怎么改**：v2 加 `error.tsx` 捕获渲染错误 + 加 `loading.tsx` 配 useTransition

**代码**：无（明确设计取舍）

#### Q5. `next.config.mjs` 几乎是空的，为什么？

**主答**：Next.js 14 零配置即可；Tailwind 通过 PostCSS 自动接入；显式声明反而可能踩坑。

**深入**：

- 唯一配置项 `reactStrictMode: true` 是开发体验改进
- 不强制 `output: undefined`，让 Next.js 默认走 Server Components
- 不引入 experimental 开关，避免 Vercel 误判
- 部署相关配置全在 `vercel.json`（与 next.config.mjs 解耦）

**代码**：`next.config.mjs`

### 4.2 React 状态与组件（4 条）

#### Q1. 推荐页用 `useState` 而不是 `useReducer`，为什么？

**主答**：4 个独立状态（pet / result / loading / error）之间没有联动，useReducer 适合多状态相互依赖或复杂 action。

**深入**：

- `useState`：单个状态、setX 简单
- `useReducer`：多状态相互依赖、action 类型多、需要 dispatch 集中管理
- 本项目状态少且独立，useState 更直观
- **何时升级**：当出现「loading 改完要重置 result」之类的联动时

**代码**：`src/app/recommend/page.tsx:13-17`

#### Q2. 为什么没有 SWR / React Query？

**主答**：v1 是单次请求、无跨组件共享、无重试/缓存需求，引入只会增加 ~10KB bundle 和抽象复杂度。

**深入**：

- SWR / React Query 解决：请求去重、自动重试、跨组件缓存、乐观更新
- 本项目没这些需求，try/catch + setState 已够
- **何时引入**：v2 多页面共享数据、需要轮询、需要乐观更新
- 不引入是为了 demo 简洁性

**代码**：`src/app/recommend/page.tsx:19-33`

#### Q3. `compare/page.tsx` 的 `useMemo(inferredSpecies)` 干什么？

**主答**：根据已选商品推断当前物种，避免选了一只猫粮 + 一只狗粮时数据不一致。

**深入**：

- 依赖 `[selectedIds, pet, products]`
- lint 报「products」不必要的 warning（products 引用恒定）
- 实际只有 selectedIds 和 pet 变化时才重算
- 用途：传给 `ProductPicker` 做物种过滤，避免商品列表和宠物不匹配

**代码**：`src/app/compare/page.tsx:24-29`

#### Q4. `ProductPicker` 的 `filtered` 列表为什么没 memoize？

**主答**：filtered 只在 props 变化时重算（30 个商品级别，微不足道）；useMemo 自身有开销。

**深入**：

- 30 个商品 × 一次 filter = 微秒级
- useMemo 本身要比较依赖数组，有开销
- 父组件 rerender 时子组件自然重算（除非 React.memo）
- **何时优化**：商品达 100+ 且 filter 逻辑复杂（如多条件交集）

**代码**：`src/components/ProductPicker.tsx:21`

### 4.3 TypeScript 与 Zod（5 条）

#### Q1. `tsconfig.json` 的 `strict: true` 实际开了哪些？

主答：`strictNullChecks` / `noImplicitAny` / `strictFunctionTypes` / `strictBindCallApply` / `strictPropertyInitialization` / `alwaysStrict` / `useUnknownInCatchVariables` 七个标志。

**深入**：

- `strictNullChecks`：`null` / `undefined` 不能隐式赋值给其他类型（最常踩）
- `noImplicitAny`：参数必须有类型或显式 `any`
- `useUnknownInCatchVariables`：`catch (e)` 的 `e` 默认是 `unknown`（强制类型守卫）
- `strictPropertyInitialization`：class 属性必须有初始值或在 constructor 里赋值

**代码**：`tsconfig.json:7`

#### Q2. `paths: { "@/*": ["./src/*"] }` 怎么用？

**主答**：TypeScript 路径别名；`import { foo } from "@/lib/foo"` 解析到 `src/lib/foo`。

**深入**：

- TS 编译器用 `paths` 解析 import 路径
- 运行时（Next.js / Vitest）需要单独配：Next.js 自动支持；Vitest 用 `resolve.alias`
- 比相对路径 `../../../lib/foo` 更清晰，避免重构地狱
- 配错时常见症状：编译通过但运行时报「module not found」

**代码**：`tsconfig.json:23-25`、`vitest.config.ts:11-13`

#### Q3. `moduleResolution: "bundler"` vs `"node"` 区别？

**主答**：bundler 支持 `.ts` / `.tsx` 直接 import（无需后缀）、支持 package.json `exports` 字段；node 是经典 CommonJS 解析。

**深入**：

- `"bundler"`（Next.js 14 必需）：模拟 webpack/vite 行为
- `"node"`：传统 CommonJS，需写文件后缀，不识别 `exports` 字段
- `"node16"` / `"nodenext"`：现代 Node ESM 解析
- 选错时常见：import 不带后缀报错、`exports` 字段的包解析失败

**代码**：`tsconfig.json:13`

#### Q4. `z.infer<typeof XxxSchema>` 怎么工作？

**主答**：Zod schema 既定义运行时校验（`parse` / `safeParse`），又派生 TS 类型（`z.infer`），schema 是单一来源。

**深入**：

- `export const PetInfoSchema = z.object({...})` 定义 schema
- `export type PetInfo = z.infer<typeof PetInfoSchema>` 派生类型
- schema 改 → 类型自动跟 → 编译期报错
- 运行时 `PetInfoSchema.safeParse(body)` 校验
- 任何 `interface PetInfo` 都是冗余的，会和 schema 漂移

**代码**：`src/types/index.ts:74-83`

#### Q5. `CompareResponse.productIds` 用 `.refine()` 而不是 `.length(2).or(.length(3))` 为什么？

**主答**：`.length()` 是元组断言，类型推断会变成 `[string, string] | [string, string, string]` 联合；`.refine()` 保留 `string[]`，TS 类型不变（都是 string[]），运行时校验更准确。

**深入**：

- `.length(2)` 把类型变成 `[string, string]`（元组）
- `.length(2).or(.length(3))` 变成 `[string, string] | [string, string, string]`
- `.refine()` 不改 TS 类型，只在运行时校验
- 处理返回值时 `string[]` 比元组联合更简单

**代码**：`src/types/index.ts:148-156`

### 4.4 Tailwind CSS（3 条）

#### Q1. 为什么不用组件库（AntD / shadcn / MUI）？

**主答**：demo 体量小，组件库会引入 ~100KB+ bundle；Tailwind 原生足够；shadcn 需要复制粘贴组件代码，跨项目复制度低。

**深入**：

- AntD / MUI：完整组件库，但样式固定、定制难、bundle 重
- shadcn：复制 Radix UI + Tailwind 源码到项目，定制自由但跨项目复用低
- 本项目用纯 Tailwind：3 个表单元素 + 3 个展示组件，组件库不划算
- **何时引入**：项目达到 20+ 复杂组件、要做 design system

**代码**：所有 `*.tsx` 文件（纯 Tailwind className）

#### Q2. `tailwind.config.ts` 的 brand 调色板怎么定的？

**主答**：自定义 `brand-50~700` 5 个色阶（实际 50/100/500/600/700），覆盖 hover/border/text 三种用途，与 Tailwind 默认 sky 色系一致。

**深入**：

- `brand-50` / `brand-100`：浅色背景（hover、selected 状态）
- `brand-500` / `brand-600` / `brand-700`：主色（按钮、链接、强调）
- 跨度 50-700，覆盖 5 种对比度
- 一键换主题：改这 5 个值即可
- 与 Tailwind 内置 sky 色系一致，迁移零成本

**代码**：`tailwind.config.ts:7-15`

#### Q3. `@layer components { .input .btn .btn-primary }` 干什么？

**主答**：自定义类提升到 components 层，Tailwind 自动管理 specificity；避免和 utilities 层 utility class 冲突；减少重复 className。

**深入**：

- Tailwind 三层：base / components / utilities
- `components` 层写可复用的语义化类（`.btn-primary`）
- `utilities` 层写单属性类（`bg-brand-600`）
- utilities 永远在 components 之上，无需手动管理优先级
- 不写 `@layer` 就直接放全局，会和 utilities 冲突

**代码**：`src/app/globals.css:18-30`

### 4.5 OpenAI SDK / LLM 调用（5 条）

#### Q1. `new OpenAI({ apiKey, baseURL })` 兼容性？

**主答**：OpenAI 官方 Node SDK 支持 `baseURL` 字段；只要目标服务兼容 `/v1/chat/completions` 端点（绝大多数厂商都兼容），即可一行切换。

**深入**：

- OpenAI SDK 默认 `https://api.openai.com/v1`
- 传 `baseURL` 后所有请求改发到该 endpoint
- 兼容厂商：Azure OpenAI、MiniMax、Anthropic（via gateway）、Ollama（本地）
- 不兼容厂商：需要自定义 SDK 或代理

**代码**：`src/lib/llm.ts:30-34`

#### Q2. 为什么用 `chat.completions.create` 而不是 `responses.create`？

**主答**：`responses` 是 OpenAI 2025 新端点，部分兼容服务（如 MiniMax）暂未跟进；`chat.completions` 是事实标准，兼容最广。

**深入**：

- `chat.completions` 是 OpenAI 2023+ 端点，所有兼容厂商都支持
- `responses` 是 OpenAI 2025 推出，新功能（function calling、流式、多模态）
- 当前项目只用纯文本 + JSON schema，`chat.completions` 够用
- **何时升级**：需要 function calling / 多模态 / 内置 cache

**代码**：`src/lib/llm.ts:62-72`

#### Q3. `temperature: 0.4` 为什么？

**主答**：0 = 完全确定性 / 易陷入循环；1 = 自由度高 / 容易发散；0.4 在「稳定 + 多样」之间平衡，结构化任务常用。

**深入**：

- `temperature: 0`：同输入必同输出，但容易陷入模板化循环
- `temperature: 1`：自由度高，但容易跑偏（特别是 JSON 任务）
- `temperature: 0.4`：结构化输出常用值，给 LLM 一点表达空间
- 不同任务最佳值不同：摘要 0.3、推荐 0.5、对话 0.7

**代码**：`src/lib/llm.ts:67`

#### Q4. 错误信息里 sanitize Key 为什么？

**主答**：`err.message.replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***")`；防 Key 进 Vercel 函数日志 / 监控平台（Sentry/Datadog）/ 用户截图。

**深入**：

- OpenAI SDK 抛错时 err.message 里可能含完整 API Key
- 直接打到日志 = 泄露
- 正则替换：保留错误结构，把 Key 替换为 `sk-***`
- 生产部署后日志会被收集到 Datadog / CloudWatch，泄露面扩大

**代码**：`src/lib/llm.ts:78-82`

#### Q5. `cachedClient` 单例模式为什么？

**主答**：避免每次请求都 `new OpenAI`（HTTP keep-alive / TCP 连接复用）；Next.js 14 单进程下足够；多进程需额外考虑连接池。

**深入**：

- `new OpenAI()` 会建一个 HTTP agent
- 重复创建 = 重复 TCP 三次握手 + TLS 握手（慢）
- 单例模式：第一次创建后缓存，全局复用
- 多进程（cluster / serverless）下每个进程有自己的单例
- Vercel Function 冷启动时新建一次，热运行复用

**代码**：`src/lib/llm.ts:21-34`

### 4.6 Testing 工具链（4 条）

#### Q1. vitest `environment: "node"` 为什么不是 jsdom？

**主答**：测试的是 lib/*（comparator / recommender / llm.mock / scraper）+ API route，都不依赖 DOM；jsdom 会拖慢启动。

**深入**：

- `environment: "node"`：纯 Node 环境，跑 TS 逻辑
- `environment: "jsdom"`：模拟浏览器，跑 React 组件测试
- 本项目没写 React 组件测试（用 Playwright E2E 替代）
- jsdom 启动慢（~200ms），本项目不需要

**代码**：`vitest.config.ts:5`

#### Q2. `next-test-api-route-handler` 怎么 mock NextRequest？

**主答**：包内部用 `node-mocks-http` 模拟 Web Request/Response；测试不用起 dev server，速度比 E2E 快 10×。

**深入**：

- `testApiHandler({ appHandler, test })`：传入 Next.js route 模块
- `test({ fetch })` 拿到一个 fetch 函数，发起 mock 请求
- 内部把 NextRequest / NextResponse 适配到 node-mocks-http
- 单元测试一个 API route 只需 ~200ms（vs E2E ~5s）

**代码**：`tests/api/recommend.test.ts`

#### Q3. Playwright `webServer.command` 为什么用绝对路径？

**主答**：Windows cmd 不识别 `next`（PATH 不含 node_modules/.bin）；`node_modules\.bin\next.cmd` 显式路径才能启动；env 字段也用对象而非 `KEY=VALUE` 前缀。

**深入**：

- 原配置：`command: `${envPrefix}next dev -p ${PORT}``，Linux 正常，Windows 失败
- 修正：`command: "node_modules\.bin\next.cmd dev -p ${PORT}"` + `env: webServerEnv`
- Windows cmd 用 `&&` 而不是空格分隔 `KEY=VALUE`
- `env` 对象是跨平台通用写法（Playwright 自动处理）

**代码**：`playwright.config.ts:31-33`

#### Q4. `data-testid` 在测试里的角色？

**主答**：与 className / role / aria-label 解耦；UI 重构不影响测试；E2E 用 `page.getByTestId(...)` 选择元素最稳。

**深入**：

- className 会因重构改名（Tailwind class 经常变）
- role / aria-label 需要可访问性设计，有时不合适
- data-testid 是测试专用标识，不影响用户
- Playwright 推荐：`page.getByTestId("submit-recommend")`
- 加 data-testid 是「写给未来的测试代码」，是契约的一部分

**代码**：所有 `*.tsx` 文件中可见 `data-testid="..."`

### 4.7 Vercel 部署（3 条）

#### Q1. `regions: ["sin1"]` 为什么是新加坡？

**主答**：Vercel 在亚洲有 sin1（新加坡）/ hnd1（东京）/ icn1（首尔）；sin1 对国内面试官延迟最低（跨境电商用例贴合）；用户可改。

**深入**：

- Vercel 全球 18 个 region，亚洲 3 个
- sin1 是新加坡节点，国内访问延迟 ~50ms
- hnd1 是东京，延迟类似但节点容量较小
- 跨境电商场景贴合（东南亚宠物食品进口）
- 用户可在 vercel.json 改成 `["hnd1"]` 或多 region `["sin1", "hnd1"]`

**代码**：`vercel.json:5`

#### Q2. `installCommand: "pnpm install --frozen-lockfile"` 为什么？

**主答**：锁定依赖版本，避免 Vercel 安装时引入未审计的传递依赖；构建可重现；安全审计友好。

**深入**：

- 默认 `pnpm install` 会更新 lockfile
- `--frozen-lockfile`：lockfile 不一致就报错
- 好处：本地 lockfile = 部署 lockfile，构建确定性
- 坏处：lockfile 过期需手动 `pnpm install` 更新
- 安全：避免供应链攻击（依赖被篡改后被自动拉取）

**代码**：`vercel.json:4`

#### Q3. Vercel 冷启动 1-3 秒怎么优化？

**主答**：v1 demo 可接受；优化方案：Edge Runtime（启动 < 100ms，但 API 受限）、预热（外部 cron 触发）、Vercel 缓存层（cache: "force-cache"）。

**深入**：

- 冷启动原因：Vercel Function 闲置 ~15 分钟后被冻结
- Edge Runtime：启动 < 100ms，但不能用 Node API（fs/net）
- 预热：用 cron-job.org 每 10 分钟 ping 一次
- 缓存层：Next.js 14 自带 `cache: "force-cache"`，但 API route 默认不缓存
- **何时优化**：用户量上来、面试官反馈「打开慢」

**代码**：无（v1 demo 接受冷启动）

---


## 附录 · 演示脚本

### A. 30 秒开场（电梯演讲）

```
"我是宾政浩，6 年经验的前端开发（全栈）。
 这个项目是宠物粮食跨境电商的面试作业 Part 2 —— AI 选粮助手。
 两个核心能力：① 输入宠物画像推荐主粮；② 多款商品配料表对比。
 技术栈：Next.js 14 + TypeScript strict + Tailwind + Zod。
 亮点：演示模式零 Key 即可完整体验；LLM 失败自动 fallback；
 部署安全四道防线（.gitignore + .vercelignore + 占位符 + Vercel 控制台填 Key）。
 现在我演示一下..."
```

### B. 1 分钟亮点（动手演示）

```
1. 打开 http://localhost:3000/recommend
2. 物种选「狗」→ 点击鸡过敏 → 点「获取推荐」
   → 推荐列表全部是狗粮（验证物种预过滤）
   → 响应 source = "llm"（不是 mock / rule）
3. 改月龄 120 → 阶段自动同步到「老年」
   → 推荐结果偏向高龄宠物粮
4. 打开 /compare → 多选 2-3 款 → 点「开始对比」
   → 营养差异（蛋白/脂肪高亮）+ 过敏原矩阵（红黄绿）+
     适配度评分柱状图 + 120 字 LLM 裁决
```

### C. 2 分钟深入（讲技术细节）

```
选一个最熟的点展开：

→ 选「LLM 输出双层校验」
1. 打开 src/app/api/recommend/route.ts
2. 讲 Zod schema 校验（line 67-74）
3. 讲 productId 在候选池内二次校验（line 79-86）
4. 讲整体 catch + rule-based fallback（line 88-93）
5. 强调：每一层都是兜底，互不依赖

→ 或选「数据三层回退」
1. 打开 src/lib/scraper.ts
2. 讲 scrapeLive → readCache → readMock
3. 讲 errors[] 透明展示
4. 讲生产接京东国际 API 只改 scrapeLive() 一处
5. 强调：架构就绪 = 接入点明确
```

### D. 应对「为什么选这个技术栈」类问题

| 选型 | 为什么 | 备选 | 不选的原因 |
|---|---|---|---|
| Next.js 14 | App Router + 一体化路由 | 纯 React + 独立后端 | 部署复杂 |
| TypeScript strict | 类型即文档 + 编译期捕获错误 | JS + JSDoc | 缺乏约束 |
| Zod | 单源 schema + 类型推断 | Yup / io-ts | bundle 重 / 类型推断弱 |
| Tailwind | 零运行时 + 快速开发 | CSS Modules / styled | 学习曲线 / 包体积 |
| Vitest | 与 Next.js 14 兼容 + 速度快 | Jest | 配置复杂 + 启动慢 |
| Playwright | 跨浏览器 + 真实环境 | Cypress | 单浏览器支持 |
| Vercel | 零配置 + 免费 tier | Cloudflare Pages | 需 OpenNext 适配器 |

### E. 应对「你下一步会怎么改」类问题

**优先级 1（高 ROI）**：

- 加 rate limiting（@upstash/ratelimit）
- 加 Sentry 错误监控
- 接真实电商 API（替换 scrapeLive）

**优先级 2（中期）**：

- 用户反馈循环（点赞/踩）
- 推荐 rerank 模型（用反馈数据训练）
- 多语言支持（next-intl）

**优先级 3（长期）**：

- 完整 i18n + a11y + PWA
- 跨境税费计算
- 与支付 / 物流系统集成

---

## 速查索引

需要快速查找某个问题：

- **业务决策**：第 1 部分
- **面试官追问**：第 2 部分
- **弱点辩护**：第 3 部分
- **技术细节**：第 4 部分
- **演示流程**：附录

面试前 1 小时复习建议：

1. 通读第 1 部分（主动展示）→ 确认每个点都能讲 30 秒
2. 跳读第 2 部分（追问应对）→ 标记不熟的点，复习
3. 通读第 3 部分（反弱点）→ 准备 5 个最可能被问到的反驳
4. 跳读第 4 部分（技术细节）→ 标记不熟的技术栈
5. 演练附录 A / B / C 三段演示

面试前 10 分钟：

- 打开 `pnpm dev`，确认能跑
- 打开浏览器三个页面确认能访问
- 准备一个具体的项目亮点（自选 1 个），演练 2 分钟

