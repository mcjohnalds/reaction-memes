import { createServer } from "./server.mjs";
import fs from "node:fs";
import { test, after, before, suite } from "node:test";
import assert from "node:assert/strict";

let server;

before(async () => {
  console.log = () => {};
  server = createServer().listen(8081);
});

after(async () => {
  // Without closeAllConnections, server.close takes ages to resolve
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await fs.promises.rm("static/unsupported.txt", { force: true });
});

suite("/", () => {
  test("GET", async () => {
    const res = await request("");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html");
    const text = await res.text();
    assert(text.includes("<html>"));
  });

  test("HEAD", async () => {
    const res = await request("", { method: "HEAD" });
    assert.equal(res.status, 200);
  });
});

suite("/search", () => {
  test("GET", async () => {
    const res = await request("/search?query=foo%20bar");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "application/json");
    const json = await res.json();
    assert(Array.isArray(json));
    await fs.promises.access(`data/images/${json[0]}`);
  });

  test("HEAD", async () => {
    const res = await request("/search?query=foo%20bar", { method: "HEAD" });
    assert.equal(res.status, 200);
  });
});

suite("/script.mjs", () => {
  test("GET", async () => {
    const res = await request("/script.mjs");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/javascript");
    const text = await res.text();
    assert(text.includes("function"));
  });

  test("HEAD", async () => {
    const res = await request("/script.mjs", { method: "HEAD" });
    assert.equal(res.status, 200);
  });
});

suite("/unsupported.txt", () => {
  test("GET", async () => {
    await fs.promises.writeFile("static/unsupported.txt", "hello");
    const res = await request("/unsupported.txt");
    assert.equal(res.status, 404);
  });

  test("HEAD", async () => {
    const res = await request("/unsupported.mjs", { method: "HEAD" });
    assert.equal(res.status, 404);
  });
});

suite("/../static/script.mjs", () => {
  test("GET", async () => {
    // This test passes because of undocumented behavior built-in to Node.js
    // where it sanitizes req.url
    const res = await request("/../static/script.mjs");
    assert.equal(res.status, 404);
  });

  test("HEAD", async () => {
    const res = await request("/../static/script.mjs", { method: "HEAD" });
    assert.equal(res.status, 404);
  });
});

suite("/does-not-exist.mjs", () => {
  test("GET", async () => {
    const res = await request("/does-not-exist.mjs");
    assert.equal(res.status, 404);
  });

  test("HEAD", async () => {
    const res = await request("/does-not-exist.mjs", { method: "HEAD" });
    assert.equal(res.status, 404);
  });
});

async function request(path, options) {
  return await fetch(`http://localhost:8081${path}`, options);
}
