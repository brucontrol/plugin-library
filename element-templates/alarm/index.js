(function () {
  var titleEl = document.getElementById("elementTitle");
  var contentEl = document.getElementById("elementContent");
  var footerEl = document.getElementById("elementFooter");
  var currentData = null;

  function isFooterActive() {
    if (!footerEl || !footerEl.contains(document.activeElement) || document.activeElement === footerEl) return false;
    var tag = (document.activeElement.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || !!document.activeElement.isContentEditable;
  }

  function getType(data) {
    if (data && data.elementType) return String(data.elementType);
    var fromAttr = document.body.getAttribute("data-element-type");
    return fromAttr || "element";
  }

  function boolText(value) {
    return value ? "ON" : "OFF";
  }

  function asBool(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      var lowered = value.toLowerCase();
      return lowered === "true" || lowered === "1" || lowered === "on";
    }
    return !!value;
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

  function sendPatch(patch) {
    if (!window.BruControl || !window.BruControl.updateProperties) return;
    window.BruControl.updateProperties(patch);
  }

  function makeButton(label, onClick, disabled) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.disabled = !!disabled;
    btn.addEventListener("click", function () {
      onClick();
      btn.blur();
    });
    return btn;
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

    var primaryRows = document.querySelectorAll(".element-row--primary");
    primaryRows.forEach(function (rowEl) {
      rowEl.style.background = (d.valueSectionBackground && String(d.valueSectionBackground).trim()) ? String(d.valueSectionBackground).trim() : "";
    });

    var footerButtons = document.querySelectorAll(".element-footer button");
    footerButtons.forEach(function (btn) {
      btn.style.background = (d.buttonColor && String(d.buttonColor).trim()) ? String(d.buttonColor).trim() : "";
    });

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
      var valColor = isPrimary
        ? (d.valueColor && String(d.valueColor).trim() ? String(d.valueColor).trim() : "var(--accent-green)")
        : (d.rowValueColor && String(d.rowValueColor).trim() ? String(d.rowValueColor).trim() : "var(--accent-green)");
      el.style.color = valColor;
      el.style.fontFamily = d.valueFontFamily || "";
      el.style.fontSize = numberOrNull(d.valueFontSize) !== null ? numberOrNull(d.valueFontSize) + "px" : "";
      el.style.fontWeight = d.valueFontWeight || "";
      el.style.fontStyle = d.valueFontStyle || "";
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

    var footerBusy = type === "alarm" ? false : isFooterActive();

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
      case "alarm":
        appendRow(primaryRow("Active", boolText(asBool(currentData.active)), asBool(currentData.active) ? "value--bad" : "value--ok", "active", hiddenRows));
        appendRow(row("Sound", (currentData.soundFile && String(currentData.soundFile).trim()) ? currentData.soundFile : "/sounds/alarm.wav", "", { key: "soundFile" }, hiddenRows));
        break;
      default:
        appendRow(row("Value", JSON.stringify(currentData), "", { key: "value" }, hiddenRows));
        break;
    }
  }

  function renderFooter(type) {
    switch (type) {
      case "alarm":
        footerEl.appendChild(
          makeButton(asBool(currentData.active) ? "Deactivate" : "Activate", function () {
            sendPatch({ active: !asBool(currentData.active) });
          }, false)
        );
        break;
      default:
        break;
    }
  }

  function getPreviewData() {
    var t = getType(null);
    var map = {
      alarm: { elementType: "alarm", name: "Alarm", displayName: "Alarm", active: false, soundFile: "/sounds/alarm.wav", userControl: true, enabled: true }
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
