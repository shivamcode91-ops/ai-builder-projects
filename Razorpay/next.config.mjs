// Two builds come out of this one app.
//
//   npm run build         a normal server build (Vercel, `next start`), where
//                         the pipeline runs in app/api/* as it always has.
//   npm run build:static  a static export for GitHub Pages, where there is no
//                         server and the same pipeline runs in the visitor's
//                         tab instead. See lib/localApi.js.
//
// The static build is served from a subpath, so it needs basePath. Nothing else
// differs — same components, same lib, same scenarios.

const isStatic = process.env.NEXT_PUBLIC_STATIC === "1";

const BASE_PATH = process.env.STATIC_BASE_PATH ?? "/ai-builder-projects/agentguard";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isStatic
    ? {
        output: "export",
        basePath: BASE_PATH,
        assetPrefix: BASE_PATH,
        // GitHub Pages serves `/agentguard/` as `/agentguard/index.html`.
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
