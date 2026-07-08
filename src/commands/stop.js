const { getQueue } = require('../queue');
const { infoEmbed } = require('../embeds');
const { inSameVoice } = require('../utils');

module.exports = {
  name: 'stop',
  aliases: ['leave', 'disconnect', 'dc', 'конец', 'стоп', 'к', 'лив'],
  description: 'Остановить музыку, очистить очередь и выйти из канала',
  usage: 'stop',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue) {
      return message.reply({ embeds: [infoEmbed('Я и так не в канале.')] });
    }
    if (!inSameVoice(message, queue)) return;
    queue.destroy();
    return message.reply({ embeds: [infoEmbed('Остановлено, очередь очищена, вышел из канала.')] });
  },
};
