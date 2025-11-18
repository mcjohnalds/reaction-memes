import fs from "node:fs";
import http from "node:http";
import { dotProduct } from "../math.mjs";
import { encodeText } from "../clip.mjs";

async function main() {
  // These images show up in way too many search results. This solution is
  // excessive but it's good enough for now.
  const v = await encodeText("nigga");
  const encodingsFile = await fs.promises.readFile("data/encodings.json", {
    encoding: "utf8",
  });
  const encodings = JSON.parse(encodingsFile);
  encodings.sort((a, b) => dotProduct(b.vector, v) - dotProduct(a.vector, v));
  const proportion = 0.01;
  const ignore = encodings
    .slice(0, encodings.length * proportion)
    .map((e) => e.file);
  const file = JSON.stringify(ignore, null, 2) + "\n";
  await fs.promises.writeFile("data/ignore.json", file);
  const server = http.createServer();
  server.on("request", (request, response) => {
    handleRequest(request, response, ignore);
  });
  server.on("listening", () => {
    console.log("Listening on http://localhost:8080");
  });
  server.listen(8080);
}

function handleRequest(request, response, ignore) {
  if (request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.write(renderIndex(ignore));
    response.end();
  } else if (request.url.startsWith("/images/")) {
    const path = `data${request.url}`;
    const stream = fs.createReadStream(path);
    response.writeHead(200, { "Content-Type": "image/webp" });
    stream.pipe(response);
  } else {
    response.writeHead(404);
    response.end();
  }
}

function renderIndex(ignore) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Reaction Memes Ignore</title>
        <style>${renderCSS()}</style>
      </head>
      <body>
        <h1>Reaction Memes Ignore</h1>
        <h2>Total: ${ignore.length}</h2>
        <div class="images">
          ${ignore.map(renderImage).join("")}
        </div>
      </body>
    </html>
  `;
}

function renderCSS() {
  return `
    .images {
      display: flex;
      flex-wrap: wrap;
      gap: 32px;
    }

    img {
      width: 100px;
      object-fit: contain;
      flex: 1;
    }
  `;
}

function renderImage(image) {
  return `<img src="/images/${image}" />`;
}

main();
