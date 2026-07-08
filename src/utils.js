const { errorEmbed } = require('./embeds');

// Управлять музыкой (skip/stop/pause/...) может только тот, кто сидит
// в одном голосовом канале с ботом. Возвращает true, если проверка пройдена,
// иначе сам отвечает отказом.
function inSameVoice(message, queue) {
  const userChannel = message.member?.voice?.channel;
  if (userChannel && userChannel.id === queue.voiceChannel.id) return true;
  message
    .reply({ embeds: [errorEmbed('Зайди в голосовой канал с ботом, чтобы управлять музыкой.')] })
    .catch(() => {});
  return false;
}

module.exports = { inSameVoice };
