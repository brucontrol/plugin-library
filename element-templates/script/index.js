(function () {
  var headerEl = document.getElementById("elementHeader");
  var titleEl = document.getElementById("elementTitle");
  var variableLabelEl = document.getElementById("variableLabel");
  var valueDisplayEl = document.getElementById("valueDisplay");
  var currentData = null;

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function applyStyles() {
    var d = currentData || {};
    var elementEl = document.getElementById("element");
    var contentEl = document.querySelector(".element-content");

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

    if (headerEl) {
      var image = (d.image && String(d.image).trim()) ? String(d.image).trim() : "";
      headerEl.style.display = (image || d.showHeader === false) ? "none" : "";
      headerEl.style.background = d.headerColor || "";
      headerEl.style.borderBottom = d.showHeader === false ? "none" : "";
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
      valueDisplayEl.style.fontFamily = d.displayFontFamily || "";
      valueDisplayEl.style.fontSize = numberOrNull(d.displayFontSize) !== null ? numberOrNull(d.displayFontSize) + "px" : "";
      valueDisplayEl.style.fontWeight = d.displayFontWeight || "";
      valueDisplayEl.style.fontStyle = d.displayFontStyle || "";
      valueDisplayEl.style.color = (d.displayColor && String(d.displayColor).trim()) ? String(d.displayColor).trim() : "var(--accent-green, #4ec9b0)";
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
