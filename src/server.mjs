import * as http from "node:http";
import { dotProduct } from "./math.mjs";
import assert from "node:assert";
import { Readable } from "node:stream";
import * as fs from "node:fs";
import * as path from "node:path";
import { encodeText } from "./clip.mjs";

const maxResults = 200;
const contentTypes = new Map([
  [".ico", "image/x-icon"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".css", "text/css"],
  [".mjs", "text/javascript"],
  [".webmanifest", "application/manifest+json"],
]);

export async function createServer(
  dataDirectory = "data",
  consoleLog = console.log,
) {
  const images = await getImages(dataDirectory);
  const server = http.createServer();
  server.on("request", (request, response) => {
    handleRequest(request, response, dataDirectory, images, consoleLog);
  });
  return server;
}

async function handleRequest(
  request,
  response,
  dataDirectory,
  images,
  consoleLog,
) {
  try {
    let start = performance.now();
    const { status, headers, body, error } = await getReply(
      request,
      dataDirectory,
      images,
    );
    request.on("end", () => {
      const end = performance.now();
      logRequest(request, status, end - start, consoleLog);
    });
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

async function getReply(request, dataDirectory, images) {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return { status: 404 };
    }
    const url = new URL(`https://example.com${request.url}`);
    if (url.pathname === "/") {
      return getIndexPageReply(images);
    } else if (url.pathname === "/search") {
      return await getSearchPageReply(url, images);
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
    return { status: 404 };
  }
  let file;
  let cacheControl;
  if (
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/thumbnails/")
  ) {
    file = path.join(dataDirectory, url.pathname);
    cacheControl = "public, max-age=31536000, immutable";
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
    return { status: 404 };
  }
  const ext = path.extname(file);
  const contentType = contentTypes.get(ext);
  if (!contentType) {
    return { status: 404 };
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

function getIndexPageReply(images) {
  const results = images.slice(0, maxResults);
  return getResultsPageReply(results, "");
}

async function getSearchPageReply(url, images) {
  const query = url.searchParams.get("query");
  if (query.length > 100) {
    return {
      status: 400,
    };
  }
  const textVec = await encodeText(query);
  const map = new Map();
  for (const image of images) {
    const similarity = dotProduct(textVec, image.vector);
    map.set(image, similarity);
  }
  let results = images.slice();
  results.sort((a, b) => map.get(b) - map.get(a));
  results = results.slice(0, maxResults);
  return getResultsPageReply(results, query);
}

function getResultsPageReply(images, query) {
  const data = images.map(({ file, width, height }) => ({
    file,
    width,
    height,
  }));
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Reaction Memes</title>
        <link rel="stylesheet" href="/style.css" type="text/css" />
      </head>
      <body>
        <a href="/" class="title" >
          <img src="/title.svg" />
        </a>
        <div class="subtitle">Find the perfect meme</div>
        <x-search-form>
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
        </x-search-form>
        <x-mosaic></x-mosaic>
        <script>
          window.images = ${JSON.stringify(data)};
        </script>
        <script src="/script.mjs" type="module"></script>
      </body>
    </html>
  `;
  const body = Readable.from([html]);
  return {
    status: 200,
    headers: { "Content-Type": "text/html" },
    body,
  };
}

async function getImages(dataDirectory) {
  const encodingsFile = await fs.promises.readFile(
    `${dataDirectory}/encodings.json`,
    { encoding: "utf8" },
  );
  const encodings = JSON.parse(encodingsFile);
  const similarFile = await fs.promises.readFile(
    `${dataDirectory}/similar.json`,
    { encoding: "utf8" },
  );
  const groups = JSON.parse(similarFile);
  const tooSimilar = new Set();
  for (const group of groups) {
    for (const image of group.slice(1)) {
      tooSimilar.add(image);
    }
  }
  const ignoreFile = await fs.promises.readFile(
    `${dataDirectory}/ignore.json`,
    { encoding: "utf8" },
  );
  const ignore = JSON.parse(ignoreFile);
  const filtered = encodings.filter(
    (encoding) =>
      !tooSimilar.has(encoding.file) && !ignore.includes(encoding.file),
  );
  assert(encodings.length > filtered.length);
  const sizesFile = await fs.promises.readFile(`${dataDirectory}/sizes.json`, {
    encoding: "utf8",
  });
  const sizes = JSON.parse(sizesFile);
  const sizesMap = new Map();
  for (const { image, width, height } of sizes) {
    sizesMap.set(image, { width, height });
  }
  const images = [];
  for (const encoding of filtered) {
    const size = sizesMap.get(encoding.file);
    assert(size);
    const { width, height } = size;
    images.push({ ...encoding, width, height });
  }
  return images;
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
