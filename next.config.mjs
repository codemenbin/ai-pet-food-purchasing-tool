/** @type {import('next').NextConfig} */
// Vercel 部署友好：保留最简零配置。
// - 不强制 output，让 Next.js 默认走 Server Components；
// - 不引入 experimental 开关，避免 Vercel 误判；
// - 不开启 telemetry（Vercel 自动处理）。
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
