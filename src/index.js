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

const { Client, GatewayIntentBits, Partials, MessageFlags } = require('discord.js');
const config = require('./config');
const { initSources } = require('./sources');
const { commands } = require('./commands');
const { getQueue, destroyAll } = require('./queue');
const { infoEmbed, errorEmbed } = require('./embeds');
const { memberInSameVoice } = require('./utils');

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
    message.reply({ embeds: [errorEmbed('Что-то пошло не так при выполнении команды.')] }).catch(() => {});
  }
});

// Кнопки под «Сейчас играет» (пауза/скип/стоп). Ответы — эфемерные, чтобы
// не засорять канал; правила те же, что у команд: нужно быть в войсе с ботом.
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() || !interaction.customId.startsWith('music:')) return;
  const reply = (embed) =>
    interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => {});

  const queue = getQueue(interaction.guildId);
  if (!queue || !queue.current) return reply(infoEmbed('Сейчас ничего не играет.'));
  if (!memberInSameVoice(interaction.member, queue)) {
    return reply(errorEmbed('Зайди в голосовой канал с ботом, чтобы управлять музыкой.'));
  }

  const action = interaction.customId.slice('music:'.length);
  if (action === 'toggle') {
    if (queue.isPaused()) {
      queue.resume();
      return reply(infoEmbed('Продолжаю.'));
    }
    queue.pause();
    return reply(infoEmbed('Пауза.'));
  }
  if (action === 'skip') {
    const title = queue.current.title;
    queue.skip();
    return reply(infoEmbed(`Пропущено: **${title}**`));
  }
  if (action === 'stop') {
    queue.destroy();
    return reply(infoEmbed('Остановлено, очередь очищена, вышел из канала.'));
  }
});

// Пустой голосовой канал: пауза сразу, выход через 5 минут (queue.onChannelEmpty).
client.on('voiceStateUpdate', (oldState, newState) => {
  const queue = getQueue(oldState.guild.id);
  if (!queue) return;
  const channelId = queue.voiceChannel.id;
  if (oldState.channelId !== channelId && newState.channelId !== channelId) return;
  const channel = oldState.guild.channels.cache.get(channelId);
  if (!channel) return;
  const humans = channel.members.filter((m) => !m.user.bot).size;
  if (humans === 0) queue.onChannelEmpty();
  else queue.onChannelActive();
});

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

// Аккуратное выключение: docker stop / systemd шлют SIGTERM — гасим очереди
// (ffmpeg-процессы, голосовые соединения), затем закрываем клиент.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Получен ${signal}, выключаюсь...`);
  try {
    destroyAll();
  } catch {}
  try {
    await client.destroy();
  } catch {}
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

(async () => {
  await initSources();
  await client.login(config.token);
})();
