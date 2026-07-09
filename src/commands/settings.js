const { PermissionFlagsBits } = require('discord.js');
const { getSetting, setSetting } = require('../settings');
const { infoEmbed, errorEmbed, successEmbed } = require('../embeds');

module.exports = {
  name: 'settings',
  aliases: ['настройки'],
  description: 'Настройки бота на сервере: settings buttons on|off',
  usage: 'settings [buttons on|off]',
  async execute(message, args) {
    if (!args.length) {
      const buttons = getSetting(message.guild.id, 'buttons', true);
      return message.reply({
        embeds: [
          infoEmbed(`Кнопки управления: **${buttons ? 'вкл' : 'выкл'}**\nИзменить: \`settings buttons on|off\``),
        ],
      });
    }

    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply({
        embeds: [errorEmbed('Менять настройки могут только участники с правом «Управление сервером».')],
      });
    }

    const key = args[0]?.toLowerCase();
    const value = args[1]?.toLowerCase();
    if ((key === 'buttons' || key === 'кнопки') && ['on', 'off', 'вкл', 'выкл'].includes(value)) {
      const on = value === 'on' || value === 'вкл';
      setSetting(message.guild.id, 'buttons', on);
      return message.reply({ embeds: [successEmbed(`Кнопки управления: **${on ? 'вкл' : 'выкл'}**.`)] });
    }

    return message.reply({ embeds: [errorEmbed('Не понял. Пример: `settings buttons off`')] });
  },
};
