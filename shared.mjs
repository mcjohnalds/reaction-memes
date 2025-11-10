export const clientId = process.env.CLIENT_ID;
export const clientSecret = process.env.CLIENT_SECRET;
export const username = process.env.USERNAME;
export const password = process.env.PASSWORD;

export function getUserAgent() {
  const platform = "script";
  return `${platform}:${clientId}:0.1.0`;
}
