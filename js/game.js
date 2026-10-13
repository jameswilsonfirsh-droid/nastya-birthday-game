"use strict";

const assetRoot = "assets/images/characters/";
const dialogues = [
  {
    speaker: "Настя",
    text: "Вика, что с тобой?",
    target: "characterLeft",
    sprite: "nastya_01_confused.png"
  },
  {
    speaker: "Викутория",
    displayName: "???",
    text: "Кто? Где? Какая Вика? Я Викутория!",
    target: "characterRight",
    sprite: "vikutoria_01_indignant.png"
  },
  {
    speaker: "Настя",
    text: "...Понятно...",
    target: "characterLeft",
    sprite: "nastya_02_done.png"
  },
  {
    speaker: "Викутория",
    text: "Погнали за мной!",
    target: "characterRight",
    sprite: "vikutoria_02_letsgo.png"
  }
];

const charactersLayer = document.getElementById("characters");
const dialogueBox = document.getElementById("dialogue-box");
const speakerElement = document.getElementById("speaker");
const textElement = document.getElementById("dialogue-text");
const nextButton = document.getElementById("next-button");
const characters = document.querySelectorAll("[data-character]");
let dialogueIndex = 0;
let stage = "intro";
// Единый канал фоновой музыки: последовательные fade-out/fade-in без наложения.
const musicTracks = {
  beach: document.getElementById("scene-music"),
  fontaine: document.getElementById("fontaine-music"),
  sumeru: document.getElementById("sumeru-music"),
  liyue: document.getElementById("liyue-music"),
  chenyu: document.getElementById("chenyu-music")
};
const musicToggle = document.getElementById("music-toggle");
const musicGains = new Map();
let musicContext = null;
let currentMusic = null;
let desiredMusic = null;
let musicMuted = false;
let musicSuspended = false;
let musicNeedsGesture = false;
let musicEpoch = 0;
let musicFrame = null;

function setMusicLevel(audio, level) {
  audio.dataset.level = String(level);
  const gain = musicGains.get(audio);
  if (gain) gain.gain.value = level;
  else audio.volume = level;
}

function unlockBackgroundMusic(context) {
  if (musicContext || !context) return;
  musicContext = context;
  for (const audio of Object.values(musicTracks)) {
    try {
      const source = context.createMediaElementSource(audio);
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(context.destination);
      musicGains.set(audio, gain);
    } catch { setMusicLevel(audio, 0); }
    audio.dataset.level = "0";
    // Только подключаем gain: реальные треки запускаются при входе в регион.
  }
}

function cancelMusicFade() {
  musicEpoch += 1;
  if (musicFrame !== null) cancelAnimationFrame(musicFrame);
  musicFrame = null;
  return musicEpoch;
}

function fadeMusic(audio, level, duration, epoch, done = () => {}) {
  const startLevel = Number(audio.dataset.level || 0);
  const started = performance.now();
  const tick = now => {
    if (epoch !== musicEpoch) return;
    const progress = Math.min(1, (now - started) / duration);
    setMusicLevel(audio, startLevel + (level - startLevel) * progress);
    if (progress < 1) musicFrame = requestAnimationFrame(tick);
    else { musicFrame = null; done(); }
  };
  musicFrame = requestAnimationFrame(tick);
}

function playDesiredMusic(epoch) {
  if (epoch !== musicEpoch || !desiredMusic || musicSuspended) return;
  const audio = musicTracks[desiredMusic];
  if (currentMusic !== audio) {
    Object.values(musicTracks).forEach(track => { if (track !== audio) { track.pause(); setMusicLevel(track, 0); } });
    currentMusic = audio;
    audio.currentTime = 0;
    setMusicLevel(audio, 0);
  }
  musicNeedsGesture = false;
  try {
    const playback = audio.play();
    const ready = () => {
      if (epoch !== musicEpoch || musicSuspended || currentMusic !== audio) return;
      fadeMusic(audio, musicMuted ? 0 : .8, 650, epoch);
    };
    if (playback) playback.then(ready).catch(error => {
      if (epoch !== musicEpoch) return;
      musicNeedsGesture = true;
      if (error.name !== "NotAllowedError" && error.name !== "AbortError") console.warn("Не удалось запустить фоновую музыку:", error);
    });
    else ready();
  } catch { musicNeedsGesture = true; }
}

function setRegionMusic(region) {
  if (desiredMusic === region && !musicSuspended && currentMusic === musicTracks[region] && currentMusic && !currentMusic.paused) return;
  desiredMusic = region;
  musicSuspended = false;
  musicNeedsGesture = false;
  musicToggle.hidden = !region;
  const epoch = cancelMusicFade();
  const next = region ? musicTracks[region] : null;
  if (currentMusic && currentMusic !== next && !currentMusic.paused) {
    const previous = currentMusic;
    fadeMusic(previous, 0, 650, epoch, () => {
      previous.pause();
      if (currentMusic === previous) currentMusic = null;
      playDesiredMusic(epoch);
    });
  } else if (next) playDesiredMusic(epoch);
  else if (currentMusic) { currentMusic.pause(); setMusicLevel(currentMusic, 0); currentMusic = null; }
}

function pauseFontaineMusicForWish() {
  musicSuspended = true;
  musicNeedsGesture = false;
  cancelMusicFade();
  Object.values(musicTracks).forEach(audio => { audio.pause(); setMusicLevel(audio, 0); });
  musicToggle.hidden = true;
}

function resumeFontaineMusicAfterWish() {
  musicSuspended = false;
  musicToggle.hidden = false;
  playDesiredMusic(cancelMusicFade());
}

function startSceneMusic() { setRegionMusic("beach"); }
function stopSceneMusic() { setRegionMusic(null); }
function startFontaineMusic() { setRegionMusic("fontaine"); }
function stopFontaineMusic() { setRegionMusic(null); }

musicToggle.addEventListener("click", () => {
  musicMuted = !musicMuted;
  musicToggle.textContent = musicMuted ? "Музыка: выкл." : "Музыка: вкл.";
  musicToggle.setAttribute("aria-pressed", String(musicMuted));
  if (currentMusic && !musicSuspended) {
    if (currentMusic === musicTracks[desiredMusic]) fadeMusic(currentMusic, musicMuted ? 0 : .8, 180, cancelMusicFade());
    else setRegionMusic(desiredMusic);
  }
});

document.addEventListener("click", () => {
  if (musicContext && musicContext.state === "suspended") musicContext.resume().catch(() => {});
  if (musicNeedsGesture && !musicSuspended && isLandscape()) playDesiredMusic(cancelMusicFade());
}, { capture: true });

// Общая защита старых и новых сцен, включая переход между разными кнопками.
let storyLastTap = -Infinity;
document.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button || button.id === "music-toggle") return;
  const now = performance.now();
  if (now - storyLastTap < 300) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  storyLastTap = now;
}, { capture: true });

// Общий renderer для пляжа и последующих диалоговых сцен.
function renderDialogue(sequence = dialogues, index = dialogueIndex, ui = {
  speaker: speakerElement, text: textElement, next: nextButton, characters,
  finalLabel: "Открыть карту путешествия"
}) {
  const dialogue = sequence[index];
  // Меняем только эмоцию говорящего; второй персонаж сохраняет свой спрайт.
  if (ui.setSprite) ui.setSprite(dialogue.target, dialogue.sprite);
  else document.getElementById(dialogue.target).src = assetRoot + dialogue.sprite;
  ui.speaker.textContent = dialogue.displayName ?? dialogue.speaker;
  ui.text.textContent = dialogue.text;
  ui.characters.forEach((character) => {
    character.classList.toggle("is-speaking", (character.dataset.character || character.dataset.fontaineCharacter) === dialogue.speaker);
  });
  const isLast = index === sequence.length - 1;
  ui.next.textContent = "Далее ◆";
  ui.next.setAttribute("aria-label", isLast ? ui.finalLabel : "Следующая реплика");
  queueMicrotask(() => rememberDialogueFrame(ui));
}

function startScene() {
  startSceneMusic();
  stage = "intro";
  dialogueIndex = 0;
  charactersLayer.hidden = true;
  dialogueBox.hidden = true;
  characters.forEach((character) => character.classList.remove("is-speaking"));
  document.getElementById("characterLeft").src = assetRoot + "nastya_idle.png";
  document.getElementById("characterRight").src = assetRoot + "vikutoria_idle.png";

  nextButton.disabled = false;
  nextButton.textContent = "Далее ◆";
  nextButton.setAttribute("aria-label", "Показать персонажей");
}

nextButton.addEventListener("click", () => {
  if (document.getElementById("story").hidden || !isLandscape()) return;
  if (stage === "intro") {
    stage = "idle";
    charactersLayer.hidden = false;
    nextButton.setAttribute("aria-label", "Начать разговор");
    return;
  }
  if (stage === "idle") {
    stage = "dialogue";
    renderDialogue();
    dialogueBox.hidden = false;
    return;
  }
  if (dialogueIndex === dialogues.length - 1) {
    stopSceneMusic();
    openMap("assets/images/maps/map_fontaine_rizley.png", "rizley_scene");
    return;
  }
  dialogueIndex += 1;
  renderDialogue();
});

// Каждый телепорт загружает только следующий сюжетный отрезок. Четыре параллельных
// запроса не перегружают память iPhone большими PNG, а общие файлы не скачиваются повторно.
const assetLoadingScreen = document.getElementById("asset-loading-screen");
const assetLoadPromises = new Map();
const bundleLoadPromises = new Map();
const PRELOAD_CONCURRENCY = 4;
const MIN_LOADING_SCREEN_TIME = 450;

