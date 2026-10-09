// robots.txt + sitemap.xml theo tên miền (dùng bởi app/robots.js, app/sitemap.js).
//
// Chỉ trang giới thiệu ở domain gốc (www.<base>) được lập chỉ mục. Subdomain của từng trung tâm
// (<slug>.<base>) là trang đăng nhập riêng của khách -> chặn toàn bộ. Khu vực sau đăng nhập luôn bị chặn.

const { baseDomain, normalizeHost } = require("./host");

const PRIVATE_PATHS = ["/api/", "/admin/", "/teacher/", "/student/", "/handoff", "/legacy/"];

function siteOrigin(base = baseDomain()) {
  if (!base || base === "localhost") return null;
  return `https://www.${base}`;
}

// Chỉ đúng domain gốc hoặc www. Subdomain, host lạ (*.vercel.app của bản preview), không host: đều chặn.
function isPublicHost(host, base) {
  const h = normalizeHost(host);
  return !!base && (h === base || h === `www.${base}`);
}

function robotsFor(host, base = baseDomain()) {
  const origin = siteOrigin(base);
  if (!origin || !isPublicHost(host, base)) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

function sitemapFor(host, base = baseDomain()) {
  const origin = siteOrigin(base);
  if (!origin || !isPublicHost(host, base)) return [];
  return [{ url: `${origin}/` }];
}

module.exports = { robotsFor, sitemapFor, siteOrigin, PRIVATE_PATHS };
