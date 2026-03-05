(function () {
  var titleEl = document.getElementById("widgetTitle");
  var metaEl = document.getElementById("widgetMeta");
  var headerEl = document.getElementById("widgetHeader");
  var contentEl = document.getElementById("widgetContent");
  var overlayEl = document.getElementById("chartOverlay");
  var oscilloscopeOverlayEl = document.getElementById("oscilloscopeOverlay");
  var widgetEl = document.getElementById("widget");
  var canvasEl = document.getElementById("chartCanvas");

  var currentData = null;
  var chart = null;
  var historyRequestVersion = 0;
  var historyRefreshHandle = null;
  var hasHistoryLoaded = false;
  var lastHistorySignature = "";
  var oscillationAnimationHandle = null;
  var configuredChannels = [];
  var oscillationRawPointsByChannel = Object.create(null);
  var oscillationHintsByChannel = Object.create(null);
  var oscillationHintsLoadedOnce = false;
  var previewTimerHandle = null;
  var realtimeTickHandle = null;

  var COLOR_PALETTE = ["#4EC9B0", "#DCDCAA", "#569CD6", "#C586C0", "#CE9178", "#9CDCFE"];
  var OSCILLATION_LOW_LEVEL = 8;
  var OSCILLATION_HIGH_LEVEL = 92;
  var OSCILLATION_AXIS_GRACE = "12%";
  var OSCILLATION_ANIMATION_INTERVAL_MS = 60;
  var REALTIME_TICK_INTERVAL_MS = 1000;
  var REALTIME_EXTEND_THRESHOLD_MS = 500;
  var TIME_PRESETS = {
    "4s": 4,
    "15s": 15,
    "30s": 30,
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "6h": 21600,
    "24h": 86400,
    "7d": 604800
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toNumber(value, fallback) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function toBool(value, fallback) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      var lowered = value.toLowerCase();
      if (lowered === "true" || lowered === "1" || lowered === "yes" || lowered === "on") return true;
      if (lowered === "false" || lowered === "0" || lowered === "no" || lowered === "off") return false;
    }
    return fallback;
  }

  function normalizeHexColor(value, fallback) {
    if (typeof value !== "string") return fallback;
    var trimmed = value.trim();
    if (!trimmed) return fallback;
    var withHash = trimmed.charAt(0) === "#" ? trimmed : "#" + trimmed;
    if (/^#([0-9a-fA-F]{3})$/.test(withHash)) {
      return "#" + withHash.charAt(1) + withHash.charAt(1) + withHash.charAt(2) + withHash.charAt(2) + withHash.charAt(3) + withHash.charAt(3);
    }
    if (/^#([0-9a-fA-F]{6})$/.test(withHash)) {
      return withHash.toUpperCase();
    }
    return fallback;
  }

  function withAlpha(hexColor, alpha) {
    var normalized = normalizeHexColor(hexColor, "#4EC9B0");
    var r = parseInt(normalized.slice(1, 3), 16);
    var g = parseInt(normalized.slice(3, 5), 16);
    var b = parseInt(normalized.slice(5, 7), 16);
    return "rgba(" + r + ", " + g + ", " + b + ", " + clamp(alpha, 0, 1).toFixed(3) + ")";
  }

  function colorFromInt(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }

    var unsigned = value >>> 0;
    var rgb = unsigned & 0xFFFFFF;
    var hex = rgb.toString(16).toUpperCase().padStart(6, "0");
    return "#" + hex;
  }

  function normalizeChannelKey(key) {
    return String(key || "").trim().toLowerCase();
  }

  function buildChannelKey(elementId, index) {
    return normalizeChannelKey(String(elementId || "") + ":" + String(index || 0));
  }

  function getChartCtor() {
    if (window.BruControlLibs && window.BruControlLibs.Chart) return window.BruControlLibs.Chart;
    if (window.Chart) return window.Chart;
    return null;
  }

  var oscilloscopePersistencePlugin = {
    id: "bruOscilloscopePersistence",
    beforeDraw: function (chartInstance, args, options) {
      if (!options || !options.enabled) return;
      var area = chartInstance.chartArea;
      if (!area) return;
      var ctx = chartInstance.ctx;
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, " + clamp(options.persistence || 0.2, 0, 0.95).toFixed(3) + ")";
      ctx.fillRect(area.left, area.top, area.right - area.left, area.bottom - area.top);
      ctx.restore();
    },
    afterDraw: function (chartInstance, args, options) {
      if (!options || !options.enabled) return;
      var noise = clamp(options.noise || 0, 0, 0.2);
      if (noise <= 0) return;
      var area = chartInstance.chartArea;
      if (!area) return;
      var ctx = chartInstance.ctx;
      var count = Math.floor((area.right - area.left) * (area.bottom - area.top) * noise * 0.0025);
      if (count <= 0) return;
      ctx.save();
      for (var i = 0; i < count; i += 1) {
        var x = Math.floor(area.left + Math.random() * (area.right - area.left));
        var y = Math.floor(area.top + Math.random() * (area.bottom - area.top));
        var brightness = Math.floor(90 + Math.random() * 100);
        ctx.fillStyle = "rgba(" + brightness + ", 255, " + brightness + ", 0.06)";
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.restore();
    }
  };

  function ensureChartCtor() {
    var ChartCtor = getChartCtor();
    if (!ChartCtor) return null;
    if (ChartCtor.register && !ChartCtor.__bruOscilloscopeRegistered) {
      ChartCtor.register(oscilloscopePersistencePlugin);
      ChartCtor.__bruOscilloscopeRegistered = true;
    }
    return ChartCtor;
  }

  function getSpanSeconds() {
    var presetRaw = String(currentData.timeRangePreset || "").trim().toLowerCase();
    if (presetRaw && presetRaw !== "custom" && Object.prototype.hasOwnProperty.call(TIME_PRESETS, presetRaw)) {
      return TIME_PRESETS[presetRaw];
    }

    var custom = toNumber(currentData.customSpanSeconds, NaN);
    if (Number.isFinite(custom) && custom >= 4) {
      return custom;
    }

    var fromElement = toNumber(currentData && currentData.spanSeconds, NaN);
    if (Number.isFinite(fromElement) && fromElement >= 4) {
      return fromElement;
    }

    return 300;
  }

  function getMaxPoints() {
    return Math.round(clamp(toNumber(currentData.maxPoints, 1000), 100, 5000));
  }

  function getOscillationChannelSet() {
    var set = Object.create(null);
    var source = currentData && Array.isArray(currentData.oscillationChannelKeys) ? currentData.oscillationChannelKeys : [];
    for (var i = 0; i < source.length; i += 1) {
      var key = normalizeChannelKey(source[i]);
      if (key) set[key] = true;
    }
    return set;
  }

  function getOscillationPeriodMap() {
    var map = Object.create(null);
    var source = currentData && currentData.oscillationPeriodMsByChannel;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return map;
    }

    var keys = Object.keys(source);
    for (var i = 0; i < keys.length; i += 1) {
      var key = normalizeChannelKey(keys[i]);
      var numeric = toNumber(source[keys[i]], NaN);
      if (!key || !Number.isFinite(numeric) || numeric <= 0) continue;
      map[key] = clamp(Math.round(numeric), 20, 60000);
    }

    return map;
  }

  function getOscillationModeMap() {
    var map = Object.create(null);
    var source = currentData && currentData.oscillationModeByChannel;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return map;
    }

    var keys = Object.keys(source);
    for (var i = 0; i < keys.length; i += 1) {
      var key = normalizeChannelKey(keys[i]);
      var mode = String(source[keys[i]] || "").trim();
      if (!key || !mode) continue;
      map[key] = mode;
    }

    return map;
  }

  function getOscillationDutyMap() {
    var map = Object.create(null);
    var source = currentData && currentData.oscillationDutyPercentByChannel;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return map;
    }

    var keys = Object.keys(source);
    for (var i = 0; i < keys.length; i += 1) {
      var key = normalizeChannelKey(keys[i]);
      var numeric = toNumber(source[keys[i]], NaN);
      if (!key || !Number.isFinite(numeric)) continue;
      map[key] = clamp(numeric, 0, 100);
    }

    return map;
  }

  function getOscillationHint(channelKey) {
    var key = normalizeChannelKey(channelKey);
    if (!key) return null;
    var hint = oscillationHintsByChannel[key];
    return hint && typeof hint === "object" ? hint : null;
  }

  function getOscillationPeriodMs(channelKey) {
    var map = getOscillationPeriodMap();
    var key = normalizeChannelKey(channelKey);
    if (key && Number.isFinite(map[key])) {
      return map[key];
    }

    var hint = getOscillationHint(channelKey);
    if (hint && Number.isFinite(hint.periodMs)) {
      return clamp(Math.round(hint.periodMs), 20, 60000);
    }

    return 1000;
  }

  function getOscillationMode(channelKey) {
    var map = getOscillationModeMap();
    var key = normalizeChannelKey(channelKey);
    if (key && typeof map[key] === "string" && map[key].length > 0) {
      return map[key];
    }

    var hint = getOscillationHint(channelKey);
    if (hint && typeof hint.mode === "string" && hint.mode.length > 0) {
      return hint.mode;
    }

    return "sample01";
  }

  function getOscillationDutyPercent(channelKey) {
    var hint = getOscillationHint(channelKey);
    if (hint && Number.isFinite(hint.dutyPercent)) {
      return clamp(hint.dutyPercent, 0, 100);
    }
    return null;
  }

  function normalizeDutyRatio(value) {
    if (!Number.isFinite(value)) return 0;
    var abs = Math.abs(value);
    if (abs <= 1) return clamp(abs, 0, 1);
    return clamp(abs / 100, 0, 1);
  }

  function resolveOscillationDutyRatio(channel, rawValue) {
    var mode = String(channel && channel.oscillationMode || "sample01");

    if (mode === "fixedDuty") {
      if (Number.isFinite(channel && channel.oscillationDutyPercent)) {
        return clamp(channel.oscillationDutyPercent / 100, 0, 1);
      }
      return 0.5;
    }

    if (mode === "pwm255") {
      return clamp(rawValue / 255, 0, 1);
    }

    if (mode === "sample100") {
      return clamp(Math.abs(rawValue) / 100, 0, 1);
    }

    return normalizeDutyRatio(rawValue);
  }

  function buildOscillationPoints(rawPoints, channel) {
    var sourcePoints = Array.isArray(rawPoints) ? rawPoints : [];
    if (sourcePoints.length === 0) return [];

    var points = sourcePoints.slice().sort(function (left, right) {
      return toNumber(left && left.x, 0) - toNumber(right && right.x, 0);
    });
    var waveform = [];
    var windowEnd = Date.now();
    var windowStart = windowEnd - getSpanSeconds() * 1000;
    var period = clamp(toNumber(channel && channel.oscillationPeriodMs, 1000), 20, 60000);
    var maxGeneratedPoints = Math.max(2000, getMaxPoints() * 6);
    var phaseAnchor = 0;

    function pushWavePoint(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      var last = waveform.length > 0 ? waveform[waveform.length - 1] : null;
      if (last && last.x === x && last.y === y) return;
      waveform.push({ x: x, y: y });
    }

    function cycleStartForTimestamp(timestamp) {
      var cycles = Math.floor((timestamp - phaseAnchor) / period);
      return phaseAnchor + cycles * period;
    }

    for (var i = 0; i < points.length && waveform.length < maxGeneratedPoints; i += 1) {
      var current = points[i];
      var currentTs = toNumber(current && current.x, NaN);
      if (!Number.isFinite(currentTs)) continue;

      var duty = clamp(resolveOscillationDutyRatio(channel, toNumber(current && current.y, 0)), 0, 1);
      var nextTs = i + 1 < points.length ? toNumber(points[i + 1] && points[i + 1].x, NaN) : windowEnd;
      if (!Number.isFinite(nextTs) || nextTs <= currentTs) {
        nextTs = currentTs + period;
      }

      var intervalStart = Math.max(currentTs, windowStart);
      var intervalEnd = Math.min(nextTs, windowEnd);
      if (intervalEnd <= intervalStart) continue;

      var cycleStart = cycleStartForTimestamp(intervalStart);
      while (cycleStart < intervalEnd && waveform.length < maxGeneratedPoints) {
        var cycleEnd = cycleStart + period;
        var highEnd = cycleStart + period * duty;
        var segmentStart = Math.max(intervalStart, cycleStart);
        var segmentEnd = Math.min(intervalEnd, cycleEnd);
        if (segmentEnd <= segmentStart) {
          cycleStart = cycleEnd;
          continue;
        }

        var startsHigh = duty > 0 && segmentStart < highEnd;
        var startLevel = startsHigh ? OSCILLATION_HIGH_LEVEL : OSCILLATION_LOW_LEVEL;
        pushWavePoint(segmentStart, startLevel);

        if (duty > 0 && duty < 1 && highEnd > segmentStart && highEnd < segmentEnd) {
          pushWavePoint(highEnd, OSCILLATION_LOW_LEVEL);
        }

        var endLevel = duty >= 1
          ? OSCILLATION_HIGH_LEVEL
          : (segmentEnd <= highEnd ? OSCILLATION_HIGH_LEVEL : OSCILLATION_LOW_LEVEL);
        pushWavePoint(segmentEnd, endLevel);

        cycleStart = cycleEnd;
      }
    }

    return waveform;
  }

  function getChartStyle() {
    var style = String(currentData.chartStyle || "line").toLowerCase();
    if (style === "step" || style === "area" || style === "bar") {
      return style;
    }
    return "line";
  }

  function isOscilloscopeMode() {
    return toBool(currentData.oscilloscopeMode, false);
  }

  function getPhosphorColor() {
    return normalizeHexColor(currentData.oscilloscopeColor, "#66FF99");
  }

  function getChannelColor(channelIndex, channel) {
    var metaColor = currentData["channel" + String(channelIndex + 1) + "Color"];
    if (typeof metaColor === "string" && metaColor.trim()) {
      return normalizeHexColor(metaColor, COLOR_PALETTE[channelIndex % COLOR_PALETTE.length]);
    }

    var appearanceColor = colorFromInt(channel.appearanceLineColor);
    if (appearanceColor) return appearanceColor;

    if (isOscilloscopeMode()) return getPhosphorColor();
    return COLOR_PALETTE[channelIndex % COLOR_PALETTE.length];
  }

  function getConfiguredChannels() {
    var sourceChannels = Array.isArray(currentData && currentData.channels) ? currentData.channels : [];
    var result = [];
    var oscillationSet = getOscillationChannelSet();
    var oscillationModeMap = getOscillationModeMap();
    var oscillationDutyMap = getOscillationDutyMap();

    var ZERO_GUID = "00000000-0000-0000-0000-000000000000";

    for (var i = 0; i < sourceChannels.length; i += 1) {
      var option = sourceChannels[i];
      if (!option || !option.channelID || !option.channelID.elementID) continue;

      var elementId = String(option.channelID.elementID);
      if (elementId === ZERO_GUID) continue;
      var index = Math.round(toNumber(option.channelID.index, 0));
      var key = buildChannelKey(elementId, index);
      var label = currentData["channel" + String(i + 1) + "Label"];
      var liveDutyPercent = getOscillationDutyPercent(key);

      result.push({
        elementId: elementId,
        index: index,
        key: key,
        label: typeof label === "string" && label.trim().length > 0 ? label.trim() : "Channel " + String(i + 1),
        autoScale: option.autoScale !== false,
        axisMin: toNumber(option.axisYMin, NaN),
        axisMax: toNumber(option.axisYMax, NaN),
        appearanceLineColor: option.appearance ? option.appearance.lineColor : null,
        appearanceAxisColor: option.appearance ? option.appearance.axisColor : null,
        oscillation: oscillationSet[key] === true,
        oscillationPeriodMs: getOscillationPeriodMs(key),
        oscillationMode: typeof oscillationModeMap[key] === "string" ? oscillationModeMap[key] : getOscillationMode(key),
        oscillationDutyPercent: Number.isFinite(liveDutyPercent)
          ? liveDutyPercent
          : (Number.isFinite(oscillationDutyMap[key]) ? clamp(oscillationDutyMap[key], 0, 100) : null)
      });
    }

    return result;
  }

  function buildDataset(channel, channelIndex) {
    var style = getChartStyle();
    var osc = isOscilloscopeMode();
    var oscillation = channel && channel.oscillation === true;
    var color = getChannelColor(channelIndex, channel);
    var smoothing = clamp(toNumber(currentData.smoothing, 0.25), 0, 0.95);
    var lineWidth = clamp(toNumber(currentData.lineWidth, 2), 1, 8);
    var pointRadius = clamp(toNumber(currentData.pointRadius, 0), 0, 6);
    var fillArea = toBool(currentData.fillArea, false) || style === "area";
    var rightAxisEnabled = toBool(currentData.rightAxisEnabled, true);

    var baseType = style === "bar" ? "bar" : "line";
    var stepped = style === "step" || osc || oscillation;
    var yAxis = rightAxisEnabled && channelIndex % 2 === 1 ? "y1" : "y";

    return {
      _channelKey: channel.key,
      _oscillation: oscillation,
      label: oscillation ? channel.label + " (osc)" : channel.label,
      yAxisID: yAxis,
      type: baseType,
      borderColor: color,
      backgroundColor: fillArea && !osc ? withAlpha(color, 0.2) : withAlpha(color, 0.08),
      pointRadius: osc ? 0 : pointRadius,
      pointHoverRadius: osc ? 0 : Math.max(pointRadius + 1, 2),
      borderWidth: osc ? Math.max(lineWidth, 2) : lineWidth,
      tension: stepped ? 0 : smoothing,
      stepped: stepped,
      fill: baseType === "line" ? (fillArea && !osc ? "origin" : false) : false,
      data: []
    };
  }

  function getAxisLocks(channels) {
    var y = { hasLock: false, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
    var y1 = { hasLock: false, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
    var rightAxisEnabled = toBool(currentData.rightAxisEnabled, true);

    for (var i = 0; i < channels.length; i += 1) {
      var channel = channels[i];
      if (channel.autoScale !== false) continue;
      if (!Number.isFinite(channel.axisMin) || !Number.isFinite(channel.axisMax)) continue;
      if (channel.axisMax <= channel.axisMin) continue;

      var axis = rightAxisEnabled && i % 2 === 1 ? y1 : y;
      axis.hasLock = true;
      axis.min = Math.min(axis.min, channel.axisMin);
      axis.max = Math.max(axis.max, channel.axisMax);
    }

    return { y: y, y1: y1 };
  }

  function buildChartOptions(channels) {
    var osc = isOscilloscopeMode();
    var phosphor = getPhosphorColor();
    var showLegend = toBool(currentData.showLegend, true);
    var showGrid = toBool(currentData.showGrid, true);
    var showAxes = toBool(currentData.showAxes, true);
    var showTooltip = toBool(currentData.showTooltip, true);
    var rightAxisEnabled = toBool(currentData.rightAxisEnabled, true);
    var axisLocks = getAxisLocks(channels);
    var hasOscillationWave = false;
    var yHasOscillation = false;
    var y1HasOscillation = false;

    for (var i = 0; i < channels.length; i += 1) {
      var channel = channels[i];
      if (!channel || channel.oscillation !== true) continue;
      hasOscillationWave = true;

      if (rightAxisEnabled && i % 2 === 1) {
        y1HasOscillation = true;
      } else {
        yHasOscillation = true;
      }
    }

    var theme = (window.BruControl && window.BruControl.getTheme) ? window.BruControl.getTheme() : {};
    var themeTextPrimary = theme["text-primary"] || theme["text-secondary"];
    var themeGridColor = themeTextPrimary ? withAlpha(themeTextPrimary, 0.15) : null;
    var axisColor = osc ? withAlpha(phosphor, 0.85) : (currentData.axisColor || themeTextPrimary || "rgba(212, 212, 212, 0.78)");
    var gridColor = osc ? withAlpha(phosphor, 0.18) : (currentData.gridLineColor || themeGridColor || "rgba(212, 212, 212, 0.14)");
    var legendColor = osc ? phosphor : (currentData.legendColor || themeTextPrimary || "rgba(212, 212, 212, 0.9)");

    var options = {
      responsive: true,
      maintainAspectRatio: false,
      normalized: true,
      parsing: false,
      animation: false,
      interaction: {
        mode: "nearest",
        intersect: false
      },
      plugins: {
        legend: {
          display: showLegend,
          labels: {
            color: legendColor,
            usePointStyle: true,
            pointStyle: "line",
            boxWidth: 18,
            boxHeight: 6
          }
        },
        tooltip: {
          enabled: showTooltip,
          mode: "nearest",
          intersect: false,
          callbacks: {
            title: function (items) {
              if (!items || items.length === 0) return "";
              var timestamp = items[0].parsed && items[0].parsed.x;
              if (!timestamp) return "";
              return new Date(timestamp).toLocaleString();
            }
          }
        },
        bruOscilloscopePersistence: {
          enabled: osc,
          persistence: clamp(toNumber(currentData.oscilloscopePersistence, 0.22), 0, 0.95),
          noise: clamp(toNumber(currentData.oscilloscopeNoise, 0.03), 0, 0.2)
        }
      },
      scales: {
        x: {
          type: "time",
          display: showAxes,
          grid: {
            display: showGrid,
            color: gridColor
          },
          ticks: {
            display: showAxes && !hasOscillationWave,
            color: axisColor,
            maxTicksLimit: 8
          },
          border: {
            color: axisColor
          }
        },
        y: {
          type: "linear",
          display: showAxes,
          position: "left",
          grid: {
            display: showGrid,
            color: gridColor
          },
          ticks: {
            color: axisColor
          },
          border: {
            color: axisColor
          },
          title: {
            display: typeof currentData.leftAxisLabel === "string" && currentData.leftAxisLabel.trim().length > 0,
            text: currentData.leftAxisLabel || "",
            color: axisColor
          },
          grace: yHasOscillation ? OSCILLATION_AXIS_GRACE : 0
        },
        y1: {
          type: "linear",
          display: showAxes && rightAxisEnabled,
          position: "right",
          grid: {
            drawOnChartArea: false,
            display: showGrid,
            color: gridColor
          },
          ticks: {
            color: axisColor
          },
          border: {
            color: axisColor
          },
          title: {
            display: typeof currentData.rightAxisLabel === "string" && currentData.rightAxisLabel.trim().length > 0,
            text: currentData.rightAxisLabel || "",
            color: axisColor
          },
          grace: y1HasOscillation ? OSCILLATION_AXIS_GRACE : 0
        }
      }
    };

    if (axisLocks.y.hasLock) {
      options.scales.y.min = axisLocks.y.min;
      options.scales.y.max = axisLocks.y.max;
    }
    if (axisLocks.y1.hasLock) {
      options.scales.y1.min = axisLocks.y1.min;
      options.scales.y1.max = axisLocks.y1.max;
    }

    return options;
  }

  function ensureChart(channels) {
    var ChartCtor = ensureChartCtor();
    if (!ChartCtor) {
      showOverlay("Chart.js is not available in this widget runtime.");
      return null;
    }

    var style = getChartStyle();
    var chartType = style === "bar" ? "bar" : "line";
    var options = buildChartOptions(channels);

    if (!chart) {
      chart = new ChartCtor(canvasEl.getContext("2d"), {
        type: chartType,
        data: { datasets: [] },
        options: options
      });
      return chart;
    }

    chart.config.type = chartType;
    chart.options = options;
    return chart;
  }

  function showOverlay(message) {
    if (!overlayEl) return;
    if (message) {
      overlayEl.textContent = message;
      overlayEl.classList.remove("hidden");
    } else {
      overlayEl.classList.add("hidden");
    }
  }

  function updateHeaderMeta(channelCount) {
    if (!metaEl) return;
    var span = getSpanSeconds();
    var units = "s";
    var value = span;
    if (span >= 86400) {
      units = "d";
      value = Math.round((span / 86400) * 10) / 10;
    } else if (span >= 3600) {
      units = "h";
      value = Math.round((span / 3600) * 10) / 10;
    } else if (span >= 60) {
      units = "m";
      value = Math.round((span / 60) * 10) / 10;
    }
    metaEl.textContent = String(channelCount) + " ch • " + String(value) + units + " window";
  }

  function applyWidgetStyles() {
    if (!widgetEl) return;

    var showHeader = toBool(currentData.showHeader, true);
    var showBackground = toBool(currentData.showBackground, true);
    var padding = 8;
    var osc = isOscilloscopeMode();
    var phosphor = getPhosphorColor();
    var scanlineOpacity = clamp(toNumber(currentData.oscilloscopeScanlineOpacity, 0.12), 0, 0.35);
    var glow = clamp(toNumber(currentData.oscilloscopeGlow, 16), 0, 40);

    if (headerEl) {
      headerEl.classList.toggle("hidden", !showHeader);
      headerEl.style.background = currentData.headerColor || "";
      headerEl.style.borderBottom = showHeader ? "" : "none";
    }

    if (contentEl) {
      contentEl.style.padding = "8px";
    }

    if (showBackground) {
      widgetEl.style.background = currentData.backgroundColor || "";
      widgetEl.style.border = currentData.borderColor ? "1px solid " + currentData.borderColor : "";
    } else {
      widgetEl.style.background = "transparent";
      widgetEl.style.border = "none";
    }

    if (oscilloscopeOverlayEl) {
      oscilloscopeOverlayEl.style.opacity = osc ? String(scanlineOpacity) : "0";
    }

    widgetEl.classList.toggle("oscilloscope-mode", osc);
    if (osc) {
      canvasEl.style.filter = "drop-shadow(0 0 " + String(Math.round(glow)) + "px " + withAlpha(phosphor, 0.65) + ")";
    } else {
      canvasEl.style.filter = "";
    }
  }

  function toSamplePoints(samples) {
    var points = [];
    if (!Array.isArray(samples)) return points;

    for (var i = 0; i < samples.length; i += 1) {
      var sample = samples[i];
      if (!sample) continue;
      var value = typeof sample.value === "number" ? sample.value : null;
      if (value === null || !Number.isFinite(value)) continue;
      var timestamp = new Date(sample.timestamp);
      var x = timestamp.getTime();
      if (!Number.isFinite(x)) continue;
      points.push({ x: x, y: value });
    }

    points.sort(function (left, right) {
      return left.x - right.x;
    });
    return points;
  }

  function trimOscillationRawPoints(points) {
    if (!Array.isArray(points) || points.length === 0) return;
    var spanMs = getSpanSeconds() * 1000;
    var cutoff = Date.now() - Math.max(spanMs + 2000, 10000);
    while (points.length > 0 && toNumber(points[0] && points[0].x, NaN) < cutoff) {
      points.shift();
    }

    var maxKeep = Math.max(getMaxPoints() * 2, 200);
    while (points.length > maxKeep) {
      points.shift();
    }
  }

  function upsertOscillationRawPoint(channelKey, timestampUnixMs, value) {
    var key = normalizeChannelKey(channelKey);
    if (!key || !Number.isFinite(timestampUnixMs) || !Number.isFinite(value)) return;

    var points = oscillationRawPointsByChannel[key];
    if (!Array.isArray(points)) {
      points = [];
      oscillationRawPointsByChannel[key] = points;
    }

    if (points.length === 0 || toNumber(points[points.length - 1] && points[points.length - 1].x, NaN) <= timestampUnixMs) {
      points.push({ x: timestampUnixMs, y: value });
    } else {
      points.push({ x: timestampUnixMs, y: value });
      points.sort(function (left, right) {
        return left.x - right.x;
      });
    }

    trimOscillationRawPoints(points);
  }

  function pruneOscillationRawPoints(channels) {
    var keep = Object.create(null);
    for (var i = 0; i < channels.length; i += 1) {
      var channel = channels[i];
      if (!channel || !channel.oscillation) continue;
      keep[normalizeChannelKey(channel.key)] = true;
    }

    var keys = Object.keys(oscillationRawPointsByChannel);
    for (var j = 0; j < keys.length; j += 1) {
      if (keep[keys[j]] === true) continue;
      delete oscillationRawPointsByChannel[keys[j]];
    }
  }

  function refreshOscillationDatasetsFromCache() {
    if (!chart) return;
    var updated = false;
    for (var i = 0; i < configuredChannels.length; i += 1) {
      var channel = configuredChannels[i];
      if (!channel || channel.oscillation !== true) continue;

      var dataset = datasetByChannelKey(channel.key);
      if (!dataset) continue;

      var key = normalizeChannelKey(channel.key);
      var rawPoints = oscillationRawPointsByChannel[key];
      if (!Array.isArray(rawPoints) || rawPoints.length === 0) continue;

      // Re-read live oscillation hints so the waveform reflects the latest
      // duty cycle percentage and period values received via SignalR samples,
      // rather than the stale values captured when configuredChannels was built.
      var liveHint = getOscillationHint(key);
      if (liveHint) {
        if (Number.isFinite(liveHint.dutyPercent)) {
          channel.oscillationDutyPercent = clamp(liveHint.dutyPercent, 0, 100);
        }
        if (Number.isFinite(liveHint.periodMs)) {
          channel.oscillationPeriodMs = clamp(Math.round(liveHint.periodMs), 20, 60000);
        }
      }

      trimOscillationRawPoints(rawPoints);
      dataset.data = buildOscillationPoints(rawPoints, channel);
      updated = true;
    }

    if (updated) {
      trimDatasets();
      applyRealtimeXAxisWindow(configuredChannels);
      chart.update("none");
    }
  }

  function clearOscillationAnimation() {
    if (!oscillationAnimationHandle) return;
    clearInterval(oscillationAnimationHandle);
    oscillationAnimationHandle = null;
  }

  function ensureOscillationAnimation(channels) {
    var hasOscillation = false;
    for (var i = 0; i < channels.length; i += 1) {
      if (channels[i] && channels[i].oscillation === true) {
        hasOscillation = true;
        break;
      }
    }

    if (!hasOscillation) {
      clearOscillationAnimation();
      return;
    }

    if (oscillationAnimationHandle) return;

    oscillationAnimationHandle = setInterval(function () {
      refreshOscillationDatasetsFromCache();
    }, OSCILLATION_ANIMATION_INTERVAL_MS);
  }

  function clearRealtimeTick() {
    if (realtimeTickHandle) {
      clearInterval(realtimeTickHandle);
      realtimeTickHandle = null;
    }
  }

  function refreshRealtimeDatasets() {
    if (!chart || !Array.isArray(chart.data.datasets)) return;
    var nowMs = Date.now();
    var updated = false;
    var datasets = chart.data.datasets;

    for (var i = 0; i < datasets.length; i += 1) {
      var dataset = datasets[i];
      if (dataset._oscillation) continue;
      if (!Array.isArray(dataset.data) || dataset.data.length === 0) continue;

      var last = dataset.data[dataset.data.length - 1];
      var lastX = pointToTimestamp(last);
      if (!Number.isFinite(lastX) || !Number.isFinite(last.y)) continue;
      if (nowMs - lastX < REALTIME_EXTEND_THRESHOLD_MS) continue;

      dataset.data.push({ x: nowMs, y: last.y });
      updated = true;
    }

    if (updated || configuredChannels.length > 0) {
      trimDatasets();
      applyRealtimeXAxisWindow(configuredChannels);
      chart.update("none");
    }
  }

  function ensureRealtimeTick(channels) {
    var hasNonOscillation = false;
    for (var i = 0; i < channels.length; i += 1) {
      if (channels[i] && channels[i].oscillation !== true) {
        hasNonOscillation = true;
        break;
      }
    }

    if (!hasNonOscillation || !hasHistoryLoaded) {
      clearRealtimeTick();
      return;
    }

    if (realtimeTickHandle) return;

    realtimeTickHandle = setInterval(function () {
      refreshRealtimeDatasets();
    }, REALTIME_TICK_INTERVAL_MS);
  }

  function requestOscillationHintsRefresh(channels) {
    // One-shot fetch of oscillation hints at init time. Never called again after first success.
    if (oscillationHintsLoadedOnce) return;

    var trackedKeys = Object.create(null);
    for (var i = 0; i < channels.length; i += 1) {
      var tracked = channels[i];
      if (!tracked || tracked.oscillation !== true) continue;
      var trackedKey = normalizeChannelKey(tracked.key);
      if (!trackedKey) continue;
      trackedKeys[trackedKey] = true;
    }

    if (Object.keys(trackedKeys).length === 0) {
      if (Object.keys(oscillationHintsByChannel).length > 0) {
        oscillationHintsByChannel = Object.create(null);
      }
      return;
    }

    if (!window.BruControl || !window.BruControl.fetchChartChannels) {
      return;
    }

    window.BruControl.fetchChartChannels()
      .then(function (items) {
        if (!Array.isArray(items)) return;
        oscillationHintsLoadedOnce = true;

        var nextHints = Object.create(null);
        for (var j = 0; j < items.length; j += 1) {
          var item = items[j];
          if (!item || typeof item !== "object") continue;

          var rawChannelKey = typeof item.channelKey === "string"
            ? item.channelKey
            : (item.elementId ? buildChannelKey(item.elementId, Math.round(toNumber(item.channelIndex, 0))) : "");
          var key = normalizeChannelKey(rawChannelKey);
          if (!key || trackedKeys[key] !== true) continue;

          var mode = typeof item.oscillationMode === "string" ? item.oscillationMode.trim() : "";
          var duty = toNumber(item.oscillationDutyPercent, NaN);
          var period = toNumber(item.oscillationPeriodMs, NaN);

          nextHints[key] = {
            mode: mode || null,
            dutyPercent: Number.isFinite(duty) ? clamp(duty, 0, 100) : null,
            periodMs: Number.isFinite(period) && period > 0 ? clamp(Math.round(period), 20, 60000) : null
          };
        }

        oscillationHintsByChannel = nextHints;
        configuredChannels = getConfiguredChannels();
        rebuildDatasets(configuredChannels);
        refreshOscillationDatasetsFromCache();
      })
      .catch(function () {
        // Ignore hint refresh failures; waveform keeps current settings.
      });
  }

  function pointToTimestamp(point) {
    if (!point) return NaN;
    if (typeof point.x === "number") return point.x;
    var parsed = new Date(point.x).getTime();
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function trimDatasets() {
    if (!chart) return;
    var cutoff = Date.now() - getSpanSeconds() * 1000;
    var maxPoints = getMaxPoints();
    var datasets = chart.data.datasets || [];

    for (var i = 0; i < datasets.length; i += 1) {
      var dataset = datasets[i];
      if (!Array.isArray(dataset.data)) continue;

      while (dataset.data.length > 0) {
        var firstTs = pointToTimestamp(dataset.data[0]);
        if (!Number.isFinite(firstTs) || firstTs >= cutoff) break;
        dataset.data.shift();
      }

      while (dataset.data.length > maxPoints) {
        dataset.data.shift();
      }
    }
  }

  function datasetByChannelKey(channelKey) {
    if (!chart || !Array.isArray(chart.data.datasets)) return null;
    var normalized = normalizeChannelKey(channelKey);
    for (var i = 0; i < chart.data.datasets.length; i += 1) {
      var dataset = chart.data.datasets[i];
      if (normalizeChannelKey(dataset._channelKey) === normalized) {
        return dataset;
      }
    }
    return null;
  }

  function rebuildDatasets(channels) {
    if (!chart) return;
    var previousByKey = Object.create(null);
    var datasets = chart.data.datasets || [];
    for (var i = 0; i < datasets.length; i += 1) {
      var dataset = datasets[i];
      var key = normalizeChannelKey(dataset._channelKey);
      if (key) previousByKey[key] = dataset.data || [];
    }

    var nextDatasets = [];
    for (var j = 0; j < channels.length; j += 1) {
      var channel = channels[j];
      var next = buildDataset(channel, j);
      var previous = previousByKey[channel.key];
      if (Array.isArray(previous) && previous.length > 0) {
        next.data = previous.slice();
      }
      nextDatasets.push(next);
    }

    chart.data.datasets = nextDatasets;
    trimDatasets();
  }

  function applyRealtimeXAxisWindow(channels) {
    if (!chart || !chart.options || !chart.options.scales || !chart.options.scales.x) return;
    if (!channels || channels.length === 0) return;

    var hasOscillationWave = false;
    for (var i = 0; i < channels.length; i += 1) {
      if (channels[i] && channels[i].oscillation === true) {
        hasOscillationWave = true;
        break;
      }
    }

    var nowMs = Date.now();
    var spanMs = getSpanSeconds() * 1000;
    chart.options.scales.x.min = nowMs - spanMs;
    chart.options.scales.x.max = nowMs;
  }

  function buildHistorySignature(channels) {
    var parts = [
      normalizeChannelKey(currentData && currentData.id),
      String(getSpanSeconds()),
      String(getMaxPoints())
    ];
    for (var i = 0; i < channels.length; i += 1) {
      var channel = channels[i];
      parts.push([
        channel.key,
        channel.oscillation ? "osc" : "raw",
        channel.oscillationPeriodMs,
        channel.oscillationMode,
        channel.oscillationDutyPercent
      ].join("|"));
    }
    return parts.join("||");
  }

  function requestHistoryRefresh() {
    if (historyRefreshHandle) {
      clearTimeout(historyRefreshHandle);
      historyRefreshHandle = null;
    }
    historyRefreshHandle = setTimeout(function () {
      historyRefreshHandle = null;
      refreshHistory();
    }, 60);
  }

  function refreshHistory() {
    if (!window.BruControl || !window.BruControl.fetchSamples || !chart) return;

    var channels = getConfiguredChannels();
    configuredChannels = channels;
    if (channels.length === 0) {
      hasHistoryLoaded = false;
      oscillationHintsByChannel = Object.create(null);
      showOverlay("No channels configured. Open Edit Chart to pick channels.");
      chart.data.datasets = [];
      chart.update("none");
      updateHeaderMeta(0);
      return;
    }

    var showLoadingOverlay = !hasHistoryLoaded;
    if (showLoadingOverlay) {
      showOverlay("Loading chart history...");
    }
    var requestVersion = historyRequestVersion + 1;
    historyRequestVersion = requestVersion;

    var since = new Date(Date.now() - getSpanSeconds() * 1000).toISOString();
    var points = getMaxPoints();

    var requests = channels.map(function (channel, channelIndex) {
      // Oscillation channels don't need historical sample data -- their waveform is
      // synthesized client-side from the live value arriving via SignalR.
      if (channel.oscillation === true) {
        var seedPoint = { x: Date.now(), y: 0 };
        return Promise.resolve({
          channelIndex: channelIndex,
          channelKey: channel.key,
          channel: channel,
          rawPoints: [seedPoint],
          points: buildOscillationPoints([seedPoint], channel)
        });
      }

      return window.BruControl.fetchSamples(channel.elementId, channel.index, since, points)
        .then(function (samples) {
          var basePoints = toSamplePoints(samples);
          return {
            channelIndex: channelIndex,
            channelKey: channel.key,
            channel: channel,
            rawPoints: basePoints,
            points: basePoints
          };
        })
        .catch(function () {
          return {
            channelIndex: channelIndex,
            channelKey: channel.key,
            channel: channel,
            rawPoints: [],
            points: []
          };
        });
    });

    Promise.all(requests).then(function (results) {
      if (!chart || requestVersion !== historyRequestVersion) return;

      for (var i = 0; i < results.length; i += 1) {
        var result = results[i];
        var dataset = datasetByChannelKey(result.channelKey);
        if (!dataset) continue;

        var normalizedKey = normalizeChannelKey(result.channelKey);
        if (result.channel && result.channel.oscillation === true) {
          oscillationRawPointsByChannel[normalizedKey] = result.rawPoints.slice();
        } else {
          delete oscillationRawPointsByChannel[normalizedKey];
        }

        dataset.data = result.points;
      }

      trimDatasets();
      pruneOscillationRawPoints(channels);
      ensureOscillationAnimation(channels);
      ensureRealtimeTick(channels);
      applyRealtimeXAxisWindow(channels);
      chart.update("none");
      updateHeaderMeta(channels.length);
      hasHistoryLoaded = true;
      if (showLoadingOverlay) {
        showOverlay(null);
      }
    });
  }

  function handleSample(sample) {
    if (!sample || !chart || !currentData) return;

    var currentChartId = normalizeChannelKey(currentData.id);
    if (currentChartId && normalizeChannelKey(sample.chartId) !== currentChartId) return;

    var dataset = datasetByChannelKey(sample.channelKey);
    if (!dataset) return;
    if (!Number.isFinite(sample.timestampUnixMs) || typeof sample.value !== "number" || !Number.isFinite(sample.value)) return;

    if (dataset._oscillation) {
      // For oscillation channels, animate locally using latest duty/period hints.
      upsertOscillationRawPoint(sample.channelKey, sample.timestampUnixMs, sample.value);

      // Accept oscillation hints piggybacked on the SignalR sample event.
      var sampleHintKey = normalizeChannelKey(sample.channelKey);
      if (sampleHintKey) {
        var dutyFromSample = toNumber(sample.oscillationDutyPercent, NaN);
        var periodFromSample = toNumber(sample.oscillationPeriodMs, NaN);
        if (Number.isFinite(dutyFromSample) || Number.isFinite(periodFromSample)) {
          var existingHint = oscillationHintsByChannel[sampleHintKey] || {};
          oscillationHintsByChannel[sampleHintKey] = {
            mode: existingHint.mode || null,
            dutyPercent: Number.isFinite(dutyFromSample) ? clamp(dutyFromSample, 0, 100) : (existingHint.dutyPercent || null),
            periodMs: Number.isFinite(periodFromSample) && periodFromSample > 0 ? clamp(Math.round(periodFromSample), 20, 60000) : (existingHint.periodMs || null)
          };
        }
      }

      refreshOscillationDatasetsFromCache();
      return;
    }

    dataset.data.push({ x: sample.timestampUnixMs, y: sample.value });
    trimDatasets();
    ensureRealtimeTick(configuredChannels);
    applyRealtimeXAxisWindow(configuredChannels);
    chart.update("none");
  }

  function rebuildChart() {
    applyWidgetStyles();

    var channels = getConfiguredChannels();
    configuredChannels = channels;
    pruneOscillationRawPoints(channels);
    var historySignature = buildHistorySignature(channels);
    if (historySignature !== lastHistorySignature) {
      lastHistorySignature = historySignature;
      hasHistoryLoaded = false;
      oscillationHintsLoadedOnce = false;
    }
    var chartInstance = ensureChart(channels);
    if (!chartInstance) return;

    if (titleEl) {
      titleEl.textContent = currentData ? (currentData.displayName || currentData.name || "Chart") : "Chart";
    }

    rebuildDatasets(channels);
    updateHeaderMeta(channels.length);

    if (channels.length === 0) {
      clearOscillationAnimation();
      clearRealtimeTick();
      oscillationHintsByChannel = Object.create(null);
      showOverlay("No channels configured. Open Edit Chart to pick channels.");
      chartInstance.update("none");
      return;
    }

    requestOscillationHintsRefresh(channels);

    if (!hasHistoryLoaded) {
      showOverlay("Loading chart history...");
    } else {
      showOverlay(null);
    }
    chartInstance.update("none");
    applyRealtimeXAxisWindow(channels);
    ensureOscillationAnimation(channels);
    ensureRealtimeTick(channels);

    // Only load history once (or when config changes, which resets hasHistoryLoaded).
    // After history is loaded, all live updates come through SignalR -- no re-fetching.
    if (!hasHistoryLoaded) {
      requestHistoryRefresh();
    }
  }

  function updateData(nextData) {
    currentData = nextData || {};
    rebuildChart();
  }

  function clearPreviewTimer() {
    if (previewTimerHandle) {
      clearInterval(previewTimerHandle);
      previewTimerHandle = null;
    }
  }

  function startPreviewMode() {
    clearPreviewTimer();

    var now = Date.now();
    currentData = {
      id: "preview-chart",
      elementType: "chart",
      name: "Chart",
      displayName: "Preview Trend",
      spanSeconds: 300,
      refreshInterval: 1,
      showHeader: true,
      showBackground: true,
      showLegend: true,
      showGrid: true,
      showAxes: true,
      chartStyle: "line",
      timeRangePreset: "5m",
      maxPoints: 800,
      oscilloscopeMode: false,
      channels: [
        {
          channelID: { elementID: "00000000-0000-0000-0000-000000000101", index: 0 },
          autoScale: true,
          axisYMin: 0,
          axisYMax: 0,
          appearance: { lineColor: null, axisColor: null }
        },
        {
          channelID: { elementID: "00000000-0000-0000-0000-000000000102", index: 0 },
          autoScale: true,
          axisYMin: 0,
          axisYMax: 0,
          appearance: { lineColor: null, axisColor: null }
        }
      ]
    };

    rebuildChart();

    var previewPhase = 0;
    previewTimerHandle = setInterval(function () {
      previewPhase += 0.18;
      var ts = now + previewPhase * 1000;
      handleSample({
        chartId: currentData.id,
        channelKey: buildChannelKey(currentData.channels[0].channelID.elementID, 0),
        timestampUnixMs: ts,
        value: 67 + Math.sin(previewPhase) * 5
      });
      handleSample({
        chartId: currentData.id,
        channelKey: buildChannelKey(currentData.channels[1].channelID.elementID, 0),
        timestampUnixMs: ts,
        value: 34 + Math.cos(previewPhase * 0.6) * 11
      });
    }, 1000);
  }

  if (window.BruControl) {
    try {
      if (window.BruControl.getData) {
        updateData(window.BruControl.getData());
      }
    } catch {}

    window.BruControl.onData(updateData);
    window.BruControl.onSamples(handleSample);
    if (window.BruControl.onTheme) {
      window.BruControl.onTheme(function () { rebuildChart(); });
    }
  } else {
    startPreviewMode();
  }

  window.addEventListener("beforeunload", function () {
    clearPreviewTimer();
    clearOscillationAnimation();
    clearRealtimeTick();
  });
})();
