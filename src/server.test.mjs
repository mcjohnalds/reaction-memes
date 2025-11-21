import { createServer, escapeHTML } from "./server.mjs";
import fs from "node:fs";
import { before, after, afterEach, test, suite, mock } from "node:test";
import assert from "node:assert/strict";
import { stressTest } from "./stress.mjs";
import { encodeText } from "./clip.mjs";

let server;
const consoleLog = mock.fn();

before(async () => {
  await fs.promises.rm("data-test", { recursive: true, force: true });
  await fs.promises.mkdir("data-test/images", { recursive: true });
  await fs.promises.mkdir("data-test/thumbnails", { recursive: true });
  const encodings = [
    { file: "a.webp", vector: await encodeText("foo") },
    { file: "b.webp", vector: await encodeText("bar") },
    { file: "c.webp", vector: await encodeText("foo") },
    { file: "d.webp", vector: await encodeText("foo") },
    { file: "e.webp", vector: await encodeText("bar") },
    { file: "f.webp", vector: await encodeText("baz") },
  ];
  for (const encoding of encodings) {
    await fs.promises.writeFile(
      `data-test/images/${encoding.file}`,
      encoding.file,
    );
    await fs.promises.writeFile(
      `data-test/thumbnails//${encoding.file}`,
      encoding.file,
    );
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
  const sizes = [
    { image: "a.webp", width: 1, height: 2 },
    { image: "b.webp", width: 3, height: 4 },
    { image: "c.webp", width: 5, height: 6 },
    { image: "d.webp", width: 7, height: 8 },
    { image: "e.webp", width: 9, height: 10 },
    { image: "f.webp", width: 11, height: 12 },
  ];
  await fs.promises.writeFile("data-test/sizes.json", JSON.stringify(sizes));
  server = await createServer("data-test", consoleLog);
  server.listen(8081);
});

after(async () => {
  // Without closeAllConnections, server.close takes ages to resolve
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await fs.promises.rm("data-test", { recursive: true, force: true });
});

afterEach(async () => {
  consoleLog.mock.resetCalls();
});

suite("/", () => {
  test("GET", async () => {
    const res = await request("");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html");
    const text = await res.text();
    assert(text.includes("<html>"));
    assert(text.includes('value=""'));
    const images = getWindowImages(text);
    images.sort();
    assert.equal(
      String(images),
      String([
        { image: "a.webp", width: 1, height: 2 },
        { image: "b.webp", width: 3, height: 4 },
      ]),
    );
  });

  test("HEAD", async () => {
    const res = await request("", { method: "HEAD" });
    assert.equal(res.status, 200);
  });
});

suite("/search", () => {
  suite("GET", () => {
    test("valid input returns valid response", async () => {
      const res = await request("/search?query=foo");
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("Content-Type"), "text/html");
      const text = await res.text();
      assert(text.includes("<html>"));
      assert(text.includes('value="foo"'));
      const images = getWindowImages(text);
      images.sort((im) => im.image);
      // Excludes c.webp, d.webp which are too similar to a.webp
      //
      // Excludes e.webp which is too similar to b.webp
      //
      // Excludes f.webp which is in the ignore file
      assert.deepEqual(images, [
        { file: "a.webp", width: 1, height: 2 },
        { file: "b.webp", width: 3, height: 4 },
      ]);
    });

    suite("returns most similar match first", () => {
      const tests = [
        { query: "foo", expectedImages: ["a.webp", "b.webp"] },
        { query: "bar", expectedImages: ["b.webp", "a.webp"] },
      ];
      for (const [i, { query, expectedImages }] of tests.entries()) {
        test(`case ${i + 1}`, async () => {
          const res = await request(`/search?query=${query}`);
          const text = await res.text();
          const images = getWindowImages(text);
          assert.deepEqual(
            images.map((im) => im.file),
            expectedImages,
          );
        });
      }
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

suite("static file", () => {
  suite("valid request", () => {
    const tests = [
      {
        url: "/script.mjs",
        expectedFile: "static/script.mjs",
        expectedHeaders: {
          "Content-Type": "text/javascript",
          "Cache-Control": "no-cache",
        },
      },
      {
        url: "/style.css",
        expectedFile: "static/style.css",
        expectedHeaders: {
          "Content-Type": "text/css",
          "Cache-Control": "no-cache",
        },
      },
      {
        url: "/title.svg",
        expectedFile: "static/title.svg",
        expectedHeaders: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400, immutable",
        },
      },
      {
        url: "/images/a.webp",
        expectedFile: "data-test/images/a.webp",
        expectedHeaders: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      },
      {
        url: "/thumbnails/a.webp",
        expectedFile: "data-test/thumbnails/a.webp",
        expectedHeaders: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      },
    ];

    for (const { url, expectedFile, expectedHeaders } of tests) {
      suite(url, () => {
        test("GET", async () => {
          const res = await request(url);
          assert.equal(res.status, 200);
          for (const [k, v] of Object.entries(expectedHeaders)) {
            assert.equal(res.headers.get(k), v);
          }
          const text = await res.text();
          const file = await fs.promises.readFile(expectedFile, {
            encoding: "utf8",
          });
          assert.equal(text, file);
        });

        test("HEAD", async () => {
          const res = await request(url, { method: "HEAD" });
          assert.equal(res.status, 200);
        });
      });
    }
  });

  test("file does not exist", async () => {
    const res = await request("/does-not-exist.js");
    assert.equal(res.status, 404);
  });

  suite("unsupported content type", () => {
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

  test("path contains ..", async () => {
    const res = await request("/../static/script.mjs");
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

test("logs requests", async () => {
  const res = await request("/script.mjs");
  // Call text() so that the callback in request.on("end", fn) gets triggered.
  // Without this, the test is flakey.
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

test("escapeHTML()", () => {
  const str = `amp=& qout=" apos=' lt=< gt=>`;
  const expected = "amp=&amp; qout=&quot; apos=&apos; lt=&lt; gt=&gt;";
  assert.equal(escapeHTML(str), expected);
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

function getWindowImages(html) {
  const start = "window.images = ";
  const end = ";";
  const line = html.split("\n").find((l) => l.includes(start));
  const i = line.indexOf(start) + start.length;
  const j = line.indexOf(end);
  const str = line.substring(i, j);
  const images = JSON.parse(str);
  assert(Array.isArray(images));
  return images;
}
