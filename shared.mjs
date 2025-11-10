export const clientId = process.env.CLIENT_ID;
export const clientSecret = process.env.CLIENT_SECRET;
export const username = process.env.USERNAME;
export const password = process.env.PASSWORD;
export const imagesDir = "data/images";

export function getUserAgent() {
  const platform = "script";
  return `${platform}:${clientId}:0.1.0`;
}

export function normalizeVector(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  return vec.map((x) => x / norm);
}
