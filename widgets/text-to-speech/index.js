(function () {
  var statusEl = document.getElementById('status');
  var textEl = document.getElementById('text-display');
  var ttsModel = null;
  var config = { voice: 'af_heart', device: 'wasm' };

  function setStatus(msg, isError) {
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.style.color = isError ? 'var(--accent-red, #ef4444)' : 'var(--text-muted, #888)';
    }
  }

  function parseValue(val) {
    if (val == null || val === '') return { text: '', speak: false };
    var s = String(val).trim();
    if (!s) return { text: '', speak: false };
    if (s.startsWith('{')) {
      try {
        var o = JSON.parse(s);
        return { text: String(o.text || ''), speak: o.speak === true };
      } catch (e) {
        return { text: s, speak: false };
      }
    }
    return { text: s, speak: false };
  }

  function getPreviewData() {
    return {
      elementType: 'globalVariable',
      value: '{"text":"Hello from TTS","speak":false}',
      voice: 'af_heart',
      device: 'wasm'
    };
  }

  function initKokoro(meta) {
    return new Promise(function (resolve) {
      if (window.__kokoroReady) {
        if (window.__kokoroReady.error) {
          resolve(null);
          return;
        }
        resolve(window.__kokoroReady.KokoroTTS);
        return;
      }
      window.addEventListener('kokoro-ready', function () {
        if (window.__kokoroReady && window.__kokoroReady.error) {
          resolve(null);
          return;
        }
        resolve(window.__kokoroReady ? window.__kokoroReady.KokoroTTS : null);
      }, { once: true });
    });
  }

  async function speak(text, voice, device) {
    var ready = window.__kokoroReady;
    if (!ready || ready.error) return false;
    var KokoroTTS = ready.KokoroTTS;
    if (!KokoroTTS) return false;
    try {
      if (!ttsModel) {
        ttsModel = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
          dtype: 'q8',
          device: device || 'wasm'
        });
      }
      var audio = await ttsModel.generate(text, { voice: voice || 'af_heart' });
      var blob = audio.toBlob();
      var url = URL.createObjectURL(blob);
      var a = new Audio(url);
      await new Promise(function (ok, err) {
        a.onended = function () { URL.revokeObjectURL(url); ok(); };
        a.onerror = err;
        a.play().catch(err);
      });
      return true;
    } catch (e) {
      console.error('[TTS] speak failed:', e);
      return false;
    }
  }

  function render(data, metadata) {
    data = data || {};
    metadata = metadata || {};
    config.voice = metadata.voice || 'af_heart';
    config.device = metadata.device || 'wasm';

    var val = data.value;
    var parsed = parseValue(val);

    if (textEl) textEl.textContent = parsed.text || '(no text)';

    if (parsed.speak && parsed.text) {
      setStatus('Speaking...', false);
      speak(parsed.text, config.voice, config.device).then(function (ok) {
        setStatus(ok ? 'Ready' : 'TTS error', !ok);
        if (ok && window.BruControl && window.BruControl.updateProperties) {
          var nextVal = JSON.stringify({ text: parsed.text, speak: false });
          window.BruControl.updateProperties({ value: nextVal });
        }
      });
    }
  }

  function onReady(KokoroTTS) {
    if (!KokoroTTS) {
      setStatus('TTS unavailable', true);
      return;
    }
    setStatus('Ready', false);
  }

  function bootstrap() {
    initKokoro().then(function (KokoroTTS) {
      onReady(KokoroTTS);
    });

    if (window.BruControl) {
      if (window.BruControl.getData) {
        try {
          var d = window.BruControl.getData();
          if (d) render(d, window.BruControl.getMetadata ? window.BruControl.getMetadata() : {});
        } catch (e) {}
      }
      if (window.BruControl.onData) {
        window.BruControl.onData(function (data) {
          var meta = window.BruControl.getMetadata ? window.BruControl.getMetadata() : {};
          render(data, meta);
        });
      }
      if (window.BruControl.onMetadata) {
        window.BruControl.onMetadata(function (meta) {
          var data = window.BruControl.getData ? window.BruControl.getData() : null;
          render(data || {}, meta);
        });
      }
    } else {
      render(getPreviewData(), { voice: 'af_heart', device: 'wasm' });
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    bootstrap();
  } else {
    document.addEventListener('DOMContentLoaded', bootstrap);
  }
})();
