# Flag Plinko

A vertical (1080x1920) elimination game for YouTube livestreams. 197 flags are dropped through a Plinko board,
a **red bin eliminates, a green bin survives**, and after ~3 hours one country wins. Then the next game starts automatically.

Everything is real physics + a seedable RNG. There is **no predetermined winner**, and chat can never influence a result.

```
flag-plinko/
  src/shared/   game core (pure JS, runs in the browser AND in Node): rng, board, physics, game (rounds + governor)
  src/web/      canvas renderer, overlay, synthesised sound, page entry
  src/server/   chat: country matcher + YouTube Live Chat poller
  server.js     static files + resume state + game logs + chat events (SSE)
  run.js        headless streaming: Xvfb + Chrome + PulseAudio + ffmpeg -> YouTube RTMP, auto-restart
  tools/        calibrate / sim (fast mode) / tests / screenshot / bench / fetch-flags / mock-chat
  data/         countries.json (197), bin-probs.json (calibrated landing probabilities)
  assets/flags/ 197 flag PNGs (downloaded once; the game never touches the network at runtime)
  config.json   channel name, watermark, game length, seed, sound, stream and chat settings
```

## Quick start

```bash
npm install
node server.js                  # then open http://localhost:8080  (OBS Browser Source: 1080 x 1920)
```

URL options: `?seed=123` (reproducible game) · `?speed=50` (fast mode) · `?game=20&intro=10` (short test game, minutes/seconds)
· `?resume=1` · `?debug=1` (fps overlay) · `?mute=1` · `?bench=200` (frame-rate bench).

### Flags
The 197 flags are already in `assets/flags/`. To (re)download them from flagcdn once: `npm run flags`
(`node tools/fetch-flags.js --source npm` renders them from the `flag-icons` npm package if flagcdn is blocked).

## The game

| Phase | Flags | Rounds | Round time |
|---|---|---|---|
| Intro | 197 | - | 4 min |
| 1 | 197 -> ~60 | 8 | ~6 min |
| 2 | ~60 -> ~16 | 8 | ~7 min |
| 3 | ~16 -> 4 | 6 | ~8 min |
| Finale | 4 -> 1 | 3 | ~8 min |

* Each round: 20 s banner ("Round X - Y flags left - Z must go" + "COMMENT YOUR COUNTRY"), balls dropped in waves across the
  round's time budget, 20 s results (scrolling list of eliminated countries).
* 12 bins; each round they are randomly assigned green/red such that the **expected** number of survivors matches the round's target
  (using the measured landing probability of every bin, `data/bin-probs.json`).
* A round with 0 eliminations, 0 survivors, or far too few survivors is **replayed** (all of its flags drop again, shorter round).
* Finale: bins carry point values (edge bins 10, centre 1); every finalist drops many balls, the **lowest total score is eliminated**,
  ties among the lowest are re-dropped (only those countries).
* **Duration governor**: after every round the remaining time is divided over the remaining (nominal-weighted) rounds. It adjusts
  (a) the red/green ratio, (b) the release rate (waves), (c) the physics time scale (0.9-1.12x). Replays, skipped rounds and ties are
  absorbed, so a game ends between 175 and 185 minutes (measured: 179.24-180.32 min over 100 simulated games, mean 179.56).
* Winner screen 30 s (confetti, big flag), then "Next game in 05:00", then a fresh seed.
* Every game is written to `logs/game-<seed>-<time>.json` (seed, every round: survivors, eliminated count, green bins, replays, winner, duration, physics stats).

## Fairness
Outcomes come only from the physics simulation (seeded RNG for spawn positions and tiny collision jitter). The game core
(`src/shared`) has no chat input whatsoever; chat only drives highlights in the overlay (`tools/test-chat.js` checks this).
The same seed always reproduces the same game, in the browser, in fast mode and in Node. If you replay a seed you get the exact same winner.

## Physics (no stuck balls)
Custom deterministic engine: circles vs pegs / capsule segments, ball-ball collisions, fixed 120 Hz steps, slow "floaty" fall
(measured 5.6-7.2 s per ball, p5-p95). The v1 wall bug is fixed by (1) half-pegs sitting on the walls, (2) the first/last peg of every
second row left out so no gap smaller than a ball ever forms next to a wall, (3) angled wedges on the walls, (4) a small random kick when a ball
balances on top of a peg, and (5) the **anti-stuck system**: a ball slower than 14 px/s for more than 1 s, or one that moved down
less than 14 px in 3 s, gets a nudge (and a last-resort forced landing after 75 s that has never triggered). The tests count nudges: 1 nudge in 100 simulated games (~70,000 balls), 0 forced landings, slowest fall 9.2 s.

## Sound
Everything is synthesised with WebAudio (no files, no licences): pitch-varying peg tick, elimination thud, "safe" chime, round-start whoosh,
replay buzz, winner fanfare and a quiet generative lo-fi loop. Volumes: `config.json -> sound`.

## Streaming to YouTube

