// Kokoro TTS: WASM + q8 only. 16-bit PCM WAV + cleaned float PCM for Web Audio (float WAV in <audio> is unreliable).
(function () {
  var KOKORO_IMPORT = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
  var MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

  var statusEl = document.getElementById('status');
  var textEl = document.getElementById('text-display');

  var model = null;
  var modelPromise = null;

  var synthSeq = 0;
  var cacheKey = '';
  var cacheAudioUrl = null;
  var cachePcm = null;
  var cacheSr = 24000;

  var playingSource = null;
  var htmlAudio = null;
  var audioCtx = null;

  var live = {
    text: '',
    voice: 'af_bella',
    speak: false,
  };

  function setStatus(msg, isError) {
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.style.color = isError ? 'var(--accent-red, #ef4444)' : 'var(--text-muted, #888)';
    }
  }

  function getPreviewData() {
    return {
      elementType: 'globalVariable',
      text: "Welcome to BruControl, I'm Bella, your personal text to speech assistant.",
      speak: false,
      voice: 'af_bella',
    };
  }

  function contentKey(text, voice) {
    return text + '\n' + voice;
  }

  function resetSpeakProp() {
    if (window.BruControl && window.BruControl.updateProperties) {
      window.BruControl.updateProperties({ speak: false });
    }
  }

  function revokeCacheMedia() {
    if (cacheAudioUrl) {
      try {
        URL.revokeObjectURL(cacheAudioUrl);
      } catch (e) {}
      cacheAudioUrl = null;
    }
    cachePcm = null;
  }

  function ensureAudioContext() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio not supported');
      try {
        audioCtx = new AC({ sampleRate: 24000 });
      } catch (e) {
        audioCtx = new AC();
      }
    }
    return audioCtx;
  }

  function stopPlayback() {
    if (htmlAudio) {
      try {
        htmlAudio.pause();
        htmlAudio.removeAttribute('src');
        htmlAudio.load();
      } catch (e) {}
      htmlAudio = null;
    }
    if (playingSource) {
      try {
        playingSource.stop();
      } catch (e2) {}
      try {
        playingSource.disconnect();
      } catch (e3) {}
      playingSource = null;
    }
  }

  function getRawSamples(raw) {
    var samples = raw.audio || raw.data;
    if (samples && samples.data instanceof Float32Array) {
      samples = samples.data;
    }
    if (!(samples instanceof Float32Array) || samples.length === 0) {
      return null;
    }
    return samples;
  }

  /** Remove DC offset; peak-normalize if samples clip (common with quantized models). */
  function prepareSamples(samples) {
    var n = samples.length;
    var out = new Float32Array(n);
    out.set(samples);
    var sum = 0;
    var i;
    for (i = 0; i < n; i++) sum += out[i];
    var mean = sum / n;
    for (i = 0; i < n; i++) out[i] -= mean;
    var peak = 0;
    for (i = 0; i < n; i++) {
      var a = Math.abs(out[i]);
      if (a > peak) peak = a;
    }
    if (peak > 1 && Number.isFinite(peak) && peak > 0) {
      var inv = 1 / peak;
      for (i = 0; i < n; i++) out[i] *= inv;
    }
    return out;
  }

  function writeWavString(view, offset, str) {
    for (var i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  /** Standard PCM WAV (format 1, s16le mono) — universally decoded by <audio>. */
  function encodeWavInt16Mono(pcmFloat32, sampleRate) {
    var n = pcmFloat32.length;
    var buffer = new ArrayBuffer(44 + n * 2);
    var view = new DataView(buffer);
    writeWavString(view, 0, 'RIFF');
    view.setUint32(4, 36 + n * 2, true);
    writeWavString(view, 8, 'WAVE');
    writeWavString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeWavString(view, 36, 'data');
    view.setUint32(40, n * 2, true);
    var offset = 44;
    for (var j = 0; j < n; j++, offset += 2) {
      var s = Math.max(-1, Math.min(1, pcmFloat32[j]));
      var v = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      if (v < -32768) v = -32768;
      if (v > 32767) v = 32767;
      view.setInt16(offset, v, true);
    }
    return buffer;
  }

  function playPcmWithContext(ctx) {
    if (!cachePcm || !cachePcm.length) return false;
    try {
      stopPlayback();
      var buf = ctx.createBuffer(1, cachePcm.length, cacheSr);
      buf.getChannelData(0).set(cachePcm);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      playingSource = src;
      setStatus('Speaking...', false);
      src.onended = function () {
        playingSource = null;
        setStatus('Ready (cached)', false);
        resetSpeakProp();
      };
      src.start(0);
      return true;
    } catch (e) {
      console.error('[Kokoro TTS] Web Audio play failed:', e);
      return false;
    }
  }

  function tryPlayAudioElementFallback() {
    if (!cacheAudioUrl) return false;
    stopPlayback();
    var a = new Audio();
    a.preload = 'auto';
    a.src = cacheAudioUrl;
    htmlAudio = a;
    setStatus('Speaking...', false);
    a.onended = function () {
      htmlAudio = null;
      setStatus('Ready (cached)', false);
      resetSpeakProp();
    };
    a.onerror = function () {
      console.warn('[Kokoro TTS] <audio> fallback failed');
      htmlAudio = null;
      setStatus('Playback error', true);
      resetSpeakProp();
    };
    var pr = a.play();
    if (pr && typeof pr.catch === 'function') {
      pr.catch(function (err) {
        console.warn('[Kokoro TTS] audio.play() rejected:', err);
        htmlAudio = null;
        setStatus('Tap the dashboard once, then speak again', true);
        resetSpeakProp();
      });
    }
    return true;
  }

  function getModel() {
    if (model) return Promise.resolve(model);
    if (modelPromise) return modelPromise;

    setStatus('Loading Kokoro model (first load may take a while)...', false);
    modelPromise = import(KOKORO_IMPORT)
      .then(function (m) {
        return m.KokoroTTS.from_pretrained(MODEL_ID, { device: 'wasm', dtype: 'q8' });
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
        setStatus('TTS unavailable', true);
        throw e;
      });
    return modelPromise;
  }

  function ensureSynth(text, voice) {
    if (!text) {
      synthSeq++;
      cacheKey = '';
      revokeCacheMedia();
      setStatus('Ready', false);
      return Promise.resolve(null);
    }

    var key = contentKey(text, voice);
    if (cacheKey === key && cachePcm && cachePcm.length) {
      setStatus('Ready (cached)', false);
      return Promise.resolve(true);
    }

    synthSeq++;
    var seq = synthSeq;
    setStatus('Synthesizing...', false);

    return getModel()
      .then(function () {
        if (seq !== synthSeq) return null;
        return model.generate(text, { voice: voice || 'af_bella' });
      })
      .then(function (raw) {
        if (seq !== synthSeq || !raw) return null;
        var samples = getRawSamples(raw);
        if (!samples) {
          throw new Error('No audio samples from Kokoro');
        }
        var sr = raw.sampling_rate || raw.sample_rate || 24000;
        revokeCacheMedia();
        cacheKey = key;
        cacheSr = sr;
        cachePcm = prepareSamples(new Float32Array(samples));
        try {
          var wav = encodeWavInt16Mono(cachePcm, sr);
          cacheAudioUrl = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
        } catch (blobErr) {
          console.warn('[Kokoro TTS] WAV blob build failed:', blobErr);
        }
        setStatus('Ready (cached)', false);
        return true;
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
    var key = contentKey(live.text, live.voice);
    if (cacheKey !== key || !cachePcm) return;

    var ctx;
    try {
      ctx = ensureAudioContext();
    } catch (e) {
      if (tryPlayAudioElementFallback()) return;
      setStatus('Playback error', true);
      resetSpeakProp();
      return;
    }

    function runWebAudio() {
      if (playPcmWithContext(ctx)) return;
      if (!tryPlayAudioElementFallback()) {
        setStatus('Playback error', true);
        resetSpeakProp();
      }
    }

    if (ctx.state === 'suspended' && ctx.resume) {
      ctx.resume().then(runWebAudio).catch(function (err) {
        console.error('[Kokoro TTS] AudioContext.resume failed:', err);
        if (!tryPlayAudioElementFallback()) {
          setStatus('Tap the dashboard once, then speak again', true);
          resetSpeakProp();
        }
      });
    } else {
      runWebAudio();
    }
  }

  function render(data) {
    data = data || {};
    var text = String(data.text || '').trim();
    var voice = String(data.voice || 'af_bella').trim() || 'af_bella';
    var speak = data.speak === true;

    live.text = text;
    live.voice = voice;
    live.speak = speak;

    if (textEl) textEl.textContent = text || '(no text)';

    if (speak && !text) {
      resetSpeakProp();
      setStatus('Ready', false);
      return;
    }

    ensureSynth(text, voice)
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
