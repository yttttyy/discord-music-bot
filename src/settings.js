const fs = require('fs');
const path = require('path');

// Простые пер-серверные настройки в JSON-файле (data/settings.json).
// Сейчас используется один ключ: buttons (кнопки под «Сейчас играет»).
const FILE = path.join(__dirname, '..', 'data', 'settings.json');

let store = {};
try {
  store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {}

function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('Не удалось сохранить настройки:', e.message);
  }
}

function getSetting(guildId, key, def) {
  const v = store[guildId]?.[key];
  return v === undefined ? def : v;
}

function setSetting(guildId, key, value) {
  if (!store[guildId]) store[guildId] = {};
  store[guildId][key] = value;
  save();
}

module.exports = { getSetting, setSetting };
