# matthewsdavies.com

Personal homepage site for Matt Davies.

## Structure

- `src/`: static site source (HTML, assets, Dockerfile).
- `ci/`: CloudFormation + CI/CD assets for AWS ECS Fargate deployment.

## Local preview

- Open `src/index.html` directly for a quick preview.
- Build the container with `docker build -t simple-site -f src/Dockerfile src`.

## Spotify top artists (weekly)

The homepage renders Spotify data from `src/data/spotify-top-artists.json`. A scheduled GitHub Actions workflow
refreshes it weekly using your Spotify account.

### Setup

1. Create a Spotify app at https://developer.spotify.com/dashboard.
2. Add a redirect URI such as `http://localhost:8888/callback`.
3. Build the one-time authorization URL (hosted by Spotify), then open it in a browser:

   ```
   https://accounts.spotify.com/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A8888%2Fcallback&scope=user-top-read
   ```

4. After approving, copy the `code` query parameter from the redirect URL and exchange it for a refresh token:

   ```
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   REDIRECT_URI="http://localhost:8888/callback"
   CODE="..."

   curl -sS -X POST https://accounts.spotify.com/api/token \
     -H "content-type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code&code=$CODE&redirect_uri=$REDIRECT_URI&client_id=$SPOTIFY_CLIENT_ID&client_secret=$SPOTIFY_CLIENT_SECRET"
   ```

   Copy the `refresh_token` from the response.

5. Add GitHub repo secrets:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REFRESH_TOKEN`

6. Run the "Update Spotify top artists" workflow once to populate the JSON.
