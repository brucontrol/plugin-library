(function () {
  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function render(data) {
    var d = data || {};
    var nameEl = document.getElementById("name");
    var widget = document.getElementById("widget");

    if (nameEl) {
      nameEl.textContent = d.displayName || d.name || "Generic";
      nameEl.style.display = d.showValue === false ? "none" : "";
      nameEl.style.fontFamily = d.valueFontFamily || "";
      nameEl.style.fontSize = numberOrNull(d.valueFontSize) !== null ? numberOrNull(d.valueFontSize) + "px" : "";
      nameEl.style.color = d.valueColor || d.textColor || "";
    }

    if (widget) {
      if (d.showBackground === false) {
        widget.style.background = "transparent";
        widget.style.border = "none";
      } else {
        widget.style.background = d.backgroundColor || "";
        widget.style.border = d.borderColor ? "1px solid " + d.borderColor : "";
      }
    }
  }

  if (window.BruControl) {
    window.BruControl.onData(render);
  } else {
    render({ displayName: "Generic" });
  }
})();
