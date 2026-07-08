const { getQueue } = require('../queue');
const { formatDuration } = require('../sources');

module.exports = {
  name: 'queue',
  aliases: ['list', 'q'],
  description: 'Показать очередь треков',
  usage: 'queue',
  async execute(message) {
    const queue = getQueue(message.guild.id);
    if (!queue || (!queue.current && queue.tracks.length === 0)) {
      return message.reply('📭 Очередь пуста.');
    }

    const lines = [];
    if (queue.current) {
      lines.push(`🎶 **Сейчас играет:** ${queue.current.title} \`(${formatDuration(queue.current.duration)})\``);
      if (queue.loop) lines.push('🔁 Повтор включён');
      lines.push('');
    }

    if (queue.tracks.length) {
      lines.push('**Далее в очереди:**');
      const shown = queue.tracks.slice(0, 10);
      shown.forEach((t, i) => {
        lines.push(`\`${i + 1}.\` ${t.title} \`(${formatDuration(t.duration)})\``);
      });
      if (queue.tracks.length > 10) {
        lines.push(`…и ещё **${queue.tracks.length - 10}** треков`);
      }
    } else {
      lines.push('_В очереди больше ничего нет._');
    }

    return message.reply(lines.join('\n'));
  },
};
