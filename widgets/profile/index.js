(function () {
  var titleEl = document.getElementById("widgetTitle");
  var contentEl = document.getElementById("widgetContent");
  var footerEl = document.getElementById("widgetFooter");
  var currentData = null;
  var sourceLiveValue = null;
  var destinationLiveValue = null;
  var subscribedSource = null;
  var subscribedDestination = null;

  function isFooterActive() {
    return footerEl && footerEl.contains(document.activeElement) &&
           document.activeElement !== footerEl;
  }

  function getType(data) {
    if (data && data.elementType) return String(data.elementType);
    var fromAttr = document.body.getAttribute("data-widget-type");
    return fromAttr || "widget";
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function toRowKey(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function getHiddenRowsMap() {
    var d = currentData || {};
    var map = Object.create(null);
    if (!Array.isArray(d.hiddenRowKeys)) return map;
    for (var i = 0; i < d.hiddenRowKeys.length; i += 1) {
      var key = toRowKey(d.hiddenRowKeys[i]);
      if (key) map[key] = true;
    }
    return map;
  }

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function formatElementValue(data) {
    if (!data) return null;
    if (data.value !== undefined && data.value !== null) {
      return String(data.value);
    }
    if (data.state !== undefined && data.state !== null) {
      return data.state ? "On" : "Off";
    }
    return null;
  }

  function handleElementUpdate(payload) {
    var et = payload && payload.elementType;
    var eid = payload && payload.elementId;
    var data = payload && payload.data;
    var val = formatElementValue(data);
    if (subscribedSource && et === subscribedSource.type && eid === subscribedSource.id) {
      sourceLiveValue = val;
      render(currentData);
    }
    if (subscribedDestination && et === subscribedDestination.type && eid === subscribedDestination.id) {
      destinationLiveValue = val;
      render(currentData);
    }
  }

  function unsubscribeAll() {
    var bc = window.BruControl;
    if (!bc || !bc.unsubscribeElement) return;
    if (subscribedSource) {
      bc.unsubscribeElement(subscribedSource.type, subscribedSource.id);
      subscribedSource = null;
      sourceLiveValue = null;
    }
    if (subscribedDestination) {
      bc.unsubscribeElement(subscribedDestination.type, subscribedDestination.id);
      subscribedDestination = null;
      destinationLiveValue = null;
    }
  }

  function setupSubscriptions(data) {
    var bc = window.BruControl;
    if (!bc || !bc.subscribeElement || !bc.unsubscribeElement) return;
    var srcType = data.sourceElementType;
    var srcId = data.sourceId;
    var destType = data.destinationElementType;
    var destId = data.destinationId;

    var srcKey = srcType && srcId ? srcType + ":" + srcId : null;
    var destKey = destType && destId ? destType + ":" + destId : null;
    var needUnsubSrc = subscribedSource && (!srcKey || subscribedSource.type + ":" + subscribedSource.id !== srcKey);
    var needUnsubDest = subscribedDestination && (!destKey || subscribedDestination.type + ":" + subscribedDestination.id !== destKey);
    if (needUnsubSrc || needUnsubDest) {
      unsubscribeAll();
      subscribedSource = null;
      subscribedDestination = null;
      sourceLiveValue = null;
      destinationLiveValue = null;
    }

    if (srcType && srcId) {
      subscribedSource = { type: srcType, id: srcId };
      bc.subscribeElement(srcType, srcId).then(function (elData) {
        if (subscribedSource && subscribedSource.type === srcType && subscribedSource.id === srcId) {
          sourceLiveValue = formatElementValue(elData);
          render(currentData);
        }
      });
    }
    if (destType && destId) {
      subscribedDestination = { type: destType, id: destId };
      bc.subscribeElement(destType, destId).then(function (elData) {
        if (subscribedDestination && subscribedDestination.type === destType && subscribedDestination.id === destId) {
          destinationLiveValue = formatElementValue(elData);
          render(currentData);
        }
      });
    }
  }

  function row(label, value, cls, options, hiddenRows) {
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
    if (hiddenRows[key]) {
      return null;
    }

    var r = document.createElement("div");
    r.className = "widget-row";
    r.setAttribute("data-row-key", key);
    if (isPrimary) {
      r.classList.add("widget-row--primary");
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
    var widget = document.getElementById("widget");
    var header = document.querySelector(".widget-header");
    var content = document.querySelector(".widget-content");

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

    var labelNodes = document.querySelectorAll(".widget-row .row-label");
    labelNodes.forEach(function (node) {
      var el = node;
      el.style.color = d.rowLabelColor || "";
      if (d.labelFontFamily) el.style.fontFamily = d.labelFontFamily;
      if (numberOrNull(d.labelFontSize) !== null) el.style.fontSize = numberOrNull(d.labelFontSize) + "px";
      if (d.labelFontWeight) el.style.fontWeight = d.labelFontWeight;
      if (d.labelFontStyle) el.style.fontStyle = d.labelFontStyle;
    });

    var valueNodes = document.querySelectorAll(".widget-row .row-value");
    valueNodes.forEach(function (node) {
      var el = node;
      if (d.rowValueColor) el.style.color = d.rowValueColor;
      if (d.valueColor) el.style.color = d.valueColor;
      if (d.valueFontFamily) el.style.fontFamily = d.valueFontFamily;
      if (numberOrNull(d.valueFontSize) !== null) el.style.fontSize = numberOrNull(d.valueFontSize) + "px";
      if (d.valueFontWeight) el.style.fontWeight = d.valueFontWeight;
      if (d.valueFontStyle) el.style.fontStyle = d.valueFontStyle;
      el.style.textAlign = "center";
    });

    if (!footerEl) return;
    if (d.showFooter === false || !footerEl.childNodes.length) {
      footerEl.style.display = "none";
    } else {
      footerEl.style.display = "flex";
    }
  }

  function render(data) {
    currentData = data || {};
    var type = getType(currentData);
    var displayName = currentData.displayName || currentData.name || type;
    var hiddenRows = getHiddenRowsMap();

    if (type === "profile") {
      setupSubscriptions(currentData);
    } else {
      unsubscribeAll();
    }

    if (titleEl) {
      titleEl.textContent = displayName;
    }

    var footerBusy = isFooterActive();

    clear(contentEl);
    renderContentRows(type, hiddenRows);

    if (!footerBusy) {
      clear(footerEl);
      renderFooter(type);
    }

    applyStyles();
  }

  function renderContentRows(type, hiddenRows) {
    switch (type) {
      case "profile": {
        var srcLabel = currentData.sourceDisplayName || currentData.sourceId || "Source";
        var destLabel = currentData.destinationDisplayName || currentData.destinationId || "Destination";
        var srcVal = sourceLiveValue !== null ? sourceLiveValue : "--";
        var destVal = destinationLiveValue !== null ? destinationLiveValue : "--";
        appendRow(row(srcLabel, srcVal, "", { key: "source" }, hiddenRows));
        appendRow(row(destLabel, destVal, "", { key: "destination" }, hiddenRows));
        appendRow(row("Direction", currentData.direction || (currentData.directional ? "Bidirectional" : "Forward"), "", { key: "direction" }, hiddenRows));
        break;
      }
      default:
        appendRow(row("Value", JSON.stringify(currentData), "", { key: "value" }, hiddenRows));
        break;
    }
  }

  function renderFooter(type) {
    switch (type) {
      default:
        break;
    }
  }

  function getPreviewData() {
    var t = getType(null);
    var map = {
      profile: { elementType: "profile", name: "Profile", displayName: "Profile", sourceId: "Source-A", destinationId: "Dest-B", sourceDisplayName: "Temp Probe", destinationDisplayName: "Mash Heater PWM", directional: false }
    };
    return map[t] || { elementType: t, displayName: t };
  }

  if (window.BruControl) {
    if (window.BruControl.onElementUpdate) {
      window.BruControl.onElementUpdate(handleElementUpdate);
    }
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

