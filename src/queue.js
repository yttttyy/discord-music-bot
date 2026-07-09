const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const { ActivityType } = require('discord.js');
const { getStream, ensureResolved, fetchMix, extractVideoId } = require('./sources');
const { nowPlayingEmbed, infoEmbed, errorEmbed, controlButtons } = require('./embeds');
const { getSetting } = require('./settings');

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
    this._advanceWithoutLoop = false; // разово подавить повтор (skip / ошибка трека)
    this.radio = false; // бесконечное радио: доливать похожие треки
    this._radioSeen = new Set(); // videoId всего, что уже было в очереди
    this._radioRefilling = false;
    this._lastVideoId = null; // затравка для следующего долива радио
    this._autoPaused = false; // пауза из-за пустого канала (не ручная)
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
    // Это ЕДИНСТВЕННАЯ точка продвижения очереди по событиям плеера.
    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.destroyed) return;
      if (this.loop && this.current && !this._advanceWithoutLoop) {
        this.tracks.unshift(this.current);
      }
      this._advanceWithoutLoop = false;
      this.current = null;
      this._processQueue();
    });

    this.player.on('error', (error) => {
      console.error(`Ошибка плеера [${this.guildId}]:`, error.message);
      this._send(errorEmbed('Ошибка при воспроизведении трека, пропускаю.'));
      // Очередь не трогаем: после error плеер уходит в Idle, и продвижение
      // случится там ровно один раз (иначе error+Idle снимали бы два трека).
      // Повтор подавляем, чтобы битый трек не крутился бесконечно.
      this._advanceWithoutLoop = true;
      this.player.stop(true);
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
      // Очередь пуста — таймер на выход из канала; статус бота сбрасываем.
      this._setActivity(null);
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

      const vid = next.videoId || extractVideoId(next.url);
      if (vid) {
        this._lastVideoId = vid; // радио доливает микс от последнего сыгранного
        this._radioSeen.add(vid);
      }
      this._setActivity(next.title);

      const buttons = getSetting(this.guildId, 'buttons', true);
      this._send(nowPlayingEmbed(next, { loop: this.loop }), buttons ? [controlButtons(false)] : undefined);

      this._prefetchNext(); // пока играет текущий — заранее резолвим следующий
      if (this.radio && this.tracks.length <= GuildQueue.RADIO_REFILL_AT) this._refillRadio();
    } catch (err) {
      console.error('Не удалось запустить трек:', err.message);
      this._send(errorEmbed(`Не удалось воспроизвести **${next.title}**, пропускаю.`));
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

  // Включить радио: помечаем уже заочередённые треки, чтобы долив их не дублировал.
  enableRadio(seedTracks = []) {
    this.radio = true;
    for (const t of seedTracks) if (t.videoId) this._radioSeen.add(t.videoId);
  }

  // Долив радио: когда очередь худеет, в фоне тянем ещё похожих треков
  // (Mix от последнего сыгранного, без повторов благодаря _radioSeen).
  async _refillRadio() {
    if (this._radioRefilling || this.destroyed || !this._lastVideoId) return;
    this._radioRefilling = true;
    try {
      const added = await fetchMix(this._lastVideoId, 'радио', { exclude: this._radioSeen });
      if (this.destroyed || !this.radio) return;
      for (const t of added) if (t.videoId) this._radioSeen.add(t.videoId);
      if (added.length) {
        this.enqueue(added);
        this._send(infoEmbed(`Радио: добавил ещё ${added.length} треков.`));
        // Если очередь успела кончиться, пока тянули микс, — запускаем сами.
        if (!this.current) await this._processQueue();
      }
    } catch (e) {
      console.error(`Радио [${this.guildId}]: не удалось долить треки:`, e.message);
    } finally {
      this._radioRefilling = false;
    }
  }

  skip() {
    if (!this.current) return;
    // Глушим старый ffmpeg ДО старта следующего, иначе его остаточные
    // буферизованные кадры могут «вылезти» микрозвуком после паузы.
    this._killProcess();
    this.currentResource = null;
    // skip должен уводить к СЛЕДУЮЩЕМУ треку даже при включённом loop.
    this._advanceWithoutLoop = true;
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

  // Переставить трек с позиции from на позицию to (1-based).
  // Возвращает переставленный трек или null при неверных границах.
  moveTrack(from, to) {
    const len = this.tracks.length;
    if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
    if (from < 1 || from > len || to < 1 || to > len) return null;
    const [t] = this.tracks.splice(from - 1, 1);
    this.tracks.splice(to - 1, 0, t);
    this._prefetchNext(); // ближайшие треки могли смениться
    return t;
  }

  pause() {
    return this.player.pause();
  }

  resume() {
    return this.player.unpause();
  }

  isPaused() {
    return this.player.state.status === AudioPlayerStatus.Paused;
  }

  // Сколько секунд трека уже проиграно (пауза не тикает).
  elapsedSeconds() {
    return this.currentResource ? Math.floor(this.currentResource.playbackDuration / 1000) : 0;
  }

  // Статус бота в Discord. Он глобальный: при игре в нескольких гильдиях
  // показывается последний запущенный трек — осознанное упрощение.
  _setActivity(title) {
    try {
      const user = this.textChannel?.client?.user;
      if (!user) return;
      if (title) user.setActivity(title, { type: ActivityType.Listening });
      else user.setPresence({ activities: [] });
    } catch {}
  }

  // --- Пустой голосовой канал: пауза сразу, выход через 5 минут. ---

  onChannelEmpty() {
    if (this.destroyed) return;
    this._cancelEmptyTimer();
    if (this.current && !this.isPaused()) {
      this._autoPaused = true; // ручную паузу пользователя не трогаем при возврате
      this.pause();
      this._send(infoEmbed('В канале никого нет — пауза.'));
    }
    this._emptyTimer = setTimeout(() => {
      this._send(infoEmbed('В канале никого нет уже 5 минут, выхожу.'));
      this.destroy();
    }, GuildQueue.EMPTY_CHANNEL_LEAVE_MS);
  }

  onChannelActive() {
    this._cancelEmptyTimer();
    if (this._autoPaused) {
      this._autoPaused = false;
      if (this.current) {
        this.resume();
        this._send(infoEmbed('Продолжаю.'));
      }
    }
  }

  _cancelEmptyTimer() {
    if (this._emptyTimer) {
      clearTimeout(this._emptyTimer);
      this._emptyTimer = null;
    }
  }

  // Перемешать очередь (Фишер–Йейтс). Возвращает количество треков.
  shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
    this._prefetchNext(); // ближайшие треки сменились — греем новые
    return this.tracks.length;
  }

  clear() {
    const n = this.tracks.length;
    this.tracks = [];
    return n;
  }

  _scheduleLeave() {
    this._cancelLeave();
    this._leaveTimer = setTimeout(() => {
      this._send(infoEmbed('Очередь пуста уже 10 минут, выхожу из голосового канала.'));
      this.destroy();
    }, 10 * 60_000);
  }

  _send(embed, components) {
    const payload = { embeds: [embed] };
    if (components?.length) payload.components = components;
    this.textChannel?.send(payload).catch(() => {});
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
    this._cancelEmptyTimer();
    this._setActivity(null);
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
// При скольких оставшихся треках радио начинает долив.
GuildQueue.RADIO_REFILL_AT = 3;
// Сколько ждать в пустом голосовом канале перед выходом.
GuildQueue.EMPTY_CHANNEL_LEAVE_MS = 5 * 60_000;

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
