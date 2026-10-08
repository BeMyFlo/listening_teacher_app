/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    // Trang chuyển phiên: không gửi Referer, không cache, không cho nhúng iframe.
    return [
      {
        source: "/handoff",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
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
