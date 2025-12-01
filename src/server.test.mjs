import { createServer, escapeHTML, isSubarray } from "./server.mjs";
import { getSQL } from "./sql.mjs";
import fs from "node:fs";
import { before, after, afterEach, test, suite, mock } from "node:test";
import assert from "node:assert/strict";
import { stressTest } from "./stress.mjs";
import { encodeText } from "./clip.mjs";
import uuidv7 from "./uuidv7.mjs";

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
  await fs.promises.mkdir("data-test/thumbnails-new", { recursive: true });
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
      `data-test/thumbnails-new/${meme.id.toHex()}.webp`,
      `${meme.id.toHex()} thumbnail`,
    );
  }
  for (const [a, b] of testSimilarMemes) {
    sql.run`INSERT INTO similar_meme(a, b) VALUES (${a}, ${b})`;
  }
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
          const res = await request(`/search?query=${query}`);
          const text = await res.text();
          const memes = getWindowMemes(text);
          assert.deepEqual(
            memes.map((im) => im.id),
            expectedMemes,
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
        url: `/memes/${testMemes[0].id.toHex()}.webp`,
        expectedFile: `data-test/memes/${testMemes[0].id.toHex()}.webp`,
        expectedHeaders: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=86400, immutable",
        },
      },
      {
        url: `/thumbnails-new/${testMemes[0].id.toHex()}.webp`,
        expectedFile: `data-test/thumbnails-new/${testMemes[0].id.toHex()}.webp`,
        expectedHeaders: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=86400, immutable",
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

  test("resource does not exist", async () => {
    const res = await request("/does-not-exist");
    assert.equal(res.status, 404);
    const text = await res.text();
    assert(text.includes("<title>Page not found | Reaction Memes</title>"));
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
  const promise = new Promise((resolve) =>
    consoleLog.mock.mockImplementation(resolve),
  );
  await request("/script.mjs");
  await promise;
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

async function request(path, options) {
  return await fetch(`http://localhost:8081${path}`, options);
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