const preloadBundles = {
  startup: {
    media: ["loading-video", "scene-music"],
    images: [
      "assets/images/backgrounds/beach.png",
      "assets/images/maps/map_fontaine_rizley.png",
      "assets/images/ui/teleport_icon.png",
      assetRoot + "nastya_idle.png",
      assetRoot + "vikutoria_idle.png",
      ...dialogues.map(dialogue => assetRoot + dialogue.sprite)
    ]
  },
  rizley_scene: {
    media: ["fontaine-music", "wish-video"],
    images: [
      "assets/images/backgrounds/fontaine_arrival_bg.png",
      "assets/images/backgrounds/fontaine_chest_bg.png",
      "assets/images/backgrounds/fontaine_neuvillette_bg.png",
      "assets/images/maps/map_sumeru.png",
      "assets/images/ui/chest.png",
      "assets/images/ui/mysterious_note.png",
      "assets/images/ui/wolf_package_icon.png",
      "assets/images/ui/flask_package_icon.png",
      "assets/images/ui/water_drop_package_icon.png",
      "assets/images/ui/wish_package_icon.png",
      assetRoot + "nastya_idle.png",
      assetRoot + "nastya_01_confused.png",
      assetRoot + "nastya_03_speechless.png",
      assetRoot + "nastya_04_teasing.png",
      assetRoot + "nastya_05_grateful.png",
      assetRoot + "nastya_06_awkward_admission.png",
      assetRoot + "nastya_07_already.png",
      assetRoot + "vikutoria_idle.png",
      assetRoot + "vikutoria_pointing_chest.png",
      assetRoot + "rizley_idle.png",
      assetRoot + "rizley_01_greeting.png",
      assetRoot + "rizley_02_waiting.png",
      assetRoot + "rizley_03_smug.png",
      assetRoot + "rizley_04_gift.png",
      assetRoot + "rizley_05_hope_you_liked_it.png",
      assetRoot + "rizley_06_not_jealous.png",
      assetRoot + "rizley_07_rain_hint.png",
      assetRoot + "neuvillette_idle.png",
      assetRoot + "neuvillette_01_greeting.png",
      assetRoot + "neuvillette_02_concerned.png",
      assetRoot + "neuvillette_03_knowing.png",
      assetRoot + "neuvillette_04_my_turn.png",
      assetRoot + "neuvillette_05_curious.png",
      assetRoot + "neuvillette_06_proposition.png",
      assetRoot + "neuvillette_07_fate.png",
      assetRoot + "neuvillette_08_result.png",
      assetRoot + "neuvillette_09_birthday_wish.png",
      assetRoot + "neuvillette_10_farewell.png",
      assetRoot + "neuvillette_11_next_guide.png",
      assetRoot + "neuvillette_12_dry_humor.png"
    ]
  },
  sumeru_pending: {
    media: ["sumeru-music"],
    images: [
      "assets/images/backgrounds/sumeru_arrival_bg.png",
      "assets/images/backgrounds/sumeru_house_bg.png",
      "assets/images/maps/map_liyue.png",
      "assets/images/ui/chest.png",
      "assets/images/ui/mysterious_note.png",
      "assets/images/ui/feather_package_icon.png",
      "assets/images/ui/book_package_icon.png",
      "assets/images/ui/house_package_icon.png",
      assetRoot + "nastya_idle.png",
      assetRoot + "nastya_08_happy_greeting.png",
      assetRoot + "nastya_09_curious.png",
      assetRoot + "nastya_10_suspicious.png",
      assetRoot + "vikutoria_idle.png",
      assetRoot + "vikutoria_pointing_chest.png",
      assetRoot + "kaveh_01_greeting.png",
      assetRoot + "kaveh_02_concerned.png",
      assetRoot + "kaveh_03_worried.png",
      assetRoot + "kaveh_04_annoyed.png",
      assetRoot + "kaveh_05_reaction.png",
      assetRoot + "kaveh_06_defensive.png",
      assetRoot + "kaveh_07_indignant.png",
      assetRoot + "kaveh_09_explaining.png",
      assetRoot + "kaveh_11_turn_to_nastya.png",
      assetRoot + "kaveh_12_gift.png",
      assetRoot + "kaveh_14_teasing.png",
      assetRoot + "kaveh_15_shouting.png",
      assetRoot + "kaveh_16_confident.png",
      assetRoot + "kaveh_18_farewell.png",
      assetRoot + "alhaitham_01_idle.png",
      assetRoot + "alhaitham_02_disapproving.png",
      assetRoot + "alhaitham_03_skeptical.png",
      assetRoot + "alhaitham_04_dry_reply.png",
      assetRoot + "alhaitham_08_question.png",
      assetRoot + "alhaitham_09_reasonable.png"
    ]
  },
  liyue_pending: {
    media: ["liyue-music", "chenyu-music"],
    images: [
      "assets/images/backgrounds/liyue_arrival_bg.png",
      "assets/images/backgrounds/liyue_zhongli_bg.png",
      "assets/images/backgrounds/chenyu_tea_scene.png",
      "assets/images/backgrounds/final_group_photo.png",
      "assets/images/ui/liyue_mora_note.png",
      "assets/images/ui/mysterious_note.png",
      "assets/images/ui/mora_package_icon.png",
      "assets/images/ui/tea_package_icon.png",
      assetRoot + "nastya_idle.png",
      assetRoot + "nastya_01_confused.png",
      assetRoot + "nastya_02_done.png",
      assetRoot + "nastya_05_grateful.png",
      assetRoot + "nastya_07_already.png",
      assetRoot + "nastya_11_tired_irony.png",
      assetRoot + "nastya_12_warm_smile.png",
      assetRoot + "nastya_13_tea_surprise.png",
      assetRoot + "vikutoria_idle.png",
      assetRoot + "vikutoria_pointing_chest.png",
      assetRoot + "vikutoria_03_curious_mora.png",
      assetRoot + "zhongli_01_greeting.png",
      assetRoot + "zhongli_03_reassuring.png",
      assetRoot + "zhongli_04_birthday.png",
      assetRoot + "zhongli_05_gift.png",
      assetRoot + "zhongli_06_reflective.png",
      assetRoot + "zhongli_08_pleased.png",
      assetRoot + "zhongli_09_gentle.png",
      assetRoot + "zhongli_10_warm_wish.png",
      assetRoot + "zhongli_11_invitation.png",
      assetRoot + "zhongli_12_osmanthus.png",
      assetRoot + "zhongli_13_tea.png",
      assetRoot + "zhongli_14_exception.png"
    ]
  }
};

function activateStaticImage(path) {
  document.querySelectorAll("img[data-src]").forEach(image => {
    if (image.dataset.src !== path) return;
    image.src = path;
    image.removeAttribute("data-src");
  });
}

function preloadImage(path) {
  const key = "image:" + path;
  if (assetLoadPromises.has(key)) return assetLoadPromises.get(key);
  const promise = new Promise(resolve => {
    let image = new Image();
    let settled = false;
    const finish = loaded => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (loaded) activateStaticImage(path);
      else console.warn("Не удалось заранее загрузить изображение:", path);
      image = null;
      resolve(loaded);
    };
    const timeout = setTimeout(() => finish(false), 45000);
    image.decoding = "async";
    image.onload = () => {
      const decoding = typeof image.decode === "function" ? image.decode() : null;
      if (decoding) decoding.then(() => finish(true), () => finish(true));
      else finish(true);
    };
    image.onerror = () => finish(false);
    image.src = path;
  });
  assetLoadPromises.set(key, promise);
  promise.then(loaded => {
    if (!loaded && assetLoadPromises.get(key) === promise) assetLoadPromises.delete(key);
  });
  return promise;
}

function preloadMediaElement(id) {
  const key = "media:" + id;
  if (assetLoadPromises.has(key)) return assetLoadPromises.get(key);
  const element = document.getElementById(id);
  if (!element) return Promise.resolve(false);
  const promise = new Promise(resolve => {
    let settled = false;
    const events = ["loadeddata", "canplay", "canplaythrough", "progress", "durationchange", "error"];
    // Safari часто не буферизует поставленное на паузу видео целиком. Первого
    // декодированного кадра достаточно: fast-start MP4 продолжит поток при play().
    const isReady = () => element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
    const finish = loaded => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      events.forEach(eventName => element.removeEventListener(eventName, onReady));
      if (!loaded) console.warn("Медиа продолжит загружаться в фоне:", element.currentSrc || element.src);
      resolve(loaded);
    };
    const onReady = event => {
      if (event.type === "error") finish(false);
      else if (isReady()) finish(true);
    };
    const timeout = setTimeout(() => finish(false), 30000);
    events.forEach(eventName => element.addEventListener(eventName, onReady));
    element.preload = "auto";
    try {
      if (isReady()) finish(true);
      else element.load();
    } catch { finish(false); }
  });
  assetLoadPromises.set(key, promise);
  promise.then(loaded => {
    if (!loaded && assetLoadPromises.get(key) === promise) assetLoadPromises.delete(key);
  });
  return promise;
}

async function preloadImages(paths) {
  const queue = [...new Set(paths)];
  const results = new Array(queue.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < queue.length) {
      const index = nextIndex;
      const path = queue[index];
      nextIndex += 1;
      results[index] = await preloadImage(path);
    }
  }
  const workerCount = Math.min(PRELOAD_CONCURRENCY, queue.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results.every(Boolean);
}

function preloadStoryBundle(bundleName) {
  const bundle = preloadBundles[bundleName];
  if (!bundle) return Promise.reject(new Error("Неизвестный пакет ресурсов: " + bundleName));
  let loading = bundleLoadPromises.get(bundleName);
  if (!loading) {
    loading = Promise.all([
      preloadImages(bundle.images),
      ...bundle.media.map(preloadMediaElement)
    ]).then(results => results.every(Boolean));
    bundleLoadPromises.set(bundleName, loading);
    loading.then(loaded => {
      if (!loaded && bundleLoadPromises.get(bundleName) === loading) bundleLoadPromises.delete(bundleName);
    });
  }
  const deadline = bundleName === "startup" ? 60000 : 120000;
  let deadlineTimer;
  const timeout = new Promise(resolve => {
    deadlineTimer = setTimeout(() => {
      console.warn("Часть ресурсов продолжит загружаться в фоне:", bundleName);
      resolve(false);
    }, deadline);
  });
  const promise = Promise.race([loading, timeout]).finally(() => clearTimeout(deadlineTimer));
  return promise;
}

function setAssetLoadingVisible(visible) {
  assetLoadingScreen.hidden = !visible;
  assetLoadingScreen.inert = !visible;
  assetLoadingScreen.setAttribute("aria-busy", String(visible));
  document.body.setAttribute("aria-busy", String(visible));
}

async function runAssetLoadingTransition(bundleName, continuation) {
  setAssetLoadingVisible(true);
  const minimumDisplay = new Promise(resolve => setTimeout(resolve, MIN_LOADING_SCREEN_TIME));
  try {
    await Promise.all([preloadStoryBundle(bundleName), minimumDisplay]);
    if (typeof continuation === "function") continuation();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  } finally {
    setAssetLoadingVisible(false);
  }
}

window.preloadStoryBundle = preloadStoryBundle;
window.runAssetLoadingTransition = runAssetLoadingTransition;
// Не ставим запуск видео и вход в игру в зависимость от загрузки всех глав.
const sceneReady = Promise.resolve();
let beachPreloadStarted = false;
function prepareBeachImages() {
  if (beachPreloadStarted) return preloadStoryBundle("startup");
  beachPreloadStarted = true;
  return preloadStoryBundle("startup");
}

// Один экран карты для всех путешествий: путь к изображению и имя следующей сцены.
const beachScene = document.getElementById("beach-scene");
const travelMap = document.getElementById("travel-map");
const travelMapImage = document.getElementById("travel-map-image");
const teleportButton = document.getElementById("teleport-button");
const nextScene = document.getElementById("next-scene");
let travelDestination = null;

const sceneRegistry = new Map();

function registerScene(sceneId, handler) {
  if (typeof sceneId !== "string" || !sceneId.trim() || typeof handler !== "function") {
    throw new TypeError("Укажите имя сцены и функцию её запуска.");
  }
  sceneRegistry.set(sceneId, handler);
}

function openMap(mapPath, nextSceneId) {
  if (typeof mapPath !== "string" || !mapPath.trim()) {
    throw new TypeError("Укажите путь к изображению карты.");
  }
  if (!sceneRegistry.has(nextSceneId)) {
    throw new Error("Неизвестная сюжетная сцена: " + nextSceneId);
  }
  stopFontaineMusic();
  stage = "travel";
  beachScene.hidden = true;
  nextScene.hidden = true;
  travelMapImage.src = mapPath;
  travelMapImage.alt = "Карта путешествия";
  travelDestination = nextSceneId;
  teleportButton.disabled = false;
  travelMap.hidden = false;
  if (isLandscape()) teleportButton.focus({ preventScroll: true });
}

