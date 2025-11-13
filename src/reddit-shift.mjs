import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import fs from "node:fs";
import sharp from "sharp";

const requestLogFilePath = "data/reddit-shift-requests.jsonl";
const notFoundFilePath = "data/reddit-not-found.txt";
const postsFilePath = "data/shift/reactionmemes.jsonl";

class NotFoundError extends Error {}

export async function scrape() {
  await fs.promises.rm(requestLogFilePath, { force: true });
  const notFoundUrls = await readNotFoundFile();
  const posts = await readPostsFile();
  let n = 0;
  for (const post of posts) {
    if (post.score < 10) {
      // Ignore low-quality posts
      continue;
    }
    let urls = [];
    if (post.media_metadata) {
      for (const media of Object.values(post.media_metadata)) {
        // Some medias have a "failed" status, indicating the media is broken.
        // Those medias lack an s field.
        //
        // Some medias are gifs which we don't want and they lack a u field
        if (media.s?.u) {
          urls.push(media.s.u);
        }
      }
    } else if (post.preview) {
      urls.push(post.preview.images[0].source.url);
    }
    for (const url of urls) {
      n++;
      const fileName = new URL(url).pathname.substring(1);
      const base = fileName.split(".").at(-2);
      const destination = `data/images/${base}.webp`;
      const exists = await fs.promises
        .access(destination)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        process.stdout.write(`${n} exists ${destination}\n`);
      } else if (notFoundUrls.includes(url)) {
        process.stdout.write(`${n} 404 ${destination}\n`);
      } else {
        let bytes;
        try {
          bytes = await getImage(url);
        } catch (error) {
          if (error instanceof NotFoundError) {
            await appendNotFound(url);
            process.stdout.write(`${n} 404 ${destination}\n`);
            continue;
          }
          throw error;
        }
        // Wait to prevent API rate limit
        await setTimeout(1_000);
        const tmp = "data/reddit-shift-temporary.webp";
        await sharp(bytes).webp().toFile(tmp);
        await fs.promises.rename(tmp, destination);
        process.stdout.write(`${n} saved ${destination}\n`);
      }
    }
  }
}

async function getImage(url) {
  let i = 0;
  while (true) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "curl/8.1.2" },
      });
      const log = {
        timestamp: new Date().toISOString(),
        url,
        status: res.status,
        headers: res.headers,
      };
      const logStr = JSON.stringify(log) + "\n";
      await fs.promises.appendFile(requestLogFilePath, logStr);
      if (res.status === 404) {
        throw new NotFoundError();
      }
      // Very rare. No idea what it means. Equivalent to 404.
      if (res.status === 403) {
        throw new NotFoundError();
      }
      assert.equal(res.status, 200);
      return res.bytes();
    } catch (error) {
      process.stdout.write(`Retrying ${error}\n`);
      if (i === 9) {
        throw new Error("Retries exceeded", { cause: error });
      }
      await setTimeout(2 ** i * 1000);
    }
  }
}

async function logRequest(data) {
  const log = { timestamp: new Date().toISOString(), ...data };
  const str = JSON.stringify(log) + "\n";
  await fs.promises.appendFile(requestLogFilePath, str);
}

async function appendNotFound(url) {
  await fs.promises.appendFile(notFoundFilePath, url + "\n");
}

async function readNotFoundFile() {
  try {
    const notFoundFile = await fs.promises.readFile(notFoundFilePath, {
      encoding: "utf8",
    });
    return notFoundFile.trim().split("\n");
  } catch {}
  return [];
}

async function readPostsFile() {
  const postsFile = await fs.promises.readFile(postsFilePath, {
    encoding: "utf8",
  });
  return postsFile
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}
