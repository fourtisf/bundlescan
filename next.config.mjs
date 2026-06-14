/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The worker shares chain/detection libs; keep server externals lean.
  experimental: {
    serverComponentsExternalPackages: ["@solana/web3.js", "ioredis", "@prisma/client"],
  },
};

export default nextConfig;