function launchScene(sceneId) {
  const handler = sceneRegistry.get(sceneId);
  if (!handler) throw new Error("Неизвестная сюжетная сцена: " + sceneId);
  travelMap.hidden = true;
  handler();
}

function showNextScenePlaceholder() {
  stage = "next-scene";
  nextScene.hidden = false;
}

// Сохраняем маршрут первой карты; он ведёт к вступлению в Фонтейн.
registerScene("rizley_scene", startFontaineIntro);

teleportButton.addEventListener("click", () => {
  if (travelMap.hidden || !isLandscape() || !travelDestination || teleportButton.disabled) return;
  teleportButton.disabled = true;
  const destination = travelDestination;
  runAssetLoadingTransition(destination, () => {
    if (travelDestination !== destination) return;
    launchScene(destination);
    travelDestination = null;
  }).catch(error => {
    console.error("Не удалось завершить переход между главами:", error);
    if (travelDestination === destination) {
      travelMap.hidden = false;
      teleportButton.disabled = false;
    }
  });
});

const fontaineBackground = document.getElementById("fontaine-background");
const fontaineArrival = document.getElementById("fontaine-background-arrival");
const fontaineChestBackground = document.getElementById("fontaine-background-chest");
const fontaineNeuvilletteBackground = document.getElementById("fontaine-background-neuvillette");
const fontaineNastya = document.getElementById("fontaine-nastya");
const fontaineVikutoria = document.getElementById("fontaine-vikutoria");
const fontaineRizley = document.getElementById("fontaine-rizley");
const fontaineChest = document.getElementById("fontaine-chest");
const fontaineNext = document.getElementById("fontaine-next");
const fontaineNoteOverlay = document.getElementById("fontaine-note-overlay");
const fontaineContinue = document.getElementById("fontaine-note-continue");
const fontaineNoteIcon = document.getElementById("fontaine-note-icon");
const fontaineNoteText = document.getElementById("fontaine-note-text");
const rizleyDialogue = document.getElementById("rizley-dialogue");
let fontaineFrame = 1;
let rizleyDialogueIndex = 0;
let activeNote = null;

const rizleyDialogues = [
  { speaker: "Ризли", text: "Анастасия, ну здравствуй.", target: "fontaine-rizley-sprite", sprite: "rizley_01_greeting.png" },
  { speaker: "Настя", text: "П-привет...", target: "fontaine-nastya-sprite", sprite: "nastya_01_confused.png" },
  { speaker: "Ризли", text: "Вижу, ты всё-таки добралась до меня. Приятно. Я уже успел тут заскучать.", target: "fontaine-rizley-sprite", sprite: "rizley_02_waiting.png" },
  { speaker: "Настя", text: "...", target: "fontaine-nastya-sprite", sprite: "nastya_03_speechless.png" },
  { speaker: "Ризли", text: "Хотя, если честно, мне редко приходится так долго ждать, чтобы кто-нибудь наконец обратил на меня внимание.", target: "fontaine-rizley-sprite", sprite: "rizley_03_smug.png" },
  { speaker: "Настя", text: "Я, кажется, знаю, без чьего внимания ты не обходишься.", target: "fontaine-nastya-sprite", sprite: "nastya_04_teasing.png" },
  { speaker: "Ризли", text: "Ладно, не буду задерживать. Я приготовил для тебя кое-что. Это от меня.", target: "fontaine-rizley-sprite", sprite: "rizley_04_gift.png" }
];

const rizleyContinuationDialogues = [
  { speaker: "Ризли", text: "С днём рождения. Дальше будет интереснее. Обещаю, скучать тебе не дадут.", target: "fontaine-rizley-sprite", sprite: "rizley_04_gift.png" },
  { speaker: "Ризли", text: "Надеюсь, тебе понравилось.", target: "fontaine-rizley-sprite", sprite: "rizley_05_hope_you_liked_it.png" },
  { speaker: "Настя", text: "Да, спасибо.", target: "fontaine-nastya-sprite", sprite: "nastya_05_grateful.png" },
  { speaker: "Ризли", text: "А теперь мне придётся отправить тебя дальше. Есть тут один господин, который наверняка уже недоволен тем, что я забрал себе слишком много твоего внимания.", target: "fontaine-rizley-sprite", sprite: "rizley_03_smug.png" },
  { speaker: "Настя", text: "Я, кажется, догадываюсь.", target: "fontaine-nastya-sprite", sprite: "nastya_04_teasing.png" },
  { speaker: "Ризли", text: "Не переживай, я не ревную. Пусть попробует тебя впечатлить.", target: "fontaine-rizley-sprite", sprite: "rizley_06_not_jealous.png" },
  { speaker: "Ризли", text: "Ищи того, кто предпочитает дождь любым другим погодным условиям.", target: "fontaine-rizley-sprite", sprite: "rizley_07_rain_hint.png" }
];
let activeRizleyDialogues = rizleyDialogues;

const rizleyDialogueUI = {
  speaker: document.getElementById("rizley-speaker"),
  text: document.getElementById("rizley-text"),
  next: fontaineNext,
  characters: [fontaineNastya, fontaineVikutoria, fontaineRizley],
  finalLabel: "Открыть записку"
};

function setFontaineSprite(id, filename) {
  const image = document.getElementById(id);
  const path = assetRoot + filename;
  if (image.getAttribute("src") !== path) image.src = path;
}

function renderFontaineFrame() {
  fontaineNeuvilletteBackground.hidden = true;
  fontaineArrival.hidden = fontaineFrame >= 3;
  fontaineChestBackground.hidden = fontaineFrame < 3;
  fontaineNastya.hidden = fontaineFrame < 2;
  fontaineVikutoria.hidden = fontaineFrame < 2 || fontaineFrame === 7;
  fontaineVikutoria.classList.toggle("pointing", fontaineFrame >= 3);
  if (fontaineFrame < 7) {
    setFontaineSprite("fontaine-vikutoria-sprite", fontaineFrame >= 3
      ? "vikutoria_pointing_chest.png" : "vikutoria_idle.png");
  }
  fontaineRizley.hidden = fontaineFrame !== 7;
  fontaineChest.hidden = fontaineFrame < 3 || fontaineFrame === 7;
  fontaineChest.disabled = fontaineFrame !== 5;
  fontaineChest.classList.toggle("interactive", fontaineFrame === 5);
  fontaineNext.hidden = fontaineFrame >= 5;
  fontaineNoteOverlay.hidden = fontaineFrame !== 6;
  rizleyDialogue.hidden = fontaineFrame !== 7;
}

function startFontaineIntro() {
  startFontaineMusic();
  stage = "fontaine-intro";
  beachScene.hidden = true;
  nextScene.hidden = false;
  fontaineFrame = 1;
  activeNote = null;
  fontaineContinue.disabled = false;
  fontaineContinue.hidden = false;
  [fontaineNastya, fontaineVikutoria, fontaineRizley, fontaineChest, fontaineNext, rizleyDialogue].forEach(element => { element.inert = false; });
  setFontaineSprite("fontaine-nastya-sprite", "nastya_idle.png");
  setFontaineSprite("fontaine-rizley-sprite", "rizley_idle.png");
  rizleyDialogueUI.characters.forEach(character => character.classList.remove("is-speaking"));
  renderFontaineFrame();
}

// Сохраняем ручное продолжение установочных кадров, без таймеров.
fontaineNext.addEventListener("click", () => {
  if (nextScene.hidden || !isLandscape() || activeNote) return;
  if (stage === "fontaine-intro" && fontaineFrame < 5) {
    fontaineFrame += 1;
    // При смене участка Викутория уже указывает на сундук.
    // Следующее продолжение включает его интерактивность, без лишнего кадра.
    if (fontaineFrame === 4) fontaineFrame = 5;
    renderFontaineFrame();
    if (fontaineFrame === 5) fontaineChest.focus({ preventScroll: true });
  } else if (stage === "fontaine-rizley-dialogue" || stage === "fontaine-rizley-continuation") {
    if (rizleyDialogueIndex === activeRizleyDialogues.length - 1) {
      showPackageNote(stage === "fontaine-rizley-continuation" ? "water" : "flask");
      return;
    }
    rizleyDialogueIndex += 1;
    renderDialogue(activeRizleyDialogues, rizleyDialogueIndex, rizleyDialogueUI);
  }
});

function showPackageNote(packageType) {
  const noteSymbols = {
    wolf: { file: "wolf_package_icon.png", alt: "Пиктограмма лапы" },
    flask: { file: "flask_package_icon.png", alt: "Пиктограмма флакона" },
    water: { file: "water_drop_package_icon.png", alt: "Пиктограмма капель" },
    wish: { file: "wish_package_icon.png", alt: "Символ молитвы" },
    feather: { file: "feather_package_icon.png", alt: "Символ пера" },
    book: { file: "book_package_icon.png", alt: "Символ книги" },
    house: { file: "house_package_icon.png", alt: "Символ дома" },
    mora: { file: "mora_package_icon.png", alt: "Символ Моры" },
    tea: { file: "tea_package_icon.png", alt: "Символ чашки" }
  };
  const symbol = noteSymbols[packageType];
  if (!symbol) throw new Error("Неизвестный символ записки: " + packageType);
  const sumeruGift = ["feather", "book", "house"].includes(packageType);
  activeNote = packageType;
  const liyueGift = ["mora", "tea"].includes(packageType);
  stage = (liyueGift ? "liyue-" : sumeruGift ? "sumeru-" : "fontaine-") + packageType + "-note";
  if (liyueGift) endingCharacters.forEach(actor => { actor.inert = true; });
  if (sumeruGift) sumeruCharacters.forEach(actor => { actor.inert = true; });
  fontaineChest.disabled = true;
  fontaineChest.classList.remove("interactive");
  fontaineNext.hidden = true;
  rizleyDialogue.hidden = true;
  fontaineNoteIcon.src = "assets/images/ui/" + symbol.file;
  fontaineNoteIcon.alt = symbol.alt;
  fontaineNoteText.textContent = "Открой свёрток с этим символом";
  fontaineContinue.hidden = false;
  fontaineContinue.disabled = false;
  [fontaineNastya, fontaineVikutoria, fontaineRizley, fontaineChest, fontaineNext, rizleyDialogue].forEach(element => { element.inert = true; });
  fontaineNoteOverlay.hidden = false;
  fontaineContinue.focus({ preventScroll: true });
}

fontaineChest.addEventListener("click", () => {
  if (nextScene.hidden || !isLandscape() || stage !== "fontaine-intro" || fontaineFrame !== 5) return;
  fontaineFrame = 6;
  showPackageNote("wolf");
});

