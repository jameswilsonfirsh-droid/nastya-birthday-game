"use strict";

const assetRoot = "assets/images/characters/";
const dialogues = [
  {
    speaker: "Настя",
    text: "Ты пришла! Я уже думала, что наш вечер приключений придётся отложить.",
    target: "characterLeft",
    sprite: "nastya_01_confused.png"
  },
  {
    speaker: "Викутория",
    text: "Разве я могла пропустить такое событие? У меня для тебя есть маленький сюрприз.",
    target: "characterRight",
    sprite: "vikutoria_01_indignant.png"
  },
  {
    speaker: "Настя",
    text: "Тогда я готова узнать, что ты придумала.",
    target: "characterLeft",
    sprite: "nastya_02_done.png"
  },
  {
    speaker: "Викутория",
    text: "Тогда скорее! Нас ждёт небольшое приключение.",
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


function renderDialogue() {
  const dialogue = dialogues[dialogueIndex];
  // Меняем только эмоцию говорящего; второй персонаж сохраняет свой спрайт.
  document.getElementById(dialogue.target).src = assetRoot + dialogue.sprite;
  speakerElement.textContent = dialogue.speaker;
  textElement.textContent = dialogue.text;
  characters.forEach((character) => {
    character.classList.toggle("is-speaking", character.dataset.character === dialogue.speaker);
  });
  const isLast = dialogueIndex === dialogues.length - 1;
  nextButton.textContent = isLast ? "Заново ◆" : "Далее ◆";
  nextButton.setAttribute("aria-label", isLast ? "Начать сцену заново" : "Следующая реплика");
}

function startScene() {
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
Promise.all(imagePaths.map(preloadImage)).then(startScene);
