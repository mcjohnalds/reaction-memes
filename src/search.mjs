import fs from "node:fs";
import { encodeText } from "./clip.mjs";

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
