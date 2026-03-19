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
    var toggleLabel = document.getElementById("toggleLabel");
    var toggleTrack = document.querySelector(".toggle-track");
    var toggleSwitch = document.getElementById("toggleSwitch");
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

    if (toggleLabel) {
      toggleLabel.style.display = d.showToggleLabel === false ? "none" : "";
      toggleLabel.style.fontFamily = d.toggleFontFamily || "";
      toggleLabel.style.fontSize = numberOrNull(d.toggleFontSize) !== null ? numberOrNull(d.toggleFontSize) + "px" : "";
      toggleLabel.style.fontWeight = d.toggleFontWeight || "";
      toggleLabel.style.fontStyle = d.toggleFontStyle || "";
      toggleLabel.style.color = (d.toggleTextColor && String(d.toggleTextColor).trim()) ? String(d.toggleTextColor).trim() : "var(--accent-green, #4ec9b0)";
      toggleLabel.style.textAlign = "center";
      toggleLabel.textContent = getStateLabel(isOn);
    }

    if (toggleTrack) {
      if (isOn && d.toggleOnColor) {
        toggleTrack.style.background = d.toggleOnColor;
      } else if (!isOn && d.toggleOffColor) {
        toggleTrack.style.background = d.toggleOffColor;
      } else {
        toggleTrack.style.background = "";
      }
    }

    if (toggleSwitch) {
      toggleSwitch.style.display = d.showValue === false ? "none" : "";
    }
  }

  function updateDisplay(data) {
    currentData = data;
    var toggleSwitch = document.getElementById("toggleSwitch");
    var elementTitle = document.getElementById("elementTitle");
    if (!data || !toggleSwitch || !elementTitle) return;

    var isTrue = asBool(data.value);
    if (isTrue) {
      toggleSwitch.classList.add("on");
    } else {
      toggleSwitch.classList.remove("on");
    }

    elementTitle.textContent = data.displayName || data.name || "Boolean";
    applyStyles();
  }

  function handleToggleClick() {
    if (!currentData || !window.BruControl) return;
    window.BruControl.updateProperties({ value: asBool(currentData.value) ? "False" : "True" });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      var toggleSwitch = document.getElementById("toggleSwitch");
      if (toggleSwitch) toggleSwitch.addEventListener("click", handleToggleClick);
    });
  } else {
    var toggleSwitch = document.getElementById("toggleSwitch");
    if (toggleSwitch) toggleSwitch.addEventListener("click", handleToggleClick);
  }

  if (window.BruControl) {
    window.BruControl.onData(updateDisplay);
  } else {
    updateDisplay({
      id: "preview",
      name: "Pump Active",
      displayName: "Pump Active",
      value: "True",
      precision: 0,
      variableType: "Boolean",
      userControl: true,
      format: ""
    });
  }
})();
