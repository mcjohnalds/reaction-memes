import { createServer } from "./api.mjs";
import fs from "node:fs";
import { test, after } from "node:test";
import assert from "node:assert/strict";

const server = createServer().listen(8081);

after(async () => {
  // Without closeAllConnections, server.close takes ages to resolve
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await fs.promises.rm("static/unsupported.txt", { force: true });
});

test("get index page", async () => {
  const res = await fetch("http://localhost:8081");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "text/html");
  const text = await res.text();
  assert(text.includes("<html>"));
});

test("get javascript file", async () => {
  const res = await fetch("http://localhost:8081/script.mjs");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "text/javascript");
  const text = await res.text();
  assert(text.includes("document.body"));
});

test("get unsupported file type", async () => {
  await fs.promises.writeFile("static/unsupported.txt", "hello");
  const res = await fetch("http://localhost:8081/unsupported.txt");
  assert.equal(res.status, 404);
});

test("get with .. in url", async () => {
  // This test passes because of undocumented behavior built-in to Node.js where
  // it sanitizes req.url
  const urls = ["../index.mjs", "foo/../../index.mjs"];
  for (const url of urls) {
    const res = await fetch(`http://localhost:8081/${url}`);
    assert.equal(res.status, 404);
  }
});

test("get non-existent file", async () => {
  const res = await fetch("http://localhost:8081/invalid.png");
  assert.equal(res.status, 404);
});
