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

  /** Formats timer value to hh:mm:ss (seconds only, no fractional seconds). */
  function formatTimerValue(value) {
    if (value == null || value === "") return "--";
    var s = String(value);
    return s.replace(/\.\d+$/, "") || "--";
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

  var sectionToggle = { value: "showTimer", type: "showType", running: "showRunning" };
  var sectionPrefix = { value: "timer", type: "type", running: "running" };

  function row(label, value, cls, options) {
    var d = currentData || {};
    var opts = options || {};
    var key = toRowKey(opts.key || label);
    var isPrimary = !!opts.primary;

    if (isPrimary && d.showValue === false) {
      return null;
    }
    if (!isPrimary && d.showDetails === false) {
      return null;
    }
    var toggleKey = sectionToggle[key];
    if (toggleKey && d[toggleKey] === false) {
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

    if (label && String(label).trim() !== "") {
      r.appendChild(l);
    }
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

  function sendPatch(patch) {
    if (!window.BruControl || !window.BruControl.updateProperties) return;
    window.BruControl.updateProperties(patch);
  }

  function openTimeSpanPicker() {
    if (!window.BruControl || !window.BruControl.requestTimeSpanPicker) return;
    if (currentData && currentData.userControl === false) return;
    var label = (currentData ? (currentData.displayName || currentData.name) : "Timer") || "Set Value";
    var currentVal = currentData && currentData.value ? String(currentData.value) : "00:00:00";
    window.BruControl.requestTimeSpanPicker({
      currentValue: currentVal,
      label: label,
      allowDays: true
    }).then(function (result) {
      if (result !== null && result !== undefined && window.BruControl) {
        window.BruControl.updateProperties({ value: String(result) });
      }
    });
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
    var image = (d.image && String(d.image).trim()) ? String(d.image).trim() : "";

    if (elementEl) {
      if (image) {
        elementEl.style.background = "transparent";
        elementEl.style.backgroundImage = "url(\"" + image.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\")";
        elementEl.style.backgroundSize = "cover";
        elementEl.style.backgroundPosition = "center";
        elementEl.style.border = "none";
      } else {
        elementEl.style.backgroundImage = "";
        if (d.showBackground === false) {
          elementEl.style.background = "transparent";
          elementEl.style.border = "none";
        } else {
          elementEl.style.background = d.backgroundColor || "";
          elementEl.style.border = d.borderColor ? "1px solid " + d.borderColor : "";
        }
      }

      elementEl.style.borderRadius = "8px";
    }

    if (header) {
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

    var rowEls = document.querySelectorAll(".element-row");
    rowEls.forEach(function (rowEl) {
      var key = rowEl.getAttribute("data-row-key");
      var prefix = sectionPrefix[key];
      if (!prefix) return;
      var labelNode = rowEl.querySelector(".row-label");
      var valueNode = rowEl.querySelector(".row-value");
      if (prefix === "timer") {
        rowEl.style.background = (d.timerBg && String(d.timerBg).trim()) ? String(d.timerBg).trim() : "";
      } else {
        rowEl.style.background = "";
      }
      if (labelNode) {
        var labelColorKey = prefix + "LabelColor";
        labelNode.style.color = (d[labelColorKey] && String(d[labelColorKey]).trim()) ? String(d[labelColorKey]).trim() : "";
        labelNode.style.fontFamily = d[prefix + "Font"] || "";
        labelNode.style.fontSize = numberOrNull(d[prefix + "Size"]) !== null ? numberOrNull(d[prefix + "Size"]) + "px" : "";
        labelNode.style.fontWeight = d[prefix + "Weight"] || "";
        labelNode.style.fontStyle = d[prefix + "Style"] || "";
      }
      if (valueNode) {
        var valColorKey = prefix + "Color";
        valueNode.style.color = (d[valColorKey] && String(d[valColorKey]).trim()) ? String(d[valColorKey]).trim() : "";
        valueNode.style.fontFamily = d[prefix + "Font"] || "";
        valueNode.style.fontSize = numberOrNull(d[prefix + "Size"]) !== null ? numberOrNull(d[prefix + "Size"]) + "px" : "";
        valueNode.style.fontWeight = d[prefix + "Weight"] || "";
        valueNode.style.fontStyle = d[prefix + "Style"] || "";
        valueNode.style.textAlign = "center";
      }
    });

    if (footerEl) {
      if (d.showFooter === false || !footerEl.childNodes.length) {
        footerEl.style.display = "none";
      } else {
        footerEl.style.display = "flex";
        var footerButtons = footerEl.querySelectorAll("button");
        var btnBg = (d.footerButtonColor && String(d.footerButtonColor).trim()) ? String(d.footerButtonColor).trim() : "var(--accent-primary, #0e639c)";
        footerButtons.forEach(function (btn) {
          btn.style.background = btnBg;
          btn.style.color = (d.buttonTextColor && String(d.buttonTextColor).trim()) ? String(d.buttonTextColor).trim() : "var(--text-primary, #d4d4d4)";
          btn.style.fontFamily = d.buttonFontFamily || "";
          btn.style.fontSize = numberOrNull(d.buttonFontSize) !== null ? numberOrNull(d.buttonFontSize) + "px" : "";
          btn.style.fontWeight = d.buttonFontWeight || "";
          btn.style.fontStyle = d.buttonFontStyle || "";
        });
      }
    }
  }

  function render(data) {
    currentData = data || {};
    var type = getType(currentData);
    var displayName = currentData.displayName || currentData.name || type;
    if (titleEl) {
      titleEl.textContent = displayName;
    }

    var footerBusy = type === "timer" ? false : isFooterActive();

    clear(contentEl);
    renderContentRows(type);

    if (!footerBusy) {
      clear(footerEl);
      renderFooter(type);
    }

    applyStyles();
  }

  function renderContentRows(type) {
    switch (type) {
      case "timer": {
        var valueRow = primaryRow("", formatTimerValue(currentData.value), "", "value");
        if (valueRow && currentData.userControl !== false) {
          var valueSpan = valueRow.querySelector(".row-value");
          if (valueSpan) {
            valueSpan.classList.add("editable");
            valueSpan.style.cursor = "pointer";
            valueSpan.addEventListener("click", openTimeSpanPicker);
          }
        }
        appendRow(valueRow);
        appendRow(row("Type", currentData.type || "--", "", { key: "type" }));
        appendRow(row("Running", boolText(asBool(currentData.isRunning)), asBool(currentData.isRunning) ? "value--ok" : "value--warn", { key: "running" }));
        break;
      }
      default:
        appendRow(row("Value", JSON.stringify(currentData), "", { key: "value" }));
        break;
    }
  }

  function renderFooter(type) {
    switch (type) {
      case "timer":
        footerEl.appendChild(
          makeButton("Start", function () {
            sendPatch({ isRunning: true });
          }, asBool(currentData.isRunning))
        );
        footerEl.appendChild(
          makeButton("Stop", function () {
            sendPatch({ isRunning: false });
          }, !asBool(currentData.isRunning))
        );
        footerEl.appendChild(
          makeButton("Reset", function () {
            sendPatch({ reset: true });
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
      timer: { elementType: "timer", name: "Timer", displayName: "Timer", value: "00:03:12", type: "CountUp", isRunning: true, userControl: true, enabled: true }
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
