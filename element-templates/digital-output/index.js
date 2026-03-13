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
    var isOn = currentData ? asBool(currentData.state) : false;

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
        var backgroundColor = (d.backgroundColor && String(d.backgroundColor).trim()) ? String(d.backgroundColor).trim() : "";
        var borderColor = (d.borderColor && String(d.borderColor).trim()) ? String(d.borderColor).trim() : "";
        if (backgroundColor) elementEl.style.background = backgroundColor; else elementEl.style.removeProperty("background");
        if (borderColor) elementEl.style.border = "1px solid " + borderColor; else elementEl.style.removeProperty("border");
      }
      elementEl.style.borderRadius = "8px";
    }

    if (header) {
      var image = (d.image && String(d.image).trim()) ? String(d.image).trim() : "";
      header.style.display = image ? "none" : (d.showHeader === false ? "none" : "");
      var headerColor = (d.headerColor && String(d.headerColor).trim()) ? String(d.headerColor).trim() : "";
      if (headerColor) header.style.background = headerColor; else header.style.removeProperty("background");
      if (d.showHeader === false) header.style.borderBottom = "none"; else header.style.removeProperty("border-bottom");
    }

    if (content) {
      content.style.padding = "10px";
    }

    if (titleEl) {
      titleEl.style.display = d.showLabel === false ? "none" : "";
      var lf = (d.labelFontFamily && String(d.labelFontFamily).trim()) ? String(d.labelFontFamily).trim() : "";
      var lfs = numberOrNull(d.labelFontSize) !== null ? numberOrNull(d.labelFontSize) + "px" : "";
      var lfw = (d.labelFontWeight && String(d.labelFontWeight).trim()) ? String(d.labelFontWeight).trim() : "";
      var lfst = (d.labelFontStyle && String(d.labelFontStyle).trim()) ? String(d.labelFontStyle).trim() : "";
      var lc = (d.labelColor && String(d.labelColor).trim()) ? String(d.labelColor).trim() : "";
      if (lf) titleEl.style.fontFamily = lf; else titleEl.style.removeProperty("font-family");
      if (lfs) titleEl.style.fontSize = lfs; else titleEl.style.removeProperty("font-size");
      if (lfw) titleEl.style.fontWeight = lfw; else titleEl.style.removeProperty("font-weight");
      if (lfst) titleEl.style.fontStyle = lfst; else titleEl.style.removeProperty("font-style");
      if (lc) titleEl.style.color = lc; else titleEl.style.removeProperty("color");
      titleEl.style.textAlign = "left";
    }

    if (toggleLabel) {
      toggleLabel.style.display = d.showToggleLabel === false ? "none" : "";
      var vf = (d.valueFontFamily && String(d.valueFontFamily).trim()) ? String(d.valueFontFamily).trim() : "";
      var vfs = numberOrNull(d.valueFontSize) !== null ? numberOrNull(d.valueFontSize) + "px" : "";
      var vfw = (d.valueFontWeight && String(d.valueFontWeight).trim()) ? String(d.valueFontWeight).trim() : "";
      var vfst = (d.valueFontStyle && String(d.valueFontStyle).trim()) ? String(d.valueFontStyle).trim() : "";
      var vc = (d.valueColor && String(d.valueColor).trim()) ? String(d.valueColor).trim() : "";
      if (vf) toggleLabel.style.fontFamily = vf; else toggleLabel.style.removeProperty("font-family");
      if (vfs) toggleLabel.style.fontSize = vfs; else toggleLabel.style.removeProperty("font-size");
      if (vfw) toggleLabel.style.fontWeight = vfw; else toggleLabel.style.removeProperty("font-weight");
      if (vfst) toggleLabel.style.fontStyle = vfst; else toggleLabel.style.removeProperty("font-style");
      if (vc) toggleLabel.style.color = vc; else toggleLabel.style.removeProperty("color");
      toggleLabel.style.textAlign = "center";
      toggleLabel.textContent = getStateLabel(isOn);
      toggleLabel.classList.toggle("on", isOn);
    }

    if (toggleTrack) {
      var toggleOnColor = (d.toggleOnColor && String(d.toggleOnColor).trim()) ? String(d.toggleOnColor).trim() : "";
      var toggleOffColor = (d.toggleOffColor && String(d.toggleOffColor).trim()) ? String(d.toggleOffColor).trim() : "";
      if (isOn && toggleOnColor) {
        toggleTrack.style.background = toggleOnColor;
      } else if (!isOn && toggleOffColor) {
        toggleTrack.style.background = toggleOffColor;
      } else {
        toggleTrack.style.removeProperty("background");
      }
    }

    if (toggleSwitch) {
      toggleSwitch.style.display = d.showValue === false ? "none" : "";
      toggleSwitch.classList.toggle("disabled", !canControl());
    }
  }

  function canControl() {
    var d = currentData || {};
    return d.userControl !== false && d.enabled !== false && d.deviceConnected !== false;
  }

  function updateDisplay(data) {
    currentData = data;
    var toggleSwitch = document.getElementById("toggleSwitch");
    var elementTitle = document.getElementById("elementTitle");
    var toggleLabel = document.getElementById("toggleLabel");
    var activeIndicator = document.getElementById("activeIndicator");

    if (!data || !toggleSwitch || !elementTitle) return;

    var isOn = asBool(data.state);
    if (isOn) {
      toggleSwitch.classList.add("on");
    } else {
      toggleSwitch.classList.remove("on");
    }

    elementTitle.textContent = data.displayName || data.name || "Digital Out";

    if (toggleLabel) {
      toggleLabel.textContent = getStateLabel(isOn);
    }

    if (activeIndicator) {
      var showIndicator = (currentData.showActiveIndicator !== false);
      activeIndicator.style.display = showIndicator ? "" : "none";
      activeIndicator.textContent = asBool(currentData.activeLow) ? "Active Low" : "Active High";
      activeIndicator.classList.toggle("active-low", asBool(currentData.activeLow));
    }

    applyStyles();
  }

  function handleToggleClick() {
    if (!currentData || !window.BruControl || !canControl()) return;
    window.BruControl.updateProperties({ state: !asBool(currentData.state) });
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
    if (window.BruControl.getData) {
      try {
        var initial = window.BruControl.getData();
        if (initial) updateDisplay(initial);
      } catch (e) {}
    }
    window.BruControl.onData(updateDisplay);
  } else {
    updateDisplay({
      elementType: "digitalOutput",
      name: "Digital Out",
      displayName: "Digital Out",
      state: true,
      activeLow: false,
      userControl: true,
      enabled: true,
      deviceConnected: true
    });
  }
})();
