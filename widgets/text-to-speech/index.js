(function () {
  var statusEl = document.getElementById('status');
  var textEl = document.getElementById('text-display');
  var config = { voice: '' };

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
      voice: ''
    };
  }

  function speak(text, voiceId) {
    if (!window.speechSynthesis) return Promise.resolve(false);
    return new Promise(function (resolve) {
      try {
        var u = new SpeechSynthesisUtterance(text);
        u.rate = 1;
        u.pitch = 1;
        u.volume = 1;
        var voices = speechSynthesis.getVoices();
        if (voiceId && voices.length > 0) {
          var match = voices.find(function (v) {
            return v.voiceURI === voiceId || v.name === voiceId || (v.lang && voiceId.indexOf(v.lang) === 0);
          });
          if (match) u.voice = match;
        } else if (voices.length > 0) {
          var en = voices.find(function (v) { return v.lang && v.lang.startsWith('en'); });
          if (en) u.voice = en;
        }
        u.onend = function () { resolve(true); };
        u.onerror = function () { resolve(false); };
        speechSynthesis.speak(u);
      } catch (e) {
        console.error('[TTS] speak failed:', e);
        resolve(false);
      }
    });
  }

  function render(data) {
    data = data || {};
    config.voice = data.voice || '';
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

  function bootstrap() {
    if (!window.speechSynthesis) {
      setStatus('TTS unavailable', true);
      return;
    }
    setStatus('Ready', false);

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
