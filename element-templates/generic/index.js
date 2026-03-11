(function () {
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
      nameEl.style.color = d.valueColor || d.textColor || "";
    }

    if (elementEl) {
      if (d.showBackground === false) {
        elementEl.style.background = "transparent";
        elementEl.style.border = "none";
      } else {
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