fontaineContinue.addEventListener("click", () => {
  if (nextScene.hidden || !isLandscape() || !activeNote || fontaineContinue.disabled) return;
  fontaineContinue.disabled = true;
  if (activeNote === "wolf") {
    activeNote = null;
    launchScene("fontaine_rizley_dialogue");
  } else if (activeNote === "flask") {
    startRizleyContinuation();
  } else if (activeNote === "water") {
    startNeuvilletteScene();
  } else if (activeNote === "wish") {
    startNeuvilletteAfterWish();
  } else if (activeNote === "feather") {
    startSumeruDialogue("first");
  } else if (activeNote === "book") {
    startSumeruDialogue("argument");
  } else if (activeNote === "house") {
    startSumeruDialogue("after");
  } else if (activeNote === "mora") {
    startEndingDialogue("main");
  } else if (activeNote === "tea") {
    startEndingDialogue("final");
  }
});

function startRizleyDialogue() {
  activeRizleyDialogues = rizleyDialogues;
  stage = "fontaine-rizley-dialogue";
  nextScene.hidden = false;
  activeNote = null;
  fontaineFrame = 7;
  rizleyDialogueIndex = 0;
  setFontaineSprite("fontaine-nastya-sprite", "nastya_idle.png");
  setFontaineSprite("fontaine-rizley-sprite", "rizley_idle.png");
  renderFontaineFrame();
  [fontaineNastya, fontaineVikutoria, fontaineRizley, fontaineChest, fontaineNext, rizleyDialogue].forEach(element => { element.inert = false; });
  fontaineNext.hidden = false;
  renderDialogue(activeRizleyDialogues, rizleyDialogueIndex, rizleyDialogueUI);
  fontaineNext.focus({ preventScroll: true });
}

registerScene("fontaine_rizley_intro", startFontaineIntro);
registerScene("fontaine_rizley_dialogue", startRizleyDialogue);

function startRizleyContinuation() {
  stage = "fontaine-rizley-continuation";
  activeNote = null;
  activeRizleyDialogues = rizleyContinuationDialogues;
  rizleyDialogueIndex = 0;
  // Возвращаем ту же сцену и сохранённые спрайты без промежуточного экрана.
  renderFontaineFrame();
  [fontaineNastya, fontaineVikutoria, fontaineRizley, fontaineChest, fontaineNext, rizleyDialogue].forEach(element => { element.inert = false; });
  fontaineNext.hidden = false;
  renderDialogue(activeRizleyDialogues, rizleyDialogueIndex, rizleyDialogueUI);
  fontaineNext.focus({ preventScroll: true });
}

const fontaineNeuvillette = document.getElementById("fontaine-neuvillette");
const wishAction = document.getElementById("wish-action");
const wishButton = document.getElementById("wish-button");
const wishVideoOverlay = document.getElementById("wish-video-overlay");
const wishVideo = document.getElementById("wish-video");
const wishVideoRetry = document.getElementById("wish-video-retry");
const wishVideoError = document.getElementById("wish-video-error");
const wishRetryButton = document.getElementById("wish-retry-button");
const neuvilletteBeforeWish = [
  {
    "speaker": "Нёвиллет",
    "text": "Анастасия. Позвольте прежде всего поблагодарить вас за то, что вы всё-таки добрались до меня.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_01_greeting.png"
  },
  {
    "speaker": "Настя",
    "text": "Здравствуйте...",
    "target": "fontaine-nastya-sprite",
    "sprite": "nastya_01_confused.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "Надеюсь, предыдущая встреча не доставила вам слишком много хлопот.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_02_concerned.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "Хотя, зная герцога, полагаю, он наверняка позволил себе несколько лишних комментариев.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_03_knowing.png"
  },
  {
    "speaker": "Настя",
    "text": "Ну... было дело.",
    "target": "fontaine-nastya-sprite",
    "sprite": "nastya_06_awkward_admission.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "Что ж. Теперь моя очередь.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_04_my_turn.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "Я приготовил для вас кое-что, что, надеюсь, окажется не менее приятным.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_04_my_turn.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "И знаете... мне стало любопытно.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_05_curious.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "Сегодня ведь ваш день. А значит, почему бы не позволить случаю решить, кто именно появится следующим?",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_06_proposition.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "В конце концов, иногда достаточно всего одной попытки, чтобы узнать, что приготовила вам судьба.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_07_fate.png"
  }
];
const neuvilletteAfterWish = [
  {
    "speaker": "Нёвиллет",
    "text": "Что ж...",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_08_result.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "Похоже, сегодня судьба решила быть к вам благосклонна.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_08_result.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "А теперь позвольте пожелать вам удачи.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_09_birthday_wish.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "Пусть она сопровождает вас не только сегодня, но и во всём, за что вы возьмётесь дальше.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_09_birthday_wish.png"
  },
  {
    "speaker": "Настя",
    "text": "Спасибо.",
    "target": "fontaine-nastya-sprite",
    "sprite": "nastya_05_grateful.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "И пусть судьба почаще оказывается на вашей стороне.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_09_birthday_wish.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "На этом я, пожалуй, откланяюсь.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_10_farewell.png"
  },
  {
    "speaker": "Настя",
    "text": "Уже?",
    "target": "fontaine-nastya-sprite",
    "sprite": "nastya_07_already.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "Мне ещё нужно вернуться к герцогу — полагаю, он уже успел заскучать без меня.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_03_knowing.png"
  },
  {
    "speaker": "Настя",
    "text": "Думаю, вы правы.",
    "target": "fontaine-nastya-sprite",
    "sprite": "nastya_04_teasing.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "А вам я оставлю другого провожатого.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_11_next_guide.png"
  },
  {
    "speaker": "Настя",
    "text": "И кого же?",
    "target": "fontaine-nastya-sprite",
    "sprite": "nastya_01_confused.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "Ищите человека, который умеет превращать свои идеи в нечто прекрасное.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_11_next_guide.png"
  },
  {
    "speaker": "Нёвиллет",
    "text": "Правда, иногда ему для этого требуется немного больше терпения, чем хотелось бы.",
    "target": "fontaine-neuvillette-sprite",
    "sprite": "neuvillette_12_dry_humor.png"
  },
  {
    "speaker": "Настя",
    "text": "Кажется, я догадываюсь.",
    "target": "fontaine-nastya-sprite",
    "sprite": "nastya_04_teasing.png"
  }
];
const neuvilletteDialogueUI = {
  ...rizleyDialogueUI,
  characters: [fontaineNastya, fontaineNeuvillette],
  finalLabel: "Продолжить"
};
let neuvilletteSequence = neuvilletteBeforeWish;
let neuvilletteIndex = 0;
let neuvilletteLastTap = -Infinity;
let wishPausedForOrientation = false;

function acceptNeuvilletteTap() {
  const now = performance.now();
  if (now - neuvilletteLastTap < 300) return false;
  neuvilletteLastTap = now;
  return true;
}

function showNeuvilletteComposition() {
  activeNote = null;
  fontaineNoteOverlay.hidden = true;
  fontaineArrival.hidden = true;
  fontaineChestBackground.hidden = true;
  fontaineNeuvilletteBackground.hidden = false;
  fontaineRizley.hidden = true;
  fontaineVikutoria.hidden = true;
  fontaineChest.hidden = true;
  fontaineNastya.hidden = false;
  fontaineNeuvillette.hidden = false;
  fontaineNeuvillette.classList.remove("is-departing");
  rizleyDialogue.classList.remove("dialogue-fade-out");
  [fontaineNastya, fontaineNeuvillette, fontaineNext, rizleyDialogue].forEach(element => { element.inert = false; });
  wishAction.hidden = true;
  fontaineNext.hidden = false;
  fontaineNext.disabled = false;
  nextScene.hidden = false;
}

function startNeuvilletteScene() {
  stage = "neuvillette-arrival";
  showNeuvilletteComposition();
  setFontaineSprite("fontaine-neuvillette-sprite", "neuvillette_idle.png");
  neuvilletteDialogueUI.characters.forEach(character => character.classList.remove("is-speaking"));
  rizleyDialogue.hidden = true;
  fontaineNext.setAttribute("aria-label", "Начать разговор");
  neuvilletteIndex = 0;
  neuvilletteSequence = neuvilletteBeforeWish;
  neuvilletteLastTap = performance.now();
}

function renderNeuvilletteDialogue() {
  rizleyDialogue.hidden = false;
  renderDialogue(neuvilletteSequence, neuvilletteIndex, neuvilletteDialogueUI);
}

fontaineNext.addEventListener("click", () => {
  if (nextScene.hidden || !isLandscape() || activeNote || !stage.startsWith("neuvillette-")) return;
  if (!["neuvillette-arrival", "neuvillette-before-wish", "neuvillette-after-wish"].includes(stage) || !acceptNeuvilletteTap()) return;
  if (stage === "neuvillette-arrival") {
    stage = "neuvillette-before-wish";
    renderNeuvilletteDialogue();
    return;
  }
  if (neuvilletteIndex < neuvilletteSequence.length - 1) {
    neuvilletteIndex += 1;
    renderNeuvilletteDialogue();
  } else if (stage === "neuvillette-before-wish") {
    showWishAction();
  } else {
    finishNeuvilletteScene();
  }
});

function showWishAction() {
  stage = "neuvillette-wish-transition";
  fontaineNext.hidden = true;
  rizleyDialogue.classList.add("dialogue-fade-out");
  setTimeout(() => {
    if (stage !== "neuvillette-wish-transition") return;
    rizleyDialogue.hidden = true;
    fontaineNastya.hidden = true;
    fontaineNeuvillette.hidden = true;
    stage = "neuvillette-wish-ready";
    wishButton.disabled = false;
    wishAction.hidden = false;
    if (isLandscape()) wishButton.focus({ preventScroll: true });
  }, 300);
}

function reportWishVideoFailure(error) {
  if (stage !== "neuvillette-wish-video") return;
  wishVideo.pause();
  stage = "neuvillette-wish-retry";
  wishPausedForOrientation = false;
  wishVideoError.textContent = error && error.name === "NotAllowedError"
    ? "Нажмите, чтобы разрешить воспроизведение со звуком."
    : "Видео не удалось загрузить. Проверьте соединение и повторите попытку.";
  wishRetryButton.disabled = false;
  wishVideoRetry.hidden = false;
}

function playWishVideo(fromBeginning) {
  pauseFontaineMusicForWish();
  stage = "neuvillette-wish-video";
  wishAction.hidden = true;
  wishButton.disabled = true;
  wishRetryButton.disabled = true;
  wishVideoRetry.hidden = true;
  wishVideoOverlay.hidden = false;
  wishVideoOverlay.inert = false;
  nextScene.inert = true;
  wishVideo.controls = false;
  wishVideo.loop = false;
  wishVideo.muted = false;
  wishVideo.volume = 1;
  if (fromBeginning) wishVideo.currentTime = 0;
  try {
    // Вызов непосредственно внутри пользовательского нажатия, без await.
    const playback = wishVideo.play();
    if (playback) playback.catch(reportWishVideoFailure);
  } catch (error) {
    reportWishVideoFailure(error);
  }
}

wishButton.addEventListener("click", () => {
  if (!isLandscape() || stage !== "neuvillette-wish-ready" || wishButton.disabled || !acceptNeuvilletteTap()) return;
  playWishVideo(true);
});

