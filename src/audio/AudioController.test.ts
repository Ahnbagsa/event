import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioController, type MediaLike } from './AudioController';

function fakeMedia(): MediaLike & { paused: boolean; playCount: number } {
  return {
    currentTime: 0,
    volume: 1,
    paused: true,
    playCount: 0,
    play() {
      this.paused = false;
      this.playCount += 1;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
  };
}

describe('AudioController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('재생하면 소리가 난다', async () => {
    const media = fakeMedia();
    await new AudioController(media).play();
    expect(media.paused).toBe(false);
  });

  it('일시정지하면 멈춘다', async () => {
    const media = fakeMedia();
    const controller = new AudioController(media);
    await controller.play();
    controller.pause();
    expect(media.paused).toBe(true);
  });

  it('처음부터 다시 재생하면 위치가 0으로 간다', async () => {
    const media = fakeMedia();
    media.currentTime = 90;
    const controller = new AudioController(media);
    await controller.restart();
    expect(media.currentTime).toBe(0);
    expect(media.paused).toBe(false);
  });

  it('볼륨은 0과 1 사이로 잘린다', () => {
    const media = fakeMedia();
    const controller = new AudioController(media);
    controller.setVolume(2);
    expect(controller.getVolume()).toBe(1);
    controller.setVolume(-1);
    expect(controller.getVolume()).toBe(0);
  });

  it('페이드아웃이 끝나면 볼륨을 되돌리고 정지한다', async () => {
    const media = fakeMedia();
    const controller = new AudioController(media);
    await controller.play();

    const done = controller.fadeOut(3, 50);
    await vi.advanceTimersByTimeAsync(3000);
    await done;

    expect(media.paused).toBe(true);
    expect(media.currentTime).toBe(0);
    expect(media.volume).toBe(1);
  });

  it('페이드아웃 중간에는 볼륨이 줄어 있다', async () => {
    const media = fakeMedia();
    const controller = new AudioController(media);
    await controller.play();

    void controller.fadeOut(3, 50);
    await vi.advanceTimersByTimeAsync(1500);

    expect(media.volume).toBeGreaterThan(0);
    expect(media.volume).toBeLessThan(0.7);
  });

  it('설정한 볼륨을 기준으로 페이드한다', async () => {
    const media = fakeMedia();
    const controller = new AudioController(media);
    controller.setVolume(0.5);
    await controller.play();

    const done = controller.fadeOut(1, 50);
    await vi.advanceTimersByTimeAsync(1000);
    await done;

    expect(media.volume).toBe(0.5);
  });
});
