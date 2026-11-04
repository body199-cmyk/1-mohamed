/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@ledger/statement-export",
    "@ledger/accounting",
    "@ledger/trip-entry",
    "@ledger/contractor-statements",
  ],
};

export default nextConfig;
