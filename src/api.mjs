import * as http from "node:http";
import { Readable } from "node:stream";
import * as fs from "node:fs";
import * as path from "node:path";
import { encodeText } from "./clip.mjs";

const contentTypes = new Map([
  [".ico", "image/x-icon"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".css", "text/css"],
  [".mjs", "text/javascript"],
  [".webmanifest", "application/manifest+json"],
]);
const encodingsFile = await fs.promises.readFile("data/encodings.json", {
  encoding: "utf8",
});
const encodings = JSON.parse(encodingsFile);

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

function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
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
      return await getSearchPageResponse(url);
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
  if (url.pathname.includes("..")) {
    // This is probably redundant but worth it just in case there is a bug in
    // the logic
    throw new NotFoundError();
  }
  let file;
  if (url.pathname.startsWith("/images/")) {
    file = path.join("data", url.pathname);
  } else {
    file = path.join("static", url.pathname);
  }
  try {
    await fs.promises.access(file);
  } catch (error) {
    throw new NotFoundError();
  }
  const ext = path.extname(file);
  const contentType = contentTypes.get(ext);
  if (!contentType) {
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
  const files = encodings.map((encoding) => encoding.file);
  return {
    status: 200,
    headers: { "Content-Type": "text/html" },
    body: Readable.from([renderIndex()]),
  };
}

async function getSearchPageResponse(url) {
  const query = url.searchParams.get("query");
  const textVec = await encodeText(query);
  const results = [];
  for (const encoding of encodings.slice(0, 25)) {
    const similarity = dotProduct(textVec, encoding.vector);
    results.push({ file: encoding.file, similarity });
  }
  results.sort((a, b) => b.similarity - a.similarity);
  const files = results.map((result) => result.file);
  return {
    status: 200,
    headers: { "Content-Type": "text/html" },
    body: Readable.from([renderSearch(files)]),
  };
}

function renderIndex() {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="/style.css" type="text/css" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Rubik+Doodle+Shadow&display=swap" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Yusei+Magic&display=swap" rel="stylesheet">
        <template id="results"></template>
      </head>
      <body>
        <h1>Auto Reaction Meme</h1>
        <h2>Type literally anything to find the perfect meme</h2>
        <input autofocus />
        <div class="columns"></div>
        <script src="/script.mjs" type="module"></script>
      </body>
    </html>
  `;
}

function renderSearch(files) {
  return files.map((file, i) => `<img src="images/${file}" />`).join("");
}
