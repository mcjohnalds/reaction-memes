import {
  CLIPVisionModelWithProjection,
  AutoProcessor,
  RawImage,
} from "@huggingface/transformers";
import fs from "node:fs";
import { imagesDir, normalizeVector } from "./shared.mjs";

const visionModel = await CLIPVisionModelWithProjection.from_pretrained(
  "Xenova/clip-vit-base-patch32",
  { dtype: "fp32" },
);
const processor = await AutoProcessor.from_pretrained(
  "Xenova/clip-vit-base-patch32",
  { dtype: "fp32" },
);

async function encodeImage(imagePath) {
  const image = await RawImage.read(imagePath);
  const inputs = await processor(image);
  const output = await visionModel(inputs);
  const v = Array.from(output.image_embeds.data);
  return normalizeVector(v);
}

const encodings = [];
const files = await fs.promises.readdir(imagesDir);
for (const file of files) {
  const vector = await encodeImage(`${imagesDir}/${file}`);
  encodings.push({ file, vector });
}
const json = JSON.stringify(encodings, null, 2);
await fs.promises.writeFile("data/encodings.json", json);
