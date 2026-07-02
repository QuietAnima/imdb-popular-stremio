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
  version: "1.0.8",
  name: "IMDb Popular",
  description: "IMDb Most Popular Movies and TV Shows, updated daily",
  logo: "http://100.72.178.10:7001/logo.png",
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

const LOGO_URL = "https://i.postimg.cc/MpFNn28w/image.png";
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
  res.set("Cache-Control", "public, max-age=86400");
  res.send(logoBuf);
});

app.get("/manifest.json", (_, res) => { hits.manifest++; res.json(MANIFEST); });

app.get("/catalog/:type/:id.json", (req, res) => {
  const { type, id } = req.params;
  if (type === "movie" && id === "imdb-popular-movies") { hits.movies++; return res.json({ metas: catalogs.movies }); }
  if (type === "series" && id === "imdb-popular-series") { hits.shows++; return res.json({ metas: catalogs.shows }); }
  hits.other++;
  res.json({ metas: [] });
});

app.get("/catalog/:type/:id/:extra.json", (req, res) => {
  const { type, id } = req.params;
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
  app.listen(PORT, "0.0.0.0", () => console.log(`IMDb Popular addon v1.0.8 on :${PORT}`));
});
