const { errorEmbed } = require('./embeds');

// Участник находится в одном голосовом канале с ботом?
function memberInSameVoice(member, queue) {
  const ch = member?.voice?.channel;
  return !!ch && ch.id === queue.voiceChannel.id;
}

// Управлять музыкой (skip/stop/pause/...) может только тот, кто сидит
// в одном голосовом канале с ботом. Возвращает true, если проверка пройдена,
// иначе сам отвечает отказом.
function inSameVoice(message, queue) {
  if (memberInSameVoice(message.member, queue)) return true;
  message
    .reply({ embeds: [errorEmbed('Зайди в голосовой канал с ботом, чтобы управлять музыкой.')] })
    .catch(() => {});
  return false;
}

module.exports = { inSameVoice, memberInSameVoice };
