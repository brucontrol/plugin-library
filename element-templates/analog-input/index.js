(function () {
  var titleEl = document.getElementById("elementTitle");
  var contentEl = document.getElementById("elementContent");
  var footerEl = document.getElementById("elementFooter");
  var currentData = null;

  function isFooterActive() {
    return footerEl && footerEl.contains(document.activeElement) &&
           document.activeElement !== footerEl;
  }

  function getType(data) {
    if (data && data.elementType) return String(data.elementType);
    var fromAttr = document.body.getAttribute("data-element-type");
    return fromAttr || "element";
  }

  function toNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function toRowKey(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function getHiddenRowsMap() {
    var d = currentData || {};
    var map = Object.create(null);
    if (!Array.isArray(d.hiddenRowKeys)) return map;
    for (var i = 0; i < d.hiddenRowKeys.length; i += 1) {
      var key = toRowKey(d.hiddenRowKeys[i]);
      if (key) map[key] = true;
    }
    return map;
  }

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function row(label, value, cls, options, hiddenRows) {
    var d = currentData || {};
    var opts = options || {};
    var key = toRowKey(opts.key || label);
    var isPrimary = !!opts.primary;

    if (isPrimary && d.showValue === false) {
      return null;
    }
    if (hiddenRows[key]) {
      return null;
    }

    var r = document.createElement("div");
    r.className = "element-row";
    r.setAttribute("data-row-key", key);
    if (isPrimary) {
      r.classList.add("element-row--primary");
    }

    var l = document.createElement("span");
    l.className = "label row-label";
    l.textContent = label;

    var v = document.createElement("span");
    v.className = "value row-value" + (cls ? " " + cls : "");
    v.textContent = String(value);

    r.appendChild(l);
    r.appendChild(v);
    return r;
  }

  function primaryRow(label, value, cls, key, hiddenRows) {
    return row(label, value, cls, { primary: true, key: key }, hiddenRows);
  }

  function appendRow(rowEl) {
    if (rowEl) {
      contentEl.appendChild(rowEl);
    }
  }

  function applyStyles() {
    var d = currentData || {};
    var elementEl = document.getElementById("element");
    var header = document.querySelector(".element-header");
    var content = document.querySelector(".element-content");

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
        elementEl.style.background = d.backgroundColor || "";
        elementEl.style.border = d.borderColor ? "1px solid " + d.borderColor : "";
      }

      elementEl.style.borderRadius = "8px";
    }

    if (header) {
      var image = (d.image && String(d.image).trim()) ? String(d.image).trim() : "";
      header.style.display = image ? "none" : (d.showHeader === false ? "none" : "");
      header.style.background = d.headerColor || "";
      header.style.borderBottom = d.showHeader === false ? "none" : "";
    }

    if (content) {
      content.style.padding = "10px";
    }

    if (titleEl) {
      titleEl.style.display = d.showLabel === false ? "none" : "";
      titleEl.style.fontFamily = d.labelFontFamily || "";
      titleEl.style.fontSize = numberOrNull(d.labelFontSize) !== null ? numberOrNull(d.labelFontSize) + "px" : "";
      titleEl.style.fontWeight = d.labelFontWeight || "";
      titleEl.style.fontStyle = d.labelFontStyle || "";
      titleEl.style.color = d.labelColor || "";
      titleEl.style.textAlign = "left";
    }

    var primaryRows = document.querySelectorAll(".element-row--primary");
    primaryRows.forEach(function (rowEl) {
      rowEl.style.background = (d.valueBackgroundColor && String(d.valueBackgroundColor).trim()) ? String(d.valueBackgroundColor).trim() : "";
    });

    var labelNodes = document.querySelectorAll(".element-row .row-label");
    labelNodes.forEach(function (node) {
      var el = node;
      el.style.color = "";
      el.style.fontFamily = d.labelFontFamily || "";
      el.style.fontSize = numberOrNull(d.labelFontSize) !== null ? numberOrNull(d.labelFontSize) + "px" : "";
      el.style.fontWeight = d.labelFontWeight || "";
      el.style.fontStyle = d.labelFontStyle || "";
    });

    var valueNodes = document.querySelectorAll(".element-row .row-value");
    valueNodes.forEach(function (node) {
      var el = node;
      var rowEl = el.closest ? el.closest(".element-row") : el.parentElement;
      var isPrimary = rowEl && rowEl.classList && rowEl.classList.contains("element-row--primary");
      var valColor = (d.valueColor && String(d.valueColor).trim()) ? String(d.valueColor).trim() : "var(--accent-green, #4ec9b0)";
      el.style.color = valColor;
      el.style.fontFamily = d.valueFontFamily || "";
      el.style.fontSize = numberOrNull(d.valueFontSize) !== null ? numberOrNull(d.valueFontSize) + "px" : "";
      el.style.fontWeight = d.valueFontWeight || "";
      el.style.fontStyle = d.valueFontStyle || "";
      el.style.textAlign = "center";
    });

    if (footerEl) {
      footerEl.style.display = "none";
    }
  }

  function render(data) {
    currentData = data || {};
    var type = getType(currentData);
    var displayName = currentData.displayName || currentData.name || type;
    var hiddenRows = getHiddenRowsMap();

    if (titleEl) {
      titleEl.textContent = displayName;
    }

    var footerBusy = isFooterActive();

    clear(contentEl);
    renderContentRows(type, hiddenRows);

    if (!footerBusy) {
      clear(footerEl);
      renderFooter(type);
    }

    applyStyles();
  }

  function renderContentRows(type, hiddenRows) {
    switch (type) {
      case "analogInput":
        appendRow(primaryRow("Value", toNumber(currentData.value, 0).toFixed(Math.max(0, Math.min(6, numberOrNull(currentData.precision) ?? 2))) + " " + (currentData.suffix || ""), "", "value", hiddenRows));
        break;
      default:
        appendRow(row("Value", JSON.stringify(currentData), "", { key: "value" }, hiddenRows));
        break;
    }
  }

  function renderFooter() {
  }

  function getPreviewData() {
    var t = getType(null);
    var map = {
      analogInput: { elementType: "analogInput", name: "Analog In", displayName: "Analog In", value: 12.34, suffix: "V", enabled: true, deviceConnected: true }
    };
    return map[t] || { elementType: t, displayName: t };
  }

  if (window.BruControl) {
    if (window.BruControl.getData) {
      try {
        var initial = window.BruControl.getData();
        if (initial) render(initial);
      } catch {}
    }

    window.BruControl.onData(render);
  } else {
    render(getPreviewData());
  }
})();
