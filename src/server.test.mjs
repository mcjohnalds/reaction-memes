import { createServer } from "./server.mjs";
import fs from "node:fs";
import { beforeEach, afterEach, test, after, before, suite } from "node:test";
import assert from "node:assert/strict";
import { stressTest } from "./stress.mjs";
import { encodeText } from "./clip.mjs";

let server;

beforeEach(async () => {
  console.log = () => {};
  await fs.promises.mkdir("data-test/images", { recursive: true });
  await fs.promises.mkdir("data-test/thumbnails", { recursive: true });
  const imageNames = ["a", "b", "c", "d", "e"];
  const encodings = [];
  for (const image of imageNames) {
    await fs.promises.writeFile(`data-test/images/${image}.webp`, "");
    await fs.promises.writeFile(`data-test/thumbnails/${image}.webp`, "");
    const encoding = {
      file: image + ".webp",
      vector: await encodeText(image),
    };
    encodings.push(encoding);
  }
  const groups = [
    ["a.webp", "c.webp", "d.webp"],
    ["b.webp", "e.webp"],
  ];
  await fs.promises.writeFile(
    "data-test/encodings.json",
    JSON.stringify(encodings),
  );
  await fs.promises.writeFile("data-test/similar.json", JSON.stringify(groups));
  server = await createServer("data-test");
  server.listen(8081);
});

afterEach(async () => {
  // Without closeAllConnections, server.close takes ages to resolve
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await fs.promises.rm("data-test", { recursive: true, force: true });
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
  suite("GET", () => {
    test("valid input", async () => {
      const res = await request("/search?query=b");
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("Content-Type"), "application/json");
      const json = await res.json();
      assert(Array.isArray(json));
      assert.equal(json[0], "b.webp");
    });

    test("large input", async () => {
      const query = "a".repeat(200);
      const res = await request(`/search?query=${query}`);
      assert.equal(res.status, 400);
    });
  });

  test("HEAD", async () => {
    const res = await request("/search?query=a", { method: "HEAD" });
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
  after(async () => {
    await fs.promises.rm("static/unsupported.txt", { force: true });
  });

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

test("stress test", async () => {
  await stressTest({
    targetRequestsPerSecond: 100,
    stressTestDuration: 2000,
    lagLimit: 10,
    port: 8081,
    log: false,
  });
});

async function request(path, options) {
  return await fetch(`http://localhost:8081${path}`, options);
}
