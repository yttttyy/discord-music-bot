const { getQueue } = require('../queue');
const { infoEmbed } = require('../embeds');
const { inSameVoice } = require('../utils');

// Слова-аргументы для режима «вся очередь».
const ALL_WORDS = ['all', 'queue', 'все', 'всё', 'очередь'];

module.exports = {
  name: 'loop',
  aliases: ['repeat', 'луп', 'л'],
  description: 'Повтор текущего трека; loop all — повтор всей очереди по кругу',
  usage: 'loop [all]',
  async execute(message, args) {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return message.reply({ embeds: [infoEmbed('Сейчас ничего не играет.')] });
    }
    if (!inSameVoice(message, queue)) return;

    const wantAll = ALL_WORDS.includes(args[0]?.toLowerCase());
    if (wantAll) {
      queue.loop = queue.loop === 'queue' ? false : 'queue';
      return message.reply({
        embeds: [
          infoEmbed(
            queue.loop
              ? 'Повтор очереди включён — треки будут крутиться по кругу.'
              : 'Повтор выключен.'
          ),
        ],
      });
    }

    queue.loop = queue.loop === 'track' ? false : 'track';
    return message.reply({
      embeds: [infoEmbed(queue.loop ? 'Повтор трека включён.' : 'Повтор выключен.')],
    });
  },
};
