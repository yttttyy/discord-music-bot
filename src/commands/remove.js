const { getQueue } = require('../queue');

module.exports = {
  name: 'remove',
  aliases: ['rm'],
  description: 'Удалить трек из очереди по его номеру (как в queue)',
  usage: 'remove <номер>',
  async execute(message, args) {
    const queue = getQueue(message.guild.id);
    if (!queue || queue.tracks.length === 0) {
      return message.reply('📭 Очередь пуста.');
    }

    const pos = Number(args[0]);
    if (!Number.isInteger(pos) || pos < 1) {
      return message.reply('❓ Укажи номер трека из `queue`, напр. `remove 3`.');
    }

    const removed = queue.removeAt(pos);
    if (!removed) {
      return message.reply(`🤷 В очереди нет трека под номером **${pos}** (всего: ${queue.tracks.length}).`);
    }
    return message.reply(`🗑️ Удалил из очереди **#${pos}**: **${removed.title}**`);
  },
};
