import { dotProduct } from "../src/math.mjs"
import { getSQL } from "../src/sql.mjs"
import http from "node:http";
import fs from "node:fs";
import { setTimeout } from "node:timers/promises";

const port = 8082;
const sql = getSQL("data");
const threshold = 0.97;
const css = `
  body {
    display: flex;
    flex-direction: column;
    background-color: #333;
  }

  .row {
    display: flex;
  }

  img {
    object-fit: cover;
    width: 200px;
    height: 200px;
  }
`;
let pairs = [];

async function getSimilarMemes() {
  let n = 1;
  const as = sql.iterate`SELECT id, json(embedding) AS embedding FROM meme`;
  const { count: memeCount } = sql.get`SELECT COUNT(*) AS count FROM meme`;
  for (const a of as) {
    console.log(`Similarity ${n++}/${memeCount}`);
    const aEmbedding = JSON.parse(a.embedding);
    const bs = sql.iterate`
      SELECT id, json(embedding) AS embedding FROM meme WHERE id > ${a.id}
    `;
    for (const b of bs) {
      const similarity = dotProduct(aEmbedding, JSON.parse(b.embedding));
      if (similarity > threshold) {
        pairs.push([a.id.toHex(), b.id.toHex()]);
      }
    }
    await setTimeout(1);
  }
}

function handleRequest(request, response) {
  if (request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.write(getIndexPage());
    response.end();
  } else if (request.url.match(/^\/.*.webp$/)) {
    response.writeHead(200, { "Content-Type": "image/webp" });
    fs.createReadStream(`data${request.url}`).pipe(response);
  }
}

function getIndexPage() {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>${css}</style>
      </head>
      <body>
        ${pairs.map(
          ([a, b]) => `
          <div class="row">
            <img src="/memes/${a}.webp" />
            <img src="/memes/${b}.webp" />
          </div>
        `,
        ).join("")}
      </body>
    </html>
  `;
}

getSimilarMemes();
const server = http.createServer();
server.on("request", handleRequest);
server.on("listening", () =>
  console.log(`Listening on http://localhost:${port}`),
);
server.listen(port);
