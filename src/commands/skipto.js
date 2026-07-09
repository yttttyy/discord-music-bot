const { getQueue } = require('../queue');
const { infoEmbed, errorEmbed } = require('../embeds');
const { inSameVoice } = require('../utils');

module.exports = {
  name: 'skipto',
  aliases: ['jump', 'прыг'],
  description: 'Пропустить всё до трека с указанным номером и сыграть его',
  usage: 'skipto <номер>',
  async execute(message, args) {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return message.reply({ embeds: [infoEmbed('Сейчас ничего не играет.')] });
    }
    if (!inSameVoice(message, queue)) return;

    const pos = Number(args[0]);
    if (!Number.isInteger(pos) || pos < 1 || pos > queue.tracks.length) {
      return message.reply({
        embeds: [errorEmbed(`Укажи номер трека из \`queue\` (1–${queue.tracks.length || '—'}).`)],
      });
    }

    const target = queue.tracks[pos - 1];
    queue.removeFromQueue(pos - 1); // выбрасываем всё перед целью
    queue.skip();
    return message.reply({ embeds: [infoEmbed(`Прыгаю к **#${pos}**: **${target.title}**`)] });
  },
};
