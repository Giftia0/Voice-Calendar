import { useState, useRef, useCallback, useEffect } from "react";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder
} from "expo-audio";

function normalizeBackendUrl(value) {
  const cleaned = String(value || "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .trim()
    .replace(/\/+$/, "");

  if (!cleaned) {
    return "";
  }

  if (!/^https?:\/\/[^\s/]+(?::\d+)?(?:\/[^\s]*)?$/i.test(cleaned)) {
    throw new Error(`EXPO_PUBLIC_BACKEND_URL 配置无效：${cleaned}`);
  }

  return cleaned;
}

const BACKEND_URL = normalizeBackendUrl(process.env.EXPO_PUBLIC_BACKEND_URL);
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  android: {
    ...RecordingPresets.HIGH_QUALITY.android,
    bitRate: 32000,
    sampleRate: 16000,
    numberOfChannels: 1
  },
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    bitRate: 32000,
    sampleRate: 16000,
    numberOfChannels: 1
  },
  isMeteringEnabled: true
};
const SILENCE_METERING_THRESHOLD = -45;
const SILENCE_AUTO_STOP_MS = 1600;
const SILENCE_CHECK_INTERVAL_MS = 250;
const MIN_AUTO_STOP_RECORDING_MS = 900;

export function useVoiceInput({ chatMessages, setChatMessages, animateSheetRef, onRecognizedText }) {
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const [isListening, setIsListening] = useState(false);
  const [speechText, setSpeechText] = useState("");
  const [speechError, setSpeechError] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState("");

  const transcriptRef = useRef("");
  const messageIdRef = useRef(1);
  const silenceCheckTimerRef = useRef(null);
  const silentSinceRef = useRef(null);
  const hasDetectedSpeechRef = useRef(false);
  const hasMeteringSampleRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  const isStoppingRef = useRef(false);
  const requestAbortControllerRef = useRef(null);
  const isCancellingRef = useRef(false);

  const stopSilenceDetection = useCallback(() => {
    if (silenceCheckTimerRef.current) {
      clearInterval(silenceCheckTimerRef.current);
      silenceCheckTimerRef.current = null;
    }
    silentSinceRef.current = null;
    hasDetectedSpeechRef.current = false;
    hasMeteringSampleRef.current = false;
  }, []);

  useEffect(
    () => () => {
      stopSilenceDetection();
      requestAbortControllerRef.current?.abort();
      if (audioRecorder.isRecording) {
        audioRecorder.stop().catch(() => {});
      }
    },
    [audioRecorder, stopSilenceDetection]
  );

  const createMessageId = useCallback((prefix) => {
    messageIdRef.current += 1;
    return `${prefix}-${messageIdRef.current}`;
  }, []);

  const appendAssistantMessage = useCallback(
    ({ title = "助手回复", text, meta = "当前为固定占位回复" }) => {
      setChatMessages((messages) => [
        ...messages,
        {
          id: createMessageId("assistant"),
          role: "assistant",
          title,
          text,
          meta
        }
      ]);
    },
    [setChatMessages, createMessageId]
  );

  const appendUserMessage = useCallback(
    (text) => {
      setChatMessages((messages) => [
        ...messages,
        {
          id: createMessageId("user"),
          role: "user",
          text
        }
      ]);
    },
    [setChatMessages, createMessageId]
  );

  const appendRecognizedConversation = useCallback(
    async (text) => {
      appendUserMessage(text);

      if (onRecognizedText) {
        await onRecognizedText(text);
        return;
      }

      setChatMessages((messages) => [
        ...messages,
        {
          id: createMessageId("assistant"),
          role: "assistant",
          title: "助手回复",
          text: "我会在这里展示解析后的日程结果",
          meta: "当前为固定占位回复"
        }
      ]);
    },
    [appendUserMessage, onRecognizedText, setChatMessages, createMessageId]
  );

  const transcribeAudio = useCallback(
    async (uri) => {
      if (!BACKEND_URL) {
        throw new Error("EXPO_PUBLIC_BACKEND_URL 未配置");
      }

      const abortController = new AbortController();
      requestAbortControllerRef.current = abortController;

      const formData = new FormData();
      formData.append("audio", {
        uri,
        name: "voice-calendar-recording.m4a",
        type: "audio/mp4"
      });

      const response = await fetch(`${BACKEND_URL}/api/stt/transcribe`, {
        method: "POST",
        body: formData,
        signal: abortController.signal
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail?.message || payload?.error || "语音识别失败");
      }

      return (payload?.text || "").trim();
    },
    []
  );

  const stopSpeechRecognition = useCallback(async () => {
    if (isStoppingRef.current) {
      return;
    }

    if (!audioRecorder.isRecording) {
      stopSilenceDetection();
      setIsListening(false);
      return;
    }

    isStoppingRef.current = true;
    isCancellingRef.current = false;
    const hadMeteringSample = hasMeteringSampleRef.current;
    const hadDetectedSpeech = hasDetectedSpeechRef.current;
    stopSilenceDetection();

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setIsListening(false);

      if (!uri) {
        throw new Error("录音文件生成失败");
      }

      if (hadMeteringSample && !hadDetectedSpeech) {
        appendAssistantMessage({
          title: "识别提示",
          text: "没有识别到有效语音",
          meta: "请靠近麦克风后重试"
        });
        return;
      }

      setSpeechText("正在识别...");
      const transcript = await transcribeAudio(uri);
      if (isCancellingRef.current) {
        return;
      }

      if (transcript) {
        await appendRecognizedConversation(transcript);
      } else {
        appendAssistantMessage({
          title: "识别提示",
          text: "没有识别到有效语音",
          meta: "请靠近麦克风后重试"
        });
      }
    } catch (error) {
      if (isCancellingRef.current || error?.name === "AbortError") {
        return;
      }

      setSpeechError(error?.message || "语音识别失败");
      appendAssistantMessage({
        title: "识别提示",
        text: error?.message || "语音识别失败",
        meta: "请确认后端服务和百炼 API Key 配置"
      });
    } finally {
      setSpeechText("");
      transcriptRef.current = "";
      setIsListening(false);
      isStoppingRef.current = false;
      isCancellingRef.current = false;
      requestAbortControllerRef.current = null;
    }
  }, [
    audioRecorder,
    appendAssistantMessage,
    appendRecognizedConversation,
    stopSilenceDetection,
    transcribeAudio
  ]);

  const startSilenceDetection = useCallback(() => {
    stopSilenceDetection();
    silentSinceRef.current = null;
    hasDetectedSpeechRef.current = false;
    hasMeteringSampleRef.current = false;
    recordingStartedAtRef.current = Date.now();

    silenceCheckTimerRef.current = setInterval(() => {
      if (!audioRecorder.isRecording || isStoppingRef.current) {
        return;
      }

      const status = audioRecorder.getStatus();
      const metering = status?.metering;
      if (typeof metering !== "number") {
        return;
      }

      hasMeteringSampleRef.current = true;
      const now = Date.now();
      const hasVoice = metering > SILENCE_METERING_THRESHOLD;
      if (hasVoice) {
        hasDetectedSpeechRef.current = true;
        silentSinceRef.current = null;
        return;
      }

      if (!hasDetectedSpeechRef.current) {
        return;
      }

      if (now - recordingStartedAtRef.current < MIN_AUTO_STOP_RECORDING_MS) {
        return;
      }

      if (!silentSinceRef.current) {
        silentSinceRef.current = now;
        return;
      }

      if (now - silentSinceRef.current >= SILENCE_AUTO_STOP_MS) {
        stopSpeechRecognition();
      }
    }, SILENCE_CHECK_INTERVAL_MS);
  }, [audioRecorder, stopSilenceDetection, stopSpeechRecognition]);

  const startSpeechRecognition = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      appendAssistantMessage({
        title: "识别提示",
        text: "麦克风权限未开启",
        meta: "请在设置中开启麦克风权限"
      });
      setIsListening(false);
      return;
    }

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      startSilenceDetection();
      setSpeechText("");
      setSpeechError("");
      setIsListening(true);
    } catch (error) {
      setSpeechError(error?.message || "录音启动失败");
      stopSilenceDetection();
      appendAssistantMessage({
        title: "识别提示",
        text: error?.message || "录音启动失败",
        meta: "请检查麦克风权限后重试"
      });
      setIsListening(false);
    }
  }, [audioRecorder, appendAssistantMessage, startSilenceDetection, stopSilenceDetection]);

  const handleMicPress = useCallback(() => {
    if (isListening) {
      stopSpeechRecognition();
      return;
    }

    if (animateSheetRef?.current) {
      animateSheetRef.current(0, true);
    }

    startSpeechRecognition();
  }, [isListening, stopSpeechRecognition, animateSheetRef, startSpeechRecognition]);

  const stopSpeechRecognitionSync = useCallback(() => {
    stopSpeechRecognition();
    setIsListening(false);
  }, [stopSpeechRecognition]);

  const cancelSpeechRecognition = useCallback(() => {
    isCancellingRef.current = true;
    stopSilenceDetection();
    requestAbortControllerRef.current?.abort();
    requestAbortControllerRef.current = null;

    if (audioRecorder.isRecording) {
      audioRecorder.stop().catch(() => {});
    }

    setSpeechText("");
    setSpeechError("");
    setIsListening(false);
    isStoppingRef.current = false;
  }, [audioRecorder, stopSilenceDetection]);

  const handleSendText = useCallback(async () => {
    const text = textInputValue.trim();
    if (!text) return;
    setTextInputValue("");

    try {
      await appendRecognizedConversation(text);
    } catch (error) {
      appendAssistantMessage({
        title: "助手回复",
        text: error?.message || "Agent 调用失败",
        meta: "请检查后端服务和模型接口"
      });
    }
  }, [textInputValue, appendRecognizedConversation, appendAssistantMessage]);

  return {
    isListening,
    speechText,
    speechError,
    showTextInput,
    textInputValue,
    setTextInputValue,
    startSpeechRecognition,
    stopSpeechRecognition: stopSpeechRecognitionSync,
    cancelSpeechRecognition,
    handleMicPress,
    handleSendText
  };
}
