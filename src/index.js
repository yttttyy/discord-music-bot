const os = require('os');
const fs = require('fs');
const path = require('path');

// yt-dlp нужен JS-рантайм (Deno) для решения YouTube-челленджа подписи.
// Подкладываем стандартную папку установки Deno в PATH, чтобы не зависеть
// от того, в каком терминале запущен бот.
const denoBin = path.join(os.homedir(), '.deno', 'bin');
if (fs.existsSync(denoBin) && !process.env.PATH.includes(denoBin)) {
  process.env.PATH = `${denoBin}${path.delimiter}${process.env.PATH}`;
}

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const { initSources } = require('./sources');
const { commands } = require('./commands');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
});

client.once('clientReady', () => {
  console.log(`✅ Вошёл как ${client.user.tag}. Префикс: "${config.prefix}"`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
  const name = args.shift()?.toLowerCase();
  const command = commands.get(name);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (err) {
    console.error(`Ошибка в команде "${name}":`, err);
    message.reply('💥 Что-то пошло не так при выполнении команды.').catch(() => {});
  }
});

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

(async () => {
  await initSources();
  await client.login(config.token);
})();
