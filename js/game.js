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
