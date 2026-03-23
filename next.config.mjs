import { withContentlayer } from "next-contentlayer"

try {
  await import("./env.mjs")
} catch (e) {
  console.warn("⚠️ env.mjs validation failed — skipping:", e.message)
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["avatars.githubusercontent.com"],
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
}

export default withContentlayer(nextConfig)
