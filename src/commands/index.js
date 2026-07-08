const fs = require('fs');
const path = require('path');

// Загружаем все команды из этой папки и строим карту имя/алиас -> команда.
const commands = new Map();
const list = [];

for (const file of fs.readdirSync(__dirname)) {
  if (file === 'index.js' || !file.endsWith('.js')) continue;
  const cmd = require(path.join(__dirname, file));
  if (!cmd.name || typeof cmd.execute !== 'function') continue;
  list.push(cmd);
  commands.set(cmd.name, cmd);
  for (const alias of cmd.aliases || []) commands.set(alias, cmd);
}

module.exports = { commands, list };
