# October Baseball

A static, no-build site that shows the MLB postseason:

- **Calendar**: every postseason game, with local start times, TV channels, final scores and series status. On phones it switches to a day-by-day list.
- **Live**: the games in progress, with score, inning, count, outs, runners on base, batter and pitcher. It refreshes every 30 seconds while games are live.
- Click any game to open details: line score, winning and losing pitchers, probable starters, venue, English and Spanish TV channels, and a link to MLB Gameday.

Data comes directly from the public [MLB Stats API](https://statsapi.mlb.com) on every page load. It needs no backend or API key.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

ES modules need a server, so opening `index.html` directly as a `file://` URL won't work.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, go to **Settings → Pages → Build and deployment**. Set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, and save.
3. The site will be at `https://<user>.github.io/<repo>/`.
