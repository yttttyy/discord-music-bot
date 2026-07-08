const { getQueue } = require('../queue');
const { infoEmbed } = require('../embeds');
const { inSameVoice } = require('../utils');

module.exports = {
  name: 'pause',
  aliases: [],
  description: 'Поставить воспроизведение на паузу',
  usage: 'pause',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return message.reply({ embeds: [infoEmbed('🤷 Сейчас ничего не играет.')] });
    }
    if (!inSameVoice(message, queue)) return;
    queue.pause();
    return message.reply({ embeds: [infoEmbed('⏸️ Пауза.')] });
  },
};
