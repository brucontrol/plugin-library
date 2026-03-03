(function () {
  var fill = document.getElementById('water-fill');

  function getPreviewData() {
    return {
      elementType: 'generic',
      value: 50,
      min: 0,
      max: 100,
      liquidColor: '#3b82f6',
      levelTransitionMs: 500,
      bubbleDurationMs: 3000
    };
  }

  function render(data) {
    if (!fill) return;
    data = data || {};

    var value = parseFloat(data.value);
    if (isNaN(value)) value = 0;
    var min = parseFloat(data.min);
    if (isNaN(min)) min = 0;
    var max = parseFloat(data.max);
    if (isNaN(max)) max = 100;

    var range = max - min;
    var pct = range <= 0 ? 0 : Math.max(0, Math.min(100, ((value - min) / range) * 100));

    fill.style.height = pct + '%';

    var color = data.liquidColor || '#3b82f6';
    fill.style.backgroundColor = color;
    fill.style.backgroundImage = 'linear-gradient(to bottom, ' + color + ' 0%, ' + color + 'cc 100%)';

    var levelMs = parseInt(data.levelTransitionMs, 10);
    if (isNaN(levelMs) || levelMs < 0) levelMs = 500;
    fill.style.transition = 'height ' + levelMs + 'ms ease-out';

    var bubbleMs = parseInt(data.bubbleDurationMs, 10);
    if (isNaN(bubbleMs) || bubbleMs < 0) bubbleMs = 3000;
    document.documentElement.style.setProperty('--bubble-duration', bubbleMs + 'ms');
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
