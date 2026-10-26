(() => {
  'use strict';

  // These are playful original impressions of the character, not dialogue quotes.
  const scenes = {
    name: {
      title: '叫、叫的是我吗？',
      text: '脑内已经排练了十种打招呼方式。现实进度：抬头，停顿，再停顿。',
      note: '社交电量：正在重新连接'
    },
    box: {
      title: '纸箱里，暂时安全。',
      text: '先躲一小会儿。等心跳慢下来，再试着向外迈一步。',
      note: '社交电量：安静充电中'
    },
    guitar: {
      title: '这一次，让吉他先开口。',
      text: '说不出口的话，终于找到了出口。手指记得那些一个人练习的夜晚。',
      note: '社交电量：舞台限定满格'
    }
  };
  const theater = document.querySelector('#bocchi-theater');
  const sceneButtons = [...document.querySelectorAll('button[data-scene]')];
  const thoughtTitle = document.querySelector('#thought-title');
  const thoughtText = document.querySelector('#thought-text');
  const sceneNote = document.querySelector('#scene-note');

  function selectScene(name) {
    const scene = scenes[name];
    if (!scene || !theater || !thoughtTitle || !thoughtText || !sceneNote) return;
    theater.dataset.scene = name;
    thoughtTitle.textContent = scene.title;
    thoughtText.textContent = scene.text;
    sceneNote.textContent = scene.note;
    sceneButtons.forEach(button => {
      const selected = button.dataset.scene === name;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('active', selected);
    });
  }

  sceneButtons.forEach(button => {
    button.addEventListener('click', () => selectScene(button.dataset.scene));
  });
  if (theater) selectScene(scenes[theater.dataset.scene] ? theater.dataset.scene : 'box');

  const strumButton = document.querySelector('#strum-button');
  const strumStatus = document.querySelector('#strum-status');
  if (!strumButton) return;
  // This is a momentary play action, not a sound-on/sound-off toggle.
  strumButton.removeAttribute('aria-pressed');
  let audioContext;
  let activeSources = [];
  let activeOutput;
  let playRequest = 0;

  function stopChord() {
    activeSources.forEach(source => {
      source.onended = null;
      try { source.stop(); } catch { /* Already finished. */ }
      source.disconnect();
    });
    activeSources = [];
    if (activeOutput) activeOutput.disconnect();
    activeOutput = null;
    strumButton.removeAttribute('data-playing');
  }

  function createPluck(context, frequency) {
    const duration = 1.25;
    const sampleCount = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    const delay = Math.round(context.sampleRate / frequency);
    const string = new Float32Array(delay);
    for (let i = 0; i < delay; i += 1) string[i] = Math.random() * 2 - 1;
    // A damped delay loop gives each string a quiet, naturally decaying pluck.
    for (let i = 0; i < sampleCount; i += 1) {
      const position = i % delay;
      const value = string[position];
      string[position] = (value + string[(position + 1) % delay]) * 0.496;
      const fadeIn = Math.min(1, i / (context.sampleRate * 0.004));
      const fadeOut = Math.min(1, (sampleCount - i) / (context.sampleRate * 0.12));
      samples[i] = value * fadeIn * fadeOut;
    }
    return buffer;
  }

  strumButton.addEventListener('click', async () => {
    const request = ++playRequest;
    stopChord();
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio is unavailable');
      // Create and resume only in response to an explicit button click.
      if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextClass();
      if (audioContext.state !== 'running') await audioContext.resume();
      if (request !== playRequest) return;
      if (audioContext.state !== 'running') throw new Error('Audio playback is unavailable');

      const output = audioContext.createGain();
      output.gain.value = 0.13;
      output.connect(audioContext.destination);
      activeOutput = output;
      const start = audioContext.currentTime + 0.015;
      const frequencies = [82.41, 123.47, 164.81, 196, 246.94, 329.63];
      frequencies.forEach((frequency, index) => {
        const source = audioContext.createBufferSource();
        source.buffer = createPluck(audioContext, frequency);
        source.connect(output);
        activeSources.push(source);
        source.onended = () => {
          source.disconnect();
          activeSources = activeSources.filter(active => active !== source);
          if (request === playRequest && activeSources.length === 0) {
            output.disconnect();
            activeOutput = null;
            strumButton.removeAttribute('data-playing');
          }
        };
        source.start(start + index * 0.025);
      });
      strumButton.dataset.playing = 'true';
      if (strumStatus) strumStatus.textContent = '和弦响起，今天也向前一点。';
    } catch {
      if (request !== playRequest) return;
      stopChord();
      if (strumStatus) strumStatus.textContent = '这个浏览器暂不支持播放声音。';
    }
  });

  window.addEventListener('pagehide', () => {
    playRequest += 1;
    stopChord();
    if (audioContext && audioContext.state === 'running') audioContext.suspend().catch(() => {});
  });
})();
