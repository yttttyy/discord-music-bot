const { resolveRadio } = require('../sources');
const { getQueue, createQueue } = require('../queue');
const { infoEmbed, errorEmbed, successEmbed } = require('../embeds');
const { inSameVoice } = require('../utils');

module.exports = {
  name: 'radio',
  aliases: ['радио', 'р'],
  description: 'Бесконечное радио: очередь сама пополняется похожими треками; radio без аргументов — выключить',
  usage: 'radio <ссылка или название>',
  async execute(message, args) {
    const query = args.join(' ').trim();
    if (!query) {
      // Без аргументов — выключатель активного радио.
      const queue = getQueue(message.guild.id);
      if (queue?.radio) {
        if (!inSameVoice(message, queue)) return;
        queue.radio = false;
        return message.reply({ embeds: [infoEmbed('Радио выключено — очередь доиграет и остановится.')] });
      }
      return message.reply({
        embeds: [errorEmbed('Укажи ссылку или название трека-затравки. Пример: `radio never gonna give you up`')],
      });
    }

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply({ embeds: [errorEmbed('Сначала зайди в голосовой канал.')] });
    }

    const existing = getQueue(message.guild.id);
    if (existing && !inSameVoice(message, existing)) return;

    const perms = voiceChannel.permissionsFor(message.guild.members.me);
    if (!perms.has('Connect') || !perms.has('Speak')) {
      return message.reply({ embeds: [errorEmbed('У меня нет прав подключаться или говорить в этом канале.')] });
    }

    const loading = await message.reply({ embeds: [infoEmbed('Ищу похожие треки...')] });

    let seed, tracks;
    try {
      ({ seed, tracks } = await resolveRadio(query, message.author.tag));
    } catch (err) {
      return loading.edit({ embeds: [errorEmbed(err.message)] });
    }

    let queue = getQueue(message.guild.id);
    if (!queue) {
      queue = createQueue(message.guild.id, voiceChannel, message.channel);
    }

    queue.enqueue(tracks);
    queue.enableRadio(tracks);
    await loading.edit({
      embeds: [
        successEmbed(
          `Радио: **${tracks.length}** треков по мотивам **${seed.title}**. Очередь будет пополняться сама; \`radio\` без аргументов — выключить.`
        ),
      ],
    });

    await queue.start();
  },
};
