const { getQueue } = require('../queue');
const { infoEmbed } = require('../embeds');
const { inSameVoice } = require('../utils');

module.exports = {
  name: 'resume',
  aliases: ['unpause'],
  description: 'Продолжить воспроизведение',
  usage: 'resume',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return message.reply({ embeds: [infoEmbed('Сейчас ничего не играет.')] });
    }
    if (!inSameVoice(message, queue)) return;
    queue.resume();
    return message.reply({ embeds: [infoEmbed('Продолжаю.')] });
  },
};
