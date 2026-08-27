/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // App cũ (vanilla) vẫn truy cập được trong lúc migrate dần
      { source: "/legacy/teacher", destination: "/legacy/teacher.html" },
      { source: "/legacy/student", destination: "/legacy/student.html" },
      { source: "/legacy", destination: "/legacy/index.html" },
    ];
  },
};

module.exports = nextConfig;
