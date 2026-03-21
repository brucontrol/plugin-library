(function () {
  var titleEl = document.getElementById("elementTitle");
  var contentEl = document.getElementById("elementContent");
  var footerEl = document.getElementById("elementFooter");
  var currentData = null;
  var inputLiveValue = null;
  var inputDisplayNameFromFetch = null;
  var subscribedInput = null;

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

  function stripNumericParseNoise(s) {
    return String(s).replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/,/g, "").trim();
  }

  function formatLiveReadingWithPrecision(raw, prec) {
    if (raw === null || raw === undefined) return "\u2014";
    if (typeof raw === "boolean") return raw ? "ON" : "OFF";
    var cleaned = stripNumericParseNoise(raw);
    if (cleaned === "") return "\u2014";
    var lowered = cleaned.toLowerCase();
    if (lowered === "true") return "ON";
    if (lowered === "false") return "OFF";
    var n = Number(cleaned);
    if (!Number.isFinite(n)) {
      n = parseFloat(cleaned);
    }
    if (Number.isFinite(n)) return n.toFixed(prec);
    return String(raw);
  }

  function typesMatch(a, b) {
    return String(a || "").toLowerCase() === String(b || "").toLowerCase();
  }

  function isEmptyRef(id) {
    return !id || id === "00000000-0000-0000-0000-000000000000" || String(id).trim() === "";
  }

  function formatElementValue(data) {
    if (!data) return null;
    if (data.value !== undefined && data.value !== null) return String(data.value);
    if (data.rawValue !== undefined && data.rawValue !== null) return String(data.rawValue);
    if (data.total !== undefined && data.total !== null) return String(data.total);
    if (data.temp !== undefined && data.temp !== null) return String(data.temp);
    if (data.variable !== undefined && data.variable !== null) return String(data.variable);
    if (data.state !== undefined && data.state !== null) return data.state ? "On" : "Off";
    return null;
  }

  function idMatches(a, b) {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return String(a).toLowerCase() === String(b).toLowerCase();
  }

  function handleElementUpdate(payload) {
    var et = payload && payload.elementType;
    var eid = payload && payload.elementId;
    var data = payload && payload.data;
    if (subscribedInput && typesMatch(et, subscribedInput.type) && idMatches(eid, subscribedInput.id)) {
      inputLiveValue = formatElementValue(data);
      render(currentData);
    }
  }

  function unsubscribeInput() {
    var bc = window.BruControl;
    if (!bc || !bc.unsubscribeElement || !subscribedInput) return;
    bc.unsubscribeElement(subscribedInput.type, subscribedInput.id);
    subscribedInput = null;
    inputLiveValue = null;
    inputDisplayNameFromFetch = null;
  }

  function setupInputSubscription(data) {
    var bc = window.BruControl;
    if (!bc || !bc.subscribeElement) return;

    var inputType = String(data.inputElementType || "").trim();
    var inputId = data.inputElementId ? String(data.inputElementId) : "";

    if (!inputType || !inputId || isEmptyRef(inputId)) {
      if (subscribedInput) unsubscribeInput();
      return;
    }

    if (subscribedInput && subscribedInput.type === inputType && idMatches(subscribedInput.id, inputId)) {
      return;
    }

    unsubscribeInput();
    subscribedInput = { type: inputType, id: inputId };

    bc.subscribeElement(inputType, inputId).then(function (elData) {
      if (!subscribedInput || subscribedInput.type !== inputType || !idMatches(subscribedInput.id, inputId)) return;
      inputLiveValue = formatElementValue(elData);
      if (elData) {
        inputDisplayNameFromFetch = elData.displayName || elData.name || null;
      }
      render(currentData);
    }).catch(function () {});
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

  function row(label, value, cls, options) {
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
    var sectionToggle = {
      input: "showInput",
      output: "showOutput",
      target: "showTarget",
      kpkikd: "showKpKiKd"
    };
    var toggleProp = sectionToggle[key];
    if (toggleProp && d[toggleProp] === false) {
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

  function sendPatch(patch) {
    if (!window.BruControl || !window.BruControl.updateProperties) return;
    window.BruControl.updateProperties(patch);
  }

  function requestKeypadFor(label, currentValue, min, max, precision, allowNegative, onResult) {
    if (!window.BruControl || !window.BruControl.requestKeypad) return;
    var options = { label: label, currentValue: currentValue };
    if (typeof min === "number") options.min = min;
    if (typeof max === "number") options.max = max;
    if (typeof precision === "number") options.precision = precision;
    if (typeof allowNegative === "boolean") options.allowNegative = allowNegative;
    window.BruControl.requestKeypad(options).then(function (val) {
      if (val !== null && val !== undefined) {
        onResult(val);
      }
    });
  }

  function makeButton(label, onClick, disabled) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.disabled = !!disabled;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function applyStyles() {
    var d = currentData || {};
    var sectionPrefix = {
      input: "input",
      output: "output",
      target: "target",
      kpkikd: "kpKiKd"
    };
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
      header.style.display = (image || d.showHeader === false) ? "none" : "";
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
      if (!footerEl.childNodes.length) {
        footerEl.style.display = "none";
      } else {
        footerEl.style.display = "flex";
        var footerButtons = footerEl.querySelectorAll("button");
        var btnBg = (d.footerButtonColor && String(d.footerButtonColor).trim()) ? String(d.footerButtonColor).trim() : "var(--accent-primary, #0e639c)";
        footerButtons.forEach(function (btn) {
          btn.style.background = btnBg;
        });
      }
    }
  }

  function render(data) {
    currentData = data || {};
    var type = getType(currentData);
    var displayName = currentData.displayName || currentData.name || type;
    setupInputSubscription(currentData);

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

  function getPrecision() {
    var p = toNumber(currentData.precision, 2);
    return Math.max(0, Math.min(6, Math.round(p)));
  }

  function formatCalibratedReading(d, numStr) {
    var pre = d.prefix != null && String(d.prefix) !== "" ? String(d.prefix) : "";
    var suf = d.suffix != null && String(d.suffix).trim() !== "" ? String(d.suffix).trim() : "";
    return pre + numStr + (suf ? " " + suf : "");
  }

  function renderContentRows(type) {
    var prec = getPrecision();
    var d = currentData || {};
    switch (type) {
      case "pid":
        var inputLabel = currentData.inputDisplayName || inputDisplayNameFromFetch || "Input";
        var inputVal = formatLiveReadingWithPrecision(inputLiveValue, prec);
        appendRow(primaryRow("Output", formatCalibratedReading(d, toNumber(d.output || d.value, 0).toFixed(prec)), "", "output"));
        appendRow(primaryRow("Target", formatCalibratedReading(d, toNumber(d.target, 0).toFixed(prec)), "", "target"));
        appendRow(primaryRow(inputLabel, inputVal, "", "input"));
        appendRow(row("Kp/Ki/Kd", toNumber(currentData.kp, 0) + " / " + toNumber(currentData.ki, 0) + " / " + toNumber(currentData.kd, 0), "", { key: "kpkikd" }));
        break;
      default:
        appendRow(row("Value", JSON.stringify(currentData), "", { key: "value" }));
        break;
    }
  }

  function renderFooter(type) {
    switch (type) {
      case "pid":
        renderTargetSetter(currentData);
        break;
      default:
        break;
    }
  }

  function renderTargetSetter(data) {
    var prec = getPrecision();
    footerEl.appendChild(
      makeButton("Set Target", function () {
        var displayName = currentData ? (currentData.displayName || currentData.name || "Target") : "Target";
        requestKeypadFor("Set Target: " + displayName, String(toNumber(data.target, 0)), undefined, undefined, prec, true, function (val) {
          sendPatch({ target: toNumber(val, 0) });
        });
      }, false)
    );
  }

  function getPreviewData() {
    var t = getType(null);
    var map = {
      pid: { elementType: "pid", name: "PID", displayName: "PID", target: 65, output: 49, kp: 2, ki: 0.8, kd: 0.2, precision: 2, userControl: true, enabled: true, deviceConnected: true, inputDisplayName: "Temp Probe", inputElementId: "", inputElementType: "", showInput: true, inputColor: "", inputBg: "", inputLabelColor: "", inputFont: "", inputSize: null, inputWeight: "", inputStyle: "", showOutput: true, outputColor: "", outputBg: "", outputLabelColor: "", outputFont: "", outputSize: null, outputWeight: "", outputStyle: "", showTarget: true, targetColor: "", targetBg: "", targetLabelColor: "", targetFont: "", targetSize: null, targetWeight: "", targetStyle: "", showKpKiKd: true, kpKiKdColor: "", kpKiKdLabelColor: "", kpKiKdFont: "", kpKiKdSize: null, kpKiKdWeight: "", kpKiKdStyle: "" }
    };
    return map[t] || { elementType: t, displayName: t };
  }

  if (window.BruControl) {
    if (window.BruControl.onElementUpdate) {
      window.BruControl.onElementUpdate(handleElementUpdate);
    }
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


