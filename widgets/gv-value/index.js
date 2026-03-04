(function() {
  var currentData = null;

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function applyStyles() {
    var d = currentData || {};
    var widget = document.getElementById("widget");
    var header = document.querySelector(".widget-header");
    var titleEl = document.getElementById("widgetTitle");
    var valueEl = document.getElementById("valueDisplay");
    var contentEl = document.querySelector(".widget-content");

    if (!widget || !header || !titleEl || !valueEl || !contentEl) {
      return;
    }

    if (d.showBackground === false) {
      widget.style.background = "transparent";
      widget.style.border = "none";
    } else {
      widget.style.background = d.backgroundColor || "";
      widget.style.border = d.borderColor ? "1px solid " + d.borderColor : "";
    }

    widget.style.borderRadius = "8px";

    header.style.display = d.showHeader === false ? "none" : "";
    header.style.background = d.headerColor || "";
    header.style.borderBottom = d.showHeader === false ? "none" : "";

    titleEl.style.display = d.showLabel === false ? "none" : "";
    titleEl.style.fontFamily = d.labelFontFamily || "";
    titleEl.style.fontSize = numberOrNull(d.labelFontSize) !== null ? numberOrNull(d.labelFontSize) + "px" : "";
    titleEl.style.fontWeight = d.labelFontWeight || "";
    titleEl.style.fontStyle = d.labelFontStyle || "";
    titleEl.style.color = d.labelColor || "";
    titleEl.style.textAlign = "left";

    valueEl.style.display = (d.showValue === false) ? "none" : "";
    valueEl.style.fontFamily = d.valueFontFamily || "";
    valueEl.style.fontSize = numberOrNull(d.valueFontSize) !== null ? numberOrNull(d.valueFontSize) + "px" : "";
    valueEl.style.fontWeight = d.valueFontWeight || "";
    valueEl.style.fontStyle = d.valueFontStyle || "";
    valueEl.style.color = d.valueColor || "";
    valueEl.style.textAlign = "center";

    contentEl.style.padding = "10px";
  }

  function getDisplayValue(data) {
    if (!data) return "--";
    var vt = String(data.variableType || "Value");
    if (vt === "Boolean") {
      var low = String(data.value || "").toLowerCase();
      return (low === "true" || low === "1") ? "True" : "False";
    }
    if (vt === "TimeSpan" || vt === "DateTime") {
      return String(data.value ?? "--");
    }
    var num = parseFloat(data.value);
    var precision = typeof data.precision === "number" ? data.precision : 0;
    return Number.isFinite(num) ? num.toFixed(precision) : String(data.value ?? "--");
  }

  function updateDisplay(data) {
    currentData = data;
    var titleEl = document.getElementById("widgetTitle");
    var valueEl = document.getElementById("valueDisplay");
    if (!titleEl || !valueEl || !data) {
      return;
    }

    titleEl.textContent = data.displayName || data.name || "Variable";

    valueEl.textContent = getDisplayValue(data);

    if (data.userControl !== false) {
      valueEl.classList.add("editable");
    } else {
      valueEl.classList.remove("editable");
    }
    applyStyles();
  }

  function getVariableType() {
    return currentData ? String(currentData.variableType || "Value") : "Value";
  }

  /* ── TimeSpan picker (via host) ── */
  function openTimeSpanPicker() {
    if (!window.BruControl || !window.BruControl.requestTimeSpanPicker) return;
    var label = (currentData ? (currentData.displayName || currentData.name) : "Value") || "Set Value";
    var currentVal = currentData && currentData.value ? String(currentData.value) : "00:00:00";
    window.BruControl.requestTimeSpanPicker({
      currentValue: currentVal,
      label: label,
      allowDays: true
    }).then(function(result) {
      if (result !== null && result !== undefined && window.BruControl) {
        window.BruControl.updateProperties({ value: String(result) });
      }
    });
  }

  /* ── DateTime picker (via host) ── */
  function openDateTimePicker() {
    if (!window.BruControl || !window.BruControl.requestDateTimePicker) return;
    var label = (currentData ? (currentData.displayName || currentData.name) : "Value") || "Set Value";
    var currentVal = currentData && currentData.value ? String(currentData.value) : "";
    try {
      var d = new Date(currentVal);
      if (isNaN(d.getTime())) currentVal = new Date().toISOString();
      else currentVal = d.toISOString();
    } catch (e) {
      currentVal = new Date().toISOString();
    }
    window.BruControl.requestDateTimePicker({
      currentValue: currentVal,
      label: label
    }).then(function(result) {
      if (result !== null && result !== undefined && window.BruControl) {
        window.BruControl.updateProperties({ value: String(result) });
      }
    });
  }

  /* ── Text input flyout (via host) for String ── */
  function openTextInputFlyout() {
    if (!window.BruControl || !window.BruControl.requestTextInput) return;

    var label = (currentData ? (currentData.displayName || currentData.name) : "Value") || "Set Value";
    var currentVal = currentData && currentData.value ? String(currentData.value) : "";

    window.BruControl.requestTextInput({
      currentValue: currentVal,
      label: label,
      placeholder: undefined
    }).then(function(result) {
      if (result !== null && result !== undefined && window.BruControl) {
        window.BruControl.updateProperties({ value: String(result) });
      }
    });
  }

  /* ── Numeric keypad (via host) ── */
  function openNumericKeypad() {
    if (!window.BruControl || !window.BruControl.requestKeypad) return;

    var currentVal = currentData ? String(currentData.value || "0") : "0";
    var precision = currentData && typeof currentData.precision === "number" ? currentData.precision : undefined;
    var label = (currentData ? (currentData.displayName || currentData.name) : "Value") || "Set Value";

    window.BruControl.requestKeypad({
      currentValue: currentVal,
      label: label,
      precision: precision,
      allowNegative: true
    }).then(function(result) {
      if (result !== null && result !== undefined && window.BruControl) {
        window.BruControl.updateProperties({ value: String(result) });
      }
    });
  }

  /* ── Click handler ── */
  function handleValueClick() {
    if (!currentData || currentData.userControl === false) return;
    var vt = getVariableType();
    if (vt === "Value") {
      openNumericKeypad();
    } else if (vt === "Boolean") {
      var low = String(currentData.value || "").toLowerCase();
      var isTrue = low === "true" || low === "1" || low === "on";
      if (window.BruControl) {
        window.BruControl.updateProperties({ value: isTrue ? "False" : "True" });
      }
    } else if (vt === "TimeSpan") {
      openTimeSpanPicker();
    } else if (vt === "DateTime") {
      openDateTimePicker();
    } else if (vt === "String") {
      openTextInputFlyout();
    }
  }

  /* ── Wire up events ── */
  function bindEvents() {
    var valueEl = document.getElementById("valueDisplay");
    if (valueEl) {
      valueEl.addEventListener("click", handleValueClick);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindEvents);
  } else {
    bindEvents();
  }

  if (window.BruControl) {
    window.BruControl.onData(updateDisplay);
  } else {
    updateDisplay({
      id: "preview",
      name: "Temperature",
      displayName: "Temperature",
      value: "72.500",
      precision: 3,
      variableType: "Value",
      userControl: true,
      enabled: true,
      format: ""
    });
  }
})();
