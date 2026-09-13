/** Static export: the whole site is pre-rendered at build time (ADR-0002:
 * no backend, no runtime data fetching). The bundle is read from disk during
 * `next build`; failure surfaces as a visible error page, never a blank site.
 * @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
};
export default nextConfig;
