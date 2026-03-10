(function () {
  var titleEl = document.getElementById("widgetTitle");
  var metaEl = document.getElementById("widgetMeta");
  var headerEl = document.getElementById("widgetHeader");
  var contentEl = document.getElementById("widgetContent");
  var overlayEl = document.getElementById("chartOverlay");
  var widgetEl = document.getElementById("widget");
  var canvasEl = document.getElementById("chartCanvas");

  var currentData = null;
  var chart = null;
  var initialRequestVersion = 0;
  var initialRefreshHandle = null;
  var hasInitialDataLoaded = false;
  var lastConfigSignature = "";
  var configuredChannels = [];
  var previewTimerHandle = null;
  var realtimeTickHandle = null;

  // Fallback palette when theme is unavailable (VS Code Dark–style)
  var COLOR_PALETTE = ["#4EC9B0", "#DCDCAA", "#569CD6", "#C586C0", "#CE9178", "#9CDCFE"];
  // Theme keys for channel line colors (order matches palette: green, yellow, blue, purple, orange, red)
  var THEME_CHANNEL_KEYS = ["accent-green", "accent-yellow", "accent-blue", "accent-purple", "accent-orange", "accent-red"];
  var REALTIME_TICK_INTERVAL_MS = 1000;
  var REALTIME_EXTEND_THRESHOLD_MS = 500;

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

  function ensureChartCtor() {
    var ChartCtor = getChartCtor();
    if (!ChartCtor) return null;
    return ChartCtor;
  }

  function getSpanSeconds() {
    var span = toNumber(currentData && currentData.spanSeconds, NaN);
    if (Number.isFinite(span) && span >= 4) {
      return span;
    }
    return 300;
  }

  function getMaxPoints() {
    return Math.round(clamp(toNumber(currentData.maxPoints, 1000), 100, 5000));
  }

  function downsampleToMaxPoints(data, maxPoints) {
    if (!Array.isArray(data) || data.length <= maxPoints) return data;
    var dataLength = data.length;
    if (maxPoints <= 2) return [data[0], data[dataLength - 1]];

    var sampled = [data[0]];
    var bucketSize = (dataLength - 2) / (maxPoints - 2);
    var a = 0;

    for (var i = 0; i < maxPoints - 2; i += 1) {
      var avgX = 0;
      var avgY = 0;
      var avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
      var avgRangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, dataLength);
      var avgRangeLength = avgRangeEnd - avgRangeStart;

      for (var j = avgRangeStart; j < avgRangeEnd; j += 1) {
        var px = typeof data[j].x === "number" ? data[j].x : new Date(data[j].x).getTime();
        avgX += px;
        avgY += data[j].y;
      }
      if (avgRangeLength > 0) {
        avgX /= avgRangeLength;
        avgY /= avgRangeLength;
      } else if (avgRangeStart < dataLength) {
        avgX = typeof data[avgRangeStart].x === "number" ? data[avgRangeStart].x : new Date(data[avgRangeStart].x).getTime();
        avgY = data[avgRangeStart].y;
      }

      var rangeStart = Math.floor(i * bucketSize) + 1;
      var rangeEnd = Math.floor((i + 1) * bucketSize) + 1;
      var pointAX = typeof data[a].x === "number" ? data[a].x : new Date(data[a].x).getTime();

      var maxArea = -1;
      var maxAreaPoint = rangeStart;

      for (var k = rangeStart; k < rangeEnd; k += 1) {
        var kx = typeof data[k].x === "number" ? data[k].x : new Date(data[k].x).getTime();
        var area = Math.abs(
          (pointAX - avgX) * (data[k].y - data[a].y) -
          (pointAX - kx) * (avgY - data[a].y)
        ) * 0.5;
        if (area > maxArea) {
          maxArea = area;
          maxAreaPoint = k;
        }
      }

      sampled.push(data[maxAreaPoint]);
      a = maxAreaPoint;
    }

    sampled.push(data[dataLength - 1]);
    return sampled;
  }

  function getChartStyle() {
    var style = String(currentData.chartStyle || "line").toLowerCase();
    if (style === "area" || style === "bar") {
      return style;
    }
    return "line";
  }

  function getThemeChannelPalette() {
    var theme = (window.BruControl && window.BruControl.getTheme) ? window.BruControl.getTheme() : {};
    var palette = [];
    for (var i = 0; i < THEME_CHANNEL_KEYS.length; i += 1) {
      var color = theme[THEME_CHANNEL_KEYS[i]];
      if (typeof color === "string" && color.trim()) {
        var normalized = normalizeHexColor(color, null);
        if (normalized) palette.push(normalized);
      }
    }
    return palette.length >= 3 ? palette : null;
  }

  function getChannelColor(channelIndex, channel) {
    var metaColor = currentData["channel" + String(channelIndex + 1) + "Color"];
    if (typeof metaColor === "string" && metaColor.trim()) {
      return normalizeHexColor(metaColor, COLOR_PALETTE[channelIndex % COLOR_PALETTE.length]);
    }

    var appearanceColor = colorFromInt(channel.appearanceLineColor);
    if (appearanceColor) return appearanceColor;

    var themePalette = getThemeChannelPalette();
    var fallback = COLOR_PALETTE[channelIndex % COLOR_PALETTE.length];
    if (themePalette && themePalette.length > 0) {
      var themeColor = themePalette[channelIndex % themePalette.length];
      if (themeColor) return themeColor;
    }
    return fallback;
  }

  function getConfiguredChannels() {
    var sourceChannels = Array.isArray(currentData && currentData.channels) ? currentData.channels : [];
    var result = [];

    var ZERO_GUID = "00000000-0000-0000-0000-000000000000";

    for (var i = 0; i < sourceChannels.length; i += 1) {
      var option = sourceChannels[i];
      if (!option || !option.channelID || !option.channelID.elementID) continue;

      var elementId = String(option.channelID.elementID);
      if (elementId === ZERO_GUID) continue;
      var index = Math.round(toNumber(option.channelID.index, 0));
      var key = buildChannelKey(elementId, index);
      var label = currentData["channel" + String(i + 1) + "Label"];

      result.push({
        elementId: elementId,
        index: index,
        key: key,
        label: typeof label === "string" && label.trim().length > 0 ? label.trim() : "Channel " + String(i + 1),
        autoScale: option.autoScale !== false,
        axisMin: toNumber(option.axisYMin, NaN),
        axisMax: toNumber(option.axisYMax, NaN),
        appearanceLineColor: option.appearance ? option.appearance.lineColor : null,
        appearanceAxisColor: option.appearance ? option.appearance.axisColor : null
      });
    }

    return result;
  }

  function buildDataset(channel, channelIndex) {
    var style = getChartStyle();
    var color = getChannelColor(channelIndex, channel);
    var smoothing = clamp(toNumber(currentData.smoothing, 0.25), 0, 0.95);
    var lineWidth = clamp(toNumber(currentData.lineWidth, 2), 1, 8);
    var pointRadius = clamp(toNumber(currentData.pointRadius, 0), 0, 6);
    var fillArea = toBool(currentData.fillArea, false) || style === "area";
    var rightAxisEnabled = toBool(currentData.rightAxisEnabled, true);

    var baseType = style === "bar" ? "bar" : "line";
    var stepped = style === "step";
    var yAxis = rightAxisEnabled && channelIndex % 2 === 1 ? "y1" : "y";

    return {
      _channelKey: channel.key,
      label: channel.label,
      yAxisID: yAxis,
      type: baseType,
      borderColor: color,
      backgroundColor: fillArea ? withAlpha(color, 0.2) : withAlpha(color, 0.08),
      pointRadius: pointRadius,
      pointHoverRadius: Math.max(pointRadius + 1, 2),
      borderWidth: lineWidth,
      tension: stepped ? 0 : smoothing,
      stepped: stepped,
      fill: baseType === "line" ? (fillArea ? "origin" : false) : false,
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
    var showLegend = toBool(currentData.showLegend, true);
    var showGrid = toBool(currentData.showGrid, true);
    var showAxes = toBool(currentData.showAxes, true);
    var showTooltip = toBool(currentData.showTooltip, true);
    var rightAxisEnabled = toBool(currentData.rightAxisEnabled, true);
    var axisLocks = getAxisLocks(channels);

    var theme = (window.BruControl && window.BruControl.getTheme) ? window.BruControl.getTheme() : {};
    var themeTextPrimary = theme["text-primary"] || theme["text-secondary"];
    var themeGridColor = themeTextPrimary ? withAlpha(themeTextPrimary, 0.15) : null;
    var axisColor = currentData.axisColor || themeTextPrimary || "rgba(212, 212, 212, 0.78)";
    var gridColor = currentData.gridLineColor || themeGridColor || "rgba(212, 212, 212, 0.14)";
    var legendColor = currentData.legendColor || themeTextPrimary || "rgba(212, 212, 212, 0.9)";

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
            display: showAxes,
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
          grace: 0
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
          grace: 0
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
    canvasEl.style.filter = "";
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
    if (!hasInitialDataLoaded) {
      clearRealtimeTick();
      return;
    }

    if (realtimeTickHandle) return;

    realtimeTickHandle = setInterval(function () {
      refreshRealtimeDatasets();
    }, REALTIME_TICK_INTERVAL_MS);
  }


  function pointToTimestamp(point) {
    if (!point) return NaN;
    if (typeof point.x === "number") return point.x;
    var parsed = new Date(point.x).getTime();
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function trimDatasets() {
    if (!chart) return;
    var spanMs = getSpanSeconds() * 1000;
    var cutoff = Date.now() - spanMs;
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

      if (dataset.data.length > maxPoints) {
        dataset.data = downsampleToMaxPoints(dataset.data, maxPoints);
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

    var spanMs = getSpanSeconds() * 1000;
    var endMs = Date.now();
    chart.options.scales.x.min = endMs - spanMs;
    chart.options.scales.x.max = endMs;
  }

  function buildConfigSignature(channels) {
    var parts = [
      normalizeChannelKey(currentData && currentData.id),
      String(getSpanSeconds()),
      String(getMaxPoints())
    ];
    for (var i = 0; i < channels.length; i += 1) {
      var channel = channels[i];
      parts.push(channel.key);
    }
    return parts.join("||");
  }

  function requestInitialLoad() {
    if (initialRefreshHandle) {
      clearTimeout(initialRefreshHandle);
      initialRefreshHandle = null;
    }
    initialRefreshHandle = setTimeout(function () {
      initialRefreshHandle = null;
      loadInitialData();
    }, 60);
  }

  function loadInitialData() {
    if (!window.BruControl || !window.BruControl.fetchSamples || !chart) return;

    var channels = getConfiguredChannels();
    configuredChannels = channels;
    if (channels.length === 0) {
      hasInitialDataLoaded = false;
      showOverlay("No channels configured. Open Edit Chart to pick channels.");
      chart.data.datasets = [];
      chart.update("none");
      updateHeaderMeta(0);
      return;
    }

    var showLoadingOverlay = !hasInitialDataLoaded;
    if (showLoadingOverlay) {
      showOverlay("Loading chart history...");
    }
    var requestVersion = initialRequestVersion + 1;
    initialRequestVersion = requestVersion;

    var since = new Date(Date.now() - getSpanSeconds() * 1000).toISOString();
    var points = getMaxPoints();

    var requests = channels.map(function (channel, channelIndex) {
      return window.BruControl.fetchSamples(channel.elementId, channel.index, since, points)
        .then(function (samples) {
          var basePoints = toSamplePoints(samples);
          return {
            channelIndex: channelIndex,
            channelKey: channel.key,
            points: basePoints
          };
        })
        .catch(function () {
          return {
            channelIndex: channelIndex,
            channelKey: channel.key,
            points: []
          };
        });
    });

    Promise.all(requests).then(function (results) {
      if (!chart || requestVersion !== initialRequestVersion) return;

      for (var i = 0; i < results.length; i += 1) {
        var result = results[i];
        var dataset = datasetByChannelKey(result.channelKey);
        if (!dataset) continue;
        dataset.data = result.points;
      }

      trimDatasets();
      hasInitialDataLoaded = true;
      ensureRealtimeTick(channels);
      applyRealtimeXAxisWindow(channels);
      chart.update("none");
      updateHeaderMeta(channels.length);
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
    var configSignature = buildConfigSignature(channels);
    if (configSignature !== lastConfigSignature) {
      lastConfigSignature = configSignature;
      hasInitialDataLoaded = false;
    }
    var chartInstance = ensureChart(channels);
    if (!chartInstance) return;

    if (titleEl) {
      titleEl.textContent = currentData ? (currentData.displayName || currentData.name || "Chart") : "Chart";
    }

    rebuildDatasets(channels);
    updateHeaderMeta(channels.length);

    if (channels.length === 0) {
      clearRealtimeTick();
      showOverlay("No channels configured. Open Edit Chart to pick channels.");
      chartInstance.update("none");
      return;
    }

    if (!hasInitialDataLoaded) {
      showOverlay("Loading chart data...");
    } else {
      showOverlay(null);
    }
    chartInstance.update("none");
    applyRealtimeXAxisWindow(channels);
    ensureRealtimeTick(channels);

    if (!hasInitialDataLoaded) {
      requestInitialLoad();
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
      showHeader: true,
      showBackground: true,
      showLegend: true,
      showGrid: true,
      showAxes: true,
      chartStyle: "line",
      maxPoints: 800,
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
    clearRealtimeTick();
  });
})();
