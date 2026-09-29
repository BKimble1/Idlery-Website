#!/usr/bin/env node
// Local preview server for idlery.com that behaves like Netlify does for this
// site: it applies site/_headers (so the Content-Security-Policy is enforced
// while you browse), follows site/_redirects (first match wins; a real file
// shadows a rule unless the rule is forced with "!"), serves /dir/ from
// dir/index.html, answers unknown paths with 404.html, and supports byte
// ranges so video seeks work. Node's standard library only -- nothing to
// install -- so it runs the same on Windows, macOS and Linux:
//
//   node scripts/serve.mjs            # http://localhost:8080
//   node scripts/serve.mjs 8090       # another port
//   node scripts/serve.mjs --dir some/other/folder   # e.g. an unzipped package
//
// It is a preview tool, not a production server: host-matched rules (the
// https://karnwold.idlery.com/* kind) cannot fire on localhost and are skipped.

import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const args = process.argv.slice(2);
const dirFlag = args.indexOf("--dir");
const ROOT = resolve(dirFlag >= 0 ? args[dirFlag + 1] : join(here, "..", "site"));
const PORT = Number(args.find((a, i) => /^\d+$/.test(a) && args[i - 1] !== "--dir") || process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
  ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2", ".vtt": "text/vtt",
};

// ------------------------------------------------------------- _headers --

function loadHeaders() {
  const file = join(ROOT, "_headers");
  const rules = [];
  if (!existsSync(file)) return rules;
  let cur = null;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (!/^\s/.test(raw)) {
      cur = { pattern: raw.trim(), headers: [] };
      rules.push(cur);
    } else if (cur) {
      const i = raw.indexOf(":");
      cur.headers.push([raw.slice(0, i).trim(), raw.slice(i + 1).trim()]);
    }
  }
  return rules;
}

const toRegex = (pattern) =>
  new RegExp("^" + pattern.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("(.*)") + "$");

function headersFor(path) {
  const out = {};
  for (const r of loadHeaders()) if (toRegex(r.pattern).test(path)) for (const [k, v] of r.headers) out[k] = v;
  return out;
}

// ----------------------------------------------------------- _redirects --

function loadRedirects() {
  const file = join(ROOT, "_redirects");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [from, to, status = "301"] = l.split(/\s+/);
      return { from, to, status: parseInt(status, 10), force: status.endsWith("!") };
    });
}

function matchRule(rule, path) {
  if (/^https?:\/\//.test(rule.from)) return null;    // host-matched: never on localhost
  const m = toRegex(rule.from).exec(path) || (!rule.from.endsWith("/") && !rule.from.includes("*") && toRegex(rule.from + "/").exec(path));
  if (!m) return null;
  return rule.to.replace(":splat", m[1] ?? "");
}

// ---------------------------------------------------------------- files --

function fileFor(path) {
  let p;
  try { p = decodeURIComponent(path); } catch { return null; }
  const full = normalize(join(ROOT, p));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  if (existsSync(full) && statSync(full).isFile()) return full;
  if (existsSync(full) && statSync(full).isDirectory() && existsSync(join(full, "index.html"))) return join(full, "index.html");
  return null;
}

function send(res, status, file, extra, req) {
  const stat = statSync(file);
  const headers = {
    "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    ...extra,
  };
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range && status === 200) {
    const start = range[1] ? parseInt(range[1], 10) : stat.size - parseInt(range[2], 10);
    const end = range[1] && range[2] ? Math.min(parseInt(range[2], 10), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1 });
    return req.method === "HEAD" ? res.end() : createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(status, { ...headers, "Content-Length": stat.size });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
}

function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;
  const file = fileFor(path);

  // /work -> /work/ when /work/index.html exists (Netlify's pretty URLs).
  if (file && file.endsWith("index.html") && !path.endsWith("/") && !path.endsWith(".html")) {
    res.writeHead(301, { Location: path + "/" + url.search });
    return res.end();
  }

  for (const rule of loadRedirects()) {
    const target = matchRule(rule, path);
    if (target === null) continue;
    if (file && !rule.force) break;                    // a real file shadows an unforced rule
    if (rule.status === 200) {
      const rewritten = fileFor(target);
      if (rewritten) return send(res, 200, rewritten, headersFor(path), req);
      break;
    }
    res.writeHead(rule.status, { Location: target, ...headersFor(path) });
    return res.end();
  }

  if (file) return send(res, 200, file, headersFor(path), req);
  const notFound = join(ROOT, "404.html");
  if (existsSync(notFound)) return send(res, 404, notFound, headersFor(path), req);
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404");
}

export function start(port = PORT, host = HOST) {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      try { handle(req, res); } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    server.listen(port, host, () => ok(server));
  });
}

// Start only when run directly, not when check_site.mjs imports start(). Both
// paths are compared as real paths, and without regard to case on Windows, so
// a symlink, a junction or a lower-case drive letter cannot stop it silently.
function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    const a = realpathSync(resolve(process.argv[1]));
    const b = realpathSync(fileURLToPath(import.meta.url));
    return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  await start();
  console.log(`Serving ${ROOT}`);
  console.log(`Open http://localhost:${PORT}/  (Ctrl+C to stop)`);
}
