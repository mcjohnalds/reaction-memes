import * as http from "node:http";
import { Readable } from "node:stream";
import * as fs from "node:fs";
import * as path from "node:path";

const contentTypes = new Map([
  [".ico", "image/x-icon"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".css", "text/css"],
  [".mjs", "text/javascript"],
  [".webmanifest", "application/manifest+json"],
]);

class NotFoundError extends Error {}

export function createServer() {
  return http.createServer(handleRequest);
}

async function handleRequest(req, res) {
  const { status, headers, body } = await getResponse(req);
  res.writeHead(status, headers);
  if (body) {
    body.pipe(res);
  } else {
    res.end();
  }
}

async function getResponse(req) {
  try {
    if (req.method !== "GET") {
      throw new NotFoundError();
    }
    const url = new URL(`https://example.com${req.url}`);
    if (url.pathname === "/") {
      return getIndexPageResponse();
    } else if (url.pathname === "/search") {
      return getSearchPageResponse(url);
    }
    return await getStaticFileResponse(url);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { status: 404 };
    } else {
      console.error(error);
      return { status: 500 };
    }
  }
}

async function getStaticFileResponse(url) {
  const file = path.join("static", url.pathname);
  const ext = path.extname(file);
  const contentType = contentTypes.get(ext);
  if (!contentType) {
    throw new NotFoundError();
  }
  const allowed = await fs.promises
    .access(file)
    .then(() => true)
    .catch(() => false);
  if (!allowed) {
    throw new NotFoundError();
  }
  const stream = fs.createReadStream(file);
  return {
    status: 200,
    headers: { "Content-Type": contentType },
    body: stream,
  };
}

function getIndexPageResponse() {
  return {
    status: 200,
    headers: { "Content-Type": "text/html" },
    body: Readable.from([renderIndex()]),
  };
}

function getSearchPageResponse(url) {
  return {
    status: 200,
    headers: { "Content-Type": "text/html" },
    body: Readable.from([url.searchParams.get("query")]),
  };
}

function renderIndex() {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="/style.css" type="text/css" />
      </head>
      <body>
        <h1>Hello</h1>
        <form>
          <input />
          <button type="submit">Search</button>
        </form>
        <div class="results">
        </div>
        <script src="/script.mjs" type="module"></script>
      </body>
    </html>
  `;
}
