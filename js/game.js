"use strict";

const dialogues = [
  { speaker: "Рассказчик", text: "Вечер обещал стать особенным. Настя ждала Викуторию у окна." },
  { speaker: "Настя", text: "Ты пришла! Я уже думала, что наш вечер приключений придётся отложить." },
  { speaker: "Викутория", text: "Разве я могла пропустить? У меня для тебя есть маленький сюрприз." },
  { speaker: "Настя", text: "Сюрприз? Теперь мне ещё интереснее. С чего начнём?" },
  { speaker: "Викутория", text: "С первого шага. Всё самое интересное ещё впереди!" },
  { speaker: "Рассказчик", text: "Так началась их история. Конец прототипа — можно прочитать его снова." }
];

const speakerElement = document.getElementById("speaker");
const textElement = document.getElementById("dialogue-text");
const nextButton = document.getElementById("next-button");
const characters = document.querySelectorAll("[data-character]");
let dialogueIndex = 0;

function renderDialogue() {
  const dialogue = dialogues[dialogueIndex];
  speakerElement.textContent = dialogue.speaker;
  textElement.textContent = dialogue.text;
  characters.forEach((character) => {
    character.classList.toggle("is-speaking", character.dataset.character === dialogue.speaker);
  });
  nextButton.textContent = dialogueIndex === dialogues.length - 1 ? "Начать заново" : "Далее →";
}

nextButton.addEventListener("click", () => {
  dialogueIndex = (dialogueIndex + 1) % dialogues.length;
  renderDialogue();
});

renderDialogue();

// Пути относительно index.html. Замените имена на свои файлы.
// Фон может быть JPG/PNG/WebP; персонажи — PNG с прозрачностью.
// Пустая строка отключает изображение и оставляет заглушку.
const sceneImages = {
  background: "assets/images/backgrounds/background.jpg",
  characterLeft: "assets/images/characters/characterLeft.png",
  characterRight: "assets/images/characters/characterRight.png"
};

function loadSceneImage(id, path) {
  const image = document.getElementById(id);
  const character = id === "background" ? null : image.parentElement;
  image.hidden = true;
  if (character) character.classList.remove("has-sprite");

  image.onload = () => {
    image.hidden = false;
    if (character) character.classList.add("has-sprite");
  };
  image.onerror = () => {
    image.hidden = true;
    if (character) character.classList.remove("has-sprite");
  };

  if (path) {
    image.src = path;
  } else {
    image.removeAttribute("src");
  }
}

function loadSceneImages(images) {
  Object.entries(images).forEach(([id, path]) => loadSceneImage(id, path));
}

loadSceneImages(sceneImages);
