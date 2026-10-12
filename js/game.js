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
  "assets/images/ui/feather_package_icon.png",
  "assets/images/ui/book_package_icon.png",
  "assets/images/ui/house_package_icon.png",
  "assets/images/ui/mora_package_icon.png",
  "assets/images/ui/tea_package_icon.png",
  "assets/images/maps/map_liyue.png",
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
// Для замены заглушки заполните src существующим путём в sumeruVisuals;
// идентификаторы поз и сценарий не меняются.
const sumeruVisuals = {
  "kaveh_01_greeting": {
    "name": "Кавех",
    "label": "приветствие",
    "src": null
  },
  "kaveh_02_concerned": {
    "name": "Кавех",
    "label": "обеспокоенность",
    "src": null
  },
  "kaveh_03_worried": {
    "name": "Кавех",
    "label": "настороженность",
    "src": null
  },
  "kaveh_04_annoyed": {
    "name": "Кавех",
    "label": "раздражение",
    "src": null
  },
  "kaveh_05_reaction": {
    "name": "Кавех",
    "label": "реакция",
    "src": null
  },
  "kaveh_06_defensive": {
    "name": "Кавех",
    "label": "оправдание",
    "src": null
  },
  "kaveh_07_indignant": {
    "name": "Кавех",
    "label": "возмущение",
    "src": null
  },
  "kaveh_08_arguing": {
    "name": "Кавех",
    "label": "спор",
    "src": null
  },
  "kaveh_09_explaining": {
    "name": "Кавех",
    "label": "объяснение",
    "src": null
  },
  "kaveh_10_exasperated": {
    "name": "Кавех",
    "label": "усталое раздражение",
    "src": null
  },
  "kaveh_11_turn_to_nastya": {
    "name": "Кавех",
    "label": "обращение к Насте",
    "src": null
  },
  "kaveh_12_gift": {
    "name": "Кавех",
    "label": "подарок",
    "src": null
  },
  "kaveh_13_satisfied": {
    "name": "Кавех",
    "label": "довольная улыбка",
    "src": null
  },
  "kaveh_14_teasing": {
    "name": "Кавех",
    "label": "насмешка",
    "src": null
  },
  "kaveh_15_shouting": {
    "name": "Кавех",
    "label": "вспышка раздражения",
    "src": null
  },
  "kaveh_16_confident": {
    "name": "Кавех",
    "label": "уверенность",
    "src": null
  },
  "kaveh_17_smug": {
    "name": "Кавех",
    "label": "хитрая улыбка",
    "src": null
  },
  "kaveh_18_farewell": {
    "name": "Кавех",
    "label": "прощание",
    "src": null
  },
  "alhaitham_01_idle": {
    "name": "Аль-Хайтам",
    "label": "невозмутимость",
    "src": null
  },
  "alhaitham_02_disapproving": {
    "name": "Аль-Хайтам",
    "label": "сухое замечание",
    "src": null
  },
  "alhaitham_03_skeptical": {
    "name": "Аль-Хайтам",
    "label": "скепсис",
    "src": null
  },
  "alhaitham_04_dry_reply": {
    "name": "Аль-Хайтам",
    "label": "сарказм",
    "src": null
  },
  "alhaitham_05_questioning": {
    "name": "Аль-Хайтам",
    "label": "вопрос",
    "src": null
  },
  "alhaitham_06_ironic": {
    "name": "Аль-Хайтам",
    "label": "ирония",
    "src": null
  },
  "alhaitham_07_still_here": {
    "name": "Аль-Хайтам",
    "label": "невозмутимое замечание",
    "src": null
  },
  "alhaitham_08_question": {
    "name": "Аль-Хайтам",
    "label": "недоумение",
    "src": null
  },
  "alhaitham_09_reasonable": {
    "name": "Аль-Хайтам",
    "label": "спокойное возражение",
    "src": null
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
      "sprite": "nastya_05_grateful.png"
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
      "sprite": "nastya_01_confused.png"
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
      "sprite": "nastya_01_confused.png"
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
const sumeruLocation = document.getElementById("sumeru-location");
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

// Универсальная подпись состояния, без запроса отсутствующих файлов.
function setSumeruSprite(target, state) {
  let element = document.getElementById(target);
  const visual = sumeruVisuals[state];
  if (!visual) {
    if (element.tagName !== "IMG") throw new Error("Неизвестное состояние: " + state);
    element.src = assetRoot + state;
  } else if (visual.src) {
    if (element.tagName !== "IMG") {
      const image = document.createElement("img");
      image.id = target;
      element.replaceWith(image);
      element = image;
    }
    element.src = visual.src;
    element.alt = visual.name + " — " + visual.label;
  } else {
    if (element.tagName === "IMG") {
      const placeholder = document.createElement("div");
      placeholder.id = target;
      placeholder.className = "scene-placeholder-character";
      placeholder.setAttribute("role", "img");
      placeholder.innerHTML = '<span class="placeholder-head" aria-hidden="true"></span><span class="placeholder-body" aria-hidden="true"></span><div class="placeholder-caption"><strong></strong><small></small></div>';
      element.replaceWith(placeholder);
      element = placeholder;
    }
    element.querySelector("strong").textContent = visual.name + " — " + visual.label;
    element.querySelector("small").textContent = state;
    element.setAttribute("aria-label", visual.name + " — " + visual.label + " (" + state + ")");
  }
  element.dataset.state = state;
}

function setSumeruBackground(label) {
  sumeruLocation.textContent = label;
  sumeruBackground.hidden = false;
}

function startSumeruScene() {
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
  setSumeruBackground("СУМЕРУ — ДИАЛОГ");
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


// Ли Юэ и завершение главы: переиспользуем renderer и placeholder-адаптер Сумеру.
Object.assign(sumeruVisuals, {
  "zhongli_01_greeting": {
    "name": "Чжун Ли",
    "label": "приветствие",
    "src": null
  },
  "zhongli_02_observant": {
    "name": "Чжун Ли",
    "label": "заинтересованность",
    "src": null
  },
  "zhongli_03_reassuring": {
    "name": "Чжун Ли",
    "label": "доброжелательность",
    "src": null
  },
  "zhongli_04_birthday": {
    "name": "Чжун Ли",
    "label": "поздравление",
    "src": null
  },
  "zhongli_05_gift": {
    "name": "Чжун Ли",
    "label": "подарок",
    "src": null
  },
  "zhongli_06_reflective": {
    "name": "Чжун Ли",
    "label": "задумчивость",
    "src": null
  },
  "zhongli_07_hope": {
    "name": "Чжун Ли",
    "label": "тёплая улыбка",
    "src": null
  },
  "zhongli_08_pleased": {
    "name": "Чжун Ли",
    "label": "удовлетворение",
    "src": null
  },
  "zhongli_09_gentle": {
    "name": "Чжун Ли",
    "label": "мягкая улыбка",
    "src": null
  },
  "zhongli_10_warm_wish": {
    "name": "Чжун Ли",
    "label": "забота",
    "src": null
  },
  "zhongli_11_invitation": {
    "name": "Чжун Ли",
    "label": "приглашение",
    "src": null
  },
  "zhongli_12_osmanthus": {
    "name": "Чжун Ли",
    "label": "османтус",
    "src": null
  },
  "zhongli_13_tea": {
    "name": "Чжун Ли",
    "label": "чай, самоирония",
    "src": null
  },
  "zhongli_14_exception": {
    "name": "Чжун Ли",
    "label": "исключение",
    "src": null
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
      "sprite": "nastya_06_awkward_admission.png"
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
      "sprite": "nastya_05_grateful.png"
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
      "sprite": "nastya_02_done.png"
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
      "sprite": "nastya_01_confused.png"
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
      "sprite": "vikutoria_pointing_chest.png"
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
// Будущие изображения подключаются только здесь; null не вызывает загрузку.
const endingVisuals = {
  LIYUE_ARRIVAL_BG: { label: "ЛИ ЮЭ — ПРИБЫТИЕ", src: null },
  LIYUE_MORA_BG: { label: "ЛИ ЮЭ — ЗАПИСКА С МОРОЙ", src: null },
  LIYUE_ZHONGLI_BG: { label: "ЛИ ЮЭ — ВСТРЕЧА С ЧЖУН ЛИ", src: null },
  CHENYU_TEA_SCENE: { label: "ЧЭНЬЮЙ — ЧАЕПИТИЕ В БЕСЕДКЕ", src: null },
  FINAL_GROUP_PHOTO: { label: "ФИНАЛЬНОЕ ОБЩЕЕ ФОТО", src: null },
  LIYUE_MORA_NOTE: { label: "Лист бумаги с монетой Мора", src: null }
};
const endingZhongli = document.getElementById("ending-zhongli");
const endingCharacters = [sumeruNastya, sumeruVikutoria, endingZhongli];
const foundMoraNote = document.getElementById("liyue-found-note");
const endingGroupLayout = document.getElementById("ending-group-layout");
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
  setSumeruBackground(visual.label);
  sumeruBackground.dataset.assetId = id;
  sumeruLocation.textContent = visual.label + " · " + id;
  let image = sumeruBackground.querySelector("img");
  if (visual.src) {
    if (!image) {
      image = document.createElement("img");
      image.className = "ending-illustration";
      sumeruBackground.prepend(image);
    }
    image.src = visual.src;
    image.alt = visual.label;
    image.hidden = false;
    sumeruLocation.hidden = true;
  } else {
    if (image) image.hidden = true;
    sumeruLocation.hidden = false;
  }
  endingGroupLayout.hidden = id !== "FINAL_GROUP_PHOTO" || !!visual.src;
}

function startLiyueScene() {
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
  foundMoraNote.hidden = true;
  foundMoraNote.disabled = true;
  foundMoraNote.classList.remove("is-close");
  foundMoraNote.dataset.assetId = "LIYUE_MORA_NOTE";
  const itemVisual = endingVisuals.LIYUE_MORA_NOTE;
  let itemImage = foundMoraNote.querySelector("img");
  foundMoraNote.querySelectorAll("span").forEach(element => { element.hidden = !!itemVisual.src; });
  if (itemVisual.src) {
    if (!itemImage) {
      itemImage = document.createElement("img");
      itemImage.className = "ending-illustration";
      foundMoraNote.append(itemImage);
    }
    itemImage.src = itemVisual.src;
    itemImage.alt = itemVisual.label;
    itemImage.hidden = false;
  } else if (itemImage) itemImage.hidden = true;
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
  endingGroupLayout.classList.add("ending-final-fade");
  endingDelay(900, () => {
    stage = "chapter-complete";
    sumeruBackground.hidden = true;
    endingGroupLayout.hidden = true;
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
