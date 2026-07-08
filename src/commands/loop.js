const { getQueue } = require('../queue');

module.exports = {
  name: 'loop',
  aliases: ['repeat'],
  description: 'Включить/выключить повтор текущего трека',
  usage: 'loop',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return message.reply('🤷 Сейчас ничего не играет.');
    }
    queue.loop = !queue.loop;
    return message.reply(queue.loop ? '🔁 Повтор включён.' : '➡️ Повтор выключен.');
  },
};