wishRetryButton.addEventListener("click", () => {
  if (!isLandscape() || stage !== "neuvillette-wish-retry" || wishRetryButton.disabled || !acceptNeuvilletteTap()) return;
  const reload = !!wishVideo.error;
  if (reload) wishVideo.load();
  playWishVideo(reload);
});

wishVideo.addEventListener("ended", () => {
  if (stage !== "neuvillette-wish-video") return;
  wishVideo.pause();
  wishVideoOverlay.hidden = true;
  wishVideoRetry.hidden = true;
  wishPausedForOrientation = false;
  nextScene.inert = false;
  showPackageNote("wish");
});
wishVideo.addEventListener("error", () => reportWishVideoFailure(wishVideo.error));

function startNeuvilletteAfterWish() {
  resumeFontaineMusicAfterWish();
  stage = "neuvillette-after-wish";
  showNeuvilletteComposition();
  neuvilletteSequence = neuvilletteAfterWish;
  neuvilletteIndex = 0;
  neuvilletteLastTap = performance.now();
  renderNeuvilletteDialogue();
  fontaineNext.focus({ preventScroll: true });
}

function finishNeuvilletteScene() {
  stage = "neuvillette-departing";
  fontaineNext.hidden = true;
  rizleyDialogue.hidden = true;
  fontaineNeuvillette.classList.add("is-departing");
  setTimeout(() => {
    if (stage !== "neuvillette-departing") return;
    fontaineNeuvillette.hidden = true;
    openMap("assets/images/maps/map_sumeru.png", "sumeru_pending");
  }, 220);
}

// Сохраняем существующий идентификатор маршрута карты Сумеру.
registerScene("sumeru_pending", startSumeruScene);

function updateWishOrientation() {
  if (typeof isLandscape !== "function") return;
  const landscape = isLandscape();
  wishVideoOverlay.inert = !landscape;
  if (!landscape && stage === "neuvillette-wish-video" && !wishVideo.paused) {
    wishPausedForOrientation = true;
    wishVideo.pause();
  } else if (landscape && wishPausedForOrientation) {
    wishPausedForOrientation = false;
    if (stage === "neuvillette-wish-video") {
      try {
        const playback = wishVideo.play();
        if (playback) playback.catch(reportWishVideoFailure);
      } catch (error) { reportWishVideoFailure(error); }
    }
  }
}
window.addEventListener("resize", updateWishOrientation);
window.addEventListener("orientationchange", updateWishOrientation);


// Сумеру: тот же renderer, сундук, записки и маршруты карты.
// Реестр связывает сюжетные эмоции с существующими PNG.
const sumeruVisuals = {
  "kaveh_01_greeting": {
    "name": "Кавех",
    "label": "приветствие",
    "src": "assets/images/characters/kaveh_01_greeting.png"
  },
  "kaveh_02_concerned": {
    "name": "Кавех",
    "label": "обеспокоенность",
    "src": "assets/images/characters/kaveh_02_concerned.png"
  },
  "kaveh_03_worried": {
    "name": "Кавех",
    "label": "настороженность",
    "src": "assets/images/characters/kaveh_03_worried.png"
  },
  "kaveh_04_annoyed": {
    "name": "Кавех",
    "label": "раздражение",
    "src": "assets/images/characters/kaveh_04_annoyed.png"
  },
  "kaveh_05_reaction": {
    "name": "Кавех",
    "label": "реакция",
    "src": "assets/images/characters/kaveh_05_reaction.png"
  },
  "kaveh_06_defensive": {
    "name": "Кавех",
    "label": "оправдание",
    "src": "assets/images/characters/kaveh_06_defensive.png"
  },
  "kaveh_07_indignant": {
    "name": "Кавех",
    "label": "возмущение",
    "src": "assets/images/characters/kaveh_07_indignant.png"
  },
  "kaveh_08_arguing": {
    "name": "Кавех",
    "label": "спор",
    "src": "assets/images/characters/kaveh_06_defensive.png"
  },
  "kaveh_09_explaining": {
    "name": "Кавех",
    "label": "объяснение",
    "src": "assets/images/characters/kaveh_09_explaining.png"
  },
  "kaveh_10_exasperated": {
    "name": "Кавех",
    "label": "усталое раздражение",
    "src": "assets/images/characters/kaveh_04_annoyed.png"
  },
  "kaveh_11_turn_to_nastya": {
    "name": "Кавех",
    "label": "обращение к Насте",
    "src": "assets/images/characters/kaveh_11_turn_to_nastya.png"
  },
  "kaveh_12_gift": {
    "name": "Кавех",
    "label": "подарок",
    "src": "assets/images/characters/kaveh_12_gift.png"
  },
  "kaveh_13_satisfied": {
    "name": "Кавех",
    "label": "довольная улыбка",
    "src": "assets/images/characters/kaveh_12_gift.png"
  },
  "kaveh_14_teasing": {
    "name": "Кавех",
    "label": "насмешка",
    "src": "assets/images/characters/kaveh_14_teasing.png"
  },
  "kaveh_15_shouting": {
    "name": "Кавех",
    "label": "вспышка раздражения",
    "src": "assets/images/characters/kaveh_15_shouting.png"
  },
  "kaveh_16_confident": {
    "name": "Кавех",
    "label": "уверенность",
    "src": "assets/images/characters/kaveh_16_confident.png"
  },
  "kaveh_17_smug": {
    "name": "Кавех",
    "label": "хитрая улыбка",
    "src": "assets/images/characters/kaveh_16_confident.png"
  },
  "kaveh_18_farewell": {
    "name": "Кавех",
    "label": "прощание",
    "src": "assets/images/characters/kaveh_18_farewell.png"
  },
  "alhaitham_01_idle": {
    "name": "Аль-Хайтам",
    "label": "невозмутимость",
    "src": "assets/images/characters/alhaitham_01_idle.png"
  },
  "alhaitham_02_disapproving": {
    "name": "Аль-Хайтам",
    "label": "сухое замечание",
    "src": "assets/images/characters/alhaitham_02_disapproving.png"
  },
  "alhaitham_03_skeptical": {
    "name": "Аль-Хайтам",
    "label": "скепсис",
    "src": "assets/images/characters/alhaitham_03_skeptical.png"
  },
  "alhaitham_04_dry_reply": {
    "name": "Аль-Хайтам",
    "label": "сарказм",
    "src": "assets/images/characters/alhaitham_04_dry_reply.png"
  },
  "alhaitham_05_questioning": {
    "name": "Аль-Хайтам",
    "label": "вопрос",
    "src": "assets/images/characters/alhaitham_08_question.png"
  },
  "alhaitham_06_ironic": {
    "name": "Аль-Хайтам",
    "label": "ирония",
    "src": "assets/images/characters/alhaitham_03_skeptical.png"
  },
  "alhaitham_07_still_here": {
    "name": "Аль-Хайтам",
    "label": "невозмутимое замечание",
    "src": "assets/images/characters/alhaitham_01_idle.png"
  },
  "alhaitham_08_question": {
    "name": "Аль-Хайтам",
    "label": "недоумение",
    "src": "assets/images/characters/alhaitham_08_question.png"
  },
  "alhaitham_09_reasonable": {
    "name": "Аль-Хайтам",
    "label": "спокойное возражение",
    "src": "assets/images/characters/alhaitham_09_reasonable.png"
  }
};
const sumeruDialogues = {
  "first": [
    {
      "speaker": "Кавех",
      "text": "Анастасия! Ну наконец-то!",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_01_greeting"
    },
    {
      "speaker": "Настя",
      "text": "Привет!",
      "target": "sumeru-nastya-sprite",
      "sprite": "nastya_08_happy_greeting.png"
    },
    {
      "speaker": "Кавех",
      "text": "С днём рождения! Я бы с удовольствием ещё немного с тобой поболтал, но есть одна проблема.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_02_concerned"
    },
    {
      "speaker": "Настя",
      "text": "Какая?",
      "target": "sumeru-nastya-sprite",
      "sprite": "nastya_09_curious.png"
    },
    {
      "speaker": "Кавех",
      "text": "Он скоро придёт.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_03_worried"
    },
    {
      "speaker": "Настя",
      "text": "Кто?",
      "target": "sumeru-nastya-sprite",
      "sprite": "nastya_10_suspicious.png"
    },
    {
      "speaker": "Кавех",
      "text": "Вот этот невыносимый человек.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_04_annoyed"
    }
  ],
  "argument": [
    {
      "speaker": "Аль-Хайтам",
      "text": "Кавех.",
      "target": "sumeru-alhaitham-sprite",
      "sprite": "alhaitham_01_idle"
    },
    {
      "speaker": "Кавех",
      "text": "Что?",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_05_reaction"
    },
    {
      "speaker": "Аль-Хайтам",
      "text": "Ты опять привёл гостя.",
      "target": "sumeru-alhaitham-sprite",
      "sprite": "alhaitham_02_disapproving"
    },
    {
      "speaker": "Кавех",
      "text": "А что мне оставалось делать? Она пришла ко мне.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_06_defensive"
    },
    {
      "speaker": "Аль-Хайтам",
      "text": "И поэтому ты решил привести её домой.",
      "target": "sumeru-alhaitham-sprite",
      "sprite": "alhaitham_03_skeptical"
    },
    {
      "speaker": "Кавех",
      "text": "Между прочим, это не только твой дом.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_07_indignant"
    },
    {
      "speaker": "Аль-Хайтам",
      "text": "Ты в нём живёшь. Это разные вещи.",
      "target": "sumeru-alhaitham-sprite",
      "sprite": "alhaitham_04_dry_reply"
    },
    {
      "speaker": "Кавех",
      "text": "Вот именно! И раз уж я здесь живу, я тоже могу решить, что в нём должно быть.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_08_arguing"
    },
    {
      "speaker": "Аль-Хайтам",
      "text": "Например?",
      "target": "sumeru-alhaitham-sprite",
      "sprite": "alhaitham_05_questioning"
    },
    {
      "speaker": "Кавех",
      "text": "Например, чтобы здесь было немного уютнее.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_09_explaining"
    },
    {
      "speaker": "Аль-Хайтам",
      "text": "Тебе не кажется, что ты и так достаточно изменил обстановку?",
      "target": "sumeru-alhaitham-sprite",
      "sprite": "alhaitham_06_ironic"
    },
    {
      "speaker": "Кавех",
      "text": "Ой, только не начинай.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_10_exasperated"
    },
    {
      "speaker": "Кавех",
      "text": "Ладно, не будем больше о нём.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_11_turn_to_nastya"
    },
    {
      "speaker": "Кавех",
      "text": "Я вообще-то приготовил для тебя кое-что. Думаю, дома пригодится.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_12_gift"
    }
  ],
  "after": [
    {
      "speaker": "Кавех",
      "text": "Вот. Теперь хоть немного уюта добавится.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_13_satisfied"
    },
    {
      "speaker": "Кавех",
      "text": "А то если оставить всё на его вкус, мы скоро будем жить среди серых стен и стопок книг.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_14_teasing"
    },
    {
      "speaker": "Аль-Хайтам",
      "text": "Я всё ещё здесь.",
      "target": "sumeru-alhaitham-sprite",
      "sprite": "alhaitham_07_still_here"
    },
    {
      "speaker": "Кавех",
      "text": "Я знаю!",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_15_shouting"
    },
    {
      "speaker": "Аль-Хайтам",
      "text": "Тогда зачем ты это говоришь?",
      "target": "sumeru-alhaitham-sprite",
      "sprite": "alhaitham_08_question"
    },
    {
      "speaker": "Кавех",
      "text": "Чтобы она знала, на чьей стороне быть.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_16_confident"
    },
    {
      "speaker": "Аль-Хайтам",
      "text": "Не думаю, что она собирается выбирать сторону.",
      "target": "sumeru-alhaitham-sprite",
      "sprite": "alhaitham_09_reasonable"
    },
    {
      "speaker": "Кавех",
      "text": "Это пока.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_17_smug"
    },
    {
      "speaker": "Кавех",
      "text": "В общем, подарок у тебя. А мне пора спасать этот дом от окончательного превращения в библиотеку.",
      "target": "sumeru-kaveh-sprite",
      "sprite": "kaveh_18_farewell"
    }
  ]
};
const sumeruBackground = document.getElementById("sumeru-background");
const sumeruActors = document.getElementById("sumeru-actors");
const sumeruNastya = document.getElementById("sumeru-nastya");
const sumeruVikutoria = document.getElementById("sumeru-vikutoria");
const sumeruKaveh = document.getElementById("sumeru-kaveh");
const sumeruAlhaitham = document.getElementById("sumeru-alhaitham");
const sumeruCharacters = [sumeruNastya, sumeruVikutoria, sumeruKaveh, sumeruAlhaitham];
const sumeruDialogueUI = {
  ...rizleyDialogueUI,
  characters: sumeruCharacters,
  setSprite: setSumeruSprite
};
let sumeruSequence = [];
let sumeruDialogueIndex = 0;
let sumeruLastTap = -Infinity;

