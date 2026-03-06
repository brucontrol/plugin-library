(function () {
  var valueEl = document.getElementById('valueDisplay');
  var value2El = document.getElementById('value2Display');

  function formatValue(val) {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  function render(data) {
    data = data || {};
    if (valueEl) valueEl.textContent = formatValue(data.value);
    if (value2El) value2El.textContent = formatValue(data.value2);
  }

  function getPreviewData() {
    return {
      elementType: 'generic',
      displayName: 'Value Debug',
      value: 42,
      value2: 'test'
    };
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
