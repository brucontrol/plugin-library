(function () {
  var statusEl = document.getElementById('status');
  var textEl = document.getElementById('text-display');
  var config = { voice: 'en_US-hfc_female-medium' };

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
      voice: 'en_US-hfc_female-medium'
    };
  }

  function initPiper() {
    return new Promise(function (resolve) {
      if (window.__piperReady) {
        if (window.__piperReady.error) {
          resolve(null);
          return;
        }
        resolve(window.__piperReady.tts);
        return;
      }
      window.addEventListener('piper-ready', function () {
        if (window.__piperReady && window.__piperReady.error) {
          resolve(null);
          return;
        }
        resolve(window.__piperReady ? window.__piperReady.tts : null);
      }, { once: true });
    });
  }

  async function speak(text, voiceId) {
    var tts = window.__piperReady && window.__piperReady.tts;
    if (!tts || window.__piperReady.error) return false;
    try {
      var wav = await tts.predict({
        text: text,
        voiceId: voiceId || config.voice || 'en_US-hfc_female-medium'
      });
      if (!wav || !(wav instanceof Blob)) return false;
      var url = URL.createObjectURL(wav);
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
    config.voice = data.voice || 'en_US-hfc_female-medium';
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

  function onReady(tts) {
    if (!tts) {
      setStatus('TTS unavailable', true);
      return;
    }
    setStatus('Ready', false);
  }

  function bootstrap() {
    initPiper().then(function (tts) {
      onReady(tts);
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