function acceptSumeruTap() {
  const now = performance.now();
  if (now - sumeruLastTap < 300) return false;
  sumeruLastTap = now;
  return true;
}

// Идентификатор эмоции сохраняется независимо от фактического PNG.
function setSumeruSprite(target, state) {
  const element = document.getElementById(target);
  const visual = sumeruVisuals[state];
  const path = visual ? visual.src : assetRoot + state;
  if (element.getAttribute("src") !== path) element.src = path;
  if (visual) element.alt = visual.name;
  element.dataset.state = state;
}

function setSumeruBackground(label) {
  const filename = label === "СУМЕРУ — ДОМ" ? "sumeru_house_bg.png" : "sumeru_arrival_bg.png";
  const image = document.getElementById("region-background-image");
  image.src = "assets/images/backgrounds/" + filename;
  image.className = "region-background-image";
  sumeruBackground.hidden = false;
}

function startSumeruScene() {
  setRegionMusic("sumeru");
  stage = "sumeru-arrival";
  nextScene.hidden = false;
  nextScene.setAttribute("aria-label", "Сумеру");
  nextScene.classList.add("sumeru-scene");
  fontaineBackground.hidden = true;
  [fontaineNastya, fontaineVikutoria, fontaineRizley, fontaineNeuvillette, fontaineChest].forEach(actor => { actor.hidden = true; });
  activeNote = null;
  fontaineNoteOverlay.hidden = true;
  wishAction.hidden = true;
  rizleyDialogue.hidden = true;
  rizleyDialogue.classList.remove("dialogue-fade-out");
  sumeruActors.hidden = false;
  sumeruCharacters.forEach(actor => {
    actor.hidden = true;
    actor.inert = false;
    actor.classList.remove("is-speaking");
  });
  setSumeruSprite("sumeru-nastya-sprite", "nastya_idle.png");
  setSumeruSprite("sumeru-vikutoria-sprite", "vikutoria_idle.png");
  setSumeruSprite("sumeru-kaveh-sprite", "kaveh_01_greeting");
  setSumeruSprite("sumeru-alhaitham-sprite", "alhaitham_01_idle");
  setSumeruBackground("СУМЕРУ — ПРИБЫТИЕ");
  fontaineChest.classList.add("sumeru-chest");
  fontaineChest.classList.remove("interactive");
  fontaineChest.disabled = true;
  fontaineChest.inert = false;
  fontaineNext.hidden = false;
  fontaineNext.disabled = false;
  fontaineNext.inert = false;
  fontaineNext.textContent = "Далее ◆";
  fontaineNext.setAttribute("aria-label", "Показать Настю и Викуторию");
  sumeruLastTap = performance.now();
}

function showSumeruChest() {
  stage = "sumeru-chest";
  rizleyDialogue.hidden = true;
  fontaineNext.hidden = true;
  sumeruCharacters.forEach(actor => { actor.hidden = true; });
  setSumeruBackground("СУМЕРУ — СУНДУК");
  fontaineChest.hidden = false;
  fontaineChest.disabled = false;
  fontaineChest.inert = false;
  fontaineChest.classList.add("interactive");
  fontaineChest.focus({ preventScroll: true });
}

function startSumeruDialogue(part) {
  activeNote = null;
  fontaineNoteOverlay.hidden = true;
  stage = "sumeru-dialogue-" + part;
  sumeruSequence = sumeruDialogues[part];
  sumeruDialogueIndex = 0;
  sumeruCharacters.forEach(actor => { actor.inert = false; });
  sumeruNastya.hidden = false;
  sumeruKaveh.hidden = false;
  sumeruVikutoria.hidden = true;
  sumeruAlhaitham.hidden = part === "first";
  // Не сбрасываем предыдущие эмоции: renderer меняет только говорящего.
  setSumeruBackground(part === "after" ? "СУМЕРУ — ДОМ" : "СУМЕРУ — ДИАЛОГ");
  fontaineChest.hidden = true;
  fontaineChest.disabled = true;
  fontaineNext.hidden = false;
  fontaineNext.inert = false;
  rizleyDialogue.hidden = false;
  rizleyDialogue.inert = false;
  sumeruDialogueUI.finalLabel = part === "first" ? "Открыть записку с книгой"
    : part === "argument" ? "Открыть записку с домом" : "Открыть карту Ли Юэ";
  renderDialogue(sumeruSequence, sumeruDialogueIndex, sumeruDialogueUI);
  sumeruLastTap = performance.now();
  fontaineNext.focus({ preventScroll: true });
}

fontaineNext.addEventListener("click", () => {
  if (nextScene.hidden || !isLandscape() || activeNote || !stage.startsWith("sumeru-")) return;
  if (!["sumeru-arrival", "sumeru-idle", "sumeru-look"].includes(stage) && !stage.startsWith("sumeru-dialogue-")) return;
  if (!acceptSumeruTap()) return;
  if (stage === "sumeru-arrival") {
    stage = "sumeru-idle";
    sumeruNastya.hidden = false;
    sumeruVikutoria.hidden = false;
    fontaineNext.setAttribute("aria-label", "Продолжить");
  } else if (stage === "sumeru-idle") {
    stage = "sumeru-look";
    renderDialogue([{speaker: "Викутория", text: "Смотри!", target: "sumeru-vikutoria-sprite", sprite: "vikutoria_pointing_chest.png"}], 0, sumeruDialogueUI);
    rizleyDialogue.hidden = false;
  } else if (stage === "sumeru-look") {
    showSumeruChest();
  } else if (sumeruDialogueIndex < sumeruSequence.length - 1) {
    sumeruDialogueIndex += 1;
    if (stage === "sumeru-dialogue-argument" && sumeruDialogueIndex === sumeruSequence.length - 1) setSumeruBackground("СУМЕРУ — ДОМ");
    renderDialogue(sumeruSequence, sumeruDialogueIndex, sumeruDialogueUI);
  } else if (stage === "sumeru-dialogue-first") {
    showPackageNote("book");
  } else if (stage === "sumeru-dialogue-argument") {
    showPackageNote("house");
  } else {
    finishSumeruScene();
  }
});

fontaineChest.addEventListener("click", () => {
  if (nextScene.hidden || !isLandscape() || stage !== "sumeru-chest" || fontaineChest.disabled || !acceptSumeruTap()) return;
  fontaineChest.disabled = true;
  showPackageNote("feather");
});

function finishSumeruScene() {
  stage = "sumeru-departing";
  rizleyDialogue.hidden = true;
  fontaineNext.hidden = true;
  sumeruActors.classList.add("sumeru-departing");
  setTimeout(() => {
    if (stage !== "sumeru-departing") return;
    sumeruCharacters.forEach(actor => { actor.hidden = true; });
    sumeruActors.hidden = true;
    sumeruActors.classList.remove("sumeru-departing");
    openMap("assets/images/maps/map_liyue.png", "liyue_pending");
    teleportButton.setAttribute("aria-label", "Телепортироваться в Ли Юэ");
  }, 220);
}

// Продолжаем существующий маршрут телепорта Ли Юэ.
registerScene("liyue_pending", startLiyueScene);


