const config = require('../config');
const { helpEmbed } = require('../embeds');

module.exports = {
  name: 'help',
  aliases: ['h', 'commands', 'хелп', 'х', 'команды'],
  description: 'Список команд',
  usage: 'help',
  async execute(message) {
    // Берём список лениво, чтобы избежать циклической зависимости.
    const { list } = require('./index');
    return message.reply({ embeds: [helpEmbed(list, config.prefix)] });
  },
};
