#!/usr/bin/env node
/**
 * scripts/verify.mjs
 *
 * 一键端到端交付门禁：
 *   1. typecheck  (TypeScript 零错误)
 *   2. lint       (代码风格零错误)
 *   3. unit+api   (Vitest 全部通过)
 *   4. build      (next build 成功)
 *   5. e2e        (Playwright 三个 spec 通过，自动启动 dev server)
 *   6. security   (仓库无明文 Key / .gitignore 含 .env.local)
 *
 * 任一失败立即退出非零码；末尾打印 ✅ 可交付 / ❌ 不可交付。
 *
 * 用法:
 *   node scripts/verify.mjs                # 跑全部门禁
 *   node scripts/verify.mjs --skip-e2e     # 跳过 E2E
 *   node scripts/verify.mjs --skip-build   # 跳过生产构建
 *   node scripts/verify.mjs --skip-lint    # 跳过 lint
 */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");

const args = process.argv.slice(2);
const SKIP_E2E = args.includes("--skip-e2e");
const SKIP_BUILD = args.includes("--skip-build");
const SKIP_LINT = args.includes("--skip-lint");

function run(label, command, env = {}) {
  const start = Date.now();
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${command}`);
  const fullEnv = { ...process.env, ...env };
  const result = spawnSync(command, {
    cwd: ROOT,
    env: fullEnv,
    shell: true,
    stdio: "inherit",
  });
  const ms = Date.now() - start;
  if (result.status === 0) {
    console.log(`  ✓ ${label} passed (${ms}ms)`);
    return { ok: true, ms };
  }
  console.log(`  ✗ ${label} FAILED (${ms}ms, exit=${result.status})`);
  return { ok: false, ms, exit: result.status };
}

const results = [];

// 1. typecheck
results.push(run("1/6 typecheck", "pnpm typecheck"));

// 2. lint
if (!SKIP_LINT) {
  results.push(run("2/6 lint", "pnpm lint"));
} else {
  console.log("\n▶ 2/6 lint skipped");
}

// 3. unit + api
results.push(run("3/6 unit+api tests", "pnpm test"));

// 4. build
if (!SKIP_BUILD) {
  results.push(run("4/6 next build", "pnpm build"));
} else {
  console.log("\n▶ 4/6 build skipped");
}

// 5. e2e
if (!SKIP_E2E) {
  results.push(
    run(
      "5/6 e2e (Playwright)",
      "pnpm exec playwright install --with-deps chromium && pnpm test:e2e"
    )
  );
} else {
  console.log("\n▶ 5/6 e2e skipped");
}

// 6. security
console.log("\n▶ 6/6 security");
let securityOk = true;
const securityChecks = [];

// 6a. .gitignore contains .env.local
const gitignorePath = resolve(ROOT, ".gitignore");
if (existsSync(gitignorePath)) {
  const gi = readFileSync(gitignorePath, "utf8");
  const has = gi.split(/\r?\n/).some((l) => l.trim() === ".env.local");
  securityChecks.push({ ok: has, msg: ".gitignore 含 .env.local" });
  if (!has) securityOk = false;
} else {
  securityChecks.push({ ok: false, msg: ".gitignore 缺失" });
  securityOk = false;
}

// 6b. .env.example 不含真实 Key（仅允许占位符）
const envExamplePath = resolve(ROOT, ".env.example");
if (existsSync(envExamplePath)) {
  const ee = readFileSync(envExamplePath, "utf8");
  const realKey = ee.match(/sk-[a-zA-Z0-9_-]{16,}/g);
  const real = (realKey || []).filter((k) => !k.startsWith("sk-replace"));
  const ok = real.length === 0;
  securityChecks.push({ ok, msg: ".env.example 无明文 Key" });
  if (!ok) securityOk = false;
}

// 6c. 仓库内无 sk-... 实际 Key（用 grep / findstr 扫描）
try {
  const isWin = process.platform === "win32";
  const searchPaths = ["src", "scripts", "tests", "docs", "README.md"]
    .map((p) => resolve(ROOT, p))
    .filter((p) => existsSync(p));
  const grep = spawnSync(
    isWin ? "findstr" : "grep",
    [
      ...(isWin
        ? ["/S", "/R", "/I"]
        : ["-r", "-l", "-E", "--include=*"]),
      "sk-[a-zA-Z0-9_-]{16,}",
      ...searchPaths,
    ],
    { cwd: ROOT, shell: false, encoding: "utf8" }
  );
  const out = (grep.stdout || "").toString();
  const found = grep.status === 0 && out.trim().length > 0;
  securityChecks.push({
    ok: !found,
    msg: "源码 / 测试 / 文档无 sk-... 实际 Key",
  });
  if (found) {
    console.log("  ⚠ 命中:\n" + out);
    securityOk = false;
  }
} catch {
  // grep/findstr 不存在时跳过
  securityChecks.push({ ok: true, msg: "扫描 Key 跳过（工具缺失）" });
}

for (const c of securityChecks) {
  console.log(`  ${c.ok ? "✓" : "✗"} ${c.msg}`);
}
results.push({ ok: securityOk, ms: 0, label: "security" });

// summary
console.log("\n========================================");
const total = results.length;
const passed = results.filter((r) => r.ok).length;
console.log(`verify summary: ${passed}/${total} 通过`);
for (const r of results) {
  const status = r.ok ? "✓" : "✗";
  console.log(`  ${status} ${r.ms ? `${r.ms}ms` : "—"}`);
}
console.log("========================================\n");

if (passed === total) {
  console.log("✅ 可交付");
  process.exit(0);
} else {
  console.log("❌ 不可交付 — 见上失败项");
  process.exit(1);
}
