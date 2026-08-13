import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-3">
          为宠物挑选合适的跨境主粮
        </h1>
        <p className="text-slate-600 leading-relaxed">
          本项目作为宠物粮食跨境电商面试作业的第二部分。
          基于内置商品库与可选大模型，提供 ① 个性化选粮推荐、② 配料表对比 两个核心能力。
        </p>
        <p className="text-xs text-slate-400 mt-3">
          默认 DEMO_MODE=1，无需 API Key 即可完整体验。
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/recommend"
          className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:border-brand-500 transition"
          data-testid="card-recommend"
        >
          <div className="text-brand-600 font-semibold mb-2">① 个性化推荐</div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            输入宠物画像 → 推荐 3-5 款主粮
          </h2>
          <p className="text-sm text-slate-500">
            覆盖物种 / 阶段 / 过敏 / 预算 / 跨境目的地。
          </p>
        </Link>
        <Link
          href="/compare"
          className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:border-brand-500 transition"
          data-testid="card-compare"
        >
          <div className="text-brand-600 font-semibold mb-2">② 配料对比</div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            2-3 款商品 → 营养 / 添加剂 / 过敏 / 适配度
          </h2>
          <p className="text-sm text-slate-500">
            纯结构化计算 + LLM 裁决（≤120 字）。
          </p>
        </Link>
      </section>

      <section className="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-sm text-slate-600 space-y-2">
        <p>
          <strong>Part 1 案例文档</strong>（AI 制表平台 · 五层架构）：
          <code className="ml-2 text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200">
            docs/case-study.md
          </code>
        </p>
        <p>
          <strong>Part 3 AI 协作记录</strong>：
          <code className="ml-2 text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200">
            docs/ai-collaboration.md
          </code>
        </p>
      </section>
    </div>
  );
}
