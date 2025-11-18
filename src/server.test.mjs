import { createServer } from "./server.mjs";
import fs from "node:fs";
import { beforeEach, afterEach, test, suite, mock } from "node:test";
import assert from "node:assert/strict";
import { stressTest } from "./stress.mjs";
import { encodeText } from "./clip.mjs";

let server;
const consoleLog = mock.fn();

beforeEach(async () => {
  await fs.promises.mkdir("data-test/images", { recursive: true });
  await fs.promises.mkdir("data-test/thumbnails", { recursive: true });
  const vectors = await Promise.all(["foo", "bar", "baz"].map(encodeText));
  const imageNames = ["a", "b", "c", "d", "e"];
  const encodings = [
    { file: "a.webp", vector: vectors[0] },
    { file: "b.webp", vector: vectors[1] },
    { file: "c.webp", vector: vectors[0] },
    { file: "d.webp", vector: vectors[0] },
    { file: "e.webp", vector: vectors[1] },
    { file: "f.webp", vector: vectors[2] },
  ];
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
  const ignore = ["f.webp"];
  await fs.promises.writeFile("data-test/ignore.json", JSON.stringify(ignore));
  await fs.promises.writeFile("data-test/similar.json", JSON.stringify(groups));
  server = await createServer("data-test", consoleLog);
  server.listen(8081);
});

afterEach(async () => {
  consoleLog.mock.resetCalls();
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
    test("valid input returns valid response", async () => {
      const res = await request("/search?query=a");
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("Content-Type"), "application/json");
      const json = await res.json();
      assert(Array.isArray(json));
    });

    test("returns most similar match", async () => {
      const res = await request("/search?query=b");
      const json = await res.json();
      assert.equal(json[0], "b.webp");
    });

    test("excludes images which are too similar", async () => {
      const res = await request("/search?query=c");
      const json = await res.json();
      assert(!json.includes("c.webp"));
    });

    test("excludes images which are in the ignore file", async () => {
      const res = await request("/search?query=baz");
      const json = await res.json();
      assert(!json.includes("f.webp"));
    });

    test("returns error on large query", async () => {
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
  suite("GET", () => {
    test("returns the file", async () => {
      const res = await request("/script.mjs");
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("Content-Type"), "text/javascript");
      const text = await res.text();
      assert(text.includes("function"));
    });

    // This test has nothing to do with /script.mjs specifically but it's a nice
    // place to put it
    test("logs the request", async () => {
      const res = await request("/script.mjs");
      // Call text() so that the callback in request.on("end", fn) gets
      // triggered. Without this, the test is flakey.
      await res.text();
      assert.equal(consoleLog.mock.callCount(), 1);
      const args = consoleLog.mock.calls[0].arguments;
      const json = JSON.parse(args[0]);
      assert.equal(json.status, 200);
      assert.equal(json.method, "GET");
      assert.equal(json.url, "/script.mjs");
      assert(typeof json.duration === "number");
      assert.equal(json.agent, "node");
      assert.equal(new Date(json.time).toISOString(), json.time);
    });
  });

  test("HEAD", async () => {
    const res = await request("/script.mjs", { method: "HEAD" });
    assert.equal(res.status, 200);
  });
});

suite("/unsupported.txt", () => {
  afterEach(async () => {
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
