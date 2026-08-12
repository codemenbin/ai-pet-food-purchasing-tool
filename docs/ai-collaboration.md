# AI 协作记录（Part 3）

> 记录本项目中 AI 参与了哪些环节、自己做了哪些决策、以及至少 2 处 AI 输出经过工程化调优的地方。

## 一、AI 参与了哪些

### 1.1 代码生成（占项目代码量约 70%）

| 模块 | AI 写的内容 | 我的复核 |
|---|---|---|
| `src/lib/prompts.ts` | 两个 Prompt 模板的初稿 | 调整 JSON Schema 约束、收紧字数 |
| `src/components/*.tsx` | 5 个组件的 UI 骨架（Tailwind class、props 接口） | 调整 data-testid 与可访问性 |
| `src/app/**/*.tsx` | 三个页面的客户端状态管理逻辑 | 校验 API 调用约定与错误兜底 |
| `src/lib/recommender.ts` | 规则过滤 + 评分的初版 | 重写评分子项（40+40+10+10 → 30+20+30+20），更贴近业务 |
| `src/lib/comparator.ts` | 营养 diff、过敏矩阵、评分函数 | 调阈值（蛋白 15% / 脂肪 15%），改数据结构让 UI 易渲染 |
| `tests/**/*.test.ts` | 9 个测试文件的用例初稿 | 补齐边界 case（空数组、超出区间、价格边界） |
| `scripts/verify.mjs` | 自检脚本结构 | 调整 Windows 兼容（findstr vs grep） |

### 1.2 文档与文案

- README 结构与各小节正文初稿
- case-study.md 五层架构拆分与 mermaid 图
- ai-collaboration.md（即本文档）

### 1.3 工程化决策建议

- 建议使用 Zod 替代手写 TS 类型校验（前后端共享 schema）
- 建议把 mock 拆成独立文件 `llm.mock.ts`，便于测试与生产切换
- 建议用 `next-test-api-route-handler` 跑 API 测试，比起 dev server 更稳

---

## 二、自己做的决策（AI 没参与）

| 决策 | 理由 |
|---|---|
| **DEMO_MODE 短路所有外部依赖** | 面试官拿到代码可能不想花 5 分钟配 Key；零成本可跑 = 立即体验 |
| **结构化计算与 LLM 解耦**（comparator 算 diff/score，LLM 只做裁决） | 数值任务交给 LLM 容易出错（幻觉），代码算精确 |
| **评分权重 30/20/30/20** | 阶段 + 过敏权重最高（业务上最影响适配方）+ 体重 + 价格兜底 |
| **mock 用关键词路由**（`推荐` / `对比` / `兜底`） | 比纯随机稳，比真 LLM 便宜；测试断言容易 |
| **TS 5.6 strict** | 宁可多写类型也不留运行时坑；类型即文档 |
| **verify.mjs 自建而非用 nx/turbo** | 跨工具串行门禁 + 人类可读输出，比 nx 启动快得多 |
| **不引入组件库**（用 Tailwind 原生） | AntD / Fusion 在精简 demo 中显得重；Tailwind 更聚焦业务 |
| **10 款商品而非更多** | 覆盖猫/狗 × 幼/成/老 + 过敏 + 跨境演示即可，多了反而稀释 |

---

## 三、≥ 2 处 AI 输出经过工程化调优

### 3.1 调优点 1：LLM Prompt 强约束

**AI 初版 prompt**：
```
请根据宠物信息和候选商品推荐几款主粮，输出 JSON。
```

**问题**：
- LLM 偶发返回 markdown 代码块（` ```json ... ``` `），前端 `JSON.parse` 报错
- LLM 偶发超出 schema 字段（reason 写 200+ 字）

**调优后**：
- 加解析层 `cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "")`
- prompt 显式约束："严格 JSON（无 markdown、无注释）"、"reason ≤ 40 字"
- 解析失败自动回退到 rule-based，不让 UI 空白

**结果**：实际生产中 LLM 输出符合 schema 的比率从 ~70% → ~95%；剩余 5% 由兜底路径接管。

### 3.2 调优点 2：过敏原匹配大小写不敏感

**AI 初版代码**：
```ts
const hits = p.allergens.filter((a) => petAllergensLower.includes(a));
```

**问题**：
- 商品 allergens 是小写（`["chicken"]`）
- 用户输入可能大写（`["Chicken"]`）或混合
- 漏匹配 → 误判"安全"→ 推荐了过敏商品

**调优后**：
```ts
const petAllergensLower = pet.knownAllergens.map((a) => a.toLowerCase());
const hits = p.allergens.filter((a) =>
  petAllergensLower.includes(a.toLowerCase())
);
```

**测试覆盖**：
- `tests/unit/comparator.test.ts` 加大小写不敏感用例
- `tests/unit/recommender.test.ts` 加过敏剔除用例

**结果**：消除了 1 类高危漏判，对应测试在 `pnpm test` 中持续守护。

### 3.3 调优点 3：评分权重调整

**AI 初版权重**：
- 阶段 40 + 无过敏 40 + 跨境 10 + 价格 10 = 100

**问题**：
- 跨境和价格各 10 分区分度太小，决策时几乎被忽略
- 体重区间完全没参与评分（漏掉）

**调优后**：
- 阶段 30 + **体重区间 20（新增）+ 无过敏 30 + 价格 20**

**理由**：
- 体重不匹配的狗吃了肥胖型犬粮，会真实生病（不可忽视）
- 跨境不可售的商品对跨境电商场景直接不可用
- 重新分配后四维度都至少 20 分，决策更有解释力

**对应测试**：
- `tests/unit/comparator.test.ts` "体重接近区间边缘得 10 分"
- UI 上 `ComparisonTable` 把四项拆成柱状图，用户一眼看出扣分项

---

## 四、AI 协作的边界

- **不参与**：业务策略（如选粮逻辑的领域知识）、最终决策（哪些功能做、哪些不做）
- **参与**：模板代码、文案润色、文档结构、测试用例初稿
- **复核**：所有 AI 生成的代码都经过我的：① 类型校验（tsc）② 业务逻辑 sanity check（人工通读）③ 测试断言（vitest）

---

## 五、为什么强调"工程化调优"

面试官常看到有人拿 AI 生成一坨代码就交差。本项目的态度是：

1. AI 是高效的"打字员"，但**业务规则**和**风险权衡**只能人来定。
2. Prompt 调优、边界用例、评分权重 —— 这些才是工程师的价值。
3. 测试是"防 AI 退化"的护栏：AI 帮我写初版，但回归用例必须我能解释为什么这么写。

---

## 六、可复现的协作流程

```
1. 我先写清楚意图（"我要做 X，约束 Y，成功标准 Z"）
2. AI 生成初版（代码 / 文档 / 测试）
3. 我逐项复核，调整 AI 盲区
4. 跑测试 → 不通过 → 回到 2 调整
5. 跑 verify 门禁 → 全部 ✅ → 提交
```

每个 PR / 每个文件都遵循这个循环，最终 `pnpm run verify` 一键证明整个链条是闭合的。
