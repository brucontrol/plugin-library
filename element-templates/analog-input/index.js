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

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  var sectionToggle = { value: "showReading" };
  var sectionPrefix = { value: "reading" };

  function row(label, value, cls, options) {
    var d = currentData || {};
    var opts = options || {};
    var key = toRowKey(opts.key || label);
    var isPrimary = !!opts.primary;

    if (isPrimary && d.showValue === false) {
      return null;
    }
    var toggle = sectionToggle[key];
    if (toggle && d[toggle] === false) {
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

  function primaryRow(label, value, cls, key) {
    return row(label, value, cls, { primary: true, key: key });
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

    var labelNodes = document.querySelectorAll(".element-row .row-label");
    labelNodes.forEach(function (node) {
      var el = node;
      var rowEl = el.closest ? el.closest(".element-row") : el.parentElement;
      var key = rowEl ? rowEl.getAttribute("data-row-key") : "";
      var pfx = sectionPrefix[key] || "";
      el.style.color = (pfx && d[pfx + "LabelColor"] && String(d[pfx + "LabelColor"]).trim())
        ? String(d[pfx + "LabelColor"]).trim()
        : "";
      el.style.fontFamily = d.labelFontFamily || "";
      el.style.fontSize = numberOrNull(d.labelFontSize) !== null ? numberOrNull(d.labelFontSize) + "px" : "";
      el.style.fontWeight = d.labelFontWeight || "";
      el.style.fontStyle = d.labelFontStyle || "";
    });

    var primaryRows = document.querySelectorAll(".element-row--primary");
    primaryRows.forEach(function (rowEl) {
      var key = rowEl.getAttribute("data-row-key") || "";
      var pfx = sectionPrefix[key] || "";
      rowEl.style.background = (pfx && d[pfx + "Bg"] && String(d[pfx + "Bg"]).trim())
        ? String(d[pfx + "Bg"]).trim()
        : "";
    });

    var valueNodes = document.querySelectorAll(".element-row .row-value");
    valueNodes.forEach(function (node) {
      var el = node;
      var rowEl = el.closest ? el.closest(".element-row") : el.parentElement;
      var key = rowEl ? rowEl.getAttribute("data-row-key") : "";
      var pfx = sectionPrefix[key] || "";

      el.style.color = (pfx && d[pfx + "Color"] && String(d[pfx + "Color"]).trim())
        ? String(d[pfx + "Color"]).trim()
        : "var(--accent-green, #4ec9b0)";

      el.style.fontFamily = (pfx && d[pfx + "Font"] && String(d[pfx + "Font"]).trim()) ? String(d[pfx + "Font"]).trim() : "";
      el.style.fontSize = (pfx && numberOrNull(d[pfx + "Size"]) !== null) ? numberOrNull(d[pfx + "Size"]) + "px" : "";
      el.style.fontWeight = (pfx && d[pfx + "Weight"] && String(d[pfx + "Weight"]).trim()) ? String(d[pfx + "Weight"]).trim() : "";
      el.style.fontStyle = (pfx && d[pfx + "Style"] && String(d[pfx + "Style"]).trim()) ? String(d[pfx + "Style"]).trim() : "";
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

    if (titleEl) {
      titleEl.textContent = displayName;
    }

    var footerBusy = isFooterActive();

    clear(contentEl);
    renderContentRows(type);

    if (!footerBusy) {
      clear(footerEl);
      renderFooter(type);
    }

    applyStyles();
  }

  function formatCalibratedReading(d, numStr) {
    var pre = d.prefix != null && String(d.prefix) !== "" ? String(d.prefix) : "";
    var suf = d.suffix != null && String(d.suffix).trim() !== "" ? String(d.suffix).trim() : "";
    return pre + numStr + (suf ? " " + suf : "");
  }

  function renderContentRows(type) {
    switch (type) {
      case "analogInput": {
        var prec = Math.max(0, Math.min(6, toNumber(currentData.precision, 2)));
        var numStr = toNumber(currentData.value, 0).toFixed(prec);
        appendRow(primaryRow("Value", formatCalibratedReading(currentData, numStr), "", "value"));
        break;
      }
      default:
        appendRow(row("Value", JSON.stringify(currentData), "", { key: "value" }));
        break;
    }
  }

  function renderFooter() {
  }

  function getPreviewData() {
    var t = getType(null);
    var map = {
      analogInput: { elementType: "analogInput", name: "Analog In", displayName: "Analog In", value: 12.34, prefix: "", suffix: "V", enabled: true, deviceConnected: true }
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
