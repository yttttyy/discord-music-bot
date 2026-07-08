const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const { getStream, ensureResolved } = require('./sources');

// Очередь и плеер для одного сервера (гильдии).
class GuildQueue {
  constructor(guildId, voiceChannel, textChannel) {
    this.guildId = guildId;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.tracks = [];
    this.current = null;
    this.currentProcess = null; // дочерний процесс yt-dlp текущего трека
    this.loop = false; // повтор текущего трека
    this.destroyed = false;

    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    this.player = createAudioPlayer();
    this.connection.subscribe(this.player);

    this._wireEvents();
  }

  _wireEvents() {
    // Когда трек закончился — играем следующий.
    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.destroyed) return;
      if (this.loop && this.current) {
        this.tracks.unshift(this.current);
      }
      this.current = null;
      this._processQueue();
    });

    this.player.on('error', (error) => {
      console.error(`Ошибка плеера [${this.guildId}]:`, error.message);
      this.textChannel?.send('⚠️ Ошибка при воспроизведении трека, пропускаю.').catch(() => {});
      this.current = null;
      this._processQueue();
    });

    // Авто-реконнект при разрыве голосового соединения.
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });
  }

  enqueue(tracks) {
    this.tracks.push(...tracks);
    // Если что-то уже играет — сразу греем следующий трек в фоне,
    // чтобы skip к нему был мгновенным.
    if (this.current) this._prefetchNext();
  }

  async start() {
    if (!this.current) await this._processQueue();
  }

  async _processQueue() {
    if (this.destroyed) return;
    const next = this.tracks.shift();
    if (!next) {
      // Очередь пуста — даём 60 сек, затем выходим из канала.
      this._scheduleLeave();
      return;
    }
    this._cancelLeave();
    this.current = next;
    this._killProcess();

    try {
      await this._resolve(next); // для Spotify-треков ищем YouTube (или берём предзагруженный)
      const { stream, process, type } = getStream(next);
      this.currentProcess = process;
      stream.on('error', (e) => console.error('Ошибка аудиопотока:', e.message));
      // type=OggOpus (ffmpeg напрямую) играет без лишнего перекодирования —
      // чистый проход без inlineVolume. Плавное появление звука делает сам
      // ffmpeg (фильтр afade), без ступенчатого JS-фейда.
      const resource = type ? createAudioResource(stream, { inputType: type }) : createAudioResource(stream);
      this.currentResource = resource;
      this.player.play(resource);
      await entersState(this.player, AudioPlayerStatus.Playing, 15_000);
      this.textChannel?.send(`🎶 Сейчас играет: **${next.title}**`).catch(() => {});
      this._prefetchNext(); // пока играет текущий — заранее резолвим следующий
    } catch (err) {
      console.error('Не удалось запустить трек:', err.message);
      this.textChannel?.send(`⚠️ Не удалось воспроизвести **${next.title}**, пропускаю.`).catch(() => {});
      this.current = null;
      this._processQueue();
    }
  }

  // Резолвит трек, кэшируя промис на нём — так предзагрузка и реальное
  // воспроизведение не запустят поиск дважды.
  _resolve(track) {
    if (track.url && track.streamUrl) return Promise.resolve(track);
    if (!track._resolvePromise) {
      track._resolvePromise = ensureResolved(track).catch((e) => {
        track._resolvePromise = null; // дать шанс повторить при воспроизведении
        throw e;
      });
    }
    return track._resolvePromise;
  }

  // Пока играет текущий трек — заранее (в фоне) греем несколько ближайших
  // треков, чтобы быстрые скипы подряд тоже были мгновенными.
  _prefetchNext() {
    for (const upcoming of this.tracks.slice(0, GuildQueue.PREFETCH_COUNT)) {
      if (!upcoming.streamUrl) this._resolve(upcoming).catch(() => {});
    }
  }

  skip() {
    if (!this.current) return;
    // Глушим старый ffmpeg ДО старта следующего, иначе его остаточные
    // буферизованные кадры могут «вылезти» микрозвуком после паузы.
    this._killProcess();
    this.currentResource = null;
    // stop() переведёт плеер в Idle -> сработает _processQueue (трек уже прогрет).
    // Резкого щелчка нет: следующий трек плавно появляется через ffmpeg afade.
    this.player.stop(true);
  }

  // Убрать N ближайших треков из очереди (не трогая текущий). Возвращает сколько убрано.
  removeFromQueue(n) {
    return this.tracks.splice(0, n).length;
  }

  // Убрать один трек по его позиции в очереди (1-based, как в !queue).
  // Возвращает удалённый трек или null, если позиции нет.
  removeAt(pos) {
    if (!Number.isInteger(pos) || pos < 1 || pos > this.tracks.length) return null;
    return this.tracks.splice(pos - 1, 1)[0];
  }

  pause() {
    return this.player.pause();
  }

  resume() {
    return this.player.unpause();
  }

  clear() {
    const n = this.tracks.length;
    this.tracks = [];
    return n;
  }

  _scheduleLeave() {
    this._cancelLeave();
    this._leaveTimer = setTimeout(() => {
      this.textChannel?.send('👋 Очередь пуста уже 10 минут, выхожу из голосового канала.').catch(() => {});
      this.destroy();
    }, 10 * 60_000);
  }

  _cancelLeave() {
    if (this._leaveTimer) {
      clearTimeout(this._leaveTimer);
      this._leaveTimer = null;
    }
  }

  _killProcess() {
    if (this.currentProcess) {
      try {
        this.currentProcess.kill('SIGKILL');
      } catch {}
      this.currentProcess = null;
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this._cancelLeave();
    this._killProcess();
    this.clear();
    this.current = null;
    try {
      this.player.stop(true);
    } catch {}
    try {
      this.connection.destroy();
    } catch {}
  }
}

// Сколько ближайших треков греть заранее (на случай быстрых скипов подряд).
GuildQueue.PREFETCH_COUNT = 2;

// Менеджер очередей по серверам.
const queues = new Map();

function getQueue(guildId) {
  return queues.get(guildId);
}

function createQueue(guildId, voiceChannel, textChannel) {
  const q = new GuildQueue(guildId, voiceChannel, textChannel);
  // оборачиваем destroy, чтобы убирать из Map
  const originalDestroy = q.destroy.bind(q);
  q.destroy = () => {
    originalDestroy();
    queues.delete(guildId);
  };
  queues.set(guildId, q);
  return q;
}

module.exports = { getQueue, createQueue };
