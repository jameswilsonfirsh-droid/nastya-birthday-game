"use strict";

const startupScreen = document.getElementById("startup-screen");
const startupText = document.getElementById("startup-text");
const startupButton = document.getElementById("startup-button");
const loadingScreen = document.getElementById("loading-screen");
const loadingVideo = document.getElementById("loading-video");
const enterButton = document.getElementById("enter-button");
const story = document.getElementById("story");
const orientationScreen = document.getElementById("orientation-screen");
let startupStage = "orientation";
let pausedForOrientation = false;
let audioContext;

function isLandscape() {
  return window.matchMedia("(orientation: landscape)").matches;
}

function showTechnicalScreen(text, buttonText = "Продолжить") {
  startupText.textContent = text;
  startupButton.textContent = buttonText;
  startupButton.disabled = false;
  startupButton.hidden = false;
  startupScreen.hidden = false;
}

function showFullscreenFallback() {
  startupStage = "fullscreen-confirm";
  showTechnicalScreen(
    "Safari не разрешил включить полноэкранный режим для этой страницы.\n" +
    "Если браузер показал запрос — подтвердите его вручную.\n" +
    "Если запроса нет, нажмите «Продолжить», чтобы играть в текущем окне. " +
    "Для запуска без панели Safari можно добавить сайт на экран «Домой» через меню «Поделиться»."
  );
}

function showSoundScreen() {
  startupStage = "sound";
  showTechnicalScreen("Сделайте звук погромче.\nОн понадобится дальше.");
}

async function requestGameFullscreen() {
  startupButton.disabled = true;
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request) {
    showFullscreenFallback();
    return;
  }
  try {
    await request.call(root);
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      showSoundScreen();
    } else {
      showFullscreenFallback();
    }
  } catch {
    showFullscreenFallback();
  }
}

function showVideoError(error) {
  if (startupStage !== "video") return;
  loadingVideo.pause();
  startupStage = "video-retry";
  const message = error && error.name === "NotAllowedError"
    ? "Safari остановил воспроизведение.\nНажмите «Продолжить», чтобы разрешить видео со звуком."
    : "Не удалось воспроизвести видео.\nПроверьте подключение и нажмите «Продолжить», чтобы повторить.";
  showTechnicalScreen(message);
}

function playLoadingVideo() {
  startupStage = "video";
  startupScreen.hidden = true;
  loadingScreen.hidden = false;
  enterButton.hidden = true;
  loadingVideo.muted = false;
  loadingVideo.volume = 1;
  loadingVideo.loop = false;
  // play вызывается непосредственно из нажатия: это необходимо Safari для звука.
  const playback = loadingVideo.play();
  if (playback) playback.catch(showVideoError);
}

startupButton.addEventListener("click", () => {
  if (!isLandscape() || startupButton.disabled) return;
  if (startupStage === "orientation") {
    startupStage = "fullscreen";
    showTechnicalScreen("Включите полноэкранный режим");
  } else if (startupStage === "fullscreen") {
    requestGameFullscreen();
  } else if (startupStage === "fullscreen-confirm") {
    showSoundScreen();
  } else if (startupStage === "sound") {
    // Разблокируем Web Audio и запускаем видео в рамках того же пользовательского жеста.
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      try {
        audioContext = new AudioContextClass();
        audioContext.resume().catch(() => {});
      } catch { /* Видео может воспроизводить звук без Web Audio. */ }
    }
    playLoadingVideo();
  } else if (startupStage === "video-retry") {
    if (loadingVideo.error) loadingVideo.load();
    playLoadingVideo();
  }
});

loadingVideo.addEventListener("ended", () => {
  if (startupStage !== "video") return;
  loadingVideo.pause();
  startupStage = "finished";
  // Не меняем currentTime и src: последний кадр остаётся на экране.
  enterButton.hidden = false;
});
loadingVideo.addEventListener("error", () => showVideoError(loadingVideo.error));

enterButton.addEventListener("click", async () => {
  if (!isLandscape() || startupStage !== "finished") return;
  startupStage = "entering";
  enterButton.disabled = true;
  await sceneReady;
  loadingVideo.pause();
  loadingScreen.hidden = true;
  startupScreen.hidden = true;
  story.hidden = false;
  startupStage = "story";
  startScene();
  updateOrientation();
});

function updateOrientation() {
  const landscape = isLandscape();
  orientationScreen.hidden = landscape;
  startupScreen.inert = !landscape;
  loadingScreen.inert = !landscape;
  story.inert = !landscape;
  document.body.style.overflow = landscape && startupStage === "story" ? "" : "hidden";
  if (!landscape && startupStage === "video" && !loadingVideo.paused) {
    pausedForOrientation = true;
    loadingVideo.pause();
  } else if (landscape && pausedForOrientation) {
    pausedForOrientation = false;
    if (startupStage === "video") {
      const playback = loadingVideo.play();
      if (playback) playback.catch(showVideoError);
    }
  }
}

window.addEventListener("resize", updateOrientation);
window.addEventListener("orientationchange", updateOrientation);
const orientationQuery = window.matchMedia("(orientation: landscape)");
if (orientationQuery.addEventListener) orientationQuery.addEventListener("change", updateOrientation);
else orientationQuery.addListener(updateOrientation);
updateOrientation();
