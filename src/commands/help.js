const config = require('../config');

module.exports = {
  name: 'help',
  aliases: ['h', 'commands'],
  description: 'Список команд',
  usage: 'help',
  async execute(message) {
    // Берём список лениво, чтобы избежать циклической зависимости.
    const { list } = require('./index');
    const p = config.prefix;
    const lines = ['**🎵 Команды бота:**'];
    for (const cmd of list) {
      const aliases = cmd.aliases?.length ? ` _(${cmd.aliases.join(', ')})_` : '';
      lines.push(`\`${p}${cmd.usage || cmd.name}\`${aliases} — ${cmd.description}`);
    }
    return message.reply(lines.join('\n'));
  },
};
