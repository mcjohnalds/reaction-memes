import {
  CLIPTextModelWithProjection,
  AutoTokenizer,
} from "@huggingface/transformers";
import fs from "node:fs";
import { imagesDir, normalizeVector } from "./shared.mjs";

const textModel = await CLIPTextModelWithProjection.from_pretrained(
  "Xenova/clip-vit-base-patch32",
  { dtype: "fp32" },
);
const tokenizer = await AutoTokenizer.from_pretrained(
  "Xenova/clip-vit-base-patch32",
  { dtype: "fp32" },
);

async function encodeText(text) {
  const inputs = await tokenizer(text);
  const output = await textModel(inputs);
  const v = Array.from(output.text_embeds.data);
  return normalizeVector(v);
}

function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

const encodingsFile = await fs.promises.readFile("data/encodings.json", {
  encoding: "utf8",
});
const encodings = JSON.parse(encodingsFile);
const textVec = await encodeText(process.argv[2]);
const results = [];
for (const encoding of encodings) {
  const similarity = dotProduct(textVec, encoding.vector);
  results.push({ file: encoding.file, similarity });
}
results.sort((a, b) => b.similarity - a.similarity);
console.table(
  results.map((r) => ({
    file: r.file,
    similarity: r.similarity.toFixed(2),
  })),
);
