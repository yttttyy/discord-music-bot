const { getQueue } = require('../queue');
const { infoEmbed } = require('../embeds');
const { inSameVoice } = require('../utils');

module.exports = {
  name: 'skip',
  // 'c' — латинская: её часто набирают вместо кириллической «с».
  aliases: ['s', 'next', 'c', 'скип', 'с'],
  description: 'Пропустить текущий трек',
  usage: 'skip',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return message.reply({ embeds: [infoEmbed('Сейчас ничего не играет.')] });
    }
    if (!inSameVoice(message, queue)) return;
    const title = queue.current.title;
    queue.skip();
    return message.reply({ embeds: [infoEmbed(`Пропущено: **${title}**`)] });
  },
};
