const { getQueue } = require('../queue');

module.exports = {
  name: 'stop',
  aliases: ['leave', 'disconnect', 'dc'],
  description: 'Остановить музыку, очистить очередь и выйти из канала',
  usage: 'stop',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue) {
      return message.reply('🤷 Я и так не в канале.');
    }
    queue.destroy();
    return message.reply('⏹️ Остановлено, очередь очищена, вышел из канала.');
  },
};
