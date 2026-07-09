const { getQueue } = require('../queue');
const { infoEmbed, errorEmbed, successEmbed } = require('../embeds');
const { inSameVoice } = require('../utils');

module.exports = {
  name: 'move',
  aliases: ['mv', 'переставить'],
  description: 'Переставить трек в очереди с одной позиции на другую',
  usage: 'move <откуда> <куда>',
  async execute(message, args) {
    const queue = getQueue(message.guild.id);
    if (!queue || queue.tracks.length < 2) {
      return message.reply({ embeds: [infoEmbed('В очереди слишком мало треков для перестановки.')] });
    }
    if (!inSameVoice(message, queue)) return;

    const from = Number(args[0]);
    const to = Number(args[1]);
    const moved = queue.moveTrack(from, to);
    if (!moved) {
      return message.reply({
        embeds: [errorEmbed(`Укажи две позиции из \`queue\` (1–${queue.tracks.length}), напр. \`move 5 1\`.`)],
      });
    }
    return message.reply({ embeds: [successEmbed(`Переместил **${moved.title}**: #${from} → #${to}.`)] });
  },
};
