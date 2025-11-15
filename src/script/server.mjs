import * as http from "node:http";
import { Readable } from "node:stream";
import * as fs from "node:fs";
import * as path from "node:path";
import * as util from "node:util";
import { encodeText } from "../clip.mjs";

const maxResults = 500;
const contentTypes = new Map([
  [".ico", "image/x-icon"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".css", "text/css"],
  [".mjs", "text/javascript"],
  [".webmanifest", "application/manifest+json"],
]);
const encodings = await readEncodingsFile();

function main() {
  const server = http.createServer(handleRequest);
  server.on("listening", () => writeLog({ type: "listening" }));
  server.listen(8080);
}

async function handleRequest(request, response) {
  try {
    writeLog({ type: "request", request });
    const { status, headers, body, error } = await getReply(request);
    response.writeHead(status, headers);
    if (body) {
      body.pipe(response);
    } else {
      response.end();
    }
    writeLog({ type: "response", request, status, error });
  } catch (error) {
    writeLog({ type: "error", request, error });
  }
}

function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

async function getReply(request) {
  try {
    if (request.method !== "GET") {
      return { status: 404 };
    }
    const url = new URL(`https://example.com${request.url}`);
    if (url.pathname === "/") {
      return getIndexPageReply();
    } else if (url.pathname === "/search") {
      return await getSearchPageReply(url);
    }
    return await getStaticFileReply(url);
  } catch (error) {
    return { status: 500, error };
  }
}

async function getStaticFileReply(url) {
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
    file = path.join("data", url.pathname);
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

function getIndexPageReply() {
  const files = encodings.map((encoding) => encoding.file).slice(0, maxResults);
  return {
    status: 200,
    headers: { "Content-Type": "text/html" },
    body: Readable.from([renderIndex(files)]),
  };
}

async function getSearchPageReply(url) {
  const query = url.searchParams.get("query");
  const textVec = await encodeText(query);
  const results = [];
  for (const encoding of encodings.slice(0, maxResults)) {
    const similarity = dotProduct(textVec, encoding.vector);
    results.push({ file: encoding.file, similarity });
  }
  results.sort((a, b) => b.similarity - a.similarity);
  const files = results.map((result) => result.file);
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
          <div class="subtitle">Search anything to find the perfect meme</div>
          <x-search-input>
            <!-- Material UI search icon -->
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/></svg>
            <input autofocus />
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

async function readEncodingsFile() {
  const encodingsFile = await fs.promises.readFile("data/encodings.json", {
    encoding: "utf8",
  });
  return JSON.parse(encodingsFile);
}

function writeLog({ type, request, error, status }) {
  const str = JSON.stringify({
    version: 1,
    type,
    time: new Date().toISOString(),
    method: request?.method,
    url: request?.url,
    status,
    error:
      error &&
      util.inspect(error, {
        depth: 5,
        showHidden: true,
        maxArrayLength: 1_000,
      }),
    ip: request?.request.headers["cf-connecting-ip"],
    country: request?.headers["cf-ipcountry"],
  });
  process.stdout.write(str + "\n");
}

main();
