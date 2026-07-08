const { spawn } = require('child_process');
const { StreamType } = require('@discordjs/voice');
const ytdlp = require('youtube-dl-exec');
const config = require('./config');
const { resolveSpotify } = require('./spotify');

// Куки для YouTube (обход возрастных ограничений). Приоритет у файла.
function cookieArgs() {
  if (config.cookies.file) return { cookies: config.cookies.file };
  if (config.cookies.browser) return { cookiesFromBrowser: config.cookies.browser };
  return {};
}

// Длительность плавного появления звука в начале трека (сек).
const FADE_IN_SEC = 1;
// Длительность плавного затухания в конце трека (сек).
const FADE_OUT_SEC = 2;
// Треки короче этого порога не затухаем (джинглы, эффекты).
const MIN_FADE_OUT_DURATION = 10;

// Цепочка ffmpeg-фильтров: fade-in в начале всегда, fade-out в конце —
// только когда длительность известна (для LIVE её нет).
function audioFilters(track) {
  const filters = [`afade=t=in:st=0:d=${FADE_IN_SEC}`];
  const d = Number(track.duration);
  if (Number.isFinite(d) && d > MIN_FADE_OUT_DURATION) {
    filters.push(`afade=t=out:st=${d - FADE_OUT_SEC}:d=${FADE_OUT_SEC}`);
  }
  return filters.join(',');
}

// Общие флаги yt-dlp. ВАЖНО: без куки — googlevideo-ссылка, добытая с куками,
// привязывается к сессии браузера, и ffmpeg на неё получает 403 Forbidden.
const COMMON = {
  noWarnings: true,
  noCheckCertificates: true,
  preferFreeFormats: true,
  noPlaylist: true,
};
const COOKIES = cookieArgs();

// Извлечение метаданных: сперва без куки (быстрый путь через прямую ссылку),
// при неудаче (18+ / «подтвердите возраст») — повтор с куками. В этом случае
// прямую ссылку использовать нельзя (403 для ffmpeg), стримим через yt-dlp.
async function extractInfo(url, flags = {}) {
  try {
    return { info: await ytdlp(url, { ...COMMON, ...flags }), viaCookies: false };
  } catch (e) {
    if (!Object.keys(COOKIES).length) throw e;
    return { info: await ytdlp(url, { ...COMMON, ...COOKIES, ...flags }), viaCookies: true };
  }
}

async function initSources() {
  console.log('✅ Источники готовы: YouTube + Spotify (без ключей, через embed).');
  if (config.cookies.file) console.log(`🍪 YouTube-куки из файла: ${config.cookies.file}`);
  else if (config.cookies.browser) console.log(`🍪 YouTube-куки из браузера: ${config.cookies.browser}`);
  else console.log('ℹ️  Куки YouTube не заданы — видео 18+ играть не будут (см. .env.example).');
}

// track.streamUrl — прямая ссылка на аудио (googlevideo) с уже решённой
// подписью; благодаря ей воспроизведение не запускает yt-dlp/Deno повторно.
// track.streamHeaders — HTTP-заголовки, с которыми yt-dlp добыл эту ссылку:
// без них googlevideo отвечает 403 Forbidden на запрос ffmpeg.
function makeTrack({ title, url, duration, thumbnail, requestedBy, searchQuery = null, streamUrl = null, streamHeaders = null, preferTopic = false }) {
  return { title, url, duration, thumbnail, requestedBy, searchQuery, streamUrl, streamHeaders, preferTopic };
}

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds)) return 'LIVE';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function detectType(query) {
  if (/open\.spotify\.com|spotify:/i.test(query)) return 'spotify';
  if (/(?:youtube\.com|youtu\.be)/i.test(query)) {
    if (/[?&]list=/.test(query) && !/[?&]list=RD/.test(query)) return 'yt_playlist';
    return 'yt_video';
  }
  return 'search';
}

