const { getQueue } = require('../queue');
const { infoEmbed } = require('../embeds');
const { inSameVoice } = require('../utils');

module.exports = {
  name: 'loop',
  aliases: ['repeat'],
  description: 'Включить/выключить повтор текущего трека',
  usage: 'loop',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return message.reply({ embeds: [infoEmbed('🤷 Сейчас ничего не играет.')] });
    }
    if (!inSameVoice(message, queue)) return;
    queue.loop = !queue.loop;
    return message.reply({
      embeds: [infoEmbed(queue.loop ? '🔁 Повтор включён.' : '➡️ Повтор выключен.')],
    });
  },
};
