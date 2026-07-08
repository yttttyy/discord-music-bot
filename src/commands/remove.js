const { getQueue } = require('../queue');
const { infoEmbed, errorEmbed, successEmbed } = require('../embeds');
const { inSameVoice } = require('../utils');

module.exports = {
  name: 'remove',
  aliases: ['rm', 'убрать'],
  description: 'Удалить трек из очереди по его номеру (как в queue)',
  usage: 'remove <номер>',
  async execute(message, args) {
    const queue = getQueue(message.guild.id);
    if (!queue || queue.tracks.length === 0) {
      return message.reply({ embeds: [infoEmbed('Очередь пуста.')] });
    }
    if (!inSameVoice(message, queue)) return;

    const pos = Number(args[0]);
    if (!Number.isInteger(pos) || pos < 1) {
      return message.reply({ embeds: [errorEmbed('Укажи номер трека из `queue`, напр. `remove 3`.')] });
    }

    const removed = queue.removeAt(pos);
    if (!removed) {
      return message.reply({
        embeds: [errorEmbed(`В очереди нет трека под номером **${pos}** (всего: ${queue.tracks.length}).`)],
      });
    }
    return message.reply({ embeds: [successEmbed(`Удалил из очереди **#${pos}**: **${removed.title}**`)] });
  },
};