// Выбирает лучший аудио-формат из ответа yt-dlp: прямую ссылку + заголовки.
function pickAudio(info) {
  if (!info) return null;
  const fmts = (info.formats || []).filter(
    (f) => f.url && f.acodec && f.acodec !== 'none' && (f.vcodec === 'none' || !f.vcodec)
  );
  if (!fmts.length) return null;
  fmts.sort((a, b) => (b.abr || 0) - (a.abr || 0));
  const f = fmts[0];
  return { url: f.url, headers: f.http_headers || info.http_headers || null };
}

// Извлекает один YouTube-URL в полный трек (с прямой ссылкой на аудио).
async function fullTrack(url, requestedBy) {
  const { info, viaCookies } = await extractInfo(url, { dumpSingleJson: true });
  const audio = viaCookies ? null : pickAudio(info);
  return makeTrack({
    title: info.title,
    url: info.webpage_url || url,
    duration: info.duration,
    thumbnail: info.thumbnail,
    requestedBy,
    streamUrl: audio?.url,
    streamHeaders: audio?.headers,
  });
}

// Поиск трека на YouTube через yt-dlp.
// preferTopic=true: берём 5 кандидатов и предпочитаем канал «… - Topic»
// (официальное чистое аудио), чтобы не попасть на клип с лишними вставками.
async function searchYouTube(query, requestedBy, preferTopic = false) {
  if (preferTopic) {
    const res = await ytdlp(`ytsearch8:${query}`, { ...COMMON, dumpSingleJson: true, flatPlaylist: true });
    const entries = (res.entries || []).filter((e) => e && e.id);
    if (!entries.length) return null;

    const isTopic = (e) => /-\s*topic$/i.test((e.channel || e.uploader || '').trim());
    // явный мусор, который не должен подменять оригинал
    const junk = /\b(karaoke|lyrics?|cover|live|remix|mashup|nightcore|instrumental|sped\s*up|slowed|8d|reverb)\b|кавер|караоке|клип|минус/i;

    const chosen =
      entries.find(isTopic) || // 1) официальное «- Topic» аудио
      entries.find((e) => !junk.test(e.title || '')) || // 2) первый «чистый»
      entries[0]; // 3) хоть что-то
    return fullTrack(chosen.url || `https://www.youtube.com/watch?v=${chosen.id}`, requestedBy);
  }

  const { info, viaCookies } = await extractInfo(`ytsearch1:${query}`, { dumpSingleJson: true });
  const e = info.entries ? info.entries[0] : info;
  if (!e) return null;
  const audio = viaCookies ? null : pickAudio(e);
  return makeTrack({
    title: e.title,
    url: e.webpage_url || e.url,
    duration: e.duration,
    thumbnail: e.thumbnail,
    requestedBy,
    streamUrl: audio?.url,
    streamHeaders: audio?.headers,
  });
}

// Главный резолвер: ссылка/текст -> массив треков.
async function resolveQuery(query, requestedBy) {
  const type = detectType(query);

  if (type === 'yt_video') {
    const { info, viaCookies } = await extractInfo(query, { dumpSingleJson: true });
    const audio = viaCookies ? null : pickAudio(info);
    return [
      makeTrack({
        title: info.title,
        url: info.webpage_url || query,
        duration: info.duration,
        thumbnail: info.thumbnail,
        requestedBy,
        streamUrl: audio?.url,
        streamHeaders: audio?.headers,
      }),
    ];
  }

  if (type === 'yt_playlist') {
    // flatPlaylist быстрый, но без форматов — прямую ссылку добудем позже (ensureResolved).
    const { info } = await extractInfo(query, { noPlaylist: false, dumpSingleJson: true, flatPlaylist: true });
    return (info.entries || [])
      .filter((e) => e && e.id)
      .map((e) =>
        makeTrack({
          title: e.title,
          url: e.url || `https://www.youtube.com/watch?v=${e.id}`,
          duration: e.duration,
          thumbnail: e.thumbnails?.[0]?.url,
          requestedBy,
        })
      );
  }

  if (type === 'spotify') {
    const metas = await resolveSpotify(query);
    // Ленивый резолв: YouTube ищем не сейчас, а перед самим воспроизведением
    // (ensureResolved) — иначе большой плейлист запускал бы десятки yt-dlp разом.
    return metas.map((m) =>
      makeTrack({
        title: m.title,
        url: null,
        duration: m.duration,
        thumbnail: m.thumbnail,
        requestedBy,
        searchQuery: m.searchQuery,
        preferTopic: true, // для Spotify ищем чистое «- Topic» аудио, а не клип
      })
    );
  }

  const t = await searchYouTube(query, requestedBy);
  return t ? [t] : [];
}

