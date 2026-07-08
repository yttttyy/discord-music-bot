const { getQueue } = require('../queue');

module.exports = {
  name: 'skip',
  aliases: ['s', 'next'],
  description: 'Пропустить текущий трек',
  usage: 'skip',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return message.reply('🤷 Сейчас ничего не играет.');
    }
    const title = queue.current.title;
    queue.skip();
    return message.reply(`⏭️ Пропущено: **${title}**`);
  },
};
