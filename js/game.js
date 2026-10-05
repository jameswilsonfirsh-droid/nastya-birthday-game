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
  assetRoot + "rizley_04_gift.png"
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
  } else if (stage === "fontaine-rizley-dialogue") {
    if (rizleyDialogueIndex === rizleyDialogues.length - 1) {
      showPackageNote("flask");
      return;
    }
    rizleyDialogueIndex += 1;
    renderDialogue(rizleyDialogues, rizleyDialogueIndex, rizleyDialogueUI);
  }
});

function showPackageNote(packageType) {
  activeNote = packageType;
  stage = packageType === "wolf" ? "fontaine-wolf-note" : "fontaine-flask-note";
  fontaineChest.disabled = true;
  fontaineChest.classList.remove("interactive");
  fontaineNext.hidden = true;
  rizleyDialogue.hidden = true;
  fontaineNoteIcon.src = "assets/images/ui/" + (packageType === "wolf" ? "wolf_package_icon.png" : "flask_package_icon.png");
  fontaineNoteIcon.alt = packageType === "wolf" ? "Пиктограмма лапы" : "Пиктограмма флакона";
  fontaineNoteText.textContent = "Открой сверток с этим символом";
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
    // Граница готового сюжета: остаёмся на записке без новых событий.
    stage = "fontaine-complete";
    fontaineContinue.hidden = true;
  }
});

function startRizleyDialogue() {
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
  renderDialogue(rizleyDialogues, rizleyDialogueIndex, rizleyDialogueUI);
  fontaineNext.focus({ preventScroll: true });
}

registerScene("fontaine_rizley_intro", startFontaineIntro);
registerScene("fontaine_rizley_dialogue", startRizleyDialogue);
