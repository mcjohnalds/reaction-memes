import * as http from "node:http";
import { dotProduct } from "./math.mjs";
import assert from "node:assert";
import { Readable } from "node:stream";
import * as fs from "node:fs";
import * as path from "node:path";
import { encodeText } from "./clip.mjs";
import { getSQL } from "./sql.mjs";

const maxResults = 200;
const contentTypes = new Map([
  [".ico", "image/x-icon"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
  [".css", "text/css"],
  [".mjs", "text/javascript"],
  [".webmanifest", "application/manifest+json"],
]);

export async function createServer(
  dataDirectory = "data",
  consoleLog = console.log,
) {
  const memes = getMemes(dataDirectory);
  const server = http.createServer();
  server.on("request", (request, response) => {
    handleRequest(request, response, dataDirectory, memes, consoleLog);
  });
  return server;
}

async function handleRequest(
  request,
  response,
  dataDirectory,
  memes,
  consoleLog,
) {
  try {
    let status, headers, body, error;
    let start = performance.now();
    request.on("end", () => {
      const end = performance.now();
      logRequest(request, status, end - start, consoleLog);
    });
    ({ status, headers, body, error } = await getReply(
      request,
      dataDirectory,
      memes,
    ));
    if (error) {
      console.error(error);
    }
    response.writeHead(status, headers);
    if (body) {
      body.pipe(response);
    } else {
      response.end();
    }
  } catch (error) {
    console.error(error);
  }
}

async function getReply(request, dataDirectory, memes) {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return get404PageReply();
    }
    const url = new URL(`https://example.com${request.url}`);
    if (url.pathname === "/") {
      return getIndexPageReply(memes);
    } else if (url.pathname === "/search") {
      return await getSearchPageReply(url, memes);
    }
    return await getStaticFileReply(url, dataDirectory);
  } catch (error) {
    return { status: 500, error };
  }
}

async function getStaticFileReply(url, dataDirectory) {
  if (url.pathname.includes("..")) {
    // This is probably redundant but worth it just in case there is a bug in
    // the logic
    return get404PageReply();
  }
  let file;
  let cacheControl;
  if (
    url.pathname.startsWith("/memes/") ||
    url.pathname.startsWith("/thumbnails/")
  ) {
    file = path.join(dataDirectory, url.pathname);
    cacheControl = "public, max-age=86400, immutable";
  } else {
    file = path.join("static", url.pathname);
    if (url.pathname === "/title.svg") {
      // TODO: increase max age once we have hashes
      cacheControl = "public, max-age=86400, immutable";
    } else {
      cacheControl = "no-cache";
    }
  }
  try {
    await fs.promises.access(file);
  } catch (error) {
    return get404PageReply();
  }
  const ext = path.extname(file);
  const contentType = contentTypes.get(ext);
  if (!contentType) {
    return get404PageReply();
  }
  const stream = fs.createReadStream(file);
  return {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    },
    body: stream,
  };
}

function getIndexPageReply(memes) {
  return getResultsPageReply(takeRandom(memes, maxResults), "");
}

async function getSearchPageReply(url, memes) {
  const query = url.searchParams.get("query");
  if (query.length > 100) {
    return {
      status: 400,
    };
  }
  const textVec = await encodeText(query);
  const map = new Map();
  for (const meme of memes) {
    const similarity = dotProduct(textVec, meme.embedding);
    map.set(meme, similarity);
  }
  let results = memes.slice();
  results.sort((a, b) => map.get(b) - map.get(a));
  results = results.slice(0, maxResults);
  return getResultsPageReply(results, query);
}

function getResultsPageReply(memes, query) {
  const data = memes.map(({ id, width, height }) => ({
    id: id.toHex(),
    width,
    height,
  }));
  const html = renderHTMLPage({
    title: "Reaction memes",
    subtitle: "Find the perfect meme",
    content: `
      <x-search>
        <form method="get" action="/search">
          <div>
            <!-- Material UI search icon -->
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/></svg>
            <input
              name="query"
              autofocus
              maxlength="100"
              type="search"
              value="${escapeHTML(query)}"
              required
            />
          </div>
          <button type="submit" tabindex="0">Search</button>
        </form>
      </x-search>
      <x-mosaic></x-mosaic>
      <script>
        window.memes = ${JSON.stringify(data)};
      </script>
    `,
  });
  const body = Readable.from([html]);
  return {
    status: 200,
    headers: { "Content-Type": "text/html" },
    body,
  };
}

function get404PageReply() {
  const html = renderHTMLPage({
    title: "Page not found | Reaction Memes",
    subtitle: "Page not found",
    content: "",
  });
  const body = Readable.from([html]);
  return {
    status: 404,
    headers: { "Content-Type": "text/html" },
    body,
  };
}

function renderHTMLPage({ title, subtitle, content }) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
        <link rel="manifest" href="/site.webmanifest">
        <title>${title}</title>
        <link rel="stylesheet" href="/style.css" type="text/css" />
      </head>
      <body>
        <a href="/" class="title" >
          <img src="/title.svg" />
        </a>
        <div class="subtitle">${subtitle}</div>
        ${content}
        <script src="/script.mjs" type="module"></script>
      </body>
    </html>
  `;
}

function getMemes(dataDirectory) {
  let memes = [];
  const sql = getSQL(dataDirectory);
  const iter = sql.iterate`
    SELECT
      id,
      json(embedding) AS embedding,
      width,
      height
    FROM meme
    WHERE NOT naughty
    AND id NOT IN (SELECT b FROM similar_meme)
  `;
  for (const { id, embedding, width, height } of iter) {
    memes.push({
      id,
      embedding: JSON.parse(embedding),
      width,
      height,
    });
  }
  return memes;
}

function logRequest(request, status, duration, consoleLog) {
  const log = {
    status,
    method: request.method,
    url: request.url,
    ip: request.headers["cf-connecting-ip"],
    country: request.headers["cf-ipcountry"],
    duration: Math.round(duration),
    agent: request.headers["user-agent"],
    referer: request.headers["referer"],
    time: new Date().toISOString(),
  };
  consoleLog(JSON.stringify(log));
}

function takeRandom(xs, count) {
  const taken = new Set();
  while (taken.size < Math.min(count, xs.length)) {
    const i = Math.floor(Math.random() * xs.length);
    taken.add(xs[i]);
  }
  const ys = Array.from(taken);
  assert(isSubarray(ys, xs));
  return ys;
}

export function escapeHTML(s) {
  const lookup = {
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
    "<": "&lt;",
    ">": "&gt;",
  };
  return s.replace(/[&"'<>]/g, (c) => lookup[c]);
}

export function isSubarray(xs, ys) {
  const xCounts = new Map();
  for (const x of xs) {
    let count = 0;
    if (xCounts.has(x)) {
      count = xCounts.get(x);
    }
    xCounts.set(x, count + 1);
  }
  const yCounts = new Map();
  for (const y of ys) {
    let count = 0;
    if (yCounts.has(y)) {
      count = yCounts.get(y);
    }
    yCounts.set(y, count + 1);
  }
  for (const k of xCounts.keys()) {
    if (!yCounts.has(k)) {
      return false;
    }
    if (xCounts.get(k) > yCounts.get(k)) {
      return false;
    }
  }
  return true;
}
