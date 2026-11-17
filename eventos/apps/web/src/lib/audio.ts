// Procedural Sound Effects & Haptics - Modo Ultra-Leve e 100% Silencioso (Otimizado para Mobile/Celular)

export const SOUND_DISABLED = true;

/**
 * Retorna null no modo silencioso para evitar alocação de threads e AudioContext pelo navegador
 */
function getAudioContext(): AudioContext | null {
  return null;
}

/**
 * Ticking de ponteiro da roleta (desativado no modo silencioso)
 */
export function playTickSound(_frequency: number = 800) {
  // 100% silencioso e zero alocação de CPU
}

/**
 * Som de desaceleração final (desativado)
 */
export function playSlowdownSound() {
  // Silencioso
}

/**
 * Fanfarra de vitória / Celebração do prêmio (desativado)
 */
export function playWinFanfare() {
  // Silencioso
}

export const playWinSound = playWinFanfare;

/**
 * Som de Bipe de Leitor Ótico / Scanner de QR Code (desativado)
 */
export function playBeepSound() {
  // Silencioso
}

/**
 * Feedback háptico opcional (apenas micro-vibração nativa se suportado, sem tocar som)
 */
export function triggerHaptic(_type: 'tick' | 'win' | 'click' = 'click') {
  // Desativado para economizar bateria e render em celulares
}

/**
 * Voz Sintetizada (desativada no modo silencioso)
 */
export function speakWinner(_name: string, _prize: string) {
  // Silencioso
}

/**
 * Salva de palmas (desativada)
 */
export function playApplauseSound() {
  // Silencioso
}

/**
 * Chime de notificação (desativado)
 */
export function playChimeSound() {
  // Silencioso
}

/**
 * Anúncio de voz de grande prêmio (desativado)
 */
export function announcePrizeVoice(_name: string, _prize: string) {
  // Silencioso
}

/**
 * Fanfarra VIP (desativada)
 */
export function playVipFanfare() {
  // Silencioso
}

/**
 * Som de chamada (desativado)
 */
export function playAirportChime(): void {
  // Silencioso
}

/**
 * Narração de atendimento (desativada)
 */
export function announceMeetingCall(_name: string, _isVip?: boolean): void {
  // Silencioso
}

/**
 * Desbloqueio de AudioContext (desativado no modo silencioso)
 */
export function unlockAudioContext(): void {
  // Sem áudio
}
