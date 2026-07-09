const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
  return new EmbedBuilder().setColor(COLORS.error).setDescription(text);
}

function nowPlayingEmbed(track, { loop = false, elapsed = null } = {}) {
  const time =
    elapsed == null ? formatDuration(track.duration) : `${formatDuration(elapsed)} / ${formatDuration(track.duration)}`;
  const embed = new EmbedBuilder()
    .setColor(COLORS.playing)
    .setAuthor({ name: 'Сейчас играет' })
    .setTitle(track.title)
    .addFields(
      { name: 'Длительность', value: `\`${time}\``, inline: true },
      { name: 'Заказал', value: track.requestedBy || '—', inline: true }
    );
  if (track.url) embed.setURL(track.url);
  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  if (loop) embed.addFields({ name: 'Режим', value: 'Повтор', inline: true });
  return embed;
}

// Один трек добавлен в очередь (position — его номер в очереди, 1-based).
function addedEmbed(track, position) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setAuthor({ name: 'Добавлено в очередь' })
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
  return successEmbed(`Добавил **${count}** треков в очередь.`);
}

function queueEmbed(queue, page = 1) {
  const perPage = 10;
  const total = queue.tracks.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);

  const embed = new EmbedBuilder().setColor(COLORS.playing).setTitle('Очередь');

  const lines = [];
  if (queue.current) {
    const loopMark = queue.loop ? ' — повтор' : '';
    const time = `${formatDuration(queue.elapsedSeconds())} / ${formatDuration(queue.current.duration)}`;
    lines.push(`**Сейчас играет:** ${queue.current.title} \`(${time})\`${loopMark}`);
    if (queue.current.thumbnail) embed.setThumbnail(queue.current.thumbnail);
    lines.push('');
  }

  if (total) {
    lines.push('**Далее:**');
    const start = (p - 1) * perPage;
    queue.tracks.slice(start, start + perPage).forEach((t, i) => {
      lines.push(`\`${start + i + 1}.\` ${t.title} \`(${formatDuration(t.duration)})\``);
    });
  } else {
    lines.push('_В очереди больше ничего нет._');
  }
  embed.setDescription(lines.join('\n'));

  const known = queue.tracks.filter((t) => Number.isFinite(t.duration));
  const sum = known.reduce((s, t) => s + t.duration, 0);
  const parts = [`Страница ${p}/${pages}`, `всего: ${total}`];
  if (known.length) parts.push(formatDuration(sum));
  if (queue.radio) parts.push('радио');
  embed.setFooter({ text: parts.join(' · ') });
  return embed;
}

// Кнопки управления под «Сейчас играет» (customId обрабатывается в index.js).
function controlButtons(paused = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music:toggle')
      .setLabel(paused ? 'Продолжить' : 'Пауза')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music:skip').setLabel('Скип').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music:stop').setLabel('Стоп').setStyle(ButtonStyle.Secondary)
  );
}

function helpEmbed(list, prefix) {
  const lines = list.map((cmd) => {
    const aliases = cmd.aliases?.length ? ` _(${cmd.aliases.join(', ')})_` : '';
    return `\`${prefix}${cmd.usage || cmd.name}\`${aliases} — ${cmd.description}`;
  });
  return new EmbedBuilder().setColor(COLORS.info).setTitle('Команды бота').setDescription(lines.join('\n'));
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
  controlButtons,
};
