import * as http from "node:http";
import { dotProduct } from "./math.mjs";
import assert from "node:assert";
import { Readable } from "node:stream";
import * as fs from "node:fs";
import * as path from "node:path";
import { encodeText } from "./clip.mjs";

const maxResults = 500;
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
  const encodings = await getEncodings(dataDirectory);
  const server = http.createServer();
  server.on("request", (request, response) => {
    handleRequest(request, response, dataDirectory, encodings, consoleLog);
  });
  return server;
}

async function handleRequest(
  request,
  response,
  dataDirectory,
  encodings,
  consoleLog,
) {
  try {
    let start = performance.now();
    const { status, headers, body, error } = await getReply(
      request,
      dataDirectory,
      encodings,
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

async function getReply(request, dataDirectory, encodings) {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return { status: 404 };
    }
    const url = new URL(`https://example.com${request.url}`);
    if (url.pathname === "/") {
      return getIndexPageReply(encodings);
    } else if (url.pathname === "/search") {
      return await getSearchPageReply(url, encodings);
    }
    return await getStaticFileReply(url, dataDirectory);
  } catch (error) {
    return { status: 500, error };
  }
}

async function getStaticFileReply(url, dataDirectory) {
  let cacheControl;
  if (url.pathname.includes("..")) {
    // This is probably redundant but worth it just in case there is a bug in
    // the logic
    return { status: 404 };
  }
  let file;
  if (
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/thumbnails")
  ) {
    cacheControl = "public, max-age=31536000, immutable";
    file = path.join(dataDirectory, url.pathname);
  } else {
    file = path.join("static", url.pathname);
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
      ...(cacheControl ? { "Cache-Control": cacheControl } : undefined),
    },
    body: stream,
  };
}

function getIndexPageReply(encodings) {
  const files = encodings.map((encoding) => encoding.file).slice(0, maxResults);
  const body = Readable.from([renderIndex(files)]);
  return {
    status: 200,
    headers: { "Content-Type": "text/html" },
    body,
  };
}

async function getSearchPageReply(url, encodings) {
  const query = url.searchParams.get("query");
  if (query.length > 100) {
    return {
      status: 400,
    };
  }
  const textVec = await encodeText(query);
  const results = [];
  for (const encoding of encodings) {
    const similarity = dotProduct(textVec, encoding.vector);
    results.push({ file: encoding.file, similarity });
  }
  results.sort((a, b) => b.similarity - a.similarity);
  const files = results.slice(0, maxResults).map((result) => result.file);
  const json = JSON.stringify(files);
  return {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: Readable.from([json]),
  };
}

function renderIndex(files) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="/style.css" type="text/css" />
      </head>
      <body>
        <x-app>
          <object class="title" data="/title.svg" type="image/svg+xml"></object>
          <div class="subtitle">Type anything to find the perfect meme</div>
          <x-search-input>
            <!-- Material UI search icon -->
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/></svg>
            <input autofocus maxlength="100" />
          </x-search-input>
          <x-mosaic></x-mosaic>
        </x-app>
        <script>
          window.initialImages = ${JSON.stringify(files)};
        </script>
        <script src="/script.mjs" type="module"></script>
      </body>
    </html>
  `;
}

async function getEncodings(dataDirectory) {
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
  const ignore = new Set();
  for (const group of groups) {
    for (const image of group.slice(1)) {
      ignore.add(image);
    }
  }
  const filtered = encodings.filter((encoding) => !ignore.has(encoding.file));
  assert(encodings.length > filtered.length);
  return filtered;
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
