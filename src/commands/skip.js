const { getQueue } = require('../queue');
const { infoEmbed } = require('../embeds');
const { inSameVoice } = require('../utils');

module.exports = {
  name: 'skip',
  aliases: ['s', 'next'],
  description: 'Пропустить текущий трек',
  usage: 'skip',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return message.reply({ embeds: [infoEmbed('🤷 Сейчас ничего не играет.')] });
    }
    if (!inSameVoice(message, queue)) return;
    const title = queue.current.title;
    queue.skip();
    return message.reply({ embeds: [infoEmbed(`⏭️ Пропущено: **${title}**`)] });
  },
};
