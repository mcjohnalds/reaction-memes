import { createServer, escapeHTML, isSubarray } from "./server.mjs";
import { getSQL } from "./sql.mjs";
import fs from "node:fs";
import { before, after, afterEach, test, suite, mock } from "node:test";
import assert from "node:assert/strict";
import { stressTest } from "./stress.mjs";
import { encodeText } from "./clip.mjs";
import uuidv7 from "./uuidv7.mjs";
import http from "node:http";

let server;
const consoleLog = mock.fn();
const testMemes = [
  {
    id: uuidv7(),
    embedding: await encodeText("foo"),
    width: 1,
    height: 2,
    naughty: false,
  },
  {
    id: uuidv7(),
    embedding: await encodeText("bar"),
    width: 3,
    height: 4,
    naughty: false,
  },
  {
    id: uuidv7(),
    embedding: await encodeText("foo"),
    width: 5,
    height: 6,
    naughty: false,
  },
  {
    id: uuidv7(),
    embedding: await encodeText("foo"),
    width: 7,
    height: 8,
    naughty: false,
  },
  {
    id: uuidv7(),
    embedding: await encodeText("bar"),
    width: 9,
    height: 10,
    naughty: false,
  },
  {
    id: uuidv7(),
    embedding: await encodeText("baz"),
    width: 11,
    height: 12,
    naughty: true,
  },
];

const testSimilarMemes = [
  [testMemes[0].id, testMemes[2].id],
  [testMemes[0].id, testMemes[3].id],
  [testMemes[2].id, testMemes[3].id],
  [testMemes[1].id, testMemes[4].id],
];

before(async () => {
  await fs.promises.rm("data-test", { recursive: true, force: true });
  await fs.promises.mkdir("data-test/memes", { recursive: true });
  await fs.promises.mkdir("data-test/thumbnails", { recursive: true });
  const sql = getSQL("data-test");
  for (const meme of testMemes) {
    sql.run`
      INSERT INTO meme(id, embedding, width, height, naughty)
      VALUES(
        ${meme.id},
        jsonb(${JSON.stringify(meme.embedding)}),
        ${BigInt(meme.width)},
        ${BigInt(meme.height)},
        ${BigInt(meme.naughty)}
      )
    `;
    await fs.promises.writeFile(
      `data-test/memes/${meme.id.toHex()}.webp`,
      `${meme.id.toHex()} image`,
    );
    await fs.promises.writeFile(
      `data-test/thumbnails/${meme.id.toHex()}.webp`,
      `${meme.id.toHex()} thumbnail`,
    );
  }
  for (const [a, b] of testSimilarMemes) {
    sql.run`INSERT INTO similar_meme(a, b) VALUES (${a}, ${b})`;
  }
  server = await createServer("data-test", consoleLog);
  await new Promise((r) => server.listen(8081, r));
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
    const res = await sendRequest({ method: "GET", path: "/" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["content-type"], "text/html");
    const text = res.body.toString("utf8");
    assert(text.includes("<!DOCTYPE html>"));
    assert(text.includes('value=""'));
    const memes = getWindowMemes(text);
    memes.sort((a, b) => a.width - b.width);
    assert.equal(
      JSON.stringify(memes),
      JSON.stringify([
        { id: testMemes[0].id.toHex(), width: 1, height: 2 },
        { id: testMemes[1].id.toHex(), width: 3, height: 4 },
      ]),
    );
  });

  test("HEAD", async () => {
    const res = await sendRequest({ method: "HEAD", path: "/" });
    assert.equal(res.statusCode, 200);
  });
});