// Ли Юэ и завершение главы: общий renderer и реестр спрайтов.
Object.assign(sumeruVisuals, {
  "zhongli_01_greeting": {
    "name": "Чжун Ли",
    "label": "приветствие",
    "src": "assets/images/characters/zhongli_01_greeting.png"
  },
  "zhongli_02_observant": {
    "name": "Чжун Ли",
    "label": "заинтересованность",
    "src": "assets/images/characters/zhongli_06_reflective.png"
  },
  "zhongli_03_reassuring": {
    "name": "Чжун Ли",
    "label": "доброжелательность",
    "src": "assets/images/characters/zhongli_03_reassuring.png"
  },
  "zhongli_04_birthday": {
    "name": "Чжун Ли",
    "label": "поздравление",
    "src": "assets/images/characters/zhongli_04_birthday.png"
  },
  "zhongli_05_gift": {
    "name": "Чжун Ли",
    "label": "подарок",
    "src": "assets/images/characters/zhongli_05_gift.png"
  },
  "zhongli_06_reflective": {
    "name": "Чжун Ли",
    "label": "задумчивость",
    "src": "assets/images/characters/zhongli_06_reflective.png"
  },
  "zhongli_07_hope": {
    "name": "Чжун Ли",
    "label": "тёплая улыбка",
    "src": "assets/images/characters/zhongli_09_gentle.png"
  },
  "zhongli_08_pleased": {
    "name": "Чжун Ли",
    "label": "удовлетворение",
    "src": "assets/images/characters/zhongli_08_pleased.png"
  },
  "zhongli_09_gentle": {
    "name": "Чжун Ли",
    "label": "мягкая улыбка",
    "src": "assets/images/characters/zhongli_09_gentle.png"
  },
  "zhongli_10_warm_wish": {
    "name": "Чжун Ли",
    "label": "забота",
    "src": "assets/images/characters/zhongli_10_warm_wish.png"
  },
  "zhongli_11_invitation": {
    "name": "Чжун Ли",
    "label": "приглашение",
    "src": "assets/images/characters/zhongli_11_invitation.png"
  },
  "zhongli_12_osmanthus": {
    "name": "Чжун Ли",
    "label": "османтус",
    "src": "assets/images/characters/zhongli_12_osmanthus.png"
  },
  "zhongli_13_tea": {
    "name": "Чжун Ли",
    "label": "чай, самоирония",
    "src": "assets/images/characters/zhongli_13_tea.png"
  },
  "zhongli_14_exception": {
    "name": "Чжун Ли",
    "label": "исключение",
    "src": "assets/images/characters/zhongli_14_exception.png"
  }
});
const endingDialogues = {
  "main": [
    {
      "speaker": "Чжун Ли",
      "text": "Анастасия. Рад наконец с вами встретиться.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_01_greeting"
    },
    {
      "speaker": "Настя",
      "text": "Здравствуйте...",
      "target": "sumeru-nastya-sprite",
      "sprite": "nastya_01_confused.png"
    },
    {
      "speaker": "Чжун Ли",
      "text": "Полагаю, путь до Ли Юэ оказался для вас достаточно насыщенным.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_02_observant"
    },
    {
      "speaker": "Настя",
      "text": "Это ещё мягко сказано.",
      "target": "sumeru-nastya-sprite",
      "sprite": "nastya_11_tired_irony.png"
    },
    {
      "speaker": "Чжун Ли",
      "text": "Что ж, тогда, надеюсь, здесь вы сможете немного передохнуть.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_03_reassuring",
      "pause": true
    },
    {
      "speaker": "Чжун Ли",
      "text": "С днём рождения.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_04_birthday"
    },
    {
      "speaker": "Чжун Ли",
      "text": "Желаю вам побольше спокойных вечеров, приятных встреч и вещей, которыми действительно хочется дорожить.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_04_birthday"
    },
    {
      "speaker": "Настя",
      "text": "Спасибо.",
      "target": "sumeru-nastya-sprite",
      "sprite": "nastya_05_grateful.png"
    },
    {
      "speaker": "Чжун Ли",
      "text": "Я приготовил для вас кое-что небольшое.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_05_gift"
    },
    {
      "speaker": "Чжун Ли",
      "text": "Думаю, вы уже догадались, что последний подарок от меня.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_05_gift"
    },
    {
      "speaker": "Чжун Ли",
      "text": "Открывайте. Я подожду.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_05_gift"
    }
  ],
  "final": [
    {
      "speaker": "Чжун Ли",
      "text": "Что ж… похоже, мы действительно добрались до конца.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_06_reflective"
    },
    {
      "speaker": "Настя",
      "text": "Уже?",
      "target": "sumeru-nastya-sprite",
      "sprite": "nastya_07_already.png"
    },
    {
      "speaker": "Чжун Ли",
      "text": "Похоже, что так.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_06_reflective"
    },
    {
      "speaker": "Чжун Ли",
      "text": "Надеюсь, этот небольшой подарок вам понравился.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_07_hope"
    },
    {
      "speaker": "Настя",
      "text": "Да. Мне всё очень понравилось.",
      "target": "sumeru-nastya-sprite",
      "sprite": "nastya_12_warm_smile.png"
    },
    {
      "speaker": "Чжун Ли",
      "text": "Это приятно слышать.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_08_pleased",
      "pause": true
    },
    {
      "speaker": "Чжун Ли",
      "text": "Анастасия… красивое имя.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_09_gentle"
    },
    {
      "speaker": "Настя",
      "text": "Спасибо.",
      "target": "sumeru-nastya-sprite",
      "sprite": "nastya_05_grateful.png"
    },
    {
      "speaker": "Чжун Ли",
      "text": "Но я бы предпочёл, чтобы рядом с вами было поменьше холода и побольше тепла.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_10_warm_wish"
    },
    {
      "speaker": "Настя",
      "text": "Звучит как хорошее пожелание.",
      "target": "sumeru-nastya-sprite",
      "sprite": "nastya_12_warm_smile.png"
    },
    {
      "speaker": "Чжун Ли",
      "text": "Тогда позвольте мне сегодня немного о вас позаботиться.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_11_invitation"
    },
    {
      "speaker": "Чжун Ли",
      "text": "И угостить османтусовым…",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_12_osmanthus",
      "pause": true
    },
    {
      "speaker": "Чжун Ли",
      "text": "Чаем.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_13_tea"
    },
    {
      "speaker": "Настя",
      "text": "Чаем?",
      "target": "sumeru-nastya-sprite",
      "sprite": "nastya_13_tea_surprise.png"
    },
    {
      "speaker": "Чжун Ли",
      "text": "Возможно, сегодня я решил сделать небольшое исключение.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_14_exception"
    }
  ],
  "find": [
    {
      "speaker": "Викутория",
      "text": "Смотри, там что-то лежит.",
      "target": "sumeru-vikutoria-sprite",
      "sprite": "vikutoria_pointing_chest.png"
    },
    {
      "speaker": "Викутория",
      "text": "Это что, Мора?",
      "target": "sumeru-vikutoria-sprite",
      "sprite": "vikutoria_03_curious_mora.png"
    },
    {
      "speaker": "Настя",
      "text": "Похоже на то.",
      "target": "sumeru-nastya-sprite",
      "sprite": "nastya_02_done.png"
    }
  ],
  "tea": [
    {
      "speaker": "Чжун Ли",
      "text": "С днём рождения.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_14_exception"
    },
    {
      "speaker": "Чжун Ли",
      "text": "И пусть этот год будет к вам благосклонен.",
      "target": "ending-zhongli-sprite",
      "sprite": "zhongli_14_exception"
    }
  ]
};
// Проверенные реальные фоны, CG и находка Ли Юэ.
const endingVisuals = {
  LIYUE_ARRIVAL_BG: { label: "ЛИ ЮЭ — ПРИБЫТИЕ", src: "assets/images/backgrounds/liyue_arrival_bg.png" },
  LIYUE_MORA_BG: { label: "ЛИ ЮЭ — ЗАПИСКА С МОРОЙ", src: "assets/images/backgrounds/liyue_arrival_bg.png" },
  LIYUE_ZHONGLI_BG: { label: "ЛИ ЮЭ — ВСТРЕЧА С ЧЖУН ЛИ", src: "assets/images/backgrounds/liyue_zhongli_bg.png" },
  CHENYU_TEA_SCENE: { label: "ЧЭНЬЮЙ — ЧАЕПИТИЕ В БЕСЕДКЕ", src: "assets/images/backgrounds/chenyu_tea_scene.png" },
  FINAL_GROUP_PHOTO: { label: "ФИНАЛЬНОЕ ОБЩЕЕ ФОТО", src: "assets/images/backgrounds/final_group_photo.png" },
  LIYUE_MORA_NOTE: { label: "Лист бумаги с монетой Мора", src: "assets/images/ui/liyue_mora_note.png" }
};
const endingZhongli = document.getElementById("ending-zhongli");
const endingCharacters = [sumeruNastya, sumeruVikutoria, endingZhongli];
const foundMoraNote = document.getElementById("liyue-found-note");
const endingFinalScreen = document.getElementById("ending-final-screen");
const endingDialogueUI = {
  ...rizleyDialogueUI, characters: endingCharacters, setSprite: setSumeruSprite
};
let endingPart = "";
let endingIndex = 0;
let endingLastTap = -Infinity;
let endingTimer = null;

// Паузы и финальный кадр не проходят под портретным экраном или в скрытой вкладке.
function endingDelay(milliseconds, callback) {
  if (endingTimer) clearTimeout(endingTimer.id);
  endingTimer = { remaining: milliseconds, callback, stage, started: 0, id: null };
  updateEndingTimer();
}

function updateEndingTimer() {
  if (!endingTimer || typeof isLandscape !== "function") return;
  const timer = endingTimer;
  if (timer.stage !== stage) {
    clearTimeout(timer.id);
    endingTimer = null;
    return;
  }
  const visible = isLandscape() && !document.hidden;
  if (!visible && timer.id !== null) {
    clearTimeout(timer.id);
    timer.remaining = Math.max(0, timer.remaining - (performance.now() - timer.started));
    timer.id = null;
  } else if (visible && timer.id === null) {
    timer.started = performance.now();
    timer.id = setTimeout(() => {
      if (endingTimer !== timer || stage !== timer.stage) return;
      endingTimer = null;
      timer.callback();
    }, timer.remaining);
  }
}
window.addEventListener("resize", updateEndingTimer);
window.addEventListener("orientationchange", updateEndingTimer);
document.addEventListener("visibilitychange", updateEndingTimer);

function acceptEndingTap() {
  const now = performance.now();
  if (now - endingLastTap < 300) return false;
  endingLastTap = now;
  return true;
}

function showEndingVisual(id) {
  const visual = endingVisuals[id];
  const image = document.getElementById("region-background-image");
  image.src = visual.src;
  image.alt = id === "FINAL_GROUP_PHOTO" ? "Общее фото Насти и её спутников" : "";
  image.className = ["CHENYU_TEA_SCENE", "FINAL_GROUP_PHOTO"].includes(id) ? "ending-illustration" : "region-background-image";
  sumeruBackground.dataset.assetId = id;
  sumeruBackground.hidden = false;
}

function startLiyueScene() {
  setRegionMusic("liyue");
  stage = "liyue-arrival";
  nextScene.hidden = false;
  nextScene.setAttribute("aria-label", "Ли Юэ");
  nextScene.classList.add("liyue-scene");
  fontaineBackground.hidden = true;
  [fontaineNastya, fontaineVikutoria, fontaineRizley, fontaineNeuvillette, fontaineChest, sumeruKaveh, sumeruAlhaitham].forEach(actor => { actor.hidden = true; });
  sumeruActors.hidden = false;
  sumeruActors.classList.remove("sumeru-departing");
  endingCharacters.forEach(actor => {
    actor.hidden = true;
    actor.inert = false;
    actor.classList.remove("is-speaking");
  });
  activeNote = null;
  fontaineNoteOverlay.hidden = true;
  wishAction.hidden = true;
  rizleyDialogue.hidden = true;
  rizleyDialogue.classList.remove("dialogue-fade-out");
  foundMoraNote.hidden = false;
  foundMoraNote.disabled = true;
  foundMoraNote.classList.remove("is-close");
  foundMoraNote.dataset.assetId = "LIYUE_MORA_NOTE";
  foundMoraNote.querySelector("img").src = endingVisuals.LIYUE_MORA_NOTE.src;
  endingFinalScreen.hidden = true;
  showEndingVisual("LIYUE_ARRIVAL_BG");
  setSumeruSprite("sumeru-nastya-sprite", "nastya_idle.png");
  setSumeruSprite("sumeru-vikutoria-sprite", "vikutoria_idle.png");
  setSumeruSprite("ending-zhongli-sprite", "zhongli_01_greeting");
  fontaineNext.hidden = false;
  fontaineNext.disabled = false;
  fontaineNext.inert = false;
  fontaineNext.textContent = "Далее ◆";
  fontaineNext.setAttribute("aria-label", "Показать Настю и Викуторию");
  endingLastTap = performance.now();
}

