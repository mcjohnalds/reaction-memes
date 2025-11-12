import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { Readable } from "node:stream";
import fs from "node:fs";

const requestLogFilePath = "data/reddit-shift-requests.jsonl";
const notFoundFilePath = "data/reddit-not-found.txt";
const postsFilePath = "data/shift/reactionmemes.jsonl";

class NotFoundError extends Error {}

export async function scrape() {
  let notFoundFile = "";
  try {
    notFoundFile = await fs.promises.readFile(notFoundFilePath, {
      encoding: "utf8",
    });
  } catch {}
  const notFoundUrls = notFoundFile.trim().split("\n");
  await fs.promises.rm(requestLogFilePath, { force: true });
  const postsFile = await fs.promises.readFile(postsFilePath, {
    encoding: "utf8",
  });
  const posts = postsFile
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  let n = 0;
  // TODO: flatten
  for (const post of posts) {
    if (post.score < 10) {
      // Ignore low-quality posts
      continue;
    }
    let images = [];
    if (post.media_metadata) {
      for (const media of Object.values(post.media_metadata)) {
        // Some medias have a "failed" status, indicating the media is broken.
        // Those medias lack an s field.
        //
        // Some medias are gifs which we don't want and they lack a u field
        if (media.s?.u) {
          images.push(media.s.u);
        }
      }
    } else if (post.preview) {
      images.push(post.preview.images[0].source.url);
    }
    for (const image of images) {
      n++;
      const fileName = new URL(image).pathname.substring(1);
      const destination = `data/images/${fileName}`;
      const exists = await fs.promises
        .access(destination)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        process.stdout.write(`${n} exists ${fileName}\n`);
      } else if (notFoundUrls.includes(image)) {
        process.stdout.write(`${n} 404 ${fileName}\n`);
      } else {
        try {
          await saveImage(destination, image);
          process.stdout.write(`${n} saved ${fileName}\n`);
          await setTimeout(1_000);
        } catch (error) {
          if (error instanceof NotFoundError) {
            await appendNotFound(image);
            process.stdout.write(`${n} 404 ${fileName}\n`);
            continue;
          }
          throw error;
        }
      }
    }
  }
}

async function saveImage(destination, url) {
  const res = await fetch(url, {
    headers: { "user-agent": "curl/8.1.2" },
  });
  await logRequest({
    url,
    status: res.status,
    headers: res.headers,
  });
  if (res.status === 404) {
    throw new NotFoundError();
  }
  assert.equal(res.status, 200);
  const stream = Readable.fromWeb(res.body);
  const tmp = `data/scrape-image-temporary`;
  await fs.promises.writeFile(tmp, stream);
  await fs.promises.rename(tmp, destination);
}

async function logRequest(data) {
  const log = { timestamp: new Date().toISOString(), ...data };
  const str = JSON.stringify(log) + "\n";
  await fs.promises.appendFile(requestLogFilePath, str);
}

async function appendNotFound(url) {
  await fs.promises.appendFile(notFoundFilePath, url + "\n");
}