suite("/search", () => {
  suite("GET", () => {
    test("valid input returns valid response", async () => {
      const res = await sendRequest({
        method: "GET",
        path: "/search?query=foo",
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers["content-type"], "text/html");
      const text = res.body.toString("utf8");
      assert(text.includes("<!DOCTYPE html>"));
      assert(text.includes('value="foo"'));
      const memes = getWindowMemes(text);
      memes.sort((im) => im.width);
      assert.deepEqual(memes, [
        { id: testMemes[0].id.toHex(), width: 1, height: 2 },
        { id: testMemes[1].id.toHex(), width: 3, height: 4 },
      ]);
    });

    suite("returns most similar match first", () => {
      const tests = [
        {
          query: "foo",
          expectedMemes: [testMemes[0].id.toHex(), testMemes[1].id.toHex()],
        },
        {
          query: "bar",
          expectedMemes: [testMemes[1].id.toHex(), testMemes[0].id.toHex()],
        },
      ];
      for (const [i, { query, expectedMemes }] of tests.entries()) {
        test(`case ${i + 1}`, async () => {
          const res = await sendRequest({
            method: "GET",
            path: `/search?query=${query}`,
          });
          const text = res.body.toString("utf8");
          const memes = getWindowMemes(text);
          assert.deepEqual(
            memes.map((im) => im.id),
            expectedMemes,
          );
        });
      }
    });

    suite("conditionally includes naughty words", () => {
      const tests = [
        { query: "foo", includesNaughty: false },
        { query: "fnig", includesNaughty: false },
        { query: "fNig", includesNaughty: false },
        { query: "Ni", includesNaughty: false },
        { query: "foo nig", includesNaughty: true },
        { query: "nigger", includesNaughty: true },
        { query: "nig", includesNaughty: true },
        { query: "Nig", includesNaughty: true },
        { query: "foo nig", includesNaughty: true },
        { query: "foo Nig", includesNaughty: true },
      ];
      for (const [i, { query, includesNaughty }] of tests.entries()) {
        test(`case ${i + 1}`, async () => {
          const res = await sendRequest({
            method: "GET",
            path: `/search?query=${query}`,
          });
          const text = res.body.toString("utf8");
          const memes = getWindowMemes(text).map((m) => m.id);
          const naughty = testMemes[5].id.toHex();
          assert.equal(memes.includes(naughty), includesNaughty);
        });
      }
    });

    test("returns error on large query", async () => {
      const query = "a".repeat(200);
      const res = await sendRequest({
        method: "GET",
        path: `/search?query=${query}`,
      });
      assert.equal(res.statusCode, 400);
    });
  });

  test("HEAD", async () => {
    const res = await sendRequest({ method: "HEAD", path: "/search?query=a" });
    assert.equal(res.statusCode, 200);
  });
});

suite("static file", () => {
  suite("valid request", () => {
    const tests = [
      {
        path: "/script.mjs",
        expectedFile: "static/script.mjs",
        expectedHeaders: {
          "content-type": "text/javascript",
          "cache-control": "no-cache",
        },
      },
      {
        path: "/style.css",
        expectedFile: "static/style.css",
        expectedHeaders: {
          "content-type": "text/css",
          "cache-control": "no-cache",
        },
      },
      {
        path: "/title.svg",
        expectedFile: "static/title.svg",
        expectedHeaders: {
          "content-type": "image/svg+xml",
          "cache-control": "public, max-age=86400, immutable",
        },
      },
      {
        path: `/memes/${testMemes[0].id.toHex()}.webp`,
        expectedFile: `data-test/memes/${testMemes[0].id.toHex()}.webp`,
        expectedHeaders: {
          "content-type": "image/webp",
          "cache-control": "public, max-age=86400, immutable",
        },
      },
      {
        path: `/thumbnails/${testMemes[0].id.toHex()}.webp`,
        expectedFile: `data-test/thumbnails/${testMemes[0].id.toHex()}.webp`,
        expectedHeaders: {
          "content-type": "image/webp",
          "cache-control": "public, max-age=86400, immutable",
        },
      },
    ];

    for (const { path, expectedFile, expectedHeaders } of tests) {
      suite(path, () => {
        test("GET", async () => {
          const res = await sendRequest({ method: "GET", path });
          assert.equal(res.statusCode, 200);
          for (const [k, v] of Object.entries(expectedHeaders)) {
            assert.equal(res.headers[k], v);
          }
          const text = res.body.toString("utf8");
          const file = await fs.promises.readFile(expectedFile, {
            encoding: "utf8",
          });
          assert.equal(text, file);
        });

        test("HEAD", async () => {
          const res = await sendRequest({ method: "HEAD", path });
          assert.equal(res.statusCode, 200);
        });
      });
    }
  });

  test("resource does not exist", async () => {
    const res = await sendRequest({ method: "GET", path: "/does-not-exist" });
    assert.equal(res.statusCode, 404);
    const text = res.body.toString("utf8");
    assert(text.includes("<title>Page not found | Reaction Memes</title>"));
  });

  suite("unsupported content type", () => {
    afterEach(async () => {
      await fs.promises.rm("static/unsupported.txt", { force: true });
    });

    test("GET", async () => {
      await fs.promises.writeFile("static/unsupported.txt", "hello");
      const res = await sendRequest({
        method: "GET",
        path: "/unsupported.txt",
      });
      assert.equal(res.statusCode, 404);
    });

    test("HEAD", async () => {
      const res = await sendRequest({
        method: "HEAD",
        path: "/unsupported.mjs",
      });
      assert.equal(res.statusCode, 404);
    });
  });

  test("path contains ..", async () => {
    const res = await sendRequest({
      method: "GET",
      path: "/../static/script.mjs",
    });
    assert.equal(res.statusCode, 404);
  });
});

suite("/../static/script.mjs", () => {
  test("GET", async () => {
    const res = await sendRequest({
      method: "GET",
      path: "/../static/script.mjs",
    });
    assert.equal(res.statusCode, 404);
  });

  test("HEAD", async () => {
    const res = await sendRequest({
      method: "HEAD",
      path: "/../static/script.mjs",
    });
    assert.equal(res.statusCode, 404);
  });
});

suite("OpenGraph tags", () => {
  test("Request from cloudflare", async () => {
    const res = await sendRequest({ method: "GET", path: "/search?query=foo" });
    const text = res.body.toString("utf8");
    assert(
      text.includes(
        '<meta property="og:url" content="https://reactionmemes.app/search?query=foo" />',
      ),
    );
  });

  test("Request from localhost", async () => {
    const res = await sendRequest({
      forwardedProto: "http",
      host: "localhost:8081",
      method: "GET",
      path: "/search?query=foo",
    });
    const text = res.body.toString("utf8");
    assert(
      text.includes(
        '<meta property="og:url" content="http://localhost:8081/search?query=foo" />',
      ),
    );
  });
});

test("logs requests", async () => {
  const promise = new Promise((resolve) =>
    consoleLog.mock.mockImplementation(resolve),
  );
  await sendRequest({ method: "GET", path: "/script.mjs" });
  await promise;
  assert.equal(consoleLog.mock.callCount(), 1);
  const args = consoleLog.mock.calls[0].arguments;
  const json = JSON.parse(args[0]);
  assert.equal(json.status, 200);
  assert.equal(json.method, "GET");
  assert.equal(json.url, "/script.mjs");
  assert(typeof json.duration === "number");
  assert.equal(
    json.agent,
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Safari/605.1.15",
  );
  assert.equal(new Date(json.time).toISOString(), json.time);
});

test("escapeHTML()", () => {
  const str = `amp=& qout=" apos=' lt=< gt=>`;
  const expected = "amp=&amp; qout=&quot; apos=&apos; lt=&lt; gt=&gt;";
  assert.equal(escapeHTML(str), expected);
});

suite("isSubarray()", () => {
  const tests = [
    { xs: [1, 2, 2, 3], ys: [1, 2, 2, 2, 3, 4], expected: true },
    { xs: [1, 2, 2, 3], ys: [1, 2, 2, 3], expected: true },
    { xs: [1, 2, 3], ys: [1, 2, 3], expected: true },
    { xs: [], ys: [], expected: true },
    { xs: [1, 2, 2, 2, 2, 3], ys: [1, 2, 2, 2, 3, 4], expected: false },
    { xs: [0], ys: [1, 2], expected: false },
  ];
  for (const t of tests) {
    test(`isSubarray(${JSON.stringify(t.xs)}, ${JSON.stringify(t.ys)}) === ${t.expected}`, () => {
      assert.equal(isSubarray(t.xs, t.ys), t.expected);
    });
  }
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

function sendRequest({
  forwardedProto = "https",
  host = "reactionmemes.app",
  method,
  path,
}) {
  const req = http.request({
    method,
    path: encodeURI(path),
    headers: {
      host,
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Safari/605.1.15",
      "accept-language": "en-US,en;q=0.9",
      "cdn-loop": "cloudflare; loops=1; subreqs=1",
      "cf-connecting-ip": "1.2.3.4",
      "cf-ew-via": "15",
      "cf-ipcountry": "US",
      "cf-ray": "aaaaaaaaaaaaaaaa-NYC",
      "cf-visitor": `{"scheme":"${forwardedProto}"}`,
      "cf-warp-tag-id": "dad28a6f-5791-4c52-9c86-e4b3a62d1485",
      connection: "keep-alive",
      priority: "u=5, i",
      referer: `https://${host}/`,
      "sec-fetch-mode": "no-cors",
      "sec-fetch-site": "same-origin",
      "x-forwarded-for": "1.2.3.4",
      "x-forwarded-proto": forwardedProto,
    },
    host: "localhost",
    port: 8081,
  });
  return new Promise((resolve, reject) => {
    req.on("response", (response) => {
      let body = new Buffer.alloc(0);
      response.on("data", (data) => {
        body = Buffer.concat([body, data]);
      });
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          body,
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function getWindowMemes(html) {
  const start = "window.memes = ";
  const end = ";";
  const line = html.split("\n").find((l) => l.includes(start));
  const i = line.indexOf(start) + start.length;
  const j = line.indexOf(end);
  const str = line.substring(i, j);
  const memes = JSON.parse(str);
  assert(Array.isArray(memes));
  return memes;
}
