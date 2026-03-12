(function () {
  var titleEl = document.getElementById("elementTitle");
  var contentEl = document.getElementById("elementContent");
  var footerEl = document.getElementById("elementFooter");
  var currentData = null;
  var sourceLiveValue = null;
  var destinationLiveValue = null;
  var sourceDisplayNameFromFetch = null;
  var destinationDisplayNameFromFetch = null;
  var sourceElementTypeResolved = null;
  var destinationElementTypeResolved = null;
  var subscribedSource = null;
  var subscribedDestination = null;

  var PROFILE_SOURCE_TYPES = ["globalVariable", "analogInput", "owTemp", "spiSensor", "hydrometer", "counter", "timer", "digitalInput", "generic"];
  var PROFILE_DEST_TYPES = ["globalVariable", "digitalOutput", "dutyCycle", "pwmOutput", "hysteresis", "pid", "deadband", "generic"];

  function isFooterActive() {
    return footerEl && footerEl.contains(document.activeElement) &&
           document.activeElement !== footerEl;
  }

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
    if (data.variable !== undefined && data.variable !== null) {
      return String(data.variable);
    }
    if (data.state !== undefined && data.state !== null) {
      return data.state ? "On" : "Off";
    }
    return null;
  }

  function isGuid(value) {
    if (!value || typeof value !== "string") return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  function isEmptyRef(id) {
    return !id || id === "00000000-0000-0000-0000-000000000000" || String(id).trim() === "";
  }

  function getLabel(name, id, fallback) {
    if (name && String(name).trim() !== "" && !isGuid(name)) return String(name);
    if (isEmptyRef(id)) return "—";
    return fallback || "—";
  }

  function elementDisplayName(el) {
    if (!el) return null;
    var n = el.displayName || el.name;
    return n && String(n).trim() !== "" ? String(n) : null;
  }

  function idMatches(a, b) {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return String(a).toLowerCase() === String(b).toLowerCase();
  }

  function handleElementUpdate(payload) {
    var et = payload && payload.elementType;
    var eid = payload && payload.elementId;
    var data = payload && payload.data;
    var val = formatElementValue(data);
    if (subscribedSource && et === subscribedSource.type && idMatches(eid, subscribedSource.id)) {
      sourceLiveValue = val;
      render(currentData);
    }
    if (subscribedDestination && et === subscribedDestination.type && idMatches(eid, subscribedDestination.id)) {
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
      sourceDisplayNameFromFetch = null;
      sourceElementTypeResolved = null;
    }
    if (subscribedDestination) {
      bc.unsubscribeElement(subscribedDestination.type, subscribedDestination.id);
      subscribedDestination = null;
      destinationLiveValue = null;
      destinationDisplayNameFromFetch = null;
      destinationElementTypeResolved = null;
    }
  }

  function subscribeOne(type, id, onResolved) {
    var bc = window.BruControl;
    if (!bc || !bc.subscribeElement) return;
    bc.subscribeElement(type, id).then(function (elData) {
      if (elData && idMatches(elData.id, id)) {
        onResolved(type, elData);
      }
    }).catch(function () {});
  }

  function subscribeWithTypeDiscovery(types, id, onResolved) {
    var bc = window.BruControl;
    if (!bc || !bc.subscribeElement || !bc.unsubscribeElement || !id) return;
    var i = 0;
    function tryNext() {
      if (i >= types.length) return;
      var t = types[i++];
      bc.subscribeElement(t, id).then(function (elData) {
        if (elData && idMatches(elData.id, id)) {
          onResolved(t, elData);
          return;
        }
        bc.unsubscribeElement(t, id);
        tryNext();
      }).catch(function () {
        bc.unsubscribeElement(t, id);
        tryNext();
      });
    }
    tryNext();
  }

  function setupSubscriptions(data) {
    var bc = window.BruControl;
    if (!bc || !bc.subscribeElement || !bc.unsubscribeElement) return;
    var srcType = String(data.sourceElementType || sourceElementTypeResolved || "").trim();
    var srcId = data.sourceId != null ? String(data.sourceId) : "";
    var destType = String(data.destinationElementType || destinationElementTypeResolved || "").trim();
    var destId = data.destinationId != null ? String(data.destinationId) : "";

    var srcKey = srcType && srcId && !isEmptyRef(srcId) ? srcType + ":" + srcId : null;
    var destKey = destType && destId && !isEmptyRef(destId) ? destType + ":" + destId : null;
    var needUnsubSrc = subscribedSource && (!srcKey || subscribedSource.type + ":" + subscribedSource.id !== srcKey);
    var needUnsubDest = subscribedDestination && (!destKey || subscribedDestination.type + ":" + subscribedDestination.id !== destKey);
    if (needUnsubSrc || needUnsubDest) {
      unsubscribeAll();
      subscribedSource = null;
      subscribedDestination = null;
      sourceLiveValue = null;
      destinationLiveValue = null;
    }

    if (srcId && !isEmptyRef(srcId)) {
      var alreadySubscribedSrc = subscribedSource && idMatches(subscribedSource.id, srcId) && subscribedSource.type === srcType;
      function onSourceResolved(type, elData) {
        if (!idMatches(currentData.sourceId, srcId)) return;
        sourceElementTypeResolved = type;
        subscribedSource = { type: type, id: srcId };
        sourceLiveValue = formatElementValue(elData);
        sourceDisplayNameFromFetch = elementDisplayName(elData);
        render(currentData);
      }
      if (srcType) {
        if (!alreadySubscribedSrc) {
          subscribedSource = { type: srcType, id: srcId };
          subscribeOne(srcType, srcId, function (_, elData) {
            if (subscribedSource && subscribedSource.type === srcType && subscribedSource.id === srcId && idMatches(currentData.sourceId, srcId)) {
              sourceLiveValue = formatElementValue(elData);
              sourceDisplayNameFromFetch = elementDisplayName(elData);
              render(currentData);
            }
          });
        }
      } else {
        if (!subscribedSource || !idMatches(subscribedSource.id, srcId)) {
          subscribeWithTypeDiscovery(PROFILE_SOURCE_TYPES, srcId, onSourceResolved);
        }
      }
    }
    if (destId && !isEmptyRef(destId)) {
      var alreadySubscribedDest = subscribedDestination && idMatches(subscribedDestination.id, destId) && subscribedDestination.type === destType;
      function onDestResolved(type, elData) {
        if (!idMatches(currentData.destinationId, destId)) return;
        destinationElementTypeResolved = type;
        subscribedDestination = { type: type, id: destId };
        destinationLiveValue = formatElementValue(elData);
        destinationDisplayNameFromFetch = elementDisplayName(elData);
        render(currentData);
      }
      if (destType) {
        if (!alreadySubscribedDest) {
          subscribedDestination = { type: destType, id: destId };
          subscribeOne(destType, destId, function (_, elData) {
            if (subscribedDestination && subscribedDestination.type === destType && subscribedDestination.id === destId && idMatches(currentData.destinationId, destId)) {
              destinationLiveValue = formatElementValue(elData);
              destinationDisplayNameFromFetch = elementDisplayName(elData);
              render(currentData);
            }
          });
        }
      } else {
        if (!subscribedDestination || !idMatches(subscribedDestination.id, destId)) {
          subscribeWithTypeDiscovery(PROFILE_DEST_TYPES, destId, onDestResolved);
        }
      }
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

    var labelNodes = document.querySelectorAll(".element-row .row-label");
    labelNodes.forEach(function (node) {
      var el = node;
      el.style.color = d.rowLabelColor || "";
      el.style.fontFamily = d.labelFontFamily || "";
      el.style.fontSize = numberOrNull(d.labelFontSize) !== null ? numberOrNull(d.labelFontSize) + "px" : "";
      el.style.fontWeight = d.labelFontWeight || "";
      el.style.fontStyle = d.labelFontStyle || "";
    });

    var valueNodes = document.querySelectorAll(".element-row .row-value");
    valueNodes.forEach(function (node) {
      var el = node;
      var rowEl = el.closest ? el.closest(".element-row") : el.parentElement;
      var isPrimary = rowEl && rowEl.classList && rowEl.classList.contains("element-row--primary");
      var valColor = isPrimary
        ? (d.valueColor && String(d.valueColor).trim() ? String(d.valueColor).trim() : "var(--accent-green)")
        : (d.rowValueColor && String(d.rowValueColor).trim() ? String(d.rowValueColor).trim() : "var(--accent-green)");
      el.style.color = valColor;
      el.style.fontFamily = d.valueFontFamily || "";
      el.style.fontSize = numberOrNull(d.valueFontSize) !== null ? numberOrNull(d.valueFontSize) + "px" : "";
      el.style.fontWeight = d.valueFontWeight || "";
      el.style.fontStyle = d.valueFontStyle || "";
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
        var srcLabel = getLabel(
          currentData.sourceDisplayName || sourceDisplayNameFromFetch,
          currentData.sourceId,
          "Source"
        );
        var destLabel = getLabel(
          currentData.destinationDisplayName || destinationDisplayNameFromFetch,
          currentData.destinationId,
          "Destination"
        );
        var srcVal = sourceLiveValue !== null ? sourceLiveValue : "—";
        var destVal = destinationLiveValue !== null ? destinationLiveValue : "—";
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

