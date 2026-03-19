(function() {
  var currentData = null;

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function parseOptions(raw) {
    if (!raw || typeof raw !== "string") return [];
    return raw.split(",").map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
  }

  function applyStyles() {
    var d = currentData || {};
    var elementEl = document.getElementById("element");
    var header = document.querySelector(".element-header");
    var titleEl = document.getElementById("elementTitle");
    var valueEl = document.getElementById("valueDisplay");
    var contentEl = document.querySelector(".element-content");

    if (!elementEl || !header || !titleEl || !valueEl || !contentEl) return;

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

    header.style.display = image ? "none" : (d.showHeader === false ? "none" : "");
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
    valueEl.style.fontFamily = d.displayFontFamily || "";
    valueEl.style.fontSize = numberOrNull(d.displayFontSize) !== null ? numberOrNull(d.displayFontSize) + "px" : "";
    valueEl.style.fontWeight = d.displayFontWeight || "";
    valueEl.style.fontStyle = d.displayFontStyle || "";
    valueEl.style.color = (d.displayColor && String(d.displayColor).trim()) ? String(d.displayColor).trim() : "var(--accent-green, #4ec9b0)";
    valueEl.style.textAlign = "center";

    contentEl.style.padding = "10px";
  }

  function updateDisplay(data) {
    currentData = data;
    var titleEl = document.getElementById("elementTitle");
    var valueEl = document.getElementById("valueDisplay");
    if (!titleEl || !valueEl || !data) return;

    titleEl.textContent = data.displayName || data.name || "Selector";

    var options = parseOptions(data.options);
    var val = data.value != null ? String(data.value) : "";

    if (options.length === 0) {
      valueEl.textContent = val || "(no options configured)";
      valueEl.classList.toggle("no-options", !val);
    } else {
      valueEl.textContent = val || "--";
      valueEl.classList.remove("no-options");
    }

    if (data.userControl !== false && options.length > 0) {
      valueEl.classList.add("editable");
    } else {
      valueEl.classList.remove("editable");
    }

    applyStyles();
  }

  function openSelector() {
    if (!currentData || currentData.userControl === false) return;
    if (!window.BruControl || !window.BruControl.requestSelection) return;

    var options = parseOptions(currentData.options);
    if (options.length === 0) return;

    var label = (currentData.displayName || currentData.name || "Select Value");
    var currentVal = currentData.value != null ? String(currentData.value) : "";

    window.BruControl.requestSelection({
      currentValue: currentVal,
      label: label,
      options: options
    }).then(function(result) {
      if (result !== null && result !== undefined && window.BruControl) {
        window.BruControl.updateProperties({ value: String(result) });
      }
    });
  }

  function handleValueClick() {
    openSelector();
  }

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
      name: "Brew Mode",
      displayName: "Brew Mode",
      value: "Mash",
      variableType: "String",
      userControl: true,
      enabled: true,
      options: "Mash,Boil,Sparge,Cool"
    });
  }
})();
