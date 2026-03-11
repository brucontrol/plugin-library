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
      if (d.showBackground === false) {
        elementEl.style.background = "transparent";
        elementEl.style.border = "none";
      } else {
        elementEl.style.background = d.backgroundColor || "";
        elementEl.style.border = d.borderColor ? "1px solid " + d.borderColor : "";
      }
      elementEl.style.borderRadius = "8px";
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
