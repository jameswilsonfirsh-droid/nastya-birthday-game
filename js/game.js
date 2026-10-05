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
const sceneMusic = document.getElementById("scene-music");
let musicActive = false;
let musicNeedsGesture = false;
let musicAttempt = 0;

function playSceneMusic() {
  const attempt = ++musicAttempt;
  musicNeedsGesture = false;
  const playback = sceneMusic.play();
  if (playback) playback.catch((error) => {
    if (!musicActive || attempt !== musicAttempt) return;
    musicNeedsGesture = error.name === "NotAllowedError";
    if (!musicNeedsGesture) console.warn("Не удалось воспроизвести музыку сцены:", error);
  });
}

function startSceneMusic() {
  if (musicActive) return;
  musicActive = true;
  sceneMusic.currentTime = 0;
  playSceneMusic();
}

function stopSceneMusic() {
  musicActive = false;
  musicNeedsGesture = false;
  musicAttempt += 1;
  sceneMusic.pause();
  sceneMusic.currentTime = 0;
}



// Один непрерывный трек на весь Фонтейн; видео молитвы имеет свой звук.
const fontaineMusic = document.getElementById("fontaine-music");
let fontaineMusicActive = false;
let fontaineMusicSuspended = false;
let fontaineMusicNeedsGesture = false;
let fontaineMusicAttempt = 0;

function playFontaineMusic() {
  if (!fontaineMusicActive || fontaineMusicSuspended) return;
  const attempt = ++fontaineMusicAttempt;
  fontaineMusicNeedsGesture = false;
  try {
    const playback = fontaineMusic.play();
    if (playback) playback.catch(error => {
      if (!fontaineMusicActive || fontaineMusicSuspended || attempt !== fontaineMusicAttempt) return;
      fontaineMusicNeedsGesture = error.name === "NotAllowedError";
      if (!fontaineMusicNeedsGesture) console.warn("Не удалось воспроизвести музыку Фонтейна:", error);
    });
  } catch (error) {
    fontaineMusicNeedsGesture = error.name === "NotAllowedError";
    if (!fontaineMusicNeedsGesture) console.warn("Не удалось воспроизвести музыку Фонтейна:", error);
  }
}

function startFontaineMusic() {
  if (fontaineMusicActive) return;
  fontaineMusicActive = true;
  fontaineMusicSuspended = false;
  fontaineMusic.currentTime = 0;
  playFontaineMusic();
}

function pauseFontaineMusicForWish() {
  fontaineMusicSuspended = true;
  fontaineMusicNeedsGesture = false;
  fontaineMusicAttempt += 1;
  fontaineMusic.pause();
}

function resumeFontaineMusicAfterWish() {
  fontaineMusicSuspended = false;
  playFontaineMusic();
}

function stopFontaineMusic() {
  if (!fontaineMusicActive) return;
  fontaineMusicActive = false;
  fontaineMusicSuspended = false;
  fontaineMusicNeedsGesture = false;
  fontaineMusicAttempt += 1;
  fontaineMusic.pause();
  fontaineMusic.currentTime = 0;
}

// Safari может потребовать ещё одно пользовательское нажатие для возобновления.
document.addEventListener("click", () => {
  if (fontaineMusicNeedsGesture && isLandscape()) playFontaineMusic();
}, { capture: true });

// Общий renderer для пляжа и последующих диалоговых сцен.
function renderDialogue(sequence = dialogues, index = dialogueIndex, ui = {
  speaker: speakerElement, text: textElement, next: nextButton, characters,
  finalLabel: "Открыть карту путешествия"
}) {
  const dialogue = sequence[index];
  // Меняем только эмоцию говорящего; второй персонаж сохраняет свой спрайт.
  document.getElementById(dialogue.target).src = assetRoot + dialogue.sprite;
  ui.speaker.textContent = dialogue.displayName ?? dialogue.speaker;
  ui.text.textContent = dialogue.text;
  ui.characters.forEach((character) => {
    character.classList.toggle("is-speaking", (character.dataset.character || character.dataset.fontaineCharacter) === dialogue.speaker);
  });
  const isLast = index === sequence.length - 1;
  ui.next.textContent = "Далее ◆";
  ui.next.setAttribute("aria-label", isLast ? ui.finalLabel : "Следующая реплика");
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
  if (musicActive && musicNeedsGesture) playSceneMusic();
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

// Загружаем спрайты заранее, чтобы смена эмоций не оставляла пустой кадр.
function preloadImage(path) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = () => {
      console.warn("Не удалось загрузить изображение:", path);
      resolve();
    };
    image.src = path;
  });
}

