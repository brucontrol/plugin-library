(function() {
  var currentData = null;
  var isEditing = false;

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

    valueEl.style.display = (d.showValue === false && !isEditing) ? "none" : "";
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

    if (!isEditing) {
      valueEl.textContent = getDisplayValue(data);
    }

    valueEl.classList.add("editable");
    applyStyles();
  }

  function getVariableType() {
    return currentData ? String(currentData.variableType || "Value") : "Value";
  }

  /* ── Inline editing for String, DateTime, TimeSpan ── */
  function showInlineEdit() {
    var valueEl = document.getElementById("valueDisplay");
    var editInline = document.getElementById("editInline");
    var editInput = document.getElementById("editInput");
    if (!editInline || !editInput || !valueEl) return;

    isEditing = true;
    valueEl.style.display = "none";
    editInline.style.display = "flex";

    var vt = getVariableType();
    if (vt === "DateTime") {
      editInput.type = "datetime-local";
      var dateVal = currentData && currentData.value ? currentData.value : "";
      try {
        var d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          editInput.value = d.toISOString().slice(0, 19);
        } else {
          editInput.value = dateVal;
        }
      } catch (e) { editInput.value = dateVal; }
    } else if (vt === "TimeSpan") {
      editInput.type = "text";
      editInput.placeholder = "hh:mm:ss or d.hh:mm:ss";
      editInput.value = currentData && currentData.value ? currentData.value : "";
    } else {
      editInput.type = "text";
      editInput.value = currentData && currentData.value ? String(currentData.value) : "";
    }

    editInput.focus();
    if (editInput.select) editInput.select();
  }

  function hideInlineEdit() {
    var valueEl = document.getElementById("valueDisplay");
    var editInline = document.getElementById("editInline");
    if (!editInline || !valueEl) return;
    isEditing = false;
    editInline.style.display = "none";
    valueEl.style.display = "";
  }

  function confirmInlineEdit() {
    var editInput = document.getElementById("editInput");
    if (!editInput || !window.BruControl) return;

    var val = editInput.value;
    var vt = getVariableType();

    if (vt === "DateTime") {
      try {
        var d = new Date(val);
        if (!isNaN(d.getTime())) {
          val = d.toISOString();
        }
      } catch (e) { /* send raw */ }
    }

    window.BruControl.updateProperties({ value: val });
    hideInlineEdit();
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
    if (!currentData) return;
    var vt = getVariableType();
    if (vt === "Value") {
      openNumericKeypad();
    } else if (vt === "Boolean") {
      var low = String(currentData.value || "").toLowerCase();
      var isTrue = low === "true" || low === "1" || low === "on";
      if (window.BruControl) {
        window.BruControl.updateProperties({ value: isTrue ? "False" : "True" });
      }
    } else if (vt === "String" || vt === "DateTime" || vt === "TimeSpan") {
      showInlineEdit();
    }
  }

  /* ── Wire up events ── */
  function bindEvents() {
    var valueEl = document.getElementById("valueDisplay");
    var editConfirm = document.getElementById("editConfirm");
    var editCancel = document.getElementById("editCancel");
    var editInput = document.getElementById("editInput");

    if (valueEl) {
      valueEl.addEventListener("click", handleValueClick);
    }
    if (editConfirm) {
      editConfirm.addEventListener("click", confirmInlineEdit);
    }
    if (editCancel) {
      editCancel.addEventListener("click", hideInlineEdit);
    }
    if (editInput) {
      editInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") { e.preventDefault(); confirmInlineEdit(); }
        if (e.key === "Escape") { e.preventDefault(); hideInlineEdit(); }
      });
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
