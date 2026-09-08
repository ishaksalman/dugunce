import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite bir WASM modülü; bundle'a girmemeli (yalnızca geliştirmede kullanılıyor).
  serverExternalPackages: ["@electric-sql/pglite"],
  images: {
    remotePatterns: [
      // Supabase Storage — gerçek mekan görselleri buradan servis edilir.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      // Demo/seed görselleri. Üretim verisi geldiğinde kaldırılacak.
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  // Güvenlik başlıkları. CSP, gerçek üçüncü taraf listesi netleşince eklenecek.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
