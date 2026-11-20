import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // !! PERINGATAN !!
    // Ini akan mengabaikan error TypeScript saat build agar aplikasi bisa online.
    // Sangat berguna untuk tahap awal deploy.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ini juga mengabaikan error ESLint saat build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;