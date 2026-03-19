(function () {
  var titleEl = document.getElementById("elementTitle");
  var contentEl = document.getElementById("elementContent");
  var footerEl = document.getElementById("elementFooter");
  var currentData = null;

  function getType(data) {
    if (data && data.elementType) return String(data.elementType);
    var fromAttr = document.body.getAttribute("data-element-type");
    return fromAttr || "element";
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function toRowKey(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function row(label, value, cls, options) {
    var d = currentData || {};
    var opts = options || {};
    var key = toRowKey(opts.key || label);
    var isPrimary = !!opts.primary;

    if (isPrimary && d.showValue === false) {
      return null;
    }
    if (!isPrimary && d.showSecondaryRows === false) {
      return null;
    }

    var r = document.createElement("div");
    r.className = "element-row";
    r.setAttribute("data-row-key", key);
    if (isPrimary) {
      r.classList.add("element-row--primary");
    }

    var l = document.createElement("span");
    l.className = "label row-label";
    l.textContent = label;

    var v = document.createElement("span");
    v.className = "value row-value" + (cls ? " " + cls : "");
    v.textContent = String(value);

    r.appendChild(l);
    r.appendChild(v);
    return r;
  }

  function appendRow(rowEl) {
    if (rowEl) {
      contentEl.appendChild(rowEl);
    }
  }

  function applyStyles() {
    var d = currentData || {};
    var elementEl = document.getElementById("element");
    var header = document.querySelector(".element-header");
    var content = document.querySelector(".element-content");
    var image = (d.image && String(d.image).trim()) ? String(d.image).trim() : "";

    if (elementEl) {
      if (image) {
        elementEl.style.background = "transparent";
        elementEl.style.backgroundImage = "url(\"" + image.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\")";
        elementEl.style.backgroundSize = "cover";
        elementEl.style.backgroundPosition = "center";
        elementEl.style.border = "none";
      } else {
        elementEl.style.backgroundImage = "";
        if (d.showBackground === false) {
          elementEl.style.background = "transparent";
          elementEl.style.border = "none";
        } else {
          elementEl.style.background = d.backgroundColor || "";
          elementEl.style.border = d.borderColor ? "1px solid " + d.borderColor : "";
        }
      }

      elementEl.style.borderRadius = "8px";
    }

    if (header) {
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

    var labelNodes = document.querySelectorAll(".element-row .row-label");
    labelNodes.forEach(function (node) {
      var el = node;
      el.style.color = (d.propertiesLabelColor && String(d.propertiesLabelColor).trim()) ? String(d.propertiesLabelColor).trim() : "";
    });

    var valueNodes = document.querySelectorAll(".element-row .row-value");
    valueNodes.forEach(function (node) {
      var el = node;
      el.style.color = (d.propertiesColor && String(d.propertiesColor).trim()) ? String(d.propertiesColor).trim() : "var(--accent-green, #4ec9b0)";
      el.style.fontFamily = (d.propertiesFont && String(d.propertiesFont).trim()) ? String(d.propertiesFont).trim() : "";
      el.style.fontSize = (numberOrNull(d.propertiesSize) !== null) ? numberOrNull(d.propertiesSize) + "px" : "";
      el.style.fontWeight = (d.propertiesWeight && String(d.propertiesWeight).trim()) ? String(d.propertiesWeight).trim() : "";
      el.style.fontStyle = (d.propertiesStyle && String(d.propertiesStyle).trim()) ? String(d.propertiesStyle).trim() : "";
      el.style.textAlign = "center";
    });

    if (!footerEl) return;
    if (!footerEl.childNodes.length) {
      footerEl.style.display = "none";
    } else {
      footerEl.style.display = "flex";
    }
  }

  function render(data) {
    currentData = data || {};
    var type = getType(currentData);
    var displayName = currentData.displayName || currentData.name || type;

    if (titleEl) {
      titleEl.textContent = displayName;
    }

    clear(contentEl);
    renderContentRows(type);
    clear(footerEl);

    applyStyles();
  }

  function renderContentRows(type) {
    switch (type) {
      case "stateful":
        var reserved = ['id','workspaceId','name','displayName','enabled','userControl','visibility','uiControls','elementType'];
        var keys = Object.keys(currentData).filter(function(k) { return reserved.indexOf(k) === -1; });
        if (keys.length === 0) {
          appendRow(row("Properties", "(empty)", "value--warn", { key: "properties" }));
        } else {
          for (var pi = 0; pi < keys.length; pi++) {
            var pk = keys[pi];
            var pv = currentData[pk];
            var display = pv === true ? "true" : pv === false ? "false" : pv == null ? "null" : String(pv);
            var cls = typeof pv === "boolean" ? (pv ? "value--ok" : "value--warn") : "";
            appendRow(row(pk, display, cls, { key: pk }));
          }
        }
        break;
      default:
        appendRow(row("Value", JSON.stringify(currentData), "", { key: "value" }));
        break;
    }
  }

  function getPreviewData() {
    var t = getType(null);
    var map = {
      stateful: { elementType: "stateful", name: "Stateful", displayName: "Stateful", enabled: true }
    };
    return map[t] || { elementType: t, displayName: t };
  }

  if (window.BruControl) {
    if (window.BruControl.getData) {
      try {
        var initial = window.BruControl.getData();
        if (initial) render(initial);
      } catch {}
    }

    window.BruControl.onData(render);
    window.BruControl.onState(function(state) {
      if (currentData && currentData.elementType === "stateful" && state && typeof state === "object") {
        for (var k in state) { if (state.hasOwnProperty(k)) currentData[k] = state[k]; }
        render(currentData);
      }
    });
  } else {
    render(getPreviewData());
  }
})();
