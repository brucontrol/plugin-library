// Kokoro TTS via dynamic ESM import; generate() returns RawAudio (Transformers.js: .data Float32Array, .sampling_rate).
(function () {
  var KOKORO_IMPORT = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
  var MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

  var statusEl = document.getElementById('status');
  var textEl = document.getElementById('text-display');

  var model = null;
  var modelDevice = null;
  var modelPromise = null;

  var synthSeq = 0;
  var cacheKey = '';
  var cacheBuffer = null;

  var playingSource = null;
  var audioCtx = null;

  var live = { text: '', voice: 'af_heart', device: 'wasm', deviceMode: 'auto', speak: false };

  function setStatus(msg, isError) {
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.style.color = isError ? 'var(--accent-red, #ef4444)' : 'var(--text-muted, #888)';
    }
  }

  function getPreviewData() {
    return {
      elementType: 'globalVariable',
      text: 'Hello from Kokoro',
      speak: false,
      voice: 'af_heart',
      device: 'auto',
    };
  }

  function webGpuPresent() {
    return typeof navigator !== 'undefined' && !!navigator.gpu;
  }

  function resolveDeviceMode(raw) {
    var s = String(raw == null || raw === '' ? 'auto' : raw).trim().toLowerCase();
    if (s === 'webgpu' || s === 'wasm' || s === 'auto') return s;
    return 'auto';
  }

  function pickBackend(mode) {
    if (mode === 'webgpu') return 'webgpu';
    if (mode === 'wasm') return 'wasm';
    return webGpuPresent() ? 'webgpu' : 'wasm';
  }

  function contentKey(text, voice, dev) {
    return text + '\n' + voice + '\n' + dev;
  }

  function resetSpeakProp() {
    if (window.BruControl && window.BruControl.updateProperties) {
      window.BruControl.updateProperties({ speak: false });
    }
  }

  function ensureAudioContext() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio not supported');
      audioCtx = new AC();
    }
    return audioCtx;
  }

  function stopPlayback() {
    if (playingSource) {
      try {
        playingSource.stop();
      } catch (e) {}
      try {
        playingSource.disconnect();
      } catch (e2) {}
      playingSource = null;
    }
  }

  function rawToAudioBuffer(raw) {
    var ctx = ensureAudioContext();
    var sr = raw.sampling_rate || raw.sample_rate || 24000;
    var samples = raw.data;
    if (!(samples instanceof Float32Array)) {
      samples = raw.audio;
      if (samples && samples.data instanceof Float32Array) {
        samples = samples.data;
      }
    }
    if (!(samples instanceof Float32Array)) {
      throw new Error('Unexpected Kokoro audio format');
    }
    var buffer = ctx.createBuffer(1, samples.length, sr);
    buffer.getChannelData(0).set(samples);
    return buffer;
  }

  function getModel(backend, mode) {
    if (model && modelDevice === backend) return Promise.resolve(model);
    if (modelDevice !== backend) {
      model = null;
      modelPromise = null;
    }
    modelDevice = backend;
    if (modelPromise) return modelPromise;

    var dtype = backend === 'webgpu' ? 'fp32' : 'q8';
    setStatus('Loading Kokoro model (first load may take a while)...', false);
    modelPromise = import(KOKORO_IMPORT)
      .then(function (m) {
        return m.KokoroTTS.from_pretrained(MODEL_ID, { device: backend, dtype: dtype });
      })
      .then(function (m) {
        model = m;
        setStatus('Ready', false);
        return m;
      })
      .catch(function (e) {
        console.error('[Kokoro TTS] model load failed:', e);
        model = null;
        modelPromise = null;
        modelDevice = null;
        if (mode === 'auto' && backend === 'webgpu') {
          setStatus('WebGPU failed; using WASM...', false);
          return getModel('wasm', 'wasm');
        }
        setStatus('TTS unavailable', true);
        throw e;
      });
    return modelPromise;
  }

  function ensureSynth(text, voice, backend, mode) {
    if (!text) {
      synthSeq++;
      cacheKey = '';
      cacheBuffer = null;
      setStatus('Ready', false);
      return Promise.resolve(null);
    }

    var key = contentKey(text, voice, backend);
    if (cacheKey === key && cacheBuffer) {
      setStatus('Ready (cached)', false);
      return Promise.resolve(cacheBuffer);
    }

    synthSeq++;
    var seq = synthSeq;
    setStatus('Synthesizing...', false);

    return getModel(backend, mode)
      .then(function () {
        if (seq !== synthSeq) return null;
        return model.generate(text, { voice: voice || 'af_heart' });
      })
      .then(function (raw) {
        if (seq !== synthSeq || !raw) return null;
        var buf = rawToAudioBuffer(raw);
        cacheKey = key;
        cacheBuffer = buf;
        setStatus('Ready (cached)', false);
        return buf;
      })
      .catch(function (e) {
        if (seq !== synthSeq) return;
        console.error('[Kokoro TTS] synthesize failed:', e);
        setStatus('Synthesis error', true);
        if (live.speak) resetSpeakProp();
        throw e;
      });
  }

  function tryPlay() {
    if (!live.speak || !live.text) return;
    var key = contentKey(live.text, live.voice, live.device);
    if (cacheKey !== key || !cacheBuffer) return;

    try {
      stopPlayback();
      var ctx = ensureAudioContext();
      if (ctx.state === 'suspended' && ctx.resume) {
        ctx.resume();
      }
      var src = ctx.createBufferSource();
      src.buffer = cacheBuffer;
      src.connect(ctx.destination);
      playingSource = src;
      setStatus('Speaking...', false);
      src.onended = function () {
        playingSource = null;
        setStatus('Ready (cached)', false);
        resetSpeakProp();
      };
      src.start(0);
    } catch (e) {
      console.error('[Kokoro TTS] play failed:', e);
      setStatus('Playback error', true);
      resetSpeakProp();
    }
  }

  function render(data) {
    data = data || {};
    var text = String(data.text || '').trim();
    var voice = String(data.voice || 'af_heart').trim() || 'af_heart';
    var deviceMode = resolveDeviceMode(data.device);
    var backend = pickBackend(deviceMode);
    var speak = data.speak === true;

    live.text = text;
    live.voice = voice;
    live.device = backend;
    live.deviceMode = deviceMode;
    live.speak = speak;

    if (textEl) textEl.textContent = text || '(no text)';

    if (speak && !text) {
      resetSpeakProp();
      setStatus('Ready', false);
      return;
    }

    ensureSynth(text, voice, backend, deviceMode)
      .then(function () {
        tryPlay();
      })
      .catch(function () {});

    if (!speak && !text) {
      setStatus('Ready', false);
    }
  }

  function bootstrap() {
    setStatus('Starting...', false);

    if (window.BruControl) {
      if (window.BruControl.getData) {
        try {
          var d = window.BruControl.getData();
          if (d) render(d);
        } catch (e) {}
      }
      if (window.BruControl.onData) {
        window.BruControl.onData(render);
      }
    } else {
      render(getPreviewData());
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    bootstrap();
  } else {
    document.addEventListener('DOMContentLoaded', bootstrap);
  }
})();
