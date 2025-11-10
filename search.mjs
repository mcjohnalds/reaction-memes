import {
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  AutoTokenizer,
  AutoProcessor,
  RawImage,
} from "@huggingface/transformers";
import fs from "node:fs";

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

function normalize(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  return vec.map((x) => x / norm);
}

async function encodeText(text) {
  const inputs = await tokenizer(text);
  const output = await textModel(inputs);
  return normalize(output.text_embeds.data);
}

async function encodeImage(imagePath) {
  const image = await RawImage.read(imagePath);
  const inputs = await processor(image);
  const output = await visionModel(inputs);
  return normalize(output.image_embeds.data);
}

function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

const textVec = await encodeText(process.argv[2]);
const results = [];
const files = await fs.promises.readdir("images");
for (const file of files) {
  const imgVec = await encodeImage(`images/${file}`);
  const similarity = dotProduct(textVec, imgVec);
  results.push({ file, similarity });
}
results.sort((a, b) => b.similarity - a.similarity);
console.table(
  results.map((r) => ({
    file: r.file,
    similarity: r.similarity.toFixed(2),
  })),
);
