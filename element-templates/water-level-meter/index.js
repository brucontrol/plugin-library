(function () {
  var fill = document.getElementById('water-fill');
  var bubbleContainer = document.getElementById('bubbles');
  var bubbles = [];
  var animId = null;
  var lastSpawn = 0;
  function getThemeColor(varName, fallback) {
    try {
      var val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      return val || fallback;
    } catch (e) {
      return fallback;
    }
  }

  var config = {
    value: 50,
    min: 0,
    max: 100,
    liquidColor: null,
    levelTransitionMs: 500,
    bubbleDurationMs: 3000,
    bubbleDensity: 8
  };

  function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return { r: 86, g: 156, b: 214 };
    var s = hex.replace(/^#/, '').trim();
    var m = s.match(/^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})?$/);
    if (!m) return { r: 86, g: 156, b: 214 };
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16)
    };
  }

  function hexToRgba(hex, a) {
    var rgb = hexToRgb(hex);
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a + ')';
  }

  function getPreviewData() {
    return {
      elementType: 'generic',
      value: 50,
      min: 0,
      max: 100,
      liquidColor: '#569cd6',
      levelTransitionMs: 500,
      bubbleDurationMs: 3000,
      bubbleDensity: 8
    };
  }

  function spawnBubble() {
    if (!bubbleContainer) return;
    var density = Math.max(0, Math.min(20, config.bubbleDensity));
    if (density === 0) return;

    var b = document.createElement('div');
    b.className = 'bubble';
    var size = 4 + Math.random() * 6;
    b.style.width = size + 'px';
    b.style.height = size + 'px';
    var baseLeftPct = 5 + Math.random() * 90;
    b.style.left = baseLeftPct + '%';
    b.style.bottom = '-10px';

    var duration = config.bubbleDurationMs / 1000;
    var phase = Math.random() * Math.PI * 2;
    var wobbleAmp = 4 + Math.random() * 6;
    var startTime = Date.now();

    function updateBubble() {
      var elapsed = (Date.now() - startTime) / 1000;
      var t = elapsed / duration;
      if (t >= 1) {
        b.remove();
        for (var j = 0; j < bubbles.length; j++) {
          if (bubbles[j].el === b) {
            bubbles.splice(j, 1);
            break;
          }
        }
        return;
      }
      var bottomPct = t * 110;
      var wobble = Math.sin(phase + elapsed * 4) * wobbleAmp;
      b.style.bottom = bottomPct + '%';
      b.style.transform = 'translate(' + wobble + 'px, 0)';
      b.style.opacity = String(Math.max(0, 0.9 - t * 0.8));
    }

    bubbles.push({ el: b, update: updateBubble });
    bubbleContainer.appendChild(b);
  }

  function animateBubbles() {
    var now = Date.now();
    var spawnInterval = config.bubbleDurationMs / Math.max(1, config.bubbleDensity);
    if (now - lastSpawn >= spawnInterval) {
      spawnBubble();
      lastSpawn = now;
    }
    for (var i = bubbles.length - 1; i >= 0; i--) {
      bubbles[i].update();
    }
    animId = requestAnimationFrame(animateBubbles);
  }

  function startBubbles() {
    if (animId) return;
    lastSpawn = Date.now();
    animId = requestAnimationFrame(animateBubbles);
  }

  function stopBubbles() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    if (bubbleContainer) bubbleContainer.innerHTML = '';
    bubbles = [];
  }

  function applyWaterStyle(color) {
    if (!fill) return;
    var c = color || '#569cd6';
    fill.style.background =
      'linear-gradient(105deg, rgba(255,255,255,0.1) 0%, transparent 40%),' +
      'linear-gradient(180deg,' +
      hexToRgba(c, 0.35) + ' 0%,' +
      hexToRgba(c, 0.55) + ' 30%,' +
      hexToRgba(c, 0.75) + ' 65%,' +
      hexToRgba(c, 0.9) + ' 100%)';
  }

  function render(data) {
    if (!fill) return;
    data = data || {};

    config.value = parseFloat(data.value);
    if (isNaN(config.value)) config.value = 0;
    config.min = parseFloat(data.min);
    if (isNaN(config.min)) config.min = 0;
    config.max = parseFloat(data.max);
    if (isNaN(config.max)) config.max = 100;
    var trimmedLiquid = (data.liquidColor && String(data.liquidColor).trim()) ? String(data.liquidColor).trim() : "";
    config.liquidColor = trimmedLiquid || getThemeColor('--accent-blue', '#569cd6');
    config.levelTransitionMs = parseInt(data.levelTransitionMs, 10);
    if (isNaN(config.levelTransitionMs) || config.levelTransitionMs < 0) config.levelTransitionMs = 500;
    config.bubbleDurationMs = parseInt(data.bubbleDurationMs, 10);
    if (isNaN(config.bubbleDurationMs) || config.bubbleDurationMs < 0) config.bubbleDurationMs = 3000;
    config.bubbleDensity = typeof data.bubbleDensity === 'number' ? data.bubbleDensity : 8;

    var range = config.max - config.min;
    var pct = range <= 0 ? 0 : Math.max(0, Math.min(100, ((config.value - config.min) / range) * 100));

    fill.style.height = pct + '%';
    fill.style.transition = 'height ' + config.levelTransitionMs + 'ms cubic-bezier(0.4, 0, 0.2, 1)';

    applyWaterStyle(config.liquidColor);

    document.documentElement.style.setProperty('--wave-duration', '2.8s');

    /* Only stop bubbles when water is empty; keep them running during level changes so water animates smoothly */
    if (pct <= 2) stopBubbles();
    else startBubbles();
  }

  if (window.BruControl) {
    if (window.BruControl.getData) {
      try {
        var initial = window.BruControl.getData();
        if (initial) render(initial);
      } catch (e) {}
    }
    window.BruControl.onData(render);
  } else {
    render(getPreviewData());
  }
})();