function renderEndingLine(row, finalLabel) {
  rizleyDialogue.hidden = false;
  rizleyDialogue.inert = false;
  fontaineNext.hidden = false;
  fontaineNext.inert = false;
  fontaineNext.disabled = false;
  const illustration = endingPart === "tea";
  renderDialogue([row], 0, {
    ...endingDialogueUI,
    finalLabel,
    ...(illustration ? { characters: [], setSprite() {} } : {})
  });
  if (row.pause) {
    fontaineNext.disabled = true;
    endingDelay(750, () => { fontaineNext.disabled = false; });
  }
}

function startEndingDialogue(part) {
  activeNote = null;
  fontaineNoteOverlay.hidden = true;
  foundMoraNote.hidden = true;
  endingCharacters.forEach(actor => { actor.inert = false; });
  sumeruNastya.hidden = false;
  sumeruVikutoria.hidden = true;
  endingZhongli.hidden = false;
  showEndingVisual("LIYUE_ZHONGLI_BG");
  endingPart = part;
  endingIndex = 0;
  stage = "liyue-dialogue-" + part;
  renderEndingLine(endingDialogues[part][0], part === "main" ? "Открыть подарок с чашкой" : "Перейти к чаепитию");
  endingLastTap = performance.now();
  fontaineNext.focus({ preventScroll: true });
}

fontaineNext.addEventListener("click", () => {
  if (nextScene.hidden || !isLandscape() || activeNote || fontaineNext.disabled) return;
  if (!["liyue-arrival", "liyue-idle", "liyue-look", "liyue-mora-question", "liyue-mora-answer", "liyue-dialogue-main", "liyue-dialogue-final", "ending-tea"].includes(stage)) return;
  if (!acceptEndingTap()) return;
  if (stage === "liyue-arrival") {
    stage = "liyue-idle";
    sumeruNastya.hidden = false;
    sumeruVikutoria.hidden = false;
    fontaineNext.setAttribute("aria-label", "Продолжить");
  } else if (stage === "liyue-idle") {
    stage = "liyue-look";
    renderEndingLine(endingDialogues.find[0], "Приблизиться к находке");
  } else if (stage === "liyue-look") {
    stage = "liyue-mora-question";
    showEndingVisual("LIYUE_MORA_BG");
    foundMoraNote.hidden = false;
    renderEndingLine(endingDialogues.find[1], "Следующая реплика");
  } else if (stage === "liyue-mora-question") {
    stage = "liyue-mora-answer";
    renderEndingLine(endingDialogues.find[2], "Рассмотреть записку");
  } else if (stage === "liyue-mora-answer") {
    stage = "liyue-mora-zoom";
    rizleyDialogue.hidden = true;
    fontaineNext.hidden = true;
    endingCharacters.forEach(actor => { actor.hidden = true; });
    foundMoraNote.classList.add("is-close");
    endingDelay(450, () => {
      stage = "liyue-mora-interactive";
      foundMoraNote.disabled = false;
      foundMoraNote.focus({ preventScroll: true });
    });
  } else if (endingIndex < endingDialogues[endingPart].length - 1) {
    endingIndex += 1;
    renderEndingLine(endingDialogues[endingPart][endingIndex], endingPart === "main" ? "Открыть подарок с чашкой" : endingPart === "final" ? "Перейти к чаепитию" : "Показать общее фото");
  } else if (endingPart === "main") {
    showPackageNote("tea");
  } else if (endingPart === "final") {
    startChenyuTeaTransition();
  } else {
    startGroupPhotoTransition();
  }
});

foundMoraNote.addEventListener("click", () => {
  if (nextScene.hidden || !isLandscape() || stage !== "liyue-mora-interactive" || foundMoraNote.disabled || !acceptEndingTap()) return;
  foundMoraNote.disabled = true;
  showPackageNote("mora");
});

function fadeEndingScene(callback) {
  rizleyDialogue.hidden = true;
  fontaineNext.hidden = true;
  sumeruBackground.classList.add("ending-scene-fade");
  sumeruActors.classList.add("sumeru-departing");
  endingZhongli.classList.add("ending-scene-fade");
  endingDelay(350, () => {
    endingCharacters.forEach(actor => { actor.hidden = true; });
    sumeruBackground.classList.remove("ending-scene-fade");
    sumeruActors.classList.remove("sumeru-departing");
    endingZhongli.classList.remove("ending-scene-fade");
    callback();
  });
}

function startChenyuTeaTransition() {
  setRegionMusic("chenyu");
  stage = "ending-tea-transition";
  fadeEndingScene(() => {
    stage = "ending-tea";
    endingPart = "tea";
    endingIndex = 0;
    showEndingVisual("CHENYU_TEA_SCENE");
    renderEndingLine(endingDialogues.tea[0], "Следующее пожелание");
    endingLastTap = performance.now();
  });
}

function startGroupPhotoTransition() {
  stage = "ending-photo-transition";
  fadeEndingScene(() => {
    stage = "ending-photo";
    showEndingVisual("FINAL_GROUP_PHOTO");
    endingDelay(4000, startFinalFade);
  });
}

function startFinalFade() {
  stage = "ending-fade";
  sumeruBackground.classList.add("ending-final-fade");
  endingDelay(900, () => {
    stage = "chapter-complete";
    musicToggle.hidden = true;
    sumeruBackground.hidden = true;
    endingFinalScreen.hidden = false;
    rizleyDialogue.hidden = true;
    fontaineNext.hidden = true;
    fontaineNext.disabled = true;
    foundMoraNote.hidden = true;
    foundMoraNote.disabled = true;
    fontaineContinue.disabled = true;
    nextButton.disabled = true;
    teleportButton.disabled = true;
    nextScene.setAttribute("aria-label", "Продолжение следует…");
  });
}


// Та же нативная кнопка и прежние обработчики: в диалоге её область совпадает
// со всей панелью, а надпись скрыта. В установочных кадрах остаётся «Далее».
function bindDialogueHitArea(scene, panel, button) {
  const update = () => {
    const dialogueVisible = !scene.hidden && !panel.hidden;
    button.classList.toggle("dialogue-hit-area", dialogueVisible);
    if (dialogueVisible) {
      button.style.setProperty("--dialogue-hit-height", panel.getBoundingClientRect().height + "px");
    }
  };
  const observer = new MutationObserver(update);
  observer.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  observer.observe(scene, { attributes: true, attributeFilter: ["hidden"] });
  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(panel);
  }
  window.addEventListener("resize", update);
  update();
}
bindDialogueHitArea(beachScene, dialogueBox, nextButton);
bindDialogueHitArea(nextScene, rizleyDialogue, fontaineNext);


// Возврат только внутри текущего разговора: не переоткрываем подарки или видео.
const dialogueBack = document.getElementById("dialogue-back");
let dialogueHistory = [];
let dialogueHistoryGroup = "";

function currentDialogueGroup() {
  if (stage === "dialogue") return "beach";
  if (["liyue-look", "liyue-mora-question", "liyue-mora-answer"].includes(stage)) return "liyue-find";
  if (["fontaine-rizley-dialogue", "fontaine-rizley-continuation",
    "neuvillette-before-wish", "neuvillette-after-wish",
    "sumeru-dialogue-first", "sumeru-dialogue-argument", "sumeru-dialogue-after",
    "liyue-dialogue-main", "liyue-dialogue-final", "ending-tea"].includes(stage)) return stage;
  return "";
}

function rememberDialogueFrame(ui) {
  const group = currentDialogueGroup();
  if (!group || activeNote) return;
  if (dialogueHistoryGroup !== group) {
    dialogueHistoryGroup = group;
    dialogueHistory = [];
  }
  const elements = [...document.querySelectorAll(".character, .character img, .fontaine-background img, #region-background-image, #liyue-found-note")];
  dialogueHistory.push({
    stage, dialogueIndex, rizleyDialogueIndex, neuvilletteIndex, sumeruDialogueIndex, endingIndex,
    ui, speaker: ui.speaker.textContent, text: ui.text.textContent,
    nextLabel: ui.next.getAttribute("aria-label"),
    elements: elements.map(element => ({
      element, hidden: element.hidden, className: element.className,
      src: element.getAttribute("src"), alt: element.getAttribute("alt"),
      state: element.getAttribute("data-state")
    }))
  });
  updateDialogueBack();
}

function updateDialogueBack() {
  const group = currentDialogueGroup();
  const visible = !!group && !activeNote && !document.getElementById("story").hidden
    && (!dialogueBox.hidden || !rizleyDialogue.hidden);
  const disabled = !visible || group !== dialogueHistoryGroup || dialogueHistory.length < 2;
  if (dialogueBack.hidden !== !visible) dialogueBack.hidden = !visible;
  if (dialogueBack.disabled !== disabled) dialogueBack.disabled = disabled;
}

dialogueBack.addEventListener("click", () => {
  if (!isLandscape() || dialogueBack.disabled || activeNote || currentDialogueGroup() !== dialogueHistoryGroup) return;
  dialogueHistory.pop();
  const frame = dialogueHistory[dialogueHistory.length - 1];
  if (!frame) return;
  // Отменяем только паузу текущей реплики; переходы и события сюда не попадают.
  if (endingTimer) { clearTimeout(endingTimer.id); endingTimer = null; }
  stage = frame.stage;
  dialogueIndex = frame.dialogueIndex;
  rizleyDialogueIndex = frame.rizleyDialogueIndex;
  neuvilletteIndex = frame.neuvilletteIndex;
  sumeruDialogueIndex = frame.sumeruDialogueIndex;
  endingIndex = frame.endingIndex;
  for (const saved of frame.elements) {
    saved.element.hidden = saved.hidden;
    saved.element.className = saved.className;
    for (const [name, value] of [["src", saved.src], ["alt", saved.alt], ["data-state", saved.state]]) {
      if (value === null) saved.element.removeAttribute(name);
      else if (saved.element.getAttribute(name) !== value) saved.element.setAttribute(name, value);
    }
  }
  frame.ui.speaker.textContent = frame.speaker;
  frame.ui.text.textContent = frame.text;
  frame.ui.next.disabled = false;
  frame.ui.next.setAttribute("aria-label", frame.nextLabel || "Следующая реплика");
  // Следующее обычное нажатие вновь показывает следующую реплику.
  const now = performance.now();
  neuvilletteLastTap = now;
  sumeruLastTap = now;
  endingLastTap = now;
  updateDialogueBack();
});

new MutationObserver(updateDialogueBack).observe(document.getElementById("story"), {
  subtree: true, attributes: true, attributeFilter: ["hidden"]
});
updateDialogueBack();

// Статические PNG скрытых сцен не занимают соединение перед загрузочным видео.
function loadVisibleSceneImages() {
  document.querySelectorAll("img[data-src]").forEach(image => {
    if (!image.getAttribute("src") && image.getClientRects().length) {
      image.src = image.dataset.src;
      image.removeAttribute("data-src");
    }
  });
}
new MutationObserver(loadVisibleSceneImages).observe(document.getElementById("story"), {
  subtree: true, attributes: true, attributeFilter: ["hidden"]
});
window.addEventListener("resize", loadVisibleSceneImages);
loadVisibleSceneImages();
