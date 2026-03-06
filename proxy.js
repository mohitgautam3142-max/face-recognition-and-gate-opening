/**
 * TruView Camera Proxy Server
 * ─────────────────────────────────────────────────────
 * Run this on your PC (same network as the camera).
 * It fetches the camera feed and serves it locally
 * with CORS headers so your GitHub Pages app can access it.
 *
 * SETUP:
 *   1. Install Node.js from https://nodejs.org
 *   2. Open terminal in this folder
 *   3. Run:  node proxy.js
 *   4. Proxy runs at http://localhost:3000
 * ─────────────────────────────────────────────────────
 */

const http  = require("http");
const https = require("https");

const CAMERA_IP   = "192.168.43.100";
const CAMERA_PORT = 80;
const PROXY_PORT  = 3000;

// Common TruView stream paths to try (we auto-detect which works)
const STREAM_PATHS = [
  "/videostream.cgi",
  "/mjpeg/1",
  "/cgi-bin/mjpeg",
  "/video.mjpeg",
  "/stream",
  "/live",
];

const SNAPSHOT_PATH = "/snapshot.cgi";

// ── CORS headers (allow GitHub Pages) ────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── Helper: fetch from camera ─────────────────────────
function fetchFromCamera(path, res, onSuccess) {
  const options = {
    hostname: CAMERA_IP,
    port:     CAMERA_PORT,
    path:     path,
    method:   "GET",
    timeout:  4000,
    headers:  { Connection: "keep-alive" },
  };

  const req = http.request(options, (camRes) => {
    const status = camRes.statusCode;
    if (status === 401) {
      res.writeHead(401, { ...CORS, "Content-Type": "text/plain" });
      res.end("Camera requires authentication. Add credentials to CAMERA_USER/CAMERA_PASS in proxy.js");
      return;
    }
    if (status !== 200) {
      onSuccess(false, status);
      return;
    }
    onSuccess(true, camRes);
  });

  req.on("error",   () => onSuccess(false, 0));
  req.on("timeout", () => { req.destroy(); onSuccess(false, 0); });
  req.end();
}

// ── Main server ───────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = req.url;

  // Pre-flight
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // ── /snapshot  → single JPEG frame ───────────────────
  if (url === "/snapshot" || url === "/snapshot.cgi") {
    fetchFromCamera(SNAPSHOT_PATH, res, (ok, camRes) => {
      if (!ok) {
        res.writeHead(503, { ...CORS, "Content-Type": "text/plain" });
        res.end("Camera snapshot failed");
        return;
      }
      res.writeHead(200, {
        ...CORS,
        "Content-Type":  "image/jpeg",
        "Cache-Control": "no-cache",
      });
      camRes.pipe(res);
    });
    return;
  }

  // ── /stream  → MJPEG stream (auto-detects working path) ─
  if (url === "/stream") {
    let tried = 0;

    function tryNext() {
      if (tried >= STREAM_PATHS.length) {
        // Fall back to snapshot polling
        res.writeHead(404, { ...CORS, "Content-Type": "text/plain" });
        res.end("No MJPEG stream found. Use /snapshot instead.");
        return;
      }
      const path = STREAM_PATHS[tried++];
      fetchFromCamera(path, res, (ok, camRes) => {
        if (!ok) { tryNext(); return; }

        const ct = camRes.headers["content-type"] || "";
        console.log(`✓ Stream found at ${path} (${ct})`);

        res.writeHead(200, {
          ...CORS,
          "Content-Type":  ct || "multipart/x-mixed-replace",
          "Cache-Control": "no-cache",
          "Connection":    "keep-alive",
        });
        camRes.pipe(res);
        req.on("close", () => camRes.destroy());
      });
    }
    tryNext();
    return;
  }

  // ── /health  → status check ───────────────────────────
  if (url === "/health") {
    res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
    res.end(JSON.stringify({
      proxy: "running",
      camera: CAMERA_IP,
      port: PROXY_PORT,
      endpoints: {
        stream:   `http://localhost:${PROXY_PORT}/stream`,
        snapshot: `http://localhost:${PROXY_PORT}/snapshot`,
        health:   `http://localhost:${PROXY_PORT}/health`,
      }
    }));
    return;
  }

  // ── Root: helpful info page ───────────────────────────
  if (url === "/" || url === "") {
    res.writeHead(200, { ...CORS, "Content-Type": "text/html" });
    res.end(`
      <html><body style="font-family:monospace;background:#0f172a;color:#00ffe7;padding:30px">
      <h2>🎥 TruView Camera Proxy — Running</h2>
      <p>Camera IP: <b>${CAMERA_IP}:${CAMERA_PORT}</b></p>
      <h3>Endpoints:</h3>
      <ul>
        <li><a href="/stream" style="color:#39ff14">/stream</a> — MJPEG live stream</li>
        <li><a href="/snapshot" style="color:#39ff14">/snapshot</a> — Single JPEG frame</li>
        <li><a href="/health" style="color:#39ff14">/health</a> — Status JSON</li>
      </ul>
      <p style="color:#ffe600">Copy this into your GitHub Pages app: <b>http://localhost:${PROXY_PORT}</b></p>
      </body></html>
    `);
    return;
  }

  res.writeHead(404, CORS);
  res.end("Not found");
});

server.listen(PROXY_PORT, () => {
  console.log("─────────────────────────────────────────");
  console.log(`  TruView Camera Proxy  — RUNNING`);
  console.log(`  Camera  : http://${CAMERA_IP}:${CAMERA_PORT}`);
  console.log(`  Proxy   : http://localhost:${PROXY_PORT}`);
  console.log("─────────────────────────────────────────");
  console.log(`  Stream  : http://localhost:${PROXY_PORT}/stream`);
  console.log(`  Snapshot: http://localhost:${PROXY_PORT}/snapshot`);
  console.log(`  Health  : http://localhost:${PROXY_PORT}/health`);
  console.log("─────────────────────────────────────────");
  console.log("  Open your GitHub Pages app and set");
  console.log(`  proxy URL to: http://localhost:${PROXY_PORT}`);
  console.log("─────────────────────────────────────────");
});
