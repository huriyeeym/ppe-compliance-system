/**
 * Audio Alert System
 * Plays alert sounds for violations
 */

class AudioAlertSystem {
  private audioContext: AudioContext | null = null
  private isMuted = false
  private volume = 0.5

  constructor() {
    // Initialize AudioContext on user interaction
    if (typeof window !== 'undefined') {
      window.addEventListener('click', this.initAudioContext.bind(this), { once: true })
    }
  }

  private initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
  }

  /**
   * Play alert sound using Web Audio API
   * Creates a synthesized alert tone
   */
  public playAlert(severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
    if (this.isMuted) return

    this.initAudioContext()
    if (!this.audioContext) return

    const now = this.audioContext.currentTime

    // Create oscillator for alert tone
    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()

    // Connect nodes
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Configure based on severity
    const config = this.getSeverityConfig(severity)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(config.frequency, now)

    // Envelope for natural sound
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(this.volume * config.volume, now + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + config.duration)

    // Play
    oscillator.start(now)
    oscillator.stop(now + config.duration)

    // Play second beep for critical
    if (severity === 'critical') {
      setTimeout(() => this.playAlert('high'), 200)
    }
  }

  private getSeverityConfig(severity: string) {
    const configs = {
      low: { frequency: 440, volume: 0.3, duration: 0.15 },      // A4, short
      medium: { frequency: 523, volume: 0.5, duration: 0.2 },    // C5, medium
      high: { frequency: 659, volume: 0.7, duration: 0.25 },     // E5, longer
      critical: { frequency: 880, volume: 0.9, duration: 0.3 },  // A5, longest
    }
    return configs[severity as keyof typeof configs] || configs.medium
  }

  /**
   * Play success sound
   */
  public playSuccess() {
    if (this.isMuted) return

    this.initAudioContext()
    if (!this.audioContext) return

    const now = this.audioContext.currentTime
    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    oscillator.type = 'sine'

    // Rising tone for success
    oscillator.frequency.setValueAtTime(523, now)           // C5
    oscillator.frequency.linearRampToValueAtTime(659, now + 0.1)  // E5

    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.4, now + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2)

    oscillator.start(now)
    oscillator.stop(now + 0.2)
  }

  /**
   * Toggle mute
   */
  public toggleMute() {
    this.isMuted = !this.isMuted
    return this.isMuted
  }

  /**
   * Set volume (0-1)
   */
  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
  }

  /**
   * Get current state
   */
  public getState() {
    return {
      isMuted: this.isMuted,
      volume: this.volume,
    }
  }
}

// Export singleton instance
export const audioAlert = new AudioAlertSystem()
