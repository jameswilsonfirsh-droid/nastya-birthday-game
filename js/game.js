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



function renderDialogue() {
  const dialogue = dialogues[dialogueIndex];
  // Меняем только эмоцию говорящего; второй персонаж сохраняет свой спрайт.
  document.getElementById(dialogue.target).src = assetRoot + dialogue.sprite;
  speakerElement.textContent = dialogue.displayName ?? dialogue.speaker;
  textElement.textContent = dialogue.text;
  characters.forEach((character) => {
    character.classList.toggle("is-speaking", character.dataset.character === dialogue.speaker);
  });
  const isLast = dialogueIndex === dialogues.length - 1;
  nextButton.textContent = "Далее ◆";
  nextButton.setAttribute("aria-label", isLast ? "Открыть карту путешествия" : "Следующая реплика");
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
  ...dialogues.map((dialogue) => assetRoot + dialogue.sprite)
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
const fontaineNastya = document.getElementById("fontaine-nastya");
const fontaineVikutoria = document.getElementById("fontaine-vikutoria");
const fontaineRizley = document.getElementById("fontaine-rizley");
const fontaineChest = document.getElementById("fontaine-chest");
const fontaineNext = document.getElementById("fontaine-next");
const fontaineNoteOverlay = document.getElementById("fontaine-note-overlay");
const fontaineContinue = document.getElementById("fontaine-note-continue");
const rizleyDialogue = document.getElementById("rizley-dialogue");
let fontaineFrame = 1;

function renderFontaineFrame() {
  fontaineBackground.classList.toggle("chest-area", fontaineFrame >= 3);
  fontaineNastya.hidden = fontaineFrame < 2;
  fontaineVikutoria.hidden = fontaineFrame < 2 || fontaineFrame === 7;
  fontaineVikutoria.classList.toggle("pointing", fontaineFrame >= 4);
  fontaineVikutoria.setAttribute("aria-label", fontaineFrame >= 4
    ? "Викутория впереди, спиной к камере, указывает на сундук"
    : "Викутория, нейтральное состояние");
  fontaineRizley.hidden = fontaineFrame !== 7;
  fontaineChest.hidden = fontaineFrame < 3 || fontaineFrame === 7;
  fontaineChest.disabled = fontaineFrame !== 5;
  fontaineChest.classList.toggle("interactive", fontaineFrame === 5);
  fontaineChest.classList.toggle("opened", fontaineFrame === 6);
  fontaineNext.hidden = fontaineFrame >= 5;
  fontaineNoteOverlay.hidden = fontaineFrame !== 6;
  rizleyDialogue.hidden = fontaineFrame !== 7;
  // Записка блокирует взаимодействие с объектами за ней.
  [fontaineNastya, fontaineVikutoria, fontaineChest, fontaineNext].forEach(element => {
    element.inert = fontaineFrame === 6;
  });
}

function startFontaineIntro() {
  stage = "fontaine-intro";
  beachScene.hidden = true;
  nextScene.hidden = false;
  fontaineFrame = 1;
  renderFontaineFrame();
}

fontaineNext.addEventListener("click", () => {
  if (nextScene.hidden || !isLandscape() || stage !== "fontaine-intro" || fontaineFrame >= 5) return;
  fontaineFrame += 1;
  renderFontaineFrame();
});

fontaineChest.addEventListener("click", () => {
  if (nextScene.hidden || !isLandscape() || stage !== "fontaine-intro" || fontaineFrame !== 5) return;
  fontaineFrame = 6;
  renderFontaineFrame();
  fontaineContinue.focus({ preventScroll: true });
});

fontaineContinue.addEventListener("click", () => {
  if (nextScene.hidden || !isLandscape() || stage !== "fontaine-intro" || fontaineFrame !== 6) return;
  launchScene("fontaine_rizley_dialogue");
});

function startRizleyDialoguePlaceholder() {
  stage = "fontaine-rizley-dialogue";
  nextScene.hidden = false;
  fontaineFrame = 7;
  renderFontaineFrame();
}

registerScene("fontaine_rizley_intro", startFontaineIntro);
registerScene("fontaine_rizley_dialogue", startRizleyDialoguePlaceholder);
