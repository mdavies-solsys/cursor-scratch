import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const requiredKeys = ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REFRESH_TOKEN"];
const missingKeys = requiredKeys.filter((key) => !process.env[key]);

if (missingKeys.length) {
  console.error(`Missing required environment variables: ${missingKeys.join(", ")}`);
  process.exit(1);
}

const timeRange = process.env.SPOTIFY_TIME_RANGE || "medium_term";
const requestedLimit = Number.parseInt(process.env.SPOTIFY_TOP_LIMIT || "10", 10);
const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 10;

const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    authorization: `Basic ${Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64")}`,
  },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
  }),
});

const tokenData = await tokenResponse.json().catch(() => ({}));
if (!tokenResponse.ok) {
  console.error("Failed to refresh Spotify access token.");
  console.error(tokenData);
  process.exit(1);
}

const accessToken = tokenData.access_token;
if (!accessToken) {
  console.error("Spotify token response missing access_token.");
  process.exit(1);
}

const topResponse = await fetch(
  `https://api.spotify.com/v1/me/top/artists?limit=${limit}&time_range=${encodeURIComponent(timeRange)}`,
  {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  }
);

const topData = await topResponse.json().catch(() => ({}));
if (!topResponse.ok) {
  console.error("Failed to fetch top artists from Spotify.");
  console.error(topData);
  process.exit(1);
}

const artists = Array.isArray(topData.items)
  ? topData.items.slice(0, limit).map((artist, index) => ({
      rank: index + 1,
      name: artist?.name || "",
      url: artist?.external_urls?.spotify || "",
      image: artist?.images?.[1]?.url || artist?.images?.[0]?.url || "",
      genres: Array.isArray(artist?.genres) ? artist.genres.slice(0, 3) : [],
    }))
  : [];

const payload = {
  generatedAt: new Date().toISOString(),
  timeRange,
  artists,
};

const dataDir = path.resolve("src", "data");
await fs.mkdir(dataDir, { recursive: true });

const outputPath = path.join(dataDir, "spotify-top-artists.json");
await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Wrote ${artists.length} artists to ${outputPath}`);
