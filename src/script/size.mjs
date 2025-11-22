import sharp from "sharp";
import fs from "node:fs";

const images = await fs.promises.readdir("data/images");
let sizes = [];
for (const file of images.values()) {
  const { width, height } = await sharp(`data/images/${file}`).metadata();
  sizes.push({ file, width, height });
}
const json = JSON.stringify(sizes, null, 2);
await fs.promises.writeFile("data/sizes.json", json);
