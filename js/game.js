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
  nextButton.textContent = isLast ? "Заново ◆" : "Далее ◆";
  nextButton.setAttribute("aria-label", isLast ? "Начать сцену заново" : "Следующая реплика");
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
    startScene();
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
