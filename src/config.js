require('dotenv').config();

const config = {
  token: process.env.DISCORD_TOKEN,
  prefix: process.env.PREFIX || '!',
  // Куки для YouTube (нужны для видео 18+ / возрастных ограничений).
  cookies: {
    browser: process.env.YT_COOKIES_FROM_BROWSER || '', // напр. firefox / chrome / edge
    file: process.env.YT_COOKIES_FILE || '', // путь к cookies.txt
  },
};

if (!config.token) {
  console.error('❌ Не задан DISCORD_TOKEN. Скопируй .env.example в .env и заполни его.');
  process.exit(1);
}

// Spotify работает через публичный embed — ключи и Premium не нужны.
config.spotifyEnabled = true;

module.exports = config;
