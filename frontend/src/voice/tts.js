import * as Speech from 'expo-speech';

export async function speak(text, options = {}) {
  const { language = 'zh-CN', rate = 1.0, onDone } = options;

  Speech.speak(text, {
    language,
    rate,
    onDone: () => {
      onDone?.();
    },
  });
}

export function stopSpeaking() {
  Speech.stop();
}

export function isSpeaking() {
  return Speech.isSpeakingAsync ? Speech.isSpeakingAsync() : false;
}