const imagePaths = [
  "assets/images/backgrounds/beach.png",
  assetRoot + "nastya_idle.png",
  assetRoot + "vikutoria_idle.png",
  ...dialogues.map((dialogue) => assetRoot + dialogue.sprite),
  "assets/images/backgrounds/fontaine_arrival_bg.png",
  "assets/images/backgrounds/fontaine_chest_bg.png",
  "assets/images/backgrounds/fontaine_neuvillette_bg.png",
  "assets/images/ui/chest.png",
  "assets/images/ui/mysterious_note.png",
  "assets/images/ui/wolf_package_icon.png",
  "assets/images/ui/flask_package_icon.png",
  assetRoot + "vikutoria_pointing_chest.png",
  assetRoot + "nastya_03_speechless.png",
  assetRoot + "nastya_04_teasing.png",
  assetRoot + "rizley_idle.png",
  assetRoot + "rizley_01_greeting.png",
  assetRoot + "rizley_02_waiting.png",
  assetRoot + "rizley_03_smug.png",
  assetRoot + "rizley_04_gift.png",
  assetRoot + "rizley_05_hope_you_liked_it.png",
  assetRoot + "nastya_05_grateful.png",
  assetRoot + "rizley_06_not_jealous.png",
  assetRoot + "rizley_07_rain_hint.png",
  "assets/images/ui/water_drop_package_icon.png",
  "assets/images/characters/neuvillette_01_greeting.png",
  "assets/images/characters/nastya_01_confused.png",
  "assets/images/characters/neuvillette_02_concerned.png",
  "assets/images/characters/neuvillette_03_knowing.png",
  "assets/images/characters/nastya_06_awkward_admission.png",
  "assets/images/characters/neuvillette_04_my_turn.png",
  "assets/images/characters/neuvillette_05_curious.png",
  "assets/images/characters/neuvillette_06_proposition.png",
  "assets/images/characters/neuvillette_07_fate.png",
  "assets/images/characters/neuvillette_08_result.png",
  "assets/images/characters/neuvillette_09_birthday_wish.png",
  "assets/images/characters/nastya_05_grateful.png",
  "assets/images/characters/neuvillette_10_farewell.png",
  "assets/images/characters/nastya_07_already.png",
  "assets/images/characters/nastya_04_teasing.png",
  "assets/images/characters/neuvillette_11_next_guide.png",
  "assets/images/characters/neuvillette_12_dry_humor.png",
  "assets/images/characters/neuvillette_idle.png",
  "assets/images/ui/wish_package_icon.png",
  "assets/images/maps/map_sumeru.png"
];
const sceneReady = Promise.all(imagePaths.map(preloadImage));

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
  travelDestination = null;
  travelMap.hidden = true;
  launchScene(destination);
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
const fontaineNoteSecondary = fontaineNoteOverlay.querySelector(".note-secondary");
const originalNoteSecondaryText = fontaineNoteSecondary.textContent;
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
    wish: { file: "wish_package_icon.png", alt: "Символ молитвы" }
  };
  const symbol = noteSymbols[packageType];
  if (!symbol) throw new Error("Неизвестный символ записки: " + packageType);
  activeNote = packageType;
  stage = "fontaine-" + packageType + "-note";
  fontaineChest.disabled = true;
  fontaineChest.classList.remove("interactive");
  fontaineNext.hidden = true;
  rizleyDialogue.hidden = true;
  fontaineNoteIcon.src = "assets/images/ui/" + symbol.file;
  fontaineNoteIcon.alt = symbol.alt;
  fontaineNoteText.textContent = "Открой сверток с этим символом";
  fontaineNoteSecondary.textContent = (packageType === "water" || packageType === "wish")
    ? "Нажмите “Продолжить” после вскрытия свертка."
    : originalNoteSecondaryText;
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
  resumeFontaineMusicAfterWish();
  showPackageNote("wish");
});
wishVideo.addEventListener("error", () => reportWishVideoFailure(wishVideo.error));

function startNeuvilletteAfterWish() {
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

// Следующий сюжет ещё не создан: сохраняем карту и фиксируем выбранный переход.
registerScene("sumeru_pending", () => {
  stage = "sumeru-pending";
  travelMap.hidden = false;
  teleportButton.disabled = true;
  teleportButton.setAttribute("aria-label", "Переход в Сумеру подготовлен");
});

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
