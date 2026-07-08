// Получение метаданных Spotify БЕЗ API-ключей и без Premium.
// Используем публичный embed-эндпоинт (open.spotify.com/embed/...),
// тот же, что отдаёт виджеты-вставки. Возвращаем только метаданные —
// звук потом ищется на YouTube в sources.js.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function parseUrl(input) {
  const m = input.match(/(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?|spotify:)(track|album|playlist)[/:]([A-Za-z0-9]+)/i);
  return m ? { type: m[1].toLowerCase(), id: m[2] } : null;
}

function meta(name, artist, durationMs) {
  const clean = (s) => (s || '').trim();
  const n = clean(name);
  const a = clean(artist);
  return {
    title: a ? `${n} — ${a}` : n,
    searchQuery: `${n} ${a}`.trim(),
    duration: durationMs ? Math.round(durationMs / 1000) : null,
    thumbnail: null,
  };
}

async function fetchEntity(type, id) {
  const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`Spotify embed ${res.status}`);
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!m) throw new Error('Не удалось разобрать страницу Spotify (формат изменился).');
  const json = JSON.parse(m[1]);
  const entity = json?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Spotify не вернул данные для этой ссылки.');
  return entity;
}

// Возвращает массив метаданных (1 для трека, много для альбома/плейлиста).
async function resolveSpotify(input) {
  const parsed = parseUrl(input);
  if (!parsed) throw new Error('Не похоже на ссылку Spotify.');

  const entity = await fetchEntity(parsed.type, parsed.id);

  if (parsed.type === 'track') {
    const artist = (entity.artists || []).map((a) => a.name).join(', ');
    return [meta(entity.name, artist, entity.duration)];
  }

  // album / playlist — берём trackList из embed
  const list = entity.trackList || [];
  if (!list.length) throw new Error('Spotify не отдал список треков для этой ссылки.');
  return list.map((t) => meta(t.title, t.subtitle, t.duration));
}

module.exports = { resolveSpotify };
