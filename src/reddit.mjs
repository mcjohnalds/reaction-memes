export const clientId = process.env.REDDIT_CLIENT_ID;
export const clientSecret = process.env.REDDIT_CLIENT_SECRET;
export const username = process.env.REDDIT_USERNAME;
export const password = process.env.REDDIT_PASSWORD;

export function getUserAgent() {
  const platform = "script";
  return `${platform}:${redditClientId}:0.1.0`;
}
