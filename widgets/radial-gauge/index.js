(function () {
  var currentData = null;
  var CX = 100, CY = 98, R = 83, STROKE = 22;
  var ARC_LEN = Math.PI * R;
  var ARC_D = 'M ' + (CX - R) + ' ' + CY + ' A ' + R + ' ' + R + ' 0 0 1 ' + (CX + R) + ' ' + CY;

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

  function getSuffix(data) {
    if (!data) return '';
    var t = getType(data);
    if (t === 'dutyCycle') return '%';
    if (t === 'counter') {
      return data.primaryDisplayChannel === 1 ? (data.rateSuffix || '') : (data.countSuffix || '');
    }
    if (t === 'hydrometer') {
      return data.primaryDisplayChannel === 1 ? (data.sgSuffix || '') : (data.tempSuffix || '°');
    }
    if (t === 'owTemp') return data.suffix || '°';
    return (data.suffix != null ? String(data.suffix) : '');
  }

  function getPrecision(data) {
    if (!data) return 2;
    var t = getType(data);
    if (t === 'counter') {
      return data.primaryDisplayChannel === 1 ? toNumber(data.ratePrecision, 2) : toNumber(data.countPrecision, 0);
    }
    if (t === 'hydrometer') {
      return data.primaryDisplayChannel === 1 ? toNumber(data.sgPrecision, 3) : toNumber(data.tempPrecision, 1);
    }
    return Math.max(0, Math.min(6, toNumber(data.precision, 2)));
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
      var defaultMin = toNumber(d.min, 0);
      var defaultMax = toNumber(d.max, 100);
      var third = (defaultMax - defaultMin) / 3;
      bands = [
        { color: '#4ec9b0', from: defaultMin, to: defaultMin + third },
        { color: '#dcdcaa', from: defaultMin + third, to: defaultMin + third * 2 },
        { color: '#f14c4c', from: defaultMin + third * 2, to: defaultMax }
      ];
    }
    return bands;
  }

  function renderBands(el, bands, min, max) {
    if (!el) return;
    el.innerHTML = '';
    var range = max - min;
    if (range <= 0) return;
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      if (!b.color || b.from >= b.to) continue;
      var fromF = Math.max(0, Math.min(1, (b.from - min) / range));
      var toF = Math.max(0, Math.min(1, (b.to - min) / range));
      var len = (toF - fromF) * ARC_LEN;
      if (len <= 0) continue;
      var offset = fromF * ARC_LEN;
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', ARC_D);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', b.color);
      p.setAttribute('stroke-width', String(STROKE));
      p.setAttribute('stroke-linecap', 'butt');
      p.setAttribute('stroke-dasharray', len + ' ' + (ARC_LEN + 10));
      p.setAttribute('stroke-dashoffset', String(-offset));
      el.appendChild(p);
    }
  }

  function renderTicks(el, tickColor) {
    if (!el) return;
    el.innerHTML = '';
    var color = (tickColor && String(tickColor).trim()) ? String(tickColor).trim() : 'white';
    var NUM_TICKS = 19;
    var innerR = R - STROKE / 2 + 3;
    var outerR = R + STROKE / 2 - 3;
    for (var i = 0; i < NUM_TICKS; i++) {
      var t = i / (NUM_TICKS - 1);
      var a = Math.PI * (1 - t);
      var isMajor = (i % 3 === 0);
      var rIn = isMajor ? innerR - 1 : innerR + 2;
      var rOut = isMajor ? outerR + 1 : outerR - 2;
      var x1 = CX + rIn * Math.cos(a);
      var y1 = CY - rIn * Math.sin(a);
      var x2 = CX + rOut * Math.cos(a);
      var y2 = CY - rOut * Math.sin(a);
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', isMajor ? '1.5' : '1');
      line.setAttribute('opacity', isMajor ? '0.5' : '0.3');
      el.appendChild(line);
    }
  }

  function setNeedle(value, min, max) {
    var ng = document.getElementById('needle-group');
    if (!ng) return;
    var range = max - min;
    var t = range <= 0 ? 0 : Math.max(0, Math.min(1, (value - min) / range));
    var cssAngle = -90 + t * 180;
    ng.style.transform = 'rotate(' + cssAngle + 'deg)';
  }

  function applyStyles() {
    var d = currentData || {};
    var widget = document.getElementById('widget');
    var header = document.querySelector('.widget-header');
    var titleEl = document.getElementById('widgetTitle');
    var valueNum = document.getElementById('valueNumber');
    var minL = document.getElementById('minLabel');
    var maxL = document.getElementById('maxLabel');
    var dial = document.getElementById('gauge-dial');
    var track = document.getElementById('gauge-track');

    var hideBg = d.showBackground === false;

    if (widget) {
      if (hideBg) {
        widget.style.background = 'transparent';
        widget.style.border = 'none';
      } else {
        widget.style.background = (d.backgroundColor && String(d.backgroundColor).trim())
          ? String(d.backgroundColor).trim()
          : 'var(--bg-secondary, #252526)';
        widget.style.border = (d.borderColor && String(d.borderColor).trim())
          ? '1px solid ' + String(d.borderColor).trim()
          : '1px solid var(--border-color, #404040)';
      }
      widget.style.borderRadius = '8px';
    }

    if (dial) {
      if (hideBg) {
        dial.setAttribute('fill', 'transparent');
      } else {
        var dialColor = (d.dialColor && String(d.dialColor).trim()) ? String(d.dialColor).trim() : '#1a1a1a';
        dial.setAttribute('fill', dialColor);
      }
    }

    if (track) {
      track.setAttribute('stroke', hideBg ? 'transparent' : '#2c2c2c');
    }

    if (header) {
      header.style.display = d.showHeader === false ? 'none' : '';
      header.style.background = d.headerColor || '';
      header.style.borderBottom = d.showHeader === false ? 'none' : '';
    }

    if (titleEl) {
      titleEl.style.display = d.showLabel === false ? 'none' : '';
      titleEl.style.fontFamily = d.labelFontFamily || '';
      titleEl.style.fontSize = numberOrNull(d.labelFontSize) != null ? numberOrNull(d.labelFontSize) + 'px' : '';
      titleEl.style.fontWeight = d.labelFontWeight || '';
      titleEl.style.fontStyle = d.labelFontStyle || '';
      titleEl.style.color = d.labelColor || '';
    }

    if (valueNum) {
      valueNum.style.display = d.showValue === false ? 'none' : '';
      if (d.valueFontFamily) valueNum.setAttribute('font-family', d.valueFontFamily);
      if (numberOrNull(d.valueFontSize) != null) valueNum.setAttribute('font-size', String(numberOrNull(d.valueFontSize)));
      if (d.valueFontWeight) valueNum.setAttribute('font-weight', d.valueFontWeight);
      if (d.valueColor) valueNum.setAttribute('fill', d.valueColor);
    }

    if (minL) minL.setAttribute('fill', d.labelColor || '#888');
    if (maxL) maxL.setAttribute('fill', d.labelColor || '#888');

    var needleColor = (d.needleColor && String(d.needleColor).trim()) ? String(d.needleColor).trim() : 'white';
    var needleArm = document.getElementById('needle-arm');
    var needleTail = document.getElementById('needle-tail');
    var needleHub = document.getElementById('needle-hub');
    if (needleArm) needleArm.setAttribute('stroke', needleColor);
    if (needleTail) needleTail.setAttribute('stroke', needleColor);
    if (needleHub) needleHub.setAttribute('stroke', needleColor);
  }

  function formatLabel(v) {
    if (v === Math.floor(v)) return String(Math.floor(v));
    return v.toFixed(2).replace(/\.?0+$/, '');
  }

  function render(data) {
    currentData = data || {};
    var d = currentData;
    var min = toNumber(d.min, 0);
    var max = toNumber(d.max, 100);
    if (max <= min) max = min + 100;

    var rawVal = getValue(d);
    var value = rawVal != null ? rawVal : min;
    var precision = getPrecision(d);
    var suffix = d.suffix != null ? String(d.suffix) : getSuffix(d);
    var bands = parseBands(d);

    var titleEl = document.getElementById('widgetTitle');
    var valueNum = document.getElementById('valueNumber');
    var valueUnit = document.getElementById('valueUnit');
    var minLabel = document.getElementById('minLabel');
    var maxLabel = document.getElementById('maxLabel');
    var bandsEl = document.getElementById('gauge-bands');
    var ticksEl = document.getElementById('gauge-ticks');

    if (titleEl) titleEl.textContent = d.displayName || d.name || 'Gauge';
    if (valueNum) valueNum.textContent = rawVal != null ? Number(value).toFixed(precision) : '—';
    if (valueUnit) valueUnit.textContent = suffix;
    if (minLabel) minLabel.textContent = formatLabel(min);
    if (maxLabel) maxLabel.textContent = formatLabel(max);

    renderBands(bandsEl, bands, min, max);
    renderTicks(ticksEl, d.tickColor);
    setNeedle(value, min, max);
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