// Гарантирует, что у трека есть и YouTube-ссылка, и прямая ссылка на аудио.
// Вызывается заранее (предзагрузка) и непосредственно перед воспроизведением.
async function ensureResolved(track) {
  if (track.url && track.streamUrl) return track;

  // YouTube известен, но нет прямой ссылки (трек из плейлиста) — извлекаем форматы.
  if (track.url && !track.streamUrl) {
    const { info, viaCookies } = await extractInfo(track.url, { dumpSingleJson: true });
    const audio = viaCookies ? null : pickAudio(info);
    track.streamUrl = audio?.url;
    track.streamHeaders = audio?.headers;
    if (!track.duration) track.duration = info.duration;
    return track;
  }

  // Трек из Spotify/поиска — ищем на YouTube (сразу получаем и прямую ссылку).
  if (!track.searchQuery) throw new Error('Нечего искать для этого трека.');
  const found = await searchYouTube(track.searchQuery, track.requestedBy, track.preferTopic);
  if (!found) throw new Error(`На YouTube не нашлось: ${track.title}`);
  track.url = found.url;
  track.streamUrl = found.streamUrl;
  track.streamHeaders = found.streamHeaders;
  if (!track.duration) track.duration = found.duration;
  if (!track.thumbnail) track.thumbnail = found.thumbnail;
  return track;
}

// Собирает HTTP-аргументы ffmpeg из заголовков yt-dlp. Без этих заголовков
// (в первую очередь User-Agent) googlevideo отвечает 403 Forbidden.
function ffmpegHeaderArgs(track) {
  const headers = track.streamHeaders || {};
  const args = ['-user_agent', headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'];
  const rest = Object.entries(headers).filter(([k]) => k.toLowerCase() !== 'user-agent');
  if (rest.length) {
    args.push('-headers', rest.map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n');
  }
  return args;
}

// Создаёт аудиопоток. Быстрый путь: ffmpeg напрямую читает прямую ссылку
// (без повторного yt-dlp/Deno). Запасной путь: старый pipe через yt-dlp.
function getStream(track) {
  if (track.streamUrl) {
    const ff = spawn(
      'ffmpeg',
      [
        ...ffmpegHeaderArgs(track),
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', track.streamUrl,
        '-vn',
        // гладкие fade-in/fade-out делает сам ffmpeg (посэмплово), без ступенек
        '-af', audioFilters(track),
        '-ar', '48000',
        '-ac', '2',
        '-c:a', 'libopus',
        '-b:a', '128k',
        '-f', 'ogg',
        'pipe:1',
      ],
      { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }
    );
    return { stream: ff.stdout, process: ff, type: StreamType.OggOpus };
  }

  // Запасной вариант (если прямой ссылки нет, в т.ч. 18+): yt-dlp сам качает
  // с куками — для его собственного HTTP-клиента сессионная привязка не помеха.
  const subprocess = ytdlp.exec(
    track.url,
    { ...COMMON, ...COOKIES, output: '-', quiet: true, format: 'bestaudio[ext=webm]/bestaudio/best', limitRate: '5M' },
    { stdio: ['ignore', 'pipe', 'ignore'] }
  );
  return { stream: subprocess.stdout, process: subprocess, type: null };
}

module.exports = { initSources, resolveQuery, ensureResolved, getStream, formatDuration };
