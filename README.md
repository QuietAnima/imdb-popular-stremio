# IMDb Popular - Stremio Addon

<p align="center">
  <img src="logo.png" alt="IMDb Popular" width="128">
</p>

<p align="center">
  A self-hosted <a href="https://www.stremio.com/">Stremio</a> addon that brings <strong>IMDb Most Popular</strong>, <strong>Trending</strong>, and <strong>Top Rated</strong> catalogs for movies and TV series to your Stremio home screen - with genre filtering and search.
</p>

---

## Features

- **Six catalogs** - Popular Movies, Popular Series, Trending Movies, Trending Series, Top Rated Movies, Top Rated Series
- **Genre filtering** on every catalog, with genres dynamically sourced from IMDb data
- **Search** across all catalogs - matches title, plot, cast, and director
- **Trending** catalogs show titles climbing fastest in IMDb popularity, sorted by rank change
- **Top Rated** catalogs filter to titles with a 7.0+ IMDb rating, sorted by rating descending
- **Popular** catalogs preserve IMDb's own popularity rank order
- **Rich metadata** - plot, genres, runtime, cast, director, certificate, year, poster, and IMDb rating
- **Smart runtime display** - films over 1 hour shown as `1h 30min` instead of raw minutes
- **Auto-refresh** - catalog data refreshes every 6 hours via node-cron
- **Lightweight** - single Node.js process with in-memory cache, no database required
- **Self-hosted** - runs as a Docker container on your own server
- **CORS enabled** - works with desktop, web, and mobile Stremio clients

## Install in Stremio

1. Open **Stremio** and go to the **Addons** page (puzzle piece icon)
2. In the search bar at the top, enter the addon URL:
   ```
   http://<your-server-ip>:7001/manifest.json
   ```
3. Click **Install**

Six new catalogs will appear on your Stremio home screen.

> **Stremio Web** users: make sure the addon URL is reachable from your browser.

## Self-Hosting

### Docker (recommended)

```bash
docker build -t imdb-popular-stremio .
docker run -d --name imdb-popular -p 7001:7001 --restart unless-stopped imdb-popular-stremio
```

### Docker Compose

```yaml
services:
  imdb-popular:
    build: .
    container_name: imdb-popular
    ports:
      - "7001:7001"
    restart: unless-stopped
```

```bash
docker compose up -d
```

### Node.js (without Docker)

```bash
npm install --omit=dev
node index.js
```

The addon will be available at `http://localhost:7001/manifest.json`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `7001`  | HTTP port the addon listens on |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /manifest.json` | Stremio addon manifest (dynamic genre lists) |
| `GET /catalog/movie/imdb-popular-movies.json` | Popular movies |
| `GET /catalog/series/imdb-popular-series.json` | Popular series |
| `GET /catalog/movie/imdb-trending-movies.json` | Trending movies |
| `GET /catalog/series/imdb-trending-series.json` | Trending series |
| `GET /catalog/movie/imdb-top-rated-movies.json` | Top rated movies |
| `GET /catalog/series/imdb-top-rated-series.json` | Top rated series |
| `GET /status` | Health check - item counts, trending/top-rated stats, genre lists |

All catalog endpoints accept optional extras via `/:extra.json` - `genre=Action`, `search=query`, `skip=N`.

## Data Source

Catalog data is sourced from [crazyuploader/IMDb-Top-50](https://github.com/crazyuploader/IMDb-Top-50), which scrapes IMDb's most popular titles. The addon fetches fresh data every 6 hours and caches it in memory.

## Tech Stack

- **Runtime:** Node.js 20
- **Server:** Express
- **Scheduling:** node-cron
- **Container:** Docker (node:20-slim)

## License

This project is licensed under the [MIT License](LICENSE).

---
