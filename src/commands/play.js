const { resolveQuery, formatDuration } = require('../sources');
const { getQueue, createQueue } = require('../queue');

module.exports = {
  name: 'play',
  aliases: ['p'],
  description: 'Воспроизвести трек по ссылке (YouTube/Spotify) или названию',
  usage: 'play <ссылка или название>',
  async execute(message, args) {
    const query = args.join(' ').trim();
    if (!query) {
      return message.reply('❓ Укажи ссылку или название трека. Пример: `play never gonna give you up`');
    }

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply('🔊 Сначала зайди в голосовой канал.');
    }

    const perms = voiceChannel.permissionsFor(message.guild.members.me);
    if (!perms.has('Connect') || !perms.has('Speak')) {
      return message.reply('🚫 У меня нет прав подключаться или говорить в этом канале.');
    }

    const loading = await message.reply('🔎 Ищу...');

    let tracks;
    try {
      tracks = await resolveQuery(query, message.author.tag);
    } catch (err) {
      return loading.edit(`⚠️ ${err.message}`);
    }

    if (!tracks.length) {
      return loading.edit('😕 Ничего не нашёл по этому запросу.');
    }

    let queue = getQueue(message.guild.id);
    if (!queue) {
      queue = createQueue(message.guild.id, voiceChannel, message.channel);
    }

    queue.enqueue(tracks);

    if (tracks.length === 1) {
      const t = tracks[0];
      await loading.edit(
        queue.current
          ? `➕ В очередь: **${t.title}** \`(${formatDuration(t.duration)})\``
          : `▶️ Запускаю: **${t.title}** \`(${formatDuration(t.duration)})\``
      );
    } else {
      await loading.edit(`➕ Добавил **${tracks.length}** треков в очередь.`);
    }

    await queue.start();
  },
};
