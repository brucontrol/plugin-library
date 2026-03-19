(function () {
  var BASE_KEYS = new Set([ 'id', 'workspaceId', 'name', 'displayName', 'enabled', 'userControl', 'visibility', 'elementType', 'enableHistoricalLogging', 'loggingIntervalSeconds', 'maxSilenceSeconds', 'propertiesJson', 'schemaJson', 'uiControls', 'elementTemplateId', 'appearance' ]);

  var UI_CONTROL_KEYS = new Set([
    'showHeader', 'showLabel', 'showBackground', 'showValue',
    'labelFontFamily', 'labelFontSize', 'labelFontWeight', 'labelFontStyle', 'labelColor',
    'displayFontFamily', 'displayFontSize', 'displayColor',
    'headerColor', 'backgroundColor', 'borderColor', 'image'
  ]);

  function getThemeColor(cssVarName, fallback) {
    try {
      if (window.BruControl && window.BruControl.getTheme) {
        var theme = window.BruControl.getTheme();
        var key = cssVarName.replace(/^--/, '');
        if (theme && typeof theme[key] === 'string' && theme[key].trim()) return theme[key].trim();
      }
      var val = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
      return val || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function isHexColor(s) {
    if (!s || typeof s !== 'string') return false;
    var t = s.trim();
    return /^#[0-9A-Fa-f]{6}$/.test(t) || /^#[0-9A-Fa-f]{8}$/.test(t);
  }

  function resolveColor(value, themeVar, fallback) {
    if (isHexColor(value)) return (value && value.trim()) || fallback;
    return getThemeColor(themeVar, fallback);
  }

  function formatValue(value) {
    if (value == null) return '--';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function getNonBaseProperties(data) {
    if (!data || typeof data !== 'object') return [];
    var out = [];
    Object.keys(data).sort().forEach(function (key) {
      if (!BASE_KEYS.has(key) && !UI_CONTROL_KEYS.has(key)) {
        out.push({ name: key, value: formatValue(data[key]) });
      }
    });
    return out;
  }

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function render(data) {
    var d = data || {};
    var elementEl = document.getElementById("element");
    var titleEl = document.getElementById("elementTitle");
    var header = document.querySelector(".element-header");
    var propertyList = document.getElementById("propertyList");

    if (titleEl) {
      titleEl.textContent = d.displayName || d.name || "Generic";
      titleEl.style.display = d.showLabel === false ? "none" : "";
      titleEl.style.fontFamily = (d.labelFontFamily && String(d.labelFontFamily).trim()) ? String(d.labelFontFamily).trim() : "";
      titleEl.style.fontSize = numberOrNull(d.labelFontSize) !== null ? numberOrNull(d.labelFontSize) + "px" : "";
      titleEl.style.fontWeight = (d.labelFontWeight && String(d.labelFontWeight).trim()) ? String(d.labelFontWeight).trim() : "";
      titleEl.style.fontStyle = (d.labelFontStyle && String(d.labelFontStyle).trim()) ? String(d.labelFontStyle).trim() : "";
      titleEl.style.color = resolveColor(d.labelColor, "--text-primary", "#d4d4d4");
    }

    if (header) {
      var image = (d.image && String(d.image).trim()) ? String(d.image).trim() : "";
      header.style.display = image ? "none" : (d.showHeader === false ? "none" : "");
      var headerBg = (d.headerColor && String(d.headerColor).trim()) ? String(d.headerColor).trim() : "";
      header.style.background = headerBg || getThemeColor("--bg-tertiary", "#2d2d2d");
      header.style.borderBottom = d.showHeader === false ? "none" : "";
    }

    if (propertyList) {
      propertyList.innerHTML = "";
      var props = getNonBaseProperties(d);
      var valueColorResolved = (d.displayColor && String(d.displayColor).trim()) ? String(d.displayColor).trim() : "var(--accent-green, #4ec9b0)";
      var dispFont = (d.displayFontFamily && String(d.displayFontFamily).trim()) ? String(d.displayFontFamily).trim() : "";
      var dispSizePx = numberOrNull(d.displayFontSize) !== null ? numberOrNull(d.displayFontSize) + "px" : "";
      props.forEach(function (p) {
        var row = document.createElement("div");
        row.className = "property-row";
        var nameSpan = document.createElement("span");
        nameSpan.className = "property-name";
        nameSpan.textContent = p.name + ": ";
        var valueSpan = document.createElement("span");
        valueSpan.className = "property-value";
        valueSpan.textContent = p.value;
        valueSpan.style.color = valueColorResolved;
        if (dispFont) valueSpan.style.fontFamily = dispFont;
        if (dispSizePx) valueSpan.style.fontSize = dispSizePx;
        row.appendChild(nameSpan);
        row.appendChild(valueSpan);
        propertyList.appendChild(row);
      });
    }

    if (elementEl) {
      var image = (d.image && String(d.image).trim()) ? String(d.image).trim() : "";
      if (image) {
        elementEl.style.background = "transparent";
        elementEl.style.backgroundImage = "url(\"" + image.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\")";
        elementEl.style.backgroundSize = "cover";
        elementEl.style.backgroundPosition = "center";
        elementEl.style.border = "none";
      } else if (d.showBackground === false) {
        elementEl.style.background = "transparent";
        elementEl.style.border = "none";
        elementEl.style.backgroundImage = "";
      } else {
        elementEl.style.backgroundImage = "";
        var bg = (d.backgroundColor && String(d.backgroundColor).trim()) ? String(d.backgroundColor).trim() : "";
        elementEl.style.background = bg || getThemeColor("--bg-secondary", "#252526");
        var bc = (d.borderColor && String(d.borderColor).trim()) ? String(d.borderColor).trim() : "";
        elementEl.style.border = bc ? "1px solid " + bc : "1px solid " + getThemeColor("--border-color", "#404040");
      }
    }
  }

  if (window.BruControl) {
    window.BruControl.onData(render);
    window.BruControl.onTheme(function () {
      if (window.BruControl.getData) {
        try {
          var data = window.BruControl.getData();
          if (data) render(data);
        } catch (e) {}
      }
    });
  } else {
    render({ displayName: "Generic" });
  }
})();
