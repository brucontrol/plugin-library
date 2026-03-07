(function () {
  var headerEl = document.getElementById("widgetHeader");
  var titleEl = document.getElementById("widgetTitle");
  var variableLabelEl = document.getElementById("variableLabel");
  var valueDisplayEl = document.getElementById("valueDisplay");
  var currentData = null;

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function applyStyles() {
    var d = currentData || {};
    var widget = document.getElementById("widget");
    var contentEl = document.querySelector(".widget-content");

    if (widget) {
      if (d.showBackground === false) {
        widget.style.background = "transparent";
        widget.style.border = "none";
      } else {
        widget.style.background = d.backgroundColor || "";
        widget.style.border = d.borderColor ? "1px solid " + d.borderColor : "";
      }
      widget.style.borderRadius = "8px";
    }

    if (headerEl) {
      headerEl.style.display = d.showHeader === false ? "none" : "";
    }

    if (variableLabelEl) {
      variableLabelEl.style.display = (d.showLabel === false) ? "none" : "";
      variableLabelEl.style.fontFamily = d.labelFontFamily || "";
      variableLabelEl.style.fontSize = numberOrNull(d.labelFontSize) !== null ? numberOrNull(d.labelFontSize) + "px" : "";
      variableLabelEl.style.fontWeight = d.labelFontWeight || "";
      variableLabelEl.style.fontStyle = d.labelFontStyle || "";
      variableLabelEl.style.color = d.labelColor || "";
    }

    if (valueDisplayEl) {
      valueDisplayEl.style.display = (d.showValue === false) ? "none" : "";
      valueDisplayEl.style.fontFamily = d.valueFontFamily || "";
      valueDisplayEl.style.fontSize = numberOrNull(d.valueFontSize) !== null ? numberOrNull(d.valueFontSize) + "px" : "";
      valueDisplayEl.style.fontWeight = d.valueFontWeight || "";
      valueDisplayEl.style.fontStyle = d.valueFontStyle || "";
      valueDisplayEl.style.color = d.valueColor || "";
    }

    if (contentEl) {
      contentEl.style.padding = "10px";
    }
  }

  function render(data) {
    currentData = data || {};
    var variableName = currentData.variableName || currentData.displayName || currentData.name || "--";
    var value = currentData.value != null ? String(currentData.value) : "--";

    if (titleEl) {
      titleEl.textContent = currentData.displayName || currentData.name || "Script";
    }

    if (variableLabelEl) {
      variableLabelEl.textContent = variableName;
    }

    if (valueDisplayEl) {
      valueDisplayEl.textContent = value;
      valueDisplayEl.classList.remove("value--warn", "value--bad");
      if (typeof currentData.valueClass === "string" && currentData.valueClass) {
        valueDisplayEl.classList.add("value--" + currentData.valueClass);
      }
    }

    applyStyles();
  }

  function getPreviewData() {
    return {
      elementType: "scriptElement",
      name: "Script",
      displayName: "Script Variable",
      processId: "Process-A",
      variableName: "Temp",
      value: "42"
    };
  }

  if (window.BruControl) {
    if (window.BruControl.getData) {
      try {
        var initial = window.BruControl.getData();
        if (initial) render(initial);
      } catch (e) {}
    }
    window.BruControl.onData(render);
  } else {
    render(getPreviewData());
  }
})();
