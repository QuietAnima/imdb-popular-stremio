# IMDb Popular - Stremio Addon

<p align="center">
  <img src="logo.png" alt="IMDb Popular" width="128">
</p>

<p align="center">
  A self-hosted <a href="https://www.stremio.com/">Stremio</a> addon that adds <strong>IMDb Most Popular Movies</strong> and <strong>IMDb Most Popular TV Series</strong> catalogs to your Stremio home screen.
</p>

---

## Features

- **Two catalogs** - IMDb Popular Movies and IMDb Popular Series, shown directly on the Stremio home screen
- **Rich metadata** - each title includes poster, IMDb rating, year, vote count, and genres
- **Auto-refresh** - catalog data refreshes every 6 hours so listings stay current
- **Lightweight** - single Node.js process with in-memory cache, no database required
- **Self-hosted** - runs as a Docker container on your own server
- **CORS enabled** - works with both desktop and web versions of Stremio
- **Health endpoint** - built-in `/status` route for monitoring

## Install in Stremio

If someone is already hosting the addon (or you have it running), add it to Stremio:

1. Open **Stremio** and go to the **Addons** page (puzzle piece icon)
2. In the search bar at the top, enter the addon URL:
   ```
   http://<your-server-ip>:7001/manifest.json
   ```
3. Click **Install**

The two new catalogs will appear on your Stremio home screen.

> **Stremio Web** users: make sure the addon URL is reachable from your browser.

## Self-Hosting

### Docker (recommended)

```bash
docker build -t imdb-popular-stremio .
docker run -d --name imdb-popular -p 7001:7001 --restart unless-stopped imdb-popular-stremio
```

### Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  imdb-popular:
    build: .
    container_name: imdb-popular
    ports:
      - "7001:7001"
    restart: unless-stopped
```

Then start it:

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

Example with a custom port:

```bash
docker run -d -e PORT=7001 -p 7001:7001 --restart unless-stopped imdb-popular-stremio
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /manifest.json` | Stremio addon manifest |
| `GET /catalog/movie/imdb-popular-movies.json` | Popular movies catalog |
| `GET /catalog/series/imdb-popular-series.json` | Popular series catalog |
| `GET /status` | Health check - returns cache sizes and last update timestamps |

## Data Source

Catalog data is sourced from [crazyuploader/IMDb-Top-50](https://github.com/crazyuploader/IMDb-Top-50), which scrapes IMDb's most popular titles. The addon fetches fresh data every 6 hours and caches it in memory.

## Tech Stack

- **Runtime:** Node.js 20
- **Server:** Express
- **Scheduling:** node-cron
- **Container:** Docker (node:20-slim)