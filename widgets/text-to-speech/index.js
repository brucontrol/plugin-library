(function () {
  var statusEl = document.getElementById('status');
  var textEl = document.getElementById('text-display');
  var ttsModel = null;
  var config = { voice: 'af_heart' };

  function setStatus(msg, isError) {
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.style.color = isError ? 'var(--accent-red, #ef4444)' : 'var(--text-muted, #888)';
    }
  }

  function getPreviewData() {
    return {
      elementType: 'globalVariable',
      text: 'Hello from TTS',
      speak: false,
      voice: 'af_heart'
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

  function pickDevice() {
    return typeof navigator !== 'undefined' && navigator.gpu ? 'webgpu' : 'wasm';
  }

  async function speak(text, voice) {
    var ready = window.__kokoroReady;
    if (!ready || ready.error) return false;
    var KokoroTTS = ready.KokoroTTS;
    if (!KokoroTTS) return false;
    try {
      if (!ttsModel) {
        var device = pickDevice();
        try {
          ttsModel = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
            dtype: 'q8',
            device: device
          });
        } catch (e) {
          if (device === 'webgpu') {
            ttsModel = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
              dtype: 'q8',
              device: 'wasm'
            });
          } else {
            throw e;
          }
        }
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

  function render(data) {
    data = data || {};
    config.voice = data.voice || 'af_heart';
    var text = String(data.text || '').trim();
    var shouldSpeak = data.speak === true;

    if (textEl) textEl.textContent = text || '(no text)';

    if (shouldSpeak && text) {
      setStatus('Speaking...', false);
      speak(text, config.voice).then(function (ok) {
        setStatus(ok ? 'Ready' : 'TTS error', !ok);
        if (ok && window.BruControl && window.BruControl.updateProperties) {
          window.BruControl.updateProperties({ speak: false });
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
