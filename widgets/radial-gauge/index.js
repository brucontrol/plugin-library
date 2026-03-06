(function () {
  var currentData = null;
  var GAUGE_CX = 100;
  var GAUGE_CY = 100;
  var GAUGE_R = 80;
  var ARC_LENGTH = Math.PI * GAUGE_R;

  function getType(data) {
    if (data && data.elementType) return String(data.elementType);
    return 'generic';
  }

  function toNumber(val, fallback) {
    var n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  function numberOrNull(val) {
    return typeof val === 'number' && Number.isFinite(val) ? val : null;
  }

  function getValue(data) {
    if (!data) return null;
    var t = getType(data);
    switch (t) {
      case 'generic':
        return data.value != null ? toNumber(data.value, null) : null;
      case 'globalVariable-value':
        return data.value != null ? toNumber(data.value, null) : null;
      case 'owTemp':
      case 'spiSensor':
      case 'analogInput':
      case 'pwmOutput':
      case 'pid':
        return data.value != null ? toNumber(data.value, null) : null;
      case 'dutyCycle':
        return data.dutyCycle != null ? toNumber(data.dutyCycle, null) : null;
      case 'counter':
        return (data.primaryDisplayChannel === 1)
          ? (data.rate != null ? toNumber(data.rate, null) : null)
          : (data.total != null ? toNumber(data.total, null) : null);
      case 'hydrometer':
        return (data.primaryDisplayChannel === 1)
          ? (data.sg != null ? toNumber(data.sg, null) : null)
          : (data.temp != null ? toNumber(data.temp, null) : null);
      default:
        return data.value != null ? toNumber(data.value, null) : null;
    }
  }

  function getPrefixSuffix(data) {
    if (!data) return { prefix: '', suffix: '' };
    var t = getType(data);
    if (t === 'generic' && data.prefix != null) return { prefix: data.prefix || '', suffix: data.suffix || '' };
    if (t === 'globalVariable-value') return { prefix: data.prefix || '', suffix: data.suffix || '' };
    if (t === 'owTemp') return { prefix: data.prefix || '', suffix: data.suffix || '°' };
    if (t === 'spiSensor' || t === 'analogInput' || t === 'pwmOutput')
      return { prefix: data.prefix || '', suffix: data.suffix || '' };
    if (t === 'dutyCycle') return { prefix: '', suffix: '%' };
    if (t === 'pid') return { prefix: data.prefix || '', suffix: data.suffix || '' };
    if (t === 'counter') {
      var pc = data.primaryDisplayChannel;
      return pc === 1
        ? { prefix: data.ratePrefix || '', suffix: data.rateSuffix || '' }
        : { prefix: data.countPrefix || '', suffix: data.countSuffix || '' };
    }
    if (t === 'hydrometer') {
      var pc = data.primaryDisplayChannel;
      return pc === 1
        ? { prefix: data.sgPrefix || '', suffix: data.sgSuffix || '' }
        : { prefix: data.tempPrefix || '', suffix: data.tempSuffix || '°' };
    }
    return { prefix: data.prefix || '', suffix: data.suffix || '' };
  }

  function getPrecision(data) {
    if (!data) return 2;
    var t = getType(data);
    if (t === 'generic' && data.precision != null) return Math.max(0, Math.min(6, toNumber(data.precision, 2)));
    if (t === 'owTemp' || t === 'spiSensor' || t === 'analogInput' || t === 'pwmOutput' || t === 'pid')
      return Math.max(0, Math.min(6, toNumber(data.precision, 2)));
    if (t === 'counter') {
      var pc = data.primaryDisplayChannel;
      return pc === 1 ? toNumber(data.ratePrecision, 2) : toNumber(data.countPrecision, 0);
    }
    if (t === 'hydrometer') {
      var pc = data.primaryDisplayChannel;
      return pc === 1 ? toNumber(data.sgPrecision, 3) : toNumber(data.tempPrecision, 1);
    }
    return 2;
  }

  function valueToAngle(value, min, max) {
    var range = max - min;
    if (range <= 0) return -90;
    var t = Math.max(0, Math.min(1, (value - min) / range));
    return -90 + t * 180;
  }

  function renderBands(bandsEl, bands, min, max) {
    if (!bandsEl) return;
    bandsEl.innerHTML = '';
    var range = max - min;
    if (range <= 0) return;

    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      var from = toNumber(b.from, min);
      var to = toNumber(b.to, max);
      if (from >= to || !b.color) continue;

      var fromPct = Math.max(0, Math.min(1, (from - min) / range));
      var toPct = Math.max(0, Math.min(1, (to - min) / range));
      var len = (toPct - fromPct) * ARC_LENGTH;
      var offset = fromPct * ARC_LENGTH;

      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M 20 100 A 80 80 0 0 1 180 100');
      p.setAttribute('class', 'band');
      p.setAttribute('stroke', b.color);
      p.setAttribute('stroke-dasharray', len + ' ' + (ARC_LENGTH + 10));
      p.setAttribute('stroke-dashoffset', -offset);
      bandsEl.appendChild(p);
    }
  }

  function renderTicks(ticksEl, min, max) {
    if (!ticksEl) return;
    ticksEl.innerHTML = '';
    var range = max - min;
    if (range <= 0) return;

    var steps = 5;
    for (var i = 0; i <= steps; i++) {
      var v = min + (range * i) / steps;
      var angle = valueToAngle(v, min, max);
      var rad = (angle + 90) * Math.PI / 180;
      var innerR = GAUGE_R - 6;
      var outerR = GAUGE_R;
      var x1 = GAUGE_CX + innerR * Math.cos(rad);
      var y1 = GAUGE_CY - innerR * Math.sin(rad);
      var x2 = GAUGE_CX + outerR * Math.cos(rad);
      var y2 = GAUGE_CY - outerR * Math.sin(rad);

      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('class', 'tick');
      ticksEl.appendChild(line);

      if (i === 0 || i === steps) {
        var labelR = GAUGE_R - 18;
        var lx = GAUGE_CX + labelR * Math.cos(rad);
        var ly = GAUGE_CY - labelR * Math.sin(rad);
        var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', lx);
        text.setAttribute('y', ly);
        text.setAttribute('class', 'tick-label');
        text.setAttribute('dy', '0.35em');
        text.textContent = Number(v) === Math.floor(v) ? String(Math.floor(v)) : v.toFixed(1);
        ticksEl.appendChild(text);
      }
    }
  }

  function parseBands(d) {
    var bands = [];
    for (var i = 1; i <= 5; i++) {
      var color = d['band' + i + 'Color'];
      var from = toNumber(d['band' + i + 'From'], NaN);
      var to = toNumber(d['band' + i + 'To'], NaN);
      if (color && !isNaN(from) && !isNaN(to) && from < to) {
        bands.push({ color: color, from: from, to: to });
      }
    }
    if (bands.length === 0) {
      bands = [
        { color: '#4ec9b0', from: 0, to: 33 },
        { color: '#dcdcaa', from: 33, to: 66 },
        { color: '#f14c4c', from: 66, to: 100 }
      ];
    }
    return bands;
  }

  function applyStyles() {
    var d = currentData || {};
    var widget = document.getElementById('widget');
    var header = document.querySelector('.widget-header');
    var titleEl = document.getElementById('widgetTitle');
    var valueWrap = document.getElementById('gaugeValue');
    var valueNum = document.getElementById('valueNumber');
    var valueUnit = document.getElementById('valueUnit');

    if (widget) {
      if (d.showBackground === false) {
        widget.style.background = 'transparent';
        widget.style.border = 'none';
      } else {
        var bg = (d.backgroundColor && String(d.backgroundColor).trim().length > 0)
          ? String(d.backgroundColor).trim()
          : 'var(--bg-secondary, #252526)';
        widget.style.background = bg;
        widget.style.border = (d.borderColor && String(d.borderColor).trim().length > 0)
          ? '1px solid ' + String(d.borderColor).trim()
          : '1px solid var(--border-color, #404040)';
      }
      widget.style.borderRadius = '8px';
    }

    if (header) {
      header.style.display = d.showHeader === false ? 'none' : '';
      header.style.background = d.headerColor || '';
      header.style.borderBottom = d.showHeader === false ? 'none' : '';
    }

    if (titleEl) {
      titleEl.style.display = d.showLabel === false ? 'none' : '';
      titleEl.style.fontFamily = d.labelFontFamily || '';
      titleEl.style.fontSize = (numberOrNull(d.labelFontSize) != null ? numberOrNull(d.labelFontSize) + 'px' : '');
      titleEl.style.fontWeight = d.labelFontWeight || '';
      titleEl.style.fontStyle = d.labelFontStyle || '';
      titleEl.style.color = d.labelColor || '';
    }

    if (valueWrap) {
      valueWrap.style.display = d.showValue === false ? 'none' : '';
    }

    if (valueNum) {
      valueNum.style.fontFamily = d.valueFontFamily || '';
      valueNum.style.fontSize = (numberOrNull(d.valueFontSize) != null ? numberOrNull(d.valueFontSize) + 'px' : '');
      valueNum.style.fontWeight = d.valueFontWeight || '';
      valueNum.style.fontStyle = d.valueFontStyle || '';
      valueNum.style.color = d.valueColor || '';
    }
  }

  function render(data) {
    currentData = data || {};
    var d = currentData;
    var min = toNumber(d.min, 0);
    var max = toNumber(d.max, 100);
    if (max <= min) max = min + 100;

    var rawVal = getValue(d);
    var value = rawVal != null ? toNumber(rawVal, min) : min;
    var bands = parseBands(d);
    var ps = getPrefixSuffix(d);
    var precision = getPrecision(d);

    var titleEl = document.getElementById('widgetTitle');
    var needle = document.getElementById('needle');
    var valueNum = document.getElementById('valueNumber');
    var valueUnit = document.getElementById('valueUnit');
    var bandsEl = document.getElementById('gauge-bands');
    var ticksEl = document.getElementById('gauge-ticks');

    if (titleEl) titleEl.textContent = d.displayName || d.name || 'Gauge';

    var angle = valueToAngle(value, min, max);
    if (needle) needle.style.transform = 'rotate(' + angle + 'deg)';

    if (valueNum) {
      valueNum.textContent = rawVal != null
        ? (Number.isFinite(value) ? value.toFixed(precision) : '—')
        : '—';
    }
    if (valueUnit) {
      valueUnit.textContent = ps.suffix || '';
    }

    renderBands(bandsEl, bands, min, max);
    renderTicks(ticksEl, min, max);

    applyStyles();
  }

  function getPreviewData() {
    return {
      elementType: 'generic',
      displayName: 'Gauge',
      value: 1.42,
      min: 0,
      max: 4,
      precision: 2,
      prefix: '',
      suffix: 'kw',
      band1Color: '#4ec9b0',
      band1From: 0,
      band1To: 1.5,
      band2Color: '#dcdcaa',
      band2From: 1.5,
      band2To: 3,
      band3Color: '#f14c4c',
      band3From: 3,
      band3To: 4,
      showHeader: true,
      showBackground: true,
      showLabel: true,
      showValue: true
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
