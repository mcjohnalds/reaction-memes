import * as fs from "node:fs";

const encodings = await readEncodingsFile();

function main() {
  for (let i = 0; i < encodings.length; i++) {
    const a = encodings[i];
    const results = [];
    for (const encoding of encodings.slice(0, maxResults)) {
      const similarity = dotProduct(textVec, encoding.vector);
      results.push({ file: encoding.file, similarity });
    }
    results.sort((a, b) => b.similarity - a.similarity);
  }
}

function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

async function readEncodingsFile() {
  const encodingsFile = await fs.promises.readFile("data/encodings.json", {
    encoding: "utf8",
  });
  return JSON.parse(encodingsFile);
}

main();
