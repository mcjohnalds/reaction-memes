import fs from "node:fs";
import {
  CLIPTextModelWithProjection,
  AutoTokenizer,
  CLIPVisionModelWithProjection,
  AutoProcessor,
  RawImage,
} from "@huggingface/transformers";

const textModel = await CLIPTextModelWithProjection.from_pretrained(
  "Xenova/clip-vit-base-patch32",
  { dtype: "fp32" },
);
const visionModel = await CLIPVisionModelWithProjection.from_pretrained(
  "Xenova/clip-vit-base-patch32",
  { dtype: "fp32" },
);
const tokenizer = await AutoTokenizer.from_pretrained(
  "Xenova/clip-vit-base-patch32",
  { dtype: "fp32" },
);
const processor = await AutoProcessor.from_pretrained(
  "Xenova/clip-vit-base-patch32",
  { dtype: "fp32" },
);

export async function encodeImages() {
  const encodings = [];
  const files = await fs.promises.readdir("data/images");
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const vector = await encodeImage(`data/images/${file}`);
    encodings.push({ file, vector });
    process.stdout.write(`${i + 1} / ${files.length}\n`);
  }
  const json = JSON.stringify(encodings, null, 2);
  await fs.promises.writeFile("data/encodings.json", json);
}

export async function encodeText(text) {
  const inputs = await tokenizer(text);
  const output = await textModel(inputs);
  const v = Array.from(output.text_embeds.data);
  return normalizeVector(v);
}

async function encodeImage(imagePath) {
  const image = await RawImage.read(imagePath);
  const inputs = await processor(image);
  const output = await visionModel(inputs);
  const v = Array.from(output.image_embeds.data);
  return normalizeVector(v);
}

function normalizeVector(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  return vec.map((x) => x / norm);
}
