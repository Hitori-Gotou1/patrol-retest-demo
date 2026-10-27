#!/usr/bin/env python3
"""仅用标准库合成本站原创演示音频；不下载或采样现有歌曲。"""
from array import array
from pathlib import Path
import json
import math
import random
import sys
import wave

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public' / 'assets' / 'audio'
SAMPLE_RATE = 22050
DURATION = 12
BEAT = 0.75
TAU = math.tau

# 简单和弦音型用于验证播放器，并非任何动画音乐的转录或改编。
TRACKS = [
    ('demo-pink-room', 11, [(48, 55, 64, 67), (53, 60, 65, 69), (45, 52, 60, 64), (55, 62, 67, 71)], 'pluck'),
    ('demo-blue-hour', 23, [(50, 57, 65, 69), (46, 53, 62, 65), (53, 60, 65, 69), (48, 55, 62, 67)], 'soft'),
    ('demo-soundcheck', 37, [(52, 59, 64, 67), (48, 55, 62, 67), (55, 62, 67, 71), (50, 57, 62, 66)], 'bright'),
]


def frequency(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def add_note(samples, start, midi, duration, level, tone='pluck'):
    """带衰减包络的简谐波叠加；只修改音频缓冲区，不使用外部素材。"""
    start_sample = round(start * SAMPLE_RATE)
    count = min(round(duration * SAMPLE_RATE), len(samples) - start_sample)
    fundamental = frequency(midi)
    decay = {'pluck': 4.2, 'soft': 2.3, 'bright': 5.0}[tone]
    harmonic = {'pluck': 0.16, 'soft': 0.08, 'bright': 0.24}[tone]
    for i in range(max(0, count)):
        t = i / SAMPLE_RATE
        attack = min(1, t / 0.012)
        release = min(1, (count - i) / (SAMPLE_RATE * 0.12))
        envelope = attack * release * math.exp(-decay * t)
        value = (math.sin(TAU * fundamental * t)
                 + harmonic * math.sin(TAU * fundamental * 2 * t)
                 + 0.04 * math.sin(TAU * fundamental * 3 * t))
        samples[start_sample + i] += level * envelope * value


def add_tick(samples, start, rng, level):
    """小音量短噪声作节拍提示，不模拟或引用现成鼓采样。"""
    first = round(start * SAMPLE_RATE)
    length = round(0.035 * SAMPLE_RATE)
    previous = 0.0
    for i in range(min(length, len(samples) - first)):
        noise = rng.uniform(-1, 1)
        high_pass = noise - previous
        previous = noise
        envelope = (1 - i / length) ** 3 * min(1, i / 12)
        samples[first + i] += high_pass * level * envelope


def render(name, seed, chords, tone):
    rng = random.Random(seed)
    samples = [0.0] * round(DURATION * SAMPLE_RATE)
    for bar, chord in enumerate(chords):
        bar_start = bar * 4 * BEAT
        # 四小节内的拨弦顺序与节拍由本脚本定义，三首演示互不相同。
        pattern = [0, 2, 1, 3, 1, 2, 3, 2] if tone != 'soft' else [0, 1, 3, 2, 1, 3, 2, 1]
        for step, index in enumerate(pattern):
            start = bar_start + step * BEAT / 2
            add_note(samples, start, chord[index] + 12, 1.8, 0.10 if step % 2 == 0 else 0.07, tone)
        for beat in range(4):
            start = bar_start + beat * BEAT
            add_note(samples, start, chord[0] - 12, 0.7, 0.075 if beat % 2 == 0 else 0.045, 'soft')
            add_tick(samples, start + BEAT / 2, rng, 0.009 if tone == 'bright' else 0.004)
        for midi in chord[1:]:
            add_note(samples, bar_start + 0.025, midi, 2.9, 0.04, 'soft')

    # 首尾淡入淡出，统一峰值留出充足余量，避免突然的爆音和削波。
    for i in range(len(samples)):
        fade_in = min(1, i / (SAMPLE_RATE * 0.10))
        fade_out = min(1, (len(samples) - 1 - i) / (SAMPLE_RATE * 0.65))
        samples[i] *= fade_in * fade_out
    peak = max(abs(sample) for sample in samples) or 1
    gain = 0.36 / peak
    pcm = array('h', (round(sample * gain * 32767) for sample in samples))
    if sys.byteorder != 'little':
        pcm.byteswap()
    path = OUTPUT / f'{name}.wav'
    with wave.open(str(path), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(SAMPLE_RATE)
        audio.writeframes(pcm.tobytes())
    with wave.open(str(path), 'rb') as audio:
        assert audio.getnframes() == DURATION * SAMPLE_RATE
        assert audio.getnchannels() == 1 and audio.getsampwidth() == 2
        assert audio.getframerate() == SAMPLE_RATE
    values = array('h', pcm)
    if sys.byteorder != 'little':
        values.byteswap()
    peak_pcm = max(abs(value) for value in values)
    assert peak_pcm < 32767
    assert values[0] == 0 and values[-1] == 0
    return {'file': path.relative_to(ROOT).as_posix(), 'duration': DURATION,
            'bytes': path.stat().st_size, 'peak_dbfs': round(20 * math.log10(peak_pcm / 32767), 2),
            'rms_dbfs': round(20 * math.log10(math.sqrt(sum(value * value for value in values) / len(values)) / 32767), 2),
            'clipped_samples': sum(abs(value) >= 32767 for value in values)}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    print(json.dumps([render(*track) for track in TRACKS], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
