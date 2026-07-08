const { getQueue } = require('../queue');
const { infoEmbed, queueEmbed } = require('../embeds');

module.exports = {
  name: 'queue',
  aliases: ['list', 'q', 'лист', 'й', 'очередь'],
  description: 'Показать очередь треков',
  usage: 'queue',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || (!queue.current && queue.tracks.length === 0)) {
      return message.reply({ embeds: [infoEmbed('Очередь пуста.')] });
    }
    return message.reply({ embeds: [queueEmbed(queue)] });
  },
};
