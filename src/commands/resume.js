const { getQueue } = require('../queue');

module.exports = {
  name: 'resume',
  aliases: ['unpause'],
  description: 'Продолжить воспроизведение',
  usage: 'resume',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return message.reply('🤷 Сейчас ничего не играет.');
    }
    queue.resume();
    return message.reply('▶️ Продолжаю.');
  },
};
