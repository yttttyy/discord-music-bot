const { EmbedBuilder } = require('discord.js');
const { formatDuration } = require('./sources');

// Единая палитра embed-ов бота.
const COLORS = {
  playing: 0x9b59b6, // фиолетовый — сейчас играет
  success: 0x57f287, // зелёный — добавление в очередь и прочие успехи
  info: 0x5865f2, // blurple — нейтральные статусы
  error: 0xed4245, // красный — ошибки и отказы
};

function infoEmbed(text) {
  return new EmbedBuilder().setColor(COLORS.info).setDescription(text);
}

function successEmbed(text) {
  return new EmbedBuilder().setColor(COLORS.success).setDescription(text);
}

function errorEmbed(text) {
  return new EmbedBuilder().setColor(COLORS.error).setDescription(`⚠️ ${text}`);
}

function nowPlayingEmbed(track, { loop = false } = {}) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.playing)
    .setAuthor({ name: '🎶 Сейчас играет' })
    .setTitle(track.title)
    .addFields(
      { name: 'Длительность', value: `\`${formatDuration(track.duration)}\``, inline: true },
      { name: 'Заказал', value: track.requestedBy || '—', inline: true }
    );
  if (track.url) embed.setURL(track.url);
  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  if (loop) embed.addFields({ name: 'Режим', value: '🔁 Повтор', inline: true });
  return embed;
}

// Один трек добавлен в очередь (position — его номер в очереди, 1-based).
function addedEmbed(track, position) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setAuthor({ name: '➕ Добавлено в очередь' })
    .setTitle(track.title)
    .addFields(
      { name: 'Длительность', value: `\`${formatDuration(track.duration)}\``, inline: true },
      { name: 'Позиция', value: `\`#${position}\``, inline: true }
    );
  if (track.url) embed.setURL(track.url);
  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  return embed;
}

function addedManyEmbed(count) {
  return successEmbed(`➕ Добавил **${count}** треков в очередь.`);
}

function queueEmbed(queue) {
  const embed = new EmbedBuilder().setColor(COLORS.playing).setTitle('📜 Очередь');

  const lines = [];
  if (queue.current) {
    const loopMark = queue.loop ? ' 🔁' : '';
    lines.push(`**Сейчас играет:** ${queue.current.title} \`(${formatDuration(queue.current.duration)})\`${loopMark}`);
    lines.push('');
  }

  if (queue.tracks.length) {
    lines.push('**Далее:**');
    queue.tracks.slice(0, 10).forEach((t, i) => {
      lines.push(`\`${i + 1}.\` ${t.title} \`(${formatDuration(t.duration)})\``);
    });
    if (queue.tracks.length > 10) lines.push(`…и ещё **${queue.tracks.length - 10}**`);
  } else {
    lines.push('_В очереди больше ничего нет._');
  }
  embed.setDescription(lines.join('\n'));

  const known = queue.tracks.filter((t) => Number.isFinite(t.duration));
  const total = known.reduce((sum, t) => sum + t.duration, 0);
  embed.setFooter({
    text: `Всего в очереди: ${queue.tracks.length}` + (known.length ? ` · ${formatDuration(total)}` : ''),
  });
  return embed;
}

function helpEmbed(list, prefix) {
  const lines = list.map((cmd) => {
    const aliases = cmd.aliases?.length ? ` _(${cmd.aliases.join(', ')})_` : '';
    return `\`${prefix}${cmd.usage || cmd.name}\`${aliases} — ${cmd.description}`;
  });
  return new EmbedBuilder().setColor(COLORS.info).setTitle('🎵 Команды бота').setDescription(lines.join('\n'));
}

module.exports = {
  COLORS,
  infoEmbed,
  successEmbed,
  errorEmbed,
  nowPlayingEmbed,
  addedEmbed,
  addedManyEmbed,
  queueEmbed,
  helpEmbed,
};
