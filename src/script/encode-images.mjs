import fs from "node:fs";
import { encodeImage } from "../clip.mjs";

const encodings = [];
const files = await fs.promises.readdir("data/images");
for (const [i, file] of files.entries()) {
  const vector = await encodeImage(`data/images/${file}`);
  encodings.push({ file, vector });
  if (i % 100 === 0) {
    process.stdout.write(`${i + 1} / ${files.length}\n`);
  }
}
const json = JSON.stringify(encodings, null, 2);
await fs.promises.writeFile("data/encodings.json", json);
