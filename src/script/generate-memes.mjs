import { setTimeout } from "node:timers/promises";
import fs from "node:fs";
import sharp from "sharp";
import sql from "../sql.mjs";
import { encodeImage, encodeText } from "../clip.mjs";
import { dotProduct } from "../math.mjs";

const postsFilePath = "data/shift/reactionmemes.jsonl";

async function main(dataDirectory) {
  await fs.promises.mkdir(`${dataDirectory}/memes`, { recursive: true });
  await fs.promises.mkdir(`${dataDirectory}/cached-responses`, {
    recursive: true,
  });
  const posts = await readPostsFile();
  for (const [i, post] of posts.entries()) {
    console.log(`Post ${i + 1} / ${posts.length}`);
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
      await scrapeURL(url, dataDirectory);
    }
  }
}

async function scrapeURL(url, dataDirectory) {
  let status;
  let bytes;
  const cachedResponse = sql.get`
    SELECT * FROM cached_response WHERE url = ${url}
  `;
  if (cachedResponse) {
    status = cachedResponse.status;
    bytes = await fs.promises.readFile(cachedResponse.file);
  } else {
    ({ status, bytes } = await fetchWithRetry(url));
    const uuid = crypto.randomUUID();
    const cacheFile = `${dataDirectory}/cached-responses/${uuid}`;
    await fs.promises.writeFile(cacheFile, bytes);
    sql.run`
      INSERT INTO cached_response(url, status, file)
      VALUES(${url}, ${BigInt(status)}, ${cacheFile})
    `;
    // Wait to prevent API rate limit
    await setTimeout(1_000);
  }
  if (status !== 200) {
    return;
  }
  const existingMeme = sql.get`SELECT file FROM meme WHERE source = ${url}`;
  const memeFile =
    existingMeme?.file ?? `${dataDirectory}/memes/${crypto.randomUUID()}.webp`;
  const image = await sharp(bytes);
  const { width, height } = await image.metadata();
  await image.webp().toFile(memeFile);
  const embedding = await encodeImage(memeFile);
  const badEmbedding = await encodeText("nigga");
  const naughty = dotProduct(badEmbedding, embedding) > 0.99;
  const { id } = sql.get`
    INSERT INTO meme(file, embedding, width, height, naughty, source)
    VALUES(
      ${memeFile},
      jsonb(${JSON.stringify(embedding)}),
      ${BigInt(width)},
      ${BigInt(height)},
      ${BigInt(naughty)},
      ${url}
    )
    ON CONFLICT DO UPDATE SET
      embedding = excluded.embedding,
      width = excluded.width,
      height = excluded.height,
      naughty = excluded.naughty
    RETURNING id
  `;
  sql.run`DELETE FROM similar_meme WHERE a = ${id} OR b = ${id}`;
  for (const meme of sql.iterate`SELECT id, json(embedding) AS embedding FROM meme`) {
    if (id === meme.id) {
      continue;
    }
    const similarity = dotProduct(embedding, JSON.parse(meme.embedding));
    if (similarity > 0.97) {
      const a = Math.min(id, meme.id);
      const b = Math.max(id, meme.id);
      sql.run`
        INSERT INTO similar_meme(a, b)
        VALUES(${BigInt(a)}, ${BigInt(b)})
      `;
    }
  }
}

async function fetchWithRetry(url) {
  let timeout = 1000;
  while (true) {
    let error;
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "curl/8.1.2" },
      });
      const status = response.status;
      const bytes = await response.bytes();
      if (status === 200 || (status >= 400 && status < 500)) {
        return { status, bytes };
      }
    } catch (e) {
      console.error(e);
      error = e;
    }
    if (error || response.status >= 500) {
      console.log("Retrying");
      await setTimeout(timeout);
      timeout *= 2;
    }
  }
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

main("data");
