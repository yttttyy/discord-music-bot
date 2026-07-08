const { getQueue } = require('../queue');
const { formatDuration } = require('../sources');

module.exports = {
  name: 'nowplaying',
  aliases: ['np', 'current'],
  description: 'Показать текущий трек',
  usage: 'nowplaying',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return message.reply('🤷 Сейчас ничего не играет.');
    }
    const t = queue.current;
    return message.reply(
      `🎶 **${t.title}** \`(${formatDuration(t.duration)})\`\n` +
        `🔗 ${t.url}\n` +
        `🙋 Заказал: ${t.requestedBy}`
    );
  },
};
