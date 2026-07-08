const { resolveQuery, formatDuration } = require('../sources');
const { getQueue, createQueue } = require('../queue');
const { infoEmbed, errorEmbed, addedEmbed, addedManyEmbed } = require('../embeds');
const { inSameVoice } = require('../utils');

module.exports = {
  name: 'play',
  aliases: ['p'],
  description: 'Воспроизвести трек по ссылке (YouTube/Spotify) или названию',
  usage: 'play <ссылка или название>',
  async execute(message, args) {
    const query = args.join(' ').trim();
    if (!query) {
      return message.reply({
        embeds: [errorEmbed('Укажи ссылку или название трека. Пример: `play never gonna give you up`')],
      });
    }

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply({ embeds: [errorEmbed('Сначала зайди в голосовой канал.')] });
    }

    // Если бот уже играет в другом канале — добавлять туда треки нельзя.
    const existing = getQueue(message.guild.id);
    if (existing && !inSameVoice(message, existing)) return;

    const perms = voiceChannel.permissionsFor(message.guild.members.me);
    if (!perms.has('Connect') || !perms.has('Speak')) {
      return message.reply({ embeds: [errorEmbed('У меня нет прав подключаться или говорить в этом канале.')] });
    }

    const loading = await message.reply({ embeds: [infoEmbed('🔎 Ищу...')] });

    let tracks;
    try {
      tracks = await resolveQuery(query, message.author.tag);
    } catch (err) {
      return loading.edit({ embeds: [errorEmbed(err.message)] });
    }

    if (!tracks.length) {
      return loading.edit({ embeds: [infoEmbed('😕 Ничего не нашёл по этому запросу.')] });
    }

    // Пока шёл поиск, бот мог выйти из канала (!stop / авто-выход) — перечитываем.
    let queue = getQueue(message.guild.id);
    if (!queue) {
      queue = createQueue(message.guild.id, voiceChannel, message.channel);
    }

    queue.enqueue(tracks);

    if (tracks.length === 1) {
      const t = tracks[0];
      await loading.edit({
        embeds: [
          queue.current
            ? addedEmbed(t, queue.tracks.length)
            : infoEmbed(`▶️ Запускаю: **${t.title}** \`(${formatDuration(t.duration)})\``),
        ],
      });
    } else {
      await loading.edit({ embeds: [addedManyEmbed(tracks.length)] });
    }

    await queue.start();
  },
};
