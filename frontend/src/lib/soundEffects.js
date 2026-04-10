const SOUND_EFFECT_PATHS = {
  notification: "/sound/notification.mp3",
  keystroke1: "/sound/keystroke1.mp3",
  keystroke2: "/sound/keystroke2.mp3",
  keystroke3: "/sound/keystroke3.mp3",
  keystroke4: "/sound/keystroke4.mp3",
};

const KEYSTROKE_SOUND_KEYS = [
  "keystroke1",
  "keystroke2",
  "keystroke3",
  "keystroke4",
];

const audioCache = new Map();

let hasInstalledUnlockListeners = false;
let isPlaybackUnlocked = false;
let unlockAttemptPromise = null;

const getAudio = (soundKey) => {
  if (typeof Audio === "undefined") {
    return null;
  }

  if (!audioCache.has(soundKey)) {
    const audio = new Audio(SOUND_EFFECT_PATHS[soundKey]);
    audio.preload = "auto";
    audioCache.set(soundKey, audio);
  }

  return audioCache.get(soundKey);
};

const removeUnlockListeners = () => {
  if (typeof window === "undefined" || !hasInstalledUnlockListeners) {
    return;
  }

  window.removeEventListener("pointerdown", attemptUnlockPlayback, true);
  window.removeEventListener("keydown", attemptUnlockPlayback, true);
  window.removeEventListener("touchstart", attemptUnlockPlayback, true);
  hasInstalledUnlockListeners = false;
};

const primeAudio = async (audio) => {
  if (!audio) {
    return false;
  }

  const previousMuted = audio.muted;
  const previousVolume = audio.volume;

  try {
    audio.muted = true;
    audio.volume = 0;
    audio.currentTime = 0;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    return true;
  } catch {
    return false;
  } finally {
    audio.muted = previousMuted;
    audio.volume = previousVolume;
  }
};

async function attemptUnlockPlayback() {
  if (isPlaybackUnlocked) {
    removeUnlockListeners();
    return true;
  }

  if (unlockAttemptPromise) {
    return unlockAttemptPromise;
  }

  unlockAttemptPromise = (async () => {
    const primeResults = await Promise.all(
      Object.keys(SOUND_EFFECT_PATHS).map((soundKey) =>
        primeAudio(getAudio(soundKey)),
      ),
    );

    if (primeResults.some(Boolean)) {
      isPlaybackUnlocked = true;
      removeUnlockListeners();
      return true;
    }

    return false;
  })();

  try {
    return await unlockAttemptPromise;
  } finally {
    unlockAttemptPromise = null;
  }
}

export const initializeSoundPlayback = () => {
  if (typeof window === "undefined" || hasInstalledUnlockListeners) {
    return;
  }

  Object.keys(SOUND_EFFECT_PATHS).forEach((soundKey) => {
    getAudio(soundKey);
  });

  window.addEventListener("pointerdown", attemptUnlockPlayback, true);
  window.addEventListener("keydown", attemptUnlockPlayback, true);
  window.addEventListener("touchstart", attemptUnlockPlayback, true);
  hasInstalledUnlockListeners = true;
};

export const primeSoundPlayback = () => attemptUnlockPlayback();

export const playSoundEffect = async (soundKey) => {
  const audio = getAudio(soundKey);
  if (!audio) {
    return;
  }

  audio.currentTime = 0;

  try {
    await audio.play();
  } catch (error) {
    console.log("Audio play failed:", error);
  }
};

export const playRandomKeyStrokeSound = () => {
  const randomSoundKey =
    KEYSTROKE_SOUND_KEYS[
      Math.floor(Math.random() * KEYSTROKE_SOUND_KEYS.length)
    ];

  void playSoundEffect(randomSoundKey);
};
