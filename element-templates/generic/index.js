(function () {
  var BASE_KEYS = new Set([ 'id', 'workspaceId', 'name', 'displayName', 'enabled', 'userControl', 'visibility', 'elementType', 'enableHistoricalLogging', 'loggingIntervalSeconds', 'maxSilenceSeconds', 'propertiesJson', 'schemaJson', 'uiControls', 'elementTemplateId', 'appearance' ]);

  function formatValue(value) {
    if (value == null) return '--';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function getNonBaseProperties(data) {
    if (!data || typeof data !== 'object') return [];
    var out = [];
    Object.keys(data).sort().forEach(function (key) {
      if (!BASE_KEYS.has(key)) {
        out.push({ name: key, value: formatValue(data[key]) });
      }
    });
    return out;
  }

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function render(data) {
    var d = data || {};
    var nameEl = document.getElementById("name");
    var elementEl = document.getElementById("element");

    if (nameEl) {
      nameEl.textContent = d.displayName || d.name || "Generic";
      nameEl.style.display = d.showValue === false ? "none" : "";
      nameEl.style.fontFamily = d.valueFontFamily || "";
      nameEl.style.fontSize = numberOrNull(d.valueFontSize) !== null ? numberOrNull(d.valueFontSize) + "px" : "";
      nameEl.style.color = (d.valueColor && String(d.valueColor).trim()) ? String(d.valueColor).trim() : (d.textColor && String(d.textColor).trim()) ? String(d.textColor).trim() : "var(--accent-green, #4ec9b0)";
    }

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
    }
  }

  if (window.BruControl) {
    window.BruControl.onData(render);
  } else {
    render({ displayName: "Generic" });
  }
})();
