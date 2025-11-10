import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";

const contentTypes = new Map([
  [".ico", "image/x-icon"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".html", "text/html"],
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
    let file = path.join("static", req.url);
    if (req.url.endsWith("/")) {
      file = path.join(file, "index.html");
    }
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
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { status: 404 };
    } else {
      console.error(error);
      return { status: 500 };
    }
  }
}
