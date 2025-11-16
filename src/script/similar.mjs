/*
 * Read data/encodings.json. Find groups of images which are too similar. Save
 * groups to data/similar.json. Run web server to view groups.
 */

import fs from "node:fs";
import http from "node:http";

const threshold = 0.97;

async function main() {
  const groups = await getGroups();
  await fs.promises.writeFile(
    "data/similar.json",
    JSON.stringify(groups, null, 2),
  );
  console.log("Saved to data/similar.json");
  const server = http.createServer((request, response) =>
    handleRequest(request, response, groups),
  );
  server.listen(8080);
  server.on("listening", () =>
    console.log("Listening on http://localhost:8080"),
  );
}

async function getGroups() {
  const encodings = await readEncodingsFile();
  const groups = [];
  const taken = new Map();
  for (let i = 0; i < encodings.length - 1; i++) {
    if (taken.has(i)) {
      continue;
    }
    const a = encodings[i];
    const group = [];
    group.push(a.file);
    for (let j = i + 1; j < encodings.length; j++) {
      const b = encodings[j];
      const similarity = dotProduct(a.vector, b.vector);
      if (similarity > threshold) {
        taken.set(j, true);
        group.push(b.file);
      }
    }
    if (group.length > 1) {
      taken.set(i, true);
      groups.push(group);
    }
  }
  return groups;
}

async function handleRequest(request, response, groups) {
  if (request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.write(renderPage(groups));
    response.end();
    return;
  }
  if (request.url.endsWith(".webp")) {
    let exists;
    const path = `data/images${request.url}`;
    try {
      await fs.promises.access(path);
      exists = true;
    } catch (error) {
      response.writeHead(404);
      response.end();
    }
    response.writeHead(200, { "Content-Type": "image/webp" });
    const file = fs.createReadStream(path);
    file.pipe(response);
    return;
  }
  response.writeHead(404);
  response.end();
}

function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

async function readEncodingsFile() {
  const encodingsFile = await fs.promises.readFile("data/encodings.json", {
    encoding: "utf8",
  });
  return JSON.parse(encodingsFile);
}

function renderPage(groups) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>${renderCSS()}</style>
        <title>Reaction Memes Similar</title>
      </head>
      <body>
        <h1>Reaction Memes Similar</h1>
        <h2>Total ${groups.length}</h2>
        <div class="groups">
          ${groups.map(renderGroup).join("\n")}
        </div>
      </body>
    </html>
  `;
}

function renderCSS() {
  return `
    * {
      padding: 0;
      margin: 0;
    }

    html {
      margin: 16px;
      width: 100%;
      font-family: sans-serif;
    }

    body {
      width: 100%;
      display: flex;
      gap: 32px;
      flex-wrap: wrap;
      flex-direction: column;
    }

    .groups {
      width: 100%;
      display: flex;
      gap: 32px;
      flex-wrap: wrap;
    }

    .group {
      width: 300px;
      display: flex;
      gap: 8px;
    }

    img {
      flex: 1;
      width: 0;
      object-fit: contain;
    }
  `;
}

function renderGroup(group) {
  return `
    <div class="group">
      ${group.map((image) => `<img src="${image}" />`).join("\n")}
    </div>
  `;
}

main();
