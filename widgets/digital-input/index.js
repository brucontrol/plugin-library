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
    var widget = document.getElementById("widget");
    var header = document.querySelector(".widget-header");
    var content = document.querySelector(".widget-content");
    var titleEl = document.getElementById("widgetTitle");
    var toggleLabel = document.getElementById("toggleLabel");
    var toggleTrack = document.querySelector(".toggle-track");
    var toggleSwitch = document.getElementById("toggleSwitch");
    var isOn = currentData ? asBool(currentData.value) : false;

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
      toggleLabel.style.color = (d.valueColor && d.valueColor.length > 0) ? d.valueColor : "";
      toggleLabel.style.textAlign = "center";
      toggleLabel.textContent = getStateLabel(isOn);
      toggleLabel.classList.toggle("on", isOn);
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
    var toggleLabel = document.getElementById("toggleLabel");
    var activeIndicator = document.getElementById("activeIndicator");

    if (!data || !toggleSwitch || !widgetTitle) return;

    var isOn = asBool(data.value);
    if (isOn) {
      toggleSwitch.classList.add("on");
    } else {
      toggleSwitch.classList.remove("on");
    }

    widgetTitle.textContent = data.displayName || data.name || "Digital In";

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
