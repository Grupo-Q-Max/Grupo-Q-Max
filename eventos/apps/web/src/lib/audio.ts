// Procedural Sound Effects & Haptics using Web Audio API (Zero external media files needed)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Ticking de ponteiro da roleta (som curto de clique/catraca)
 */
export function playTickSound(frequency: number = 800) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);

    // Haptic sutil no celular
    triggerHaptic('tick');
  } catch {
    // Silencioso se o áudio estiver bloqueado pelo navegador
  }
}

/**
 * Som de desaceleração final
 */
export function playSlowdownSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

/**
 * Fanfarra de vitória / Celebração do prêmio (Acordes ricos em harmônicos)
 */
export function playWinFanfare() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, time: 0.0, dur: 0.15 }, // C5
      { freq: 659.25, time: 0.12, dur: 0.15 }, // E5
      { freq: 783.99, time: 0.24, dur: 0.2 }, // G5
      { freq: 1046.5, time: 0.40, dur: 0.6 }, // C6 (agudo festivo)
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0.4, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });

    triggerHaptic('win');
  } catch {}
}

export const playWinSound = playWinFanfare;

/**
 * Som de Bipe de Leitor Ótico / Scanner de QR Code
 */
export function playBeepSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6 (bipe agudo limpo)
    osc.frequency.setValueAtTime(2637, ctx.currentTime + 0.04); // E7

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);

    triggerHaptic('click');
  } catch {}
}

/**
 * Feedback háptico (vibração no smartphone/tablet)
 */
export function triggerHaptic(type: 'tick' | 'win' | 'click' = 'click') {

  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;

  try {
    if (type === 'tick') {
      navigator.vibrate(10);
    } else if (type === 'win') {
      navigator.vibrate([100, 50, 100, 50, 200]);
    } else {
      navigator.vibrate(20);
    }
  } catch {}
}

/**
 * Voz Sintetizada Nativa de Anúncio de Vitória (Web Speech API)
 */
export function speakWinner(name: string, prize: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel(); // Cancela falas anteriores

    const cleanName = name.split(' ')[0] || name;
    const text = `Parabéns, ${cleanName}! Você ganhou ${prize}!`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05; // Velocidade dinâmica e alegre
    utterance.pitch = 1.1; // Tom animado

    // Tenta selecionar uma voz em português do Brasil
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.includes('pt-BR') || v.lang.includes('pt_BR') || v.lang.includes('pt'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch {}
}

/**
 * Som Procedural de Salva de Palmas e Torcida (Web Audio API)
 */
export function playApplauseSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const duration = 2.2;
    const now = ctx.currentTime;

    // Gera pulsos de palmas usando múltiplos osciladores aleatórios com filtro
    for (let i = 0; i < 24; i++) {
      const delay = Math.random() * duration * 0.85;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400 + Math.random() * 800, now + delay);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000 + Math.random() * 1200, now + delay);
      filter.Q.setValueAtTime(2.5, now + delay);

      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(0.18 + Math.random() * 0.15, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.12);
    }

    triggerHaptic('win');
  } catch {}
}

/**
 * Desbloqueia o AudioContext do navegador no primeiro gesto do usuário
 */
export function unlockAudioContext(): void {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch {}
}

/**
 * Narração por voz nativa (Web Speech API) para animar o estande em português
 */
export function announcePrizeVoice(winnerName: string, prizeName: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel(); // Cancela falas anteriores

    const firstName = winnerName ? winnerName.split(' ')[0] : 'Parabéns';
    const text = `Parabéns, ${firstName}! Você ganhou ${prizeName}!`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05; // Ritmo dinâmico de locutor
    utterance.pitch = 1.1; // Tom alegre

    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang === 'pt-BR' || v.lang.startsWith('pt'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch {
    // Silencioso se não houver suporte de voz
  }
}

/**
 * Som Procedural de Notificação Chime (Novo participante na fila)
 */
export function playChimeSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 659.25, time: 0.0, dur: 0.15 }, // E5
      { freq: 880.00, time: 0.08, dur: 0.25 }, // A5
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0.25, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch {}
}

/**
 * Som Procedural de Chamada de Aeroporto / Summit (Dois acordes em cascata)
 */
export function playAirportChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // F4 (349.23), A4 (440.00), C5 (523.25), F5 (698.46)
    const notes = [
      { freq: 349.23, time: 0.0, dur: 0.35 },
      { freq: 440.00, time: 0.18, dur: 0.35 },
      { freq: 523.25, time: 0.36, dur: 0.4 },
      { freq: 698.46, time: 0.54, dur: 0.8 },
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0.3, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch {}
}

/**
 * Narração por voz nativa de chamada de participante para o atendimento no estande
 */
export function announceMeetingCall(name: string, isVip?: boolean): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();

    const firstName = name ? name.split(' ')[0] : 'Participante';
    const text = isVip
      ? `Atenção: Dr. ${firstName}, seu atendimento VIP Ouro começa agora no estande Finora.`
      : `Dr. ${firstName}, dirija-se ao atendimento no estande Finora.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang === 'pt-BR' || v.lang.startsWith('pt'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch {}
}