```bash
sudo apt install ffmpeg xvfb pulseaudio chromium      # or any Chrome; set CHROME_PATH / config.stream.chrome
cp config.json config.local.json                      # keep ONLY what you change, e.g.:
```
`config.local.json` (git-ignored; merged over `config.json`):
```json
{
  "channelName": "FLAG PLINKO",
  "watermark": "@MyChannel - subscribe & comment your country!",
  "stream": { "streamKey": "xxxx-xxxx-xxxx-xxxx-xxxx", "fps": 30, "videoBitrate": "6000k" },
  "chat":   { "enabled": true, "apiKey": "AIza...", "videoId": "<your live video id>" }
}
```
```bash
node run.js                       # streams forever, one game after the other, restarts on a crash
node run.js --once                # exactly one game, then stop
node run.js --output test.mp4 --duration 60 --game 5 --intro 5     # local test recording
```
`run.js` starts Xvfb (:99, 1080x1920), a PulseAudio null sink, Chrome in `--app` mode (so the capture has no browser UI), and
ffmpeg (`x11grab` + the sink's monitor -> H.264/AAC -> RTMP). A watchdog restarts everything if Chrome crashes, ffmpeg dies or the
game clock stalls (2-60 s back-off); the game resumes at the start of the round that was running (state is saved to `state/current.json`
at every round start). `config.stream.audio`: `"pulse"` (default), `"silent"`, or `"file:/path/music.mp3"`. GPU encoding: `"encoder": "h264_nvenc"`.

**Several streams per day**: either `"schedule": ["06:00","09:15","12:30","15:45","19:00","22:15"]` in `config.stream` (one game per slot),
or cron (`deploy/crontab.example`), or run it as a service (`deploy/flagplinko.service`). A game is 3 h + 35 s winner screen,
so slots 3 h 15 min apart never overlap. You still have to create/bind a YouTube broadcast for each slot (stream key reuse: in YouTube Studio
create a *reusable* stream key and schedule the broadcasts, or enable "Enable auto-start/auto-stop").

## Hall of fame
The server counts every winner in `state/wins.json` (git-ignored, survives restarts). The winner screen shows "WIN #3" and a top-5 **Hall of Fame**,
and the intro of every game shows the last three winners and the country with the most wins (`docs/hall-of-fame.png`). Only normal games are counted:
a page opened with test parameters (`?seed`, `?speed`, `?game`, `?intro` ...) shows a preview but is never saved. To reset the counters delete `state/wins.json`.

## Chat (YouTube Live Chat API)
Viewers type a country name, an alias (`holland`, `usa`, `south korea`), a flag emoji, or - on its own - a 2-letter code (`NL`).
Longest match wins (`north korea` before `korea`). The country's ball (if it is on the board) gets a gold ring and the viewer's name for 10 s,
its flag in the grid pulses, and the footer shows "MOST SUPPORTED". One count per viewer per country per 20 s.
Set `chat.enabled`, `chat.videoId` (or `liveChatId`) and `chat.apiKey` (or an OAuth `oauthToken`). **Quota**: `liveChat/messages` costs ~5 units per call and the
default project quota is 10,000 units/day; the poller waits >= 10 s between calls (about 5,400 units for one 3 h stream), so several streams a day
need a quota increase. Test without YouTube: `node tools/mock-chat.js` while a game is running (open the page with `?chat=1`).

## Shorter games (20-30 minutes)
Set `"gameMinutes": 25` in `config.local.json` (restart `node server.js`, refresh the OBS Browser source) and every game lasts about that long, then a new one with a new seed
starts automatically. Games under ~2.6 h automatically use fewer rounds (30 min: 4+4+3 elimination rounds + 3 finale rounds), a shorter intro (2.5% of the game),
shorter winner screen (<= 30 s) and a shorter pause before the next game (3% of the game). Measured over 50 simulated games each:
20 min -> 19.62-20.01, 25 min -> 24.62-25.03, 30 min -> 29.61-29.99 minutes, 0 forced landings. Test it: `node tools/sim.js --games 50 --minutes 25`,
or look at it in the browser: `http://localhost:8080/?game=25`.

## Tests

```bash
npm test                                       # physics/game + chat + hall-of-fame tests
node tools/calibrate.js --n 20000 --write      # fall times, bin probabilities (writes data/bin-probs.json), 200-ball burst, stuck check
node tools/sim.js --games 50                   # 50 complete 3-hour games in a few seconds; checks 175-185 min, nudges, forced landings
node tools/fast-browser.js 1 50                # one full game in the real page at ?speed=50
node tools/screenshot.js shots                 # 1080x1920 screenshots of every screen
node tools/bench.js 200 12                     # 200 balls on screen: frame time / fps / CPU per frame
```
If you change anything in `src/shared/physics.js` or `board.js`, re-run `calibrate.js --write` so the bin probabilities stay correct.

## Honest limits
* **Stream frame rate depends on the machine.** The page itself renders 60 fps with 200 balls using ~2 ms CPU per frame (software rendering),
  but capturing 1080x1920 from X11 and encoding with x264 on a small CPU-only box delivered ~29 fps at a 30 fps target and ~32 fps at a 60 fps target.
  Use `fps: 30` there, or a machine with more cores / a GPU (`encoder: h264_nvenc`) for 60.
* YouTube chat polling and RTMP delivery to youtube.com were not tested against YouTube itself (no network access to it from the dev sandbox);
  the RTMP path was tested against a local ffmpeg RTMP receiver, the chat poller against the API shape only.
* The game clock follows wall time, so if the machine stalls for long the stream gets longer than 3 h; the governor then shortens the remaining rounds.
