const { getQueue } = require('../queue');
const { infoEmbed, nowPlayingEmbed } = require('../embeds');

module.exports = {
  name: 'nowplaying',
  aliases: ['np', 'current', 'чтощас', 'нп', 'щас'],
  description: 'Показать текущий трек',
  usage: 'nowplaying',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return message.reply({ embeds: [infoEmbed('Сейчас ничего не играет.')] });
    }
    return message.reply({ embeds: [nowPlayingEmbed(queue.current, { loop: queue.loop })] });
  },
};
