// Kokoro Hosted TTS via https://kokoro.samf.dev/v1/audio/speech (OpenAI-compatible)
(function () {
  var API_BASE = 'https://kokoro.samf.dev';
  var API_SPEECH = API_BASE + '/v1/audio/speech';

  var statusEl = document.getElementById('status');
  var textEl = document.getElementById('text-display');

  var synthSeq = 0;
  var cacheKey = '';
  var cacheAudioUrl = null;

  var htmlAudio = null;

  var live = {
    text: '',
    speak: false,
    voice: 'af_heart',
    speed: 1.0,
    responseFormat: 'mp3',
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
      voice: 'af_heart',
      speed: 1.0,
      responseFormat: 'mp3',
    };
  }

  function contentKey(text, voice, speed, responseFormat) {
    return [text, voice, speed, responseFormat].join('\n');
  }

  function resetSpeakProp() {
    if (window.BruControl && window.BruControl.updateProperties) {
      window.BruControl.updateProperties({ speak: false });
    }
  }

  function revokeCacheAudio() {
    if (cacheAudioUrl) {
      try {
        URL.revokeObjectURL(cacheAudioUrl);
      } catch (e) {}
      cacheAudioUrl = null;
    }
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
  }

  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function base64ToBlob(b64, mimeType) {
    var raw = atob(b64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type: mimeType || 'audio/mpeg' });
  }

  function getMimeType(format) {
    switch (String(format || 'mp3').toLowerCase()) {
      case 'wav': return 'audio/wav';
      case 'opus': return 'audio/opus';
      case 'flac': return 'audio/flac';
      default: return 'audio/mpeg';
    }
  }

  function fetchSpeechViaProxy(text, voice, speed, responseFormat) {
    var bodyJson = JSON.stringify({
      model: 'kokoro',
      input: text,
      voice: voice || 'af_heart',
      response_format: responseFormat || 'mp3',
      speed: typeof speed === 'number' ? speed : 1.0,
      stream: false,
    });
    return window.BruControl.fetchExternal({
      method: 'POST',
      url: API_SPEECH,
      headers: {
        'Content-Type': 'application/json',
        Accept: getMimeType(responseFormat),
      },
      bodyBase64: utf8ToBase64(bodyJson),
    }).then(function (res) {
      if (res.error && !res.statusCode) throw new Error(res.error);
      if (res.statusCode >= 200 && res.statusCode < 300 && res.bodyBase64) {
        var mime = (res.headers && res.headers['Content-Type']) || getMimeType(responseFormat);
        return base64ToBlob(res.bodyBase64, mime);
      }
      var msg = 'HTTP ' + res.statusCode;
      if (res.bodyBase64) {
        try {
          var decoded = decodeURIComponent(escape(atob(res.bodyBase64)));
          var j = JSON.parse(decoded);
          if (j.detail != null) {
            msg += ': ' + (typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)).slice(0, 300);
          }
        } catch (e2) {}
      }
      if (res.error) msg += ' — ' + res.error;
      throw new Error(msg);
    });
  }

  function fetchSpeechDirect(text, voice, speed, responseFormat) {
    return fetch(API_SPEECH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: getMimeType(responseFormat),
      },
      body: JSON.stringify({
        model: 'kokoro',
        input: text,
        voice: voice || 'af_heart',
        response_format: responseFormat || 'mp3',
        speed: typeof speed === 'number' ? speed : 1.0,
        stream: false,
      }),
    }).then(function (res) {
      if (res.ok) return res.blob();
      return res.text().then(function (t) {
        var msg = 'HTTP ' + res.status;
        try {
          var j = JSON.parse(t);
          if (j.detail != null) {
            msg += ': ' + (typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)).slice(0, 300);
          } else if (t) {
            msg += ': ' + t.slice(0, 200);
          }
        } catch (e2) {
          if (t) msg += ': ' + t.slice(0, 200);
        }
        throw new Error(msg);
      });
    });
  }

  function fetchSpeech(text, voice, speed, responseFormat) {
    if (window.BruControl && typeof window.BruControl.fetchExternal === 'function') {
      return fetchSpeechViaProxy(text, voice, speed, responseFormat);
    }
    return fetchSpeechDirect(text, voice, speed, responseFormat);
  }

  function ensureSynth(text, voice, speed, responseFormat) {
    if (!text) {
      synthSeq++;
      cacheKey = '';
      revokeCacheAudio();
      setStatus('Ready', false);
      return Promise.resolve(null);
    }

    var v = String(voice || 'af_heart').trim() || 'af_heart';
    var s = typeof speed === 'number' ? Math.max(0.25, Math.min(4, speed)) : 1.0;
    var fmt = String(responseFormat || 'mp3').trim() || 'mp3';

    var key = contentKey(text, v, s, fmt);
    if (cacheKey === key && cacheAudioUrl) {
      setStatus('Ready (cached)', false);
      return Promise.resolve(true);
    }

    synthSeq++;
    var seq = synthSeq;
    setStatus('Requesting audio…', false);

    return fetchSpeech(text, v, s, fmt)
      .then(function (blob) {
        if (seq !== synthSeq) return null;
        revokeCacheAudio();
        cacheKey = key;
        cacheAudioUrl = URL.createObjectURL(blob);
        setStatus('Ready (cached)', false);
        return true;
      })
      .catch(function (e) {
        if (seq !== synthSeq) return;
        console.error('[Kokoro Hosted TTS]', e);
        var msg = e && e.message ? String(e.message) : 'Request failed';
        if (msg.indexOf('Failed to fetch') !== -1 || msg.indexOf('NetworkError') !== -1) {
          msg = 'Network error — add kokoro.samf.dev to ExternalFetch:AllowedHosts for server proxy.';
        }
        setStatus(msg, true);
        revokeCacheAudio();
        cacheKey = '';
        if (live.speak) resetSpeakProp();
        throw e;
      });
  }

  function tryPlay() {
    if (!live.speak || !live.text) return;
    var key = contentKey(
      live.text,
      String(live.voice || 'af_heart').trim() || 'af_heart',
      live.speed,
      live.responseFormat
    );
    if (cacheKey !== key || !cacheAudioUrl) return;

    stopPlayback();
    var a = new Audio();
    a.preload = 'auto';
    a.src = cacheAudioUrl;
    htmlAudio = a;
    setStatus('Speaking…', false);
    a.onended = function () {
      htmlAudio = null;
      setStatus('Ready (cached)', false);
      resetSpeakProp();
    };
    a.onerror = function () {
      console.warn('[Kokoro Hosted TTS] <audio> playback error');
      htmlAudio = null;
      setStatus('Playback error', true);
      resetSpeakProp();
    };
    var pr = a.play();
    if (pr && typeof pr.catch === 'function') {
      pr.catch(function (err) {
        console.warn('[Kokoro Hosted TTS] audio.play() rejected:', err);
        htmlAudio = null;
        setStatus('Tap the page once, then speak again', true);
        resetSpeakProp();
      });
    }
  }

  function render(data) {
    data = data || {};
    var text = String(data.text || '').trim();
    var speak = data.speak === true;
    var voice = String(data.voice != null ? data.voice : 'af_heart').trim() || 'af_heart';
    var speed = typeof data.speed === 'number' ? data.speed : 1.0;
    var responseFormat = String(data.responseFormat != null ? data.responseFormat : 'mp3').trim() || 'mp3';

    live.text = text;
    live.speak = speak;
    live.voice = voice;
    live.speed = speed;
    live.responseFormat = responseFormat;

    if (textEl) textEl.textContent = text || '(no text)';

    if (speak && !text) {
      resetSpeakProp();
      setStatus('Ready', false);
      return;
    }

    ensureSynth(text, voice, speed, responseFormat)
      .then(function () {
        tryPlay();
      })
      .catch(function () {});

    if (!speak && !text) {
      setStatus('Ready', false);
    }
  }

  function bootstrap() {
    setStatus('Kokoro Hosted TTS', false);

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
