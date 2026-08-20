export type MediaLike = {
  play(): Promise<void>;
  pause(): void;
  currentTime: number;
  volume: number;
};

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export class AudioController {
  private baseVolume = 1;

  constructor(private readonly media: MediaLike) {}

  async play(): Promise<void> {
    this.media.volume = this.baseVolume;
    await this.media.play();
  }

  pause(): void {
    this.media.pause();
  }

  async restart(): Promise<void> {
    this.media.currentTime = 0;
    await this.play();
  }

  setVolume(value: number): void {
    this.baseVolume = clamp01(value);
    this.media.volume = this.baseVolume;
  }

  getVolume(): number {
    return this.baseVolume;
  }

  fadeOut(seconds: number, stepMs = 50): Promise<void> {
    return new Promise((resolve) => {
      const steps = Math.max(1, Math.round((seconds * 1000) / stepMs));
      const startVolume = this.media.volume;
      let done = 0;

      const timer = setInterval(() => {
        done += 1;
        this.media.volume = clamp01(startVolume * (1 - done / steps));

        if (done >= steps) {
          clearInterval(timer);
          this.media.pause();
          this.media.currentTime = 0;
          this.media.volume = this.baseVolume;
          resolve();
        }
      }, stepMs);
    });
  }
}
