// ============================================================
//  Local development server (replaces `vercel dev`)
//  Serves static files + maps api/ folder to Express routes.
// ============================================================
require("dotenv").config({ path: require("path").join(__dirname, ".env.local") });

const express = require("express");
const path = require("path");
const fs = require("fs");
const formidable = require("formidable").formidable;

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Static files ---
app.use(express.static(__dirname));

// --- Helpers to load API handlers ---
function loadHandler(filePath) {
  try {
    return require(filePath);
  } catch (e) {
    console.error("Failed to load handler:", filePath, e.message);
    return null;
  }
}

function wrapFormidable(handler) {
  return (req, res) => {
    const form = formidable({ multiples: true, keepExtensions: true });
    form.parse(req, (err, fields, files) => {
      if (err) {
        return res.status(400).json({ ok: false, error: err.message });
      }
      // Merge fields into req.body (keep existing JSON body if any)
      req.body = { ...(req.body || {}), ...fields };
      req.files = files;
      // Vercel compat: merge route params into req.query
      Object.assign(req.query, req.params);
      handler(req, res);
    });
  };
}

// --- Register API routes ---
function registerRoutes(basePath, dirPath) {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      registerRoutes(path.posix.join(basePath, entry.name), fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      const handler = loadHandler(fullPath);
      if (!handler) continue;

      let routePath = basePath;

      // Handle [id] dynamic segments
      const match = entry.name.match(/^\[(.+)\]\.js$/);
      if (match) {
        routePath = path.posix.join(basePath, ":" + match[1]);
      } else if (entry.name === "index.js") {
        // index.js maps to the directory path itself
      } else {
        routePath = path.posix.join(basePath, entry.name.replace(/\.js$/, ""));
      }

      // Ensure route starts with /
      if (!routePath.startsWith("/")) routePath = "/" + routePath;

      // Check if handler uses formidable (file upload endpoints)
      const usesFormidable =
        routePath.includes("/admin/audio") || routePath.includes("/admin/images");

      // Vercel compat: merge route params into req.query
      // Express 5 req.query is a getter that re-parses URL,
      // so we inject params by modifying req.url directly.
      const compatHandler = (req, res) => {
        if (Object.keys(req.params).length > 0) {
          const qs = new URLSearchParams(req.params).toString();
          req.url = req.url.includes("?") ? req.url + "&" + qs : req.url + "?" + qs;
        }
        handler(req, res);
      };

      const compatFormidable = (req, res) => {
        if (Object.keys(req.params).length > 0) {
          const qs = new URLSearchParams(req.params).toString();
          req.url = req.url.includes("?") ? req.url + "&" + qs : req.url + "?" + qs;
        }
        wrapFormidable(handler)(req, res);
      };

      if (usesFormidable) {
        app.all(routePath, compatFormidable);
      } else {
        app.all(routePath, compatHandler);
      }

      console.log("  Route:", routePath, "<-", fullPath);
    }
  }
}

console.log("Loading API routes...");
registerRoutes("/api", path.join(__dirname, "api"));

// --- Clean URL routes ---
app.get("/teacher", (req, res) => {
  res.sendFile(path.join(__dirname, "teacher.html"));
});
app.get("/student", (req, res) => {
  res.sendFile(path.join(__dirname, "student.html"));
});

// --- SPA fallback: serve index.html for unknown routes ---
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`\nServer running at http://localhost:${PORT}\n`);
  console.log("Teacher login password:", process.env.TEACHER_PASSWORD || "(not set)");
});
