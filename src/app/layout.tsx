import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI 选粮助手 · 宠物粮食跨境电商",
  description: "基于宠物画像的个性化选粮 + 配料表对比",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg text-slate-900">
              🐾 AI 选粮助手
            </Link>
            <nav className="text-sm text-slate-600 space-x-6">
              <Link href="/recommend" className="hover:text-brand-600">
                ① 个性化推荐
              </Link>
              <Link href="/compare" className="hover:text-brand-600">
                ② 配料对比
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-6 py-8 text-xs text-slate-400">
          演示项目 · DEMO_MODE 默认开启 · 详见 README
        </footer>
      </body>
    </html>
  );
}
