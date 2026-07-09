const { getQueue } = require('../queue');
const { infoEmbed, queueEmbed } = require('../embeds');

module.exports = {
  name: 'queue',
  aliases: ['list', 'q', 'лист', 'й', 'очередь'],
  description: 'Показать очередь треков (по 10 на страницу)',
  usage: 'queue [страница]',
  async execute(message, args) {
    const queue = getQueue(message.guild.id);
    if (!queue || (!queue.current && queue.tracks.length === 0)) {
      return message.reply({ embeds: [infoEmbed('Очередь пуста.')] });
    }
    const page = Number(args[0]) || 1;
    return message.reply({ embeds: [queueEmbed(queue, page)] });
  },
};
