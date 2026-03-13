(function () {
  var currentData = null;

  function asBool(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      var lowered = value.toLowerCase();
      return lowered === "true" || lowered === "1" || lowered === "on";
    }
    return !!value;
  }

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function getStateLabel(isOn) {
    var d = currentData || {};
    if (isOn) {
      return typeof d.onLabel === "string" && d.onLabel.length > 0 ? d.onLabel : "ON";
    }
    return typeof d.offLabel === "string" && d.offLabel.length > 0 ? d.offLabel : "OFF";
  }

  function applyStyles() {
    var d = currentData || {};
    var elementEl = document.getElementById("element");
    var header = document.querySelector(".element-header");
    var content = document.querySelector(".element-content");
    var titleEl = document.getElementById("elementTitle");
    var valueText = document.getElementById("valueText");
    var isOn = currentData ? asBool(currentData.value) : false;

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
        var backgroundColor = (typeof d.backgroundColor === "string" && d.backgroundColor.trim()) ? d.backgroundColor.trim() : "";
        var borderColor = (typeof d.borderColor === "string" && d.borderColor.trim()) ? d.borderColor.trim() : "";
        elementEl.style.background = backgroundColor || "";
        elementEl.style.border = borderColor ? "1px solid " + borderColor : "";
      }
      elementEl.style.borderRadius = "8px";
    }

    if (header) {
      var image = (d.image && String(d.image).trim()) ? String(d.image).trim() : "";
      header.style.display = image ? "none" : (d.showHeader === false ? "none" : "");
      var headerColor = (typeof d.headerColor === "string" && d.headerColor.trim()) ? d.headerColor.trim() : "";
      header.style.background = headerColor || "";
      header.style.borderBottom = d.showHeader === false ? "none" : "";
    }

    if (content) {
      content.style.padding = "10px";
    }

    if (titleEl) {
      titleEl.style.display = d.showLabel === false ? "none" : "";
      titleEl.style.fontFamily = (typeof d.labelFontFamily === "string" && d.labelFontFamily.trim()) ? d.labelFontFamily.trim() : "";
      titleEl.style.fontSize = numberOrNull(d.labelFontSize) !== null ? numberOrNull(d.labelFontSize) + "px" : "";
      titleEl.style.fontWeight = (typeof d.labelFontWeight === "string" && d.labelFontWeight.trim()) ? d.labelFontWeight.trim() : "";
      titleEl.style.fontStyle = (typeof d.labelFontStyle === "string" && d.labelFontStyle.trim()) ? d.labelFontStyle.trim() : "";
      titleEl.style.color = (typeof d.labelColor === "string" && d.labelColor.trim()) ? d.labelColor.trim() : "";
      titleEl.style.textAlign = "left";
    }

    if (valueText) {
      valueText.style.display = d.showValue === false ? "none" : "";
      valueText.style.fontFamily = (typeof d.valueFontFamily === "string" && d.valueFontFamily.trim()) ? d.valueFontFamily.trim() : "";
      valueText.style.fontSize = numberOrNull(d.valueFontSize) !== null ? numberOrNull(d.valueFontSize) + "px" : "";
      valueText.style.fontWeight = (typeof d.valueFontWeight === "string" && d.valueFontWeight.trim()) ? d.valueFontWeight.trim() : "";
      valueText.style.fontStyle = (typeof d.valueFontStyle === "string" && d.valueFontStyle.trim()) ? d.valueFontStyle.trim() : "";
      valueText.style.color = (typeof d.valueColor === "string" && d.valueColor.trim()) ? d.valueColor.trim() : "";
      valueText.style.textAlign = "center";
      valueText.textContent = getStateLabel(isOn);
      valueText.classList.toggle("on", isOn);
    }
  }

  function updateDisplay(data) {
    currentData = data;
    var valueText = document.getElementById("valueText");
    var elementTitle = document.getElementById("elementTitle");
    var activeIndicator = document.getElementById("activeIndicator");

    if (!data || !valueText || !elementTitle) return;

    var isOn = asBool(data.value);
    valueText.textContent = getStateLabel(isOn);
    valueText.classList.toggle("on", isOn);

    elementTitle.textContent = data.displayName || data.name || "Digital In";

    if (activeIndicator) {
      var showIndicator = (currentData.showActiveIndicator !== false);
      activeIndicator.style.display = showIndicator ? "" : "none";
      activeIndicator.textContent = asBool(currentData.activeLow) ? "Active Low" : "Active High";
      activeIndicator.classList.toggle("active-low", asBool(currentData.activeLow));
    }

    applyStyles();
  }

  if (window.BruControl) {
    if (window.BruControl.getData) {
      try {
        var initial = window.BruControl.getData();
        if (initial) updateDisplay(initial);
      } catch (e) {}
    }
    window.BruControl.onData(updateDisplay);
  } else {
    updateDisplay({
      elementType: "digitalInput",
      name: "Digital In",
      displayName: "Digital In",
      value: true,
      activeLow: false,
      enabled: true,
      deviceConnected: true
    });
  }
})();
