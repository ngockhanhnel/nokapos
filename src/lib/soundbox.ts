/**
 * Soundbox (Loa Thanh Toán Thông Minh DuckPOS)
 * Tích hợp âm thanh chuông Ting-Ting kỹ thuật số âm vang cao
 * kết hợp Web Speech Synthesis đọc tiếng Việt số tiền và mã đơn hàng thời gian thực.
 */

// Helper to convert number to Vietnamese words for natural speech
export function numberToVietnameseWords(num: number): string {
  if (num === 0) return 'không đồng';
  if (num < 0) return 'âm ' + numberToVietnameseWords(Math.abs(num));

  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

  function readGroupOfThree(n: number, isLastGroup: boolean): string {
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;

    let res = '';

    if (h > 0 || !isLastGroup) {
      res += digits[h] + ' trăm ';
      if (t === 0 && u > 0) res += 'linh ';
    }

    if (t > 1) {
      res += digits[t] + ' mươi ';
      if (u === 1) res += 'mốt ';
      else if (u === 5) res += 'lăm ';
      else if (u > 0) res += digits[u] + ' ';
    } else if (t === 1) {
      res += 'mười ';
      if (u === 5) res += 'lăm ';
      else if (u > 0) res += digits[u] + ' ';
    } else if (u > 0) {
      res += digits[u] + ' ';
    }

    return res.trim();
  }

  const groups: number[] = [];
  let temp = Math.floor(num);
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  let textResult = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g > 0) {
      const isLastGroup = i === groups.length - 1;
      const groupText = readGroupOfThree(g, isLastGroup);
      textResult += groupText + ' ' + units[i] + ' ';
    }
  }

  return textResult.trim() + ' đồng';
}

export interface SoundboxSettings {
  enabled: boolean;
  enableChime: boolean;
  enableVoice: boolean;
  volume: number; // 0.1 to 1.0
  speed: number; // 0.8 to 1.2
}

const STORAGE_KEY = 'duckpos_soundbox_settings';

export function getSoundboxSettings(): SoundboxSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {
    enabled: true,
    enableChime: true,
    enableVoice: true,
    volume: 1.0,
    speed: 1.0,
  };
}

export function saveSoundboxSettings(s: SoundboxSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return null;
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (err) {
    console.warn('AudioContext init error:', err);
    return null;
  }
}

/**
 * Phát chuông Ting-Ting chuyên dụng cho Loa thanh toán POS
 * Mô phỏng chuông cơ điện tử âm ngân vang cao
 */
export function playTingTingChime(volume = 1.0): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    if (!ctx) {
      resolve();
      return;
    }

    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(Math.min(1.0, Math.max(0.1, volume)) * 0.4, now);
      masterGain.connect(ctx.destination);

      // Ting 1: High crisp harmonic (B5 ~ 987.77 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(987.77, now);
      gain1.gain.setValueAtTime(1.0, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Ting 2: Higher ringing chime (E6 ~ 1318.51 Hz) at +0.12s
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.51, now + 0.12);
      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.setValueAtTime(1.2, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.7);

      setTimeout(() => {
        resolve();
      }, 650);
    } catch (e) {
      console.warn('TingTing chime error:', e);
      resolve();
    }
  });
}

/**
 * Đọc giọng nói tiếng Việt bằng Web Speech Synthesis
 */
export function speakVietnamese(text: string, volume = 1.0, speed = 1.0): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Cancel any prior speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = speed || 1.0;
      utterance.volume = volume || 1.0;
      utterance.pitch = 1.05;

      // Try finding Vietnamese voice
      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find(
        (v) => v.lang.startsWith('vi') || v.lang.includes('VN') || v.name.toLowerCase().includes('vietnam')
      );
      if (viVoice) {
        utterance.voice = viVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);

      // Safety timeout in case speech synth hangs
      setTimeout(() => {
        resolve();
      }, 10000);
    } catch (e) {
      console.warn('SpeechSynthesis error:', e);
      resolve();
    }
  });
}

/**
 * Phát Loa Thanh Toán Thành Công
 * Kết hợp Chuông Ting-Ting + Giọng đọc tiếng Việt số tiền
 */
export async function playPaymentSoundbox(params: {
  amount: number;
  orderCode?: string;
  shopName?: string;
}): Promise<void> {
  const settings = getSoundboxSettings();
  if (!settings.enabled) return;

  // 1. Play chime Ting-Ting first
  if (settings.enableChime) {
    await playTingTingChime(settings.volume);
  }

  // 2. Play Vietnamese voice announcement
  if (settings.enableVoice) {
    const words = numberToVietnameseWords(params.amount);
    let speechText = `Đã nhận thành công ${words}`;
    if (params.orderCode) {
      // Split order code letters so it spells clearly or reads cleanly
      speechText += ` cho đơn hàng ${params.orderCode}`;
    }

    await speakVietnamese(speechText, settings.volume, settings.speed);
  }
}

/**
 * Kiểm tra Loa thanh toán thử nghiệm
 */
export async function testSoundbox(sampleAmount = 185000): Promise<void> {
  await playPaymentSoundbox({
    amount: sampleAmount,
    orderCode: 'DUCK-TEST',
  });
}
