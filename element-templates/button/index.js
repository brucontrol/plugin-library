(function () {
  var btnEl = document.getElementById("elementButton");
  var currentData = null;

  function getType(data) {
    if (data && data.elementType) return String(data.elementType);
    var fromAttr = document.body.getAttribute("data-element-type");
    return fromAttr || "element";
  }

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function sendPatch(patch) {
    if (!window.BruControl || !window.BruControl.updateProperties) return;
    window.BruControl.updateProperties(patch);
  }

  function applyStyles() {
    var d = currentData || {};
    if (!btnEl) return;

    var image = (d.image && String(d.image).trim()) ? String(d.image).trim() : "";
    if (image) {
      var escaped = image.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
      btnEl.style.setProperty("--button-bg-image", "url(\"" + escaped + "\")");
      btnEl.classList.add("has-image");
      document.body.style.removeProperty("--button-primary-bg");
      document.body.style.removeProperty("--button-primary-hover");
    } else {
      btnEl.style.removeProperty("--button-bg-image");
      btnEl.classList.remove("has-image");
      btnEl.style.backgroundImage = "";
      btnEl.style.backgroundSize = "";
      btnEl.style.backgroundPosition = "";
      if (d.buttonColor) {
        document.body.style.setProperty("--button-primary-bg", d.buttonColor);
        document.body.style.setProperty("--button-primary-hover", d.buttonColor);
      } else {
        document.body.style.removeProperty("--button-primary-bg");
        document.body.style.removeProperty("--button-primary-hover");
      }
    }

    btnEl.style.fontFamily = d.buttonFontFamily || "";
    btnEl.style.fontSize = numberOrNull(d.buttonFontSize) !== null ? numberOrNull(d.buttonFontSize) + "px" : "";
    btnEl.style.fontWeight = d.buttonFontWeight || "";
    btnEl.style.fontStyle = d.buttonFontStyle || "";
    btnEl.style.color = d.buttonTextColor || "";
  }

  function render(data) {
    var type = getType(data);
    if (type === "button" && currentData && getType(currentData) === "button") {
      var keysToIgnore = { state: true };
      var changed = false;
      for (var k in data) {
        if (!keysToIgnore[k] && data[k] !== currentData[k]) { changed = true; break; }
      }
      if (!changed) {
        for (var k2 in currentData) {
          if (!keysToIgnore[k2] && data[k2] !== currentData[k2]) { changed = true; break; }
        }
      }
      if (!changed) {
        currentData = data || {};
        return;
      }
    }
    currentData = data || {};
    var displayName = currentData.displayName || currentData.name || type;

    if (btnEl) {
      btnEl.textContent = displayName;
      btnEl.disabled = currentData.userControl === false;
    }

    applyStyles();
  }

  function setupButton() {
    if (!btnEl) return;
    btnEl.addEventListener("pointerdown", function () { sendPatch({ state: true }); });
    btnEl.addEventListener("pointerup", function () { sendPatch({ state: false }); });
    btnEl.addEventListener("pointerleave", function () { sendPatch({ state: false }); });
    btnEl.addEventListener("pointercancel", function () { sendPatch({ state: false }); });
  }

  function getPreviewData() {
    var t = getType(null);
    var map = {
      button: { elementType: "button", name: "Button", displayName: "Button", state: false, userControl: true, enabled: true }
    };
    return map[t] || { elementType: t, displayName: t };
  }

  setupButton();

  if (window.BruControl) {
    if (window.BruControl.getData) {
      try {
        var initial = window.BruControl.getData();
        if (initial) render(initial);
      } catch {}
    }

    window.BruControl.onData(render);
  } else {
    render(getPreviewData());
  }
})();
