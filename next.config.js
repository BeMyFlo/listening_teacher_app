/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Chất lượng ảnh landing dùng (Next 16 bắt buộc khai báo).
  images: { qualities: [75, 85, 88] },
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
};

module.exports = nextConfig;
