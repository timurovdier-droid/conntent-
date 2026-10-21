import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@libsql/client", "mammoth", "unpdf"],
  outputFileTracingIncludes: {
    "/*": ["./db/migrations/**/*"],
    "/api/**": ["./db/migrations/**/*"],
  },
};

export default nextConfig;
