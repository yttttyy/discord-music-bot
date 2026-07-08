# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Discord music bot (CommonJS, Node.js 18+) that plays audio from YouTube and Spotify links or text search, with per-guild queues. Prefix commands (default `!`), no slash commands. All code comments and user-facing bot messages are in **Russian** — keep new ones in Russian too.

## Commands

- Run: `npm start` (requires a filled `.env` with `DISCORD_TOKEN`; copy from `.env.example`)
- No tests, linter, or build step exists.

External runtime requirements: FFmpeg in PATH; Deno (yt-dlp uses it to solve YouTube's signature JS challenge — `src/index.js` prepends `~/.deno/bin` to PATH automatically).

## Architecture

Flow of a `!play` request:

1. `src/index.js` — entry point; parses prefix messages and dispatches to commands.
2. `src/commands/` — one file per command, auto-loaded by `commands/index.js` (any `.js` file exporting `{ name, execute }` is registered along with its `aliases`). Drop in a new file to add a command; nothing else to wire up.
3. `src/sources.js` — resolves a query (YouTube video/playlist URL, Spotify URL, or free text) into track objects via `yt-dlp` (`youtube-dl-exec`), and creates audio streams.
4. `src/queue.js` — `GuildQueue`: one voice connection + audio player + track queue per guild, kept in a module-level `Map` keyed by guild id.
5. `src/spotify.js` — Spotify metadata only, scraped from the public `open.spotify.com/embed` endpoint (`__NEXT_DATA__` JSON). No Spotify API keys; actual audio is always found on YouTube.
6. `src/embeds.js` — factories for all bot replies (Discord embeds, shared color palette). Every user-facing message goes through these; don't send plain-text replies.
7. `src/utils.js` — `inSameVoice(message, queue)`: control commands (skip/stop/pause/…) require the caller to be in the bot's voice channel; the helper replies with the refusal itself.

### Key design decisions (understand before changing playback code)

- **Lazy resolution**: Spotify and playlist tracks are enqueued with only metadata (`searchQuery` / `url`); the YouTube lookup and direct audio URL (`streamUrl`) are resolved right before playback via `ensureResolved()`. This avoids spawning dozens of yt-dlp processes for large playlists.
- **Prefetch**: while a track plays, `GuildQueue._prefetchNext()` pre-resolves the next `PREFETCH_COUNT` tracks so skips are instant. Resolution promises are cached on the track object (`_resolvePromise`) to dedupe concurrent resolves.
- **Streaming fast path**: when `track.streamUrl` (direct googlevideo audio URL) is known, ffmpeg is spawned directly on it, encoding to Ogg/Opus with `afade` fade-in at the start and fade-out at the end (fade-out only when `track.duration` is known and long enough — see `audioFilters()`) — no second yt-dlp/Deno invocation and no inlineVolume re-encoding. Fallback path pipes through `ytdlp.exec`. The child process is tracked as `currentProcess` and must be SIGKILLed before starting the next track (see `skip()`) to avoid leftover audio frames.
- **403 gotchas on the fast path** (both caused silent auto-skipping): (1) extraction must run WITHOUT browser cookies — a googlevideo URL obtained with cookies is session-bound and returns 403 to ffmpeg; cookies are only a retry fallback in `extractInfo()` for age-restricted videos, which then take the yt-dlp pipe path (`streamUrl` stays null); (2) ffmpeg must send yt-dlp's `http_headers` (stored as `track.streamHeaders`, passed via `-user_agent`/`-headers`), otherwise googlevideo also 403s. ffmpeg's stderr is discarded in `getStream` — when debugging playback, spawn the same args with stderr piped.
- **Spotify search quality**: Spotify-sourced tracks set `preferTopic: true`, so `searchYouTube` fetches 8 candidates and prefers "- Topic" channels (official clean audio), filtering out covers/karaoke/remixes via a junk regex.
- **Queue lifecycle**: empty queue starts a leave timer (`_scheduleLeave`); `createQueue` wraps `destroy()` to also remove the queue from the guild Map — always go through `destroy()`, never tear down the connection directly.
- **Single queue-advance point**: only the `Idle` handler pulls the next track. The `error` handler and `skip()` just set `_advanceWithoutLoop` (suppresses the loop re-queue once) and force `player.stop(true)`; advancing from anywhere else risks double-shifting the queue.

## Configuration

`src/config.js` reads `.env`: `DISCORD_TOKEN` (required, exits if missing), `PREFIX`, and optional YouTube cookies (`YT_COOKIES_FILE` takes priority over `YT_COOKIES_FROM_BROWSER`) needed only for age-restricted videos.
