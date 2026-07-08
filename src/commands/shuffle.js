const { getQueue } = require('../queue');
const { infoEmbed, successEmbed } = require('../embeds');
const { inSameVoice } = require('../utils');

module.exports = {
  name: 'shuffle',
  aliases: ['sh', 'шафл', 'ш'],
  description: 'Перемешать очередь (текущий трек не трогает)',
  usage: 'shuffle',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || queue.tracks.length < 2) {
      return message.reply({ embeds: [infoEmbed('В очереди слишком мало треков, чтобы перемешивать.')] });
    }
    if (!inSameVoice(message, queue)) return;
    const n = queue.shuffle();
    return message.reply({ embeds: [successEmbed(`Перемешал **${n}** трек(ов).`)] });
  },
};
