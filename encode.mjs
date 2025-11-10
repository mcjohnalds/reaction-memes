import fs from "node:fs";
import { encodeImage } from "./clip.mjs";

const encodings = [];
const files = await fs.promises.readdir("data/images");
for (const file of files) {
  const vector = await encodeImage(`data/images/${file}`);
  encodings.push({ file, vector });
}
const json = JSON.stringify(encodings, null, 2);
await fs.promises.writeFile("data/encodings.json", json);
