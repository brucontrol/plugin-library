(function() {
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

  function getIsOn(data) {
    if (!data) return false;
    return data.elementType === "toggleSwitch" ? asBool(data.state) : asBool(data.value);
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
    var widget = document.getElementById("widget");
    var header = document.querySelector(".widget-header");
    var content = document.querySelector(".widget-content");
    var titleEl = document.getElementById("widgetTitle");
    var toggleLabel = document.getElementById("toggleLabel");
    var toggleTrack = document.querySelector(".toggle-track");
    var toggleSwitch = document.getElementById("toggleSwitch");
    var isOn = getIsOn(currentData);

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

    if (header) {
      header.style.display = d.showHeader === false ? "none" : "";
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
      toggleLabel.style.fontFamily = d.valueFontFamily || "";
      toggleLabel.style.fontSize = numberOrNull(d.valueFontSize) !== null ? numberOrNull(d.valueFontSize) + "px" : "";
      toggleLabel.style.fontWeight = d.valueFontWeight || "";
      toggleLabel.style.fontStyle = d.valueFontStyle || "";
      toggleLabel.style.color = d.valueColor || "";
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
    var widgetTitle = document.getElementById("widgetTitle");
    if (!data || !toggleSwitch || !widgetTitle) return;

    var isOn = getIsOn(data);
    toggleSwitch.classList.toggle("on", isOn);
    widgetTitle.textContent = data.displayName || data.name || "Switch";
    applyStyles();
  }

  function handleToggleClick() {
    if (!currentData || !window.BruControl) return;
    if (currentData.elementType === "toggleSwitch") {
      window.BruControl.updateProperties({ state: !asBool(currentData.state) });
    } else {
      window.BruControl.updateProperties({ value: asBool(currentData.value) ? "False" : "True" });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      var el = document.getElementById("toggleSwitch");
      if (el) el.addEventListener("click", handleToggleClick);
    });
  } else {
    var el = document.getElementById("toggleSwitch");
    if (el) el.addEventListener("click", handleToggleClick);
  }

  if (window.BruControl) {
    window.BruControl.onData(updateDisplay);
  } else {
    updateDisplay({
      elementType: "toggleSwitch",
      id: "preview",
      name: "Switch",
      displayName: "Switch",
      state: false,
      userControl: true
    });
  }
})();
