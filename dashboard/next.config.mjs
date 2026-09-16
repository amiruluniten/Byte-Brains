import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  // Static export (ADR-0002: no backend, no runtime data fetching). The bundle
  // is read from disk during `next build`; failure surfaces as a visible error
  // page, never a blank site.
  output: "export",
};
export default nextConfig;
