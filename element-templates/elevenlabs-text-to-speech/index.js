// ElevenLabs TTS via https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
(function () {
  var API_TTS = 'https://api.elevenlabs.io/v1/text-to-speech/';

  var statusEl = document.getElementById('status');
  var textEl = document.getElementById('text-display');

  var synthSeq = 0;
  var cacheKey = '';
  var cacheAudioUrl = null;

  var htmlAudio = null;

  var live = {
    text: '',
    speak: false,
    apiKey: '',
    voiceId: '',
    modelId: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
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
      apiKey: '',
      voiceId: '',
      modelId: 'eleven_multilingual_v2',
      outputFormat: 'mp3_44100_128',
    };
  }

  function contentKey(text, apiKey, voiceId, modelId, outputFormat) {
    return [text, apiKey, voiceId, modelId, outputFormat].join('\n');
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

  function fetchSpeechViaProxy(apiKey, voiceId, text, modelId, outputFormat) {
    var url =
      API_TTS +
      encodeURIComponent(voiceId) +
      '?output_format=' +
      encodeURIComponent(outputFormat);
    var bodyJson = JSON.stringify({
      text: text,
      model_id: modelId,
    });
    return window.BruControl.fetchExternal({
      method: 'POST',
      url: url,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'xi-api-key': apiKey,
      },
      bodyBase64: utf8ToBase64(bodyJson),
    }).then(function (res) {
      if (res.error && !res.statusCode) throw new Error(res.error);
      if (res.statusCode >= 200 && res.statusCode < 300 && res.bodyBase64) {
        var mime = (res.headers && res.headers['Content-Type']) || 'audio/mpeg';
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

  function fetchSpeechDirect(apiKey, voiceId, text, modelId, outputFormat) {
    var url =
      API_TTS +
      encodeURIComponent(voiceId) +
      '?output_format=' +
      encodeURIComponent(outputFormat);
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({ text: text, model_id: modelId }),
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

  function fetchSpeech(apiKey, voiceId, text, modelId, outputFormat) {
    var key = String(apiKey || '').trim();
    var vid = String(voiceId || '').trim();
    if (!key || !vid) {
      return Promise.reject(new Error('Missing API key or Voice ID'));
    }
    var mid = String(modelId || 'eleven_multilingual_v2').trim() || 'eleven_multilingual_v2';
    var fmt = String(outputFormat || 'mp3_44100_128').trim() || 'mp3_44100_128';

    // Prefer server proxy (avoids CORS); fall back to direct browser fetch.
    if (window.BruControl && typeof window.BruControl.fetchExternal === 'function') {
      return fetchSpeechViaProxy(key, vid, text, mid, fmt);
    }
    return fetchSpeechDirect(key, vid, text, mid, fmt);
  }

  function ensureSynth(text, apiKey, voiceId, modelId, outputFormat) {
    if (!text) {
      synthSeq++;
      cacheKey = '';
      revokeCacheAudio();
      setStatus('Ready', false);
      return Promise.resolve(null);
    }

    var keyTrim = String(apiKey || '').trim();
    var vidTrim = String(voiceId || '').trim();
    if (!keyTrim || !vidTrim) {
      synthSeq++;
      cacheKey = '';
      revokeCacheAudio();
      setStatus(!keyTrim ? 'Set API key in element settings' : 'Set Voice ID in element settings', true);
      return Promise.resolve(null);
    }

    var key = contentKey(text, keyTrim, vidTrim, modelId, outputFormat);
    if (cacheKey === key && cacheAudioUrl) {
      setStatus('Ready (cached)', false);
      return Promise.resolve(true);
    }

    synthSeq++;
    var seq = synthSeq;
    setStatus('Requesting audio…', false);

    return fetchSpeech(keyTrim, vidTrim, text, modelId, outputFormat)
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
        console.error('[ElevenLabs TTS]', e);
        var msg = e && e.message ? String(e.message) : 'Request failed';
        if (msg.indexOf('Failed to fetch') !== -1 || msg.indexOf('NetworkError') !== -1) {
          msg = 'Network error — check that api.elevenlabs.io is in the server ExternalFetch allowlist.';
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
      String(live.apiKey || '').trim(),
      String(live.voiceId || '').trim(),
      live.modelId,
      live.outputFormat
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
      console.warn('[ElevenLabs TTS] <audio> playback error');
      htmlAudio = null;
      setStatus('Playback error', true);
      resetSpeakProp();
    };
    var pr = a.play();
    if (pr && typeof pr.catch === 'function') {
      pr.catch(function (err) {
        console.warn('[ElevenLabs TTS] audio.play() rejected:', err);
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
    var apiKey = String(data.apiKey != null ? data.apiKey : '');
    var voiceId = String(data.voiceId != null ? data.voiceId : '');
    var modelId = String(data.modelId != null ? data.modelId : 'eleven_multilingual_v2').trim() || 'eleven_multilingual_v2';
    var outputFormat = String(data.outputFormat != null ? data.outputFormat : 'mp3_44100_128').trim() || 'mp3_44100_128';

    live.text = text;
    live.speak = speak;
    live.apiKey = apiKey;
    live.voiceId = voiceId;
    live.modelId = modelId;
    live.outputFormat = outputFormat;

    if (textEl) textEl.textContent = text || '(no text)';

    if (speak && !text) {
      resetSpeakProp();
      setStatus('Ready', false);
      return;
    }

    if (speak && (!String(apiKey).trim() || !String(voiceId).trim())) {
      resetSpeakProp();
      setStatus(!String(apiKey).trim() ? 'Set API key' : 'Set Voice ID', true);
      return;
    }

    ensureSynth(text, apiKey, voiceId, modelId, outputFormat)
      .then(function () {
        tryPlay();
      })
      .catch(function () {});

    if (!speak && !text) {
      setStatus('Ready', false);
    }
  }

  function bootstrap() {
    setStatus('ElevenLabs TTS', false);

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
