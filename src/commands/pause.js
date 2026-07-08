const { getQueue } = require('../queue');

module.exports = {
  name: 'pause',
  aliases: [],
  description: 'Поставить воспроизведение на паузу',
  usage: 'pause',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return message.reply('🤷 Сейчас ничего не играет.');
    }
    queue.pause();
    return message.reply('⏸️ Пауза.');
  },
};
