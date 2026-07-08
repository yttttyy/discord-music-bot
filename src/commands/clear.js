const { getQueue } = require('../queue');

module.exports = {
  name: 'clear',
  aliases: ['clr'],
  description: 'Очистить очередь целиком или убрать N ближайших треков (текущий не трогает)',
  usage: 'clear [N]',
  async execute(message, args) {
    const queue = getQueue(message.guild.id);
    if (!queue || queue.tracks.length === 0) {
      return message.reply('📭 Очередь и так пуста.');
    }

    if (args[0] !== undefined) {
      const n = Number(args[0]);
      if (!Number.isInteger(n) || n <= 0) {
        return message.reply('❓ Укажи положительное целое число, напр. `clear 10`.');
      }
      const removed = queue.removeFromQueue(n);
      return message.reply(`🗑️ Убрал **${removed}** трек(ов) из очереди. Осталось: **${queue.tracks.length}**.`);
    }

    const removed = queue.clear();
    return message.reply(`🧹 Очередь очищена (**${removed}** трек(ов)). Текущий трек продолжает играть.`);
  },
};
