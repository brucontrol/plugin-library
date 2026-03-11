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
    if (!isPrimary && d.showSecondaryRows === false) {
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
      if (d.showBackground === false) {
        elementEl.style.background = "transparent";
        elementEl.style.border = "none";
      } else {
        elementEl.style.background = d.backgroundColor || "";
        elementEl.style.border = d.borderColor ? "1px solid " + d.borderColor : "";
      }

      elementEl.style.borderRadius = "8px";
    }

    if (header) {
      header.style.display = d.showHeader === false ? "none" : "";
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

    var labelNodes = document.querySelectorAll(".element-row .row-label");
    labelNodes.forEach(function (node) {
      var el = node;
      el.style.color = d.rowLabelColor || "";
      if (d.labelFontFamily) el.style.fontFamily = d.labelFontFamily;
      if (numberOrNull(d.labelFontSize) !== null) el.style.fontSize = numberOrNull(d.labelFontSize) + "px";
      if (d.labelFontWeight) el.style.fontWeight = d.labelFontWeight;
      if (d.labelFontStyle) el.style.fontStyle = d.labelFontStyle;
    });

    var valueNodes = document.querySelectorAll(".element-row .row-value");
    valueNodes.forEach(function (node) {
      var el = node;
      if (d.rowValueColor) el.style.color = d.rowValueColor;
      if (d.valueColor) el.style.color = d.valueColor;
      if (d.valueFontFamily) el.style.fontFamily = d.valueFontFamily;
      if (numberOrNull(d.valueFontSize) !== null) el.style.fontSize = numberOrNull(d.valueFontSize) + "px";
      if (d.valueFontWeight) el.style.fontWeight = d.valueFontWeight;
      if (d.valueFontStyle) el.style.fontStyle = d.valueFontStyle;
      el.style.textAlign = "center";
    });

    if (!footerEl) return;
    if (d.showFooter === false || !footerEl.childNodes.length) {
      footerEl.style.display = "none";
    } else {
      footerEl.style.display = "flex";
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
      case "counter":
        appendRow(primaryRow("Count", toNumber(currentData.count || currentData.total, 0).toFixed(2), "", "count", hiddenRows));
        appendRow(row("Rate", toNumber(currentData.rate, 0).toFixed(2), "", { key: "rate" }, hiddenRows));
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
      counter: { elementType: "counter", name: "Counter", displayName: "Counter", total: 123, rate: 4.5, enabled: true, deviceConnected: true }
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
