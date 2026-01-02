/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    // Turbopack config - empty for now, works fine with defaults
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize native Node.js modules that can't be bundled
      config.externals = config.externals || [];
      config.externals.push("keytar");
    }
    return config;
  },
};

export default nextConfig;
