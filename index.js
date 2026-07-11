const express = require("express");
const cron = require("node-cron");
const app = express();
const PORT = process.env.PORT || 7001;

const SOURCES = {
  movies: "https://raw.githubusercontent.com/crazyuploader/IMDb-Top-50/main/data/popular/movies.json",
  shows: "https://raw.githubusercontent.com/crazyuploader/IMDb-Top-50/main/data/popular/shows.json",
};

const MANIFEST = {
  id: "community.imdb-popular",
  version: "1.0.9",
  name: "IMDb Popular",
  description: "IMDb Most Popular Movies and TV Shows, updated daily",
  logo: "",
  resources: ["catalog"],
  types: ["movie", "series"],
  catalogs: [
    { type: "movie", id: "imdb-popular-movies", name: "IMDb Popular Movies" },
    { type: "series", id: "imdb-popular-series", name: "IMDb Popular Series" },
  ],
  behaviorHints: { configurable: false },
  idPrefixes: ["tt"],
};

const catalogs = { movies: [], shows: [] };

async function fetchJSON(url) {
  const { default: fetch } = await import("node-fetch").catch(() => ({ default: globalThis.fetch }));
  const fn = fetch || globalThis.fetch;
  let res = await fn(url, { redirect: "follow" });
  if ([301, 302, 307, 308].includes(res.status)) {
    const loc = res.headers.get("location");
    if (loc) res = await fn(loc, { redirect: "follow" });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function decodeEntities(str) {
  if (!str || typeof str !== "string") return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractImdbId(item) {
  if (item.imdb_id) return item.imdb_id;
  if (item.id && String(item.id).startsWith("tt")) return item.id;
  const link = item.url || item.link || "";
  const m = link.match(/tt\d{7,}/);
  return m ? m[0] : null;
}

function toStremioMeta(item, type) {
  const id = extractImdbId(item);
  if (!id) return null;
  const meta = { id, type, name: decodeEntities(item.title || item.name || "Unknown") };
  if (item.poster || item.image) meta.poster = item.poster || item.image;
  if (item.rating) meta.imdbRating = String(item.rating);
  if (item.plot) meta.description = decodeEntities(item.plot);
  if (item.genres) {
    const g = typeof item.genres === "string" ? item.genres.split(/,\s*/) : item.genres;
    if (Array.isArray(g) && g.length) meta.genres = g;
  }
  if (item.runtime) {
    const mins = Number(item.runtime);
    meta.runtime = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : `${mins} min`;
  }
  if (item.year) meta.year = String(item.year);
  if (item.certificate) meta.certification = item.certificate;
  if (item.directors) meta.director = Array.isArray(item.directors) ? item.directors : [item.directors];
  if (item.stars) meta.cast = typeof item.stars === "string" ? item.stars.split(/,\s*/) : item.stars;
  return meta;
}

async function refreshCatalog(key, url, type) {
  try {
    const data = await fetchJSON(url);
    const items = Array.isArray(data) ? data : data.items || data.results || [];
    const metas = items.map((i) => toStremioMeta(i, type)).filter(Boolean);
    if (metas.length > 0) {
      catalogs[key] = metas;
      console.log(`[${key}] Loaded ${metas.length} items`);
    }
  } catch (e) {
    console.error(`[${key}] Refresh failed:`, e.message);
  }
}

async function refreshAll() {
  await Promise.all([
    refreshCatalog("movies", SOURCES.movies, "movie"),
    refreshCatalog("shows", SOURCES.shows, "series"),
  ]);
}

const hits = { manifest: 0, movies: 0, shows: 0, other: 0 };

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.log(`[REQ] ${req.method} ${req.url} from ${ip}`);
  next();
});

const LOGO_URL = "https://raw.githubusercontent.com/QuietAnima/imdb-popular-stremio/main/logo.png";
const fs = require("fs"), path = require("path");
const LOGO_PATH = path.join(__dirname, "logo.png");
let logoBuf = null;

async function ensureLogo() {
  if (logoBuf) return;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      logoBuf = fs.readFileSync(LOGO_PATH);
      console.log(`[logo] Loaded from cache: ${logoBuf.length} bytes`);
      return;
    }
    const { default: fetch } = await import("node-fetch").catch(() => ({ default: globalThis.fetch }));
    const fn = fetch || globalThis.fetch;
    const res = await fn(LOGO_URL);
    if (res.ok) {
      logoBuf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(LOGO_PATH, logoBuf);
      console.log(`[logo] Downloaded and cached: ${logoBuf.length} bytes`);
    }
  } catch (e) {
    console.error("[logo] Failed:", e.message);
  }
}

app.get("/logo.png", async (_, res) => {
  await ensureLogo();
  if (!logoBuf) return res.status(404).end();
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
  res.send(logoBuf);
});

app.get("/", (req, res) => {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers.host;
  const base = `${proto}://${host}`;
  res.set("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=3600");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IMDb Popular - Stremio Addon</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #0a0a0a; color: #e0e0e0; min-height: 100vh;
           display: flex; align-items: center; justify-content: center; }
    .card { background: #1a1a2e; border-radius: 16px; padding: 2.5rem;
            max-width: 480px; width: 90%; text-align: center;
            box-shadow: 0 8px 32px rgba(0,0,0,.4); }
    h1 { font-size: 1.6rem; margin-bottom: .5rem; }
    .version { color: #888; font-size: .85rem; margin-bottom: 1.2rem; }
    p { color: #aaa; line-height: 1.5; margin-bottom: 1.5rem; }
    .btn { display: inline-block; background: #7b2ddb; color: #fff;
           padding: .75rem 2rem; border-radius: 8px; text-decoration: none;
           font-weight: 600; transition: background .2s; }
    .btn:hover { background: #6222b8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>IMDb Popular</h1>
    <p class="version">v${MANIFEST.version}</p>
    <p>Browse IMDb's most popular movies and TV shows, updated daily.</p>
    <a class="btn" href="stremio://${host}/manifest.json">Install in Stremio</a>
  </div>
</body>
</html>`);
});

app.get("/manifest.json", (req, res) => {
  hits.manifest++;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers.host;
  res.set("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=3600");
  res.json({ ...MANIFEST, logo: `${proto}://${host}/logo.png` });
});

app.get("/catalog/:type/:id.json", (req, res) => {
  const { type, id } = req.params;
  res.set("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=3600");
  if (type === "movie" && id === "imdb-popular-movies") { hits.movies++; return res.json({ metas: catalogs.movies }); }
  if (type === "series" && id === "imdb-popular-series") { hits.shows++; return res.json({ metas: catalogs.shows }); }
  hits.other++;
  res.json({ metas: [] });
});

app.get("/catalog/:type/:id/:extra.json", (req, res) => {
  const { type, id } = req.params;
  res.set("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=3600");
  if (type === "movie" && id === "imdb-popular-movies") return res.json({ metas: catalogs.movies });
  if (type === "series" && id === "imdb-popular-series") return res.json({ metas: catalogs.shows });
  res.json({ metas: [] });
});

app.get("/status", (_, res) =>
  res.json({
    status: "ok",
    version: MANIFEST.version,
    hits,
    movies: { count: catalogs.movies.length, lastUpdated: new Date().toISOString() },
    shows: { count: catalogs.shows.length, lastUpdated: new Date().toISOString() },
  })
);

Promise.all([refreshAll(), ensureLogo()]).then(() => {
  cron.schedule("0 */6 * * *", refreshAll);
  app.listen(PORT, "0.0.0.0", () => console.log(`IMDb Popular addon v${MANIFEST.version} on :${PORT}`));
});
