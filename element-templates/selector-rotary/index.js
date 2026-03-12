(function () {
  var currentData = null;
  var CX = 100, CY = 100;
  var OUTER_R = 90;
  var TICK_R = 75;
  var LABEL_R = 58;
  var NEEDLE_R = 68;
  var ARC_START = 135;
  var ARC_SPAN = 270;
  var INNER_R = 40;

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function getOptions() {
    var d = currentData || {};
    if (Array.isArray(d.selectOptions) && d.selectOptions.length > 0) {
      return d.selectOptions.filter(function (v) {
        return typeof v === "number" && Number.isFinite(v);
      });
    }
    return [0, 25, 50, 75, 100];
  }

  function deg2rad(d) { return d * Math.PI / 180; }

  function polarToCart(cx, cy, r, angleDeg) {
    var rad = deg2rad(angleDeg);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function valueToAngle(value, options) {
    if (options.length < 2) return ARC_START;
    var idx = -1;
    for (var i = 0; i < options.length; i++) {
      if (options[i] === value) { idx = i; break; }
    }
    if (idx < 0) {
      var closest = 0;
      var minDist = Math.abs(options[0] - value);
      for (var j = 1; j < options.length; j++) {
        var dist = Math.abs(options[j] - value);
        if (dist < minDist) { minDist = dist; closest = j; }
      }
      idx = closest;
    }
    return ARC_START + (idx / (options.length - 1)) * ARC_SPAN;
  }

  function svgEl(tag, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) {
      for (var k in attrs) {
        if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
      }
    }
    return el;
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    var start = polarToCart(cx, cy, r, startAngle);
    var end = polarToCart(cx, cy, r, endAngle);
    var largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
    return "M " + start.x + " " + start.y + " A " + r + " " + r + " 0 " + largeArc + " 1 " + end.x + " " + end.y;
  }

  function getThemeColor(varName, fallback) {
    try {
      var val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      return val || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function buildDial() {
    var svg = document.getElementById("dialSvg");
    if (!svg) return;
    svg.innerHTML = "";

    var d = currentData || {};
    var options = getOptions();
    var dialColor = d.dialColor || getThemeColor("--bg-tertiary", "#2d2d2d");
    var needleColor = d.needleColor || getThemeColor("--accent-green", "#4ec9b0");
    var activeColor = d.activeColor || getThemeColor("--accent-primary", "#007acc");
    var trackStroke = getThemeColor("--border-color", "#555555");
    var textMuted = getThemeColor("--text-secondary", "#888888");
    var textSecondary = getThemeColor("--text-secondary", "#aaaaaa");
    var innerFill = getThemeColor("--bg-primary", "#1e1e1e");
    var currentValue = currentData ? parseFloat(currentData.value) : null;

    /* Background circle */
    svg.appendChild(svgEl("circle", {
      cx: CX, cy: CY, r: OUTER_R,
      fill: dialColor, stroke: trackStroke, "stroke-width": "1.5"
    }));

    /* Arc track */
    var trackPath = describeArc(CX, CY, TICK_R, ARC_START, ARC_START + ARC_SPAN);
    svg.appendChild(svgEl("path", {
      d: trackPath, fill: "none", stroke: trackStroke, "stroke-width": "3",
      "stroke-linecap": "round"
    }));

    /* Inner circle (center) */
    svg.appendChild(svgEl("circle", {
      cx: CX, cy: CY, r: INNER_R,
      fill: innerFill, stroke: trackStroke, "stroke-width": "1"
    }));

    /* Ticks and labels */
    for (var i = 0; i < options.length; i++) {
      var angle = options.length > 1
        ? ARC_START + (i / (options.length - 1)) * ARC_SPAN
        : ARC_START + ARC_SPAN / 2;

      var isActive = currentValue !== null && options[i] === currentValue;
      var tickStart = polarToCart(CX, CY, TICK_R - 8, angle);
      var tickEnd = polarToCart(CX, CY, TICK_R + 4, angle);
      var tickColor = isActive ? activeColor : textMuted;

      svg.appendChild(svgEl("line", {
        x1: tickStart.x, y1: tickStart.y,
        x2: tickEnd.x, y2: tickEnd.y,
        stroke: tickColor, "stroke-width": isActive ? "3" : "2",
        "stroke-linecap": "round"
      }));

      /* Label */
      var labelPos = polarToCart(CX, CY, LABEL_R, angle);
      var text = svgEl("text", {
        x: labelPos.x, y: labelPos.y,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        fill: isActive ? activeColor : textSecondary,
        "font-size": isActive ? "12" : "11",
        "font-weight": isActive ? "700" : "400",
        style: "cursor:pointer"
      });
      text.textContent = String(options[i]);

      (function (val) {
        text.addEventListener("click", function () {
          if (window.BruControl) {
            window.BruControl.updateProperties({ value: String(val) });
          }
        });
      })(options[i]);
      svg.appendChild(text);

      /* Clickable hit area */
      var hitCircle = svgEl("circle", {
        cx: labelPos.x, cy: labelPos.y, r: "10",
        fill: "transparent", style: "cursor:pointer"
      });
      (function (val) {
        hitCircle.addEventListener("click", function () {
          if (window.BruControl) {
            window.BruControl.updateProperties({ value: String(val) });
          }
        });
      })(options[i]);
      svg.appendChild(hitCircle);
    }

    /* Needle */
    if (currentValue !== null && Number.isFinite(currentValue)) {
      var needleAngle = valueToAngle(currentValue, options);
      var needleTip = polarToCart(CX, CY, NEEDLE_R, needleAngle);
      var needleBase1 = polarToCart(CX, CY, 6, needleAngle - 90);
      var needleBase2 = polarToCart(CX, CY, 6, needleAngle + 90);

      var needlePath = "M " + needleBase1.x + " " + needleBase1.y +
        " L " + needleTip.x + " " + needleTip.y +
        " L " + needleBase2.x + " " + needleBase2.y + " Z";

      svg.appendChild(svgEl("path", {
        d: needlePath, fill: needleColor, opacity: "0.9"
      }));

      /* Needle center cap */
      svg.appendChild(svgEl("circle", {
        cx: CX, cy: CY, r: "7",
        fill: needleColor, stroke: innerFill, "stroke-width": "1.5"
      }));
    }

    /* Active glow dot on arc */
    if (currentValue !== null && Number.isFinite(currentValue)) {
      var glowAngle = valueToAngle(currentValue, options);
      var glowPos = polarToCart(CX, CY, TICK_R, glowAngle);
      svg.appendChild(svgEl("circle", {
        cx: glowPos.x, cy: glowPos.y, r: "4",
        fill: activeColor, opacity: "0.8"
      }));
    }
  }

  function updateCenterDisplay() {
    var center = document.getElementById("dialCenter");
    if (!center) return;

    if (!currentData || currentData.value == null) {
      center.textContent = "--";
      return;
    }

    var num = parseFloat(currentData.value);
    var precision = typeof currentData.precision === "number" ? currentData.precision : 0;
    center.textContent = Number.isFinite(num) ? num.toFixed(precision) : String(currentData.value);
  }

  function applyStyles() {
    var d = currentData || {};
    var elementEl = document.getElementById("element");
    var header = document.querySelector(".element-header");
    var titleEl = document.getElementById("elementTitle");
    var contentEl = document.querySelector(".element-content");
    var center = document.getElementById("dialCenter");

    if (!elementEl || !header || !titleEl || !contentEl) return;

    if (d.showBackground === false) {
      elementEl.style.background = "transparent";
      elementEl.style.border = "none";
    } else {
      elementEl.style.background = d.backgroundColor || "";
      elementEl.style.border = d.borderColor ? "1px solid " + d.borderColor : "";
    }

    elementEl.style.borderRadius = "8px";

    header.style.display = d.showHeader === false ? "none" : "";
    header.style.background = d.headerColor || "";
    header.style.borderBottom = d.showHeader === false ? "none" : "";

    titleEl.style.display = d.showLabel === false ? "none" : "";
    titleEl.style.fontFamily = d.labelFontFamily || "";
    titleEl.style.fontSize = numberOrNull(d.labelFontSize) !== null ? numberOrNull(d.labelFontSize) + "px" : "";
    titleEl.style.fontWeight = d.labelFontWeight || "";
    titleEl.style.fontStyle = d.labelFontStyle || "";
    titleEl.style.color = d.labelColor || "";
    titleEl.style.textAlign = "left";

    contentEl.style.padding = "10px";

    if (center) {
      var showValue = d.showValue !== false;
      center.style.display = showValue ? "" : "none";
      center.style.fontFamily = d.valueFontFamily || "";
      center.style.fontSize = numberOrNull(d.valueFontSize) !== null ? numberOrNull(d.valueFontSize) + "px" : "";
      center.style.fontWeight = d.valueFontWeight || "";
      center.style.fontStyle = d.valueFontStyle || "";
      center.style.color = d.valueColor || "";
    }
  }

  function updateDisplay(data) {
    currentData = data;
    var titleEl = document.getElementById("elementTitle");
    if (titleEl && data) {
      titleEl.textContent = data.displayName || data.name || "Variable";
    }
    updateCenterDisplay();
    buildDial();
    applyStyles();
  }

  if (window.BruControl) {
    window.BruControl.onData(updateDisplay);
  } else {
    updateDisplay({
      elementType: "globalVariable",
      id: "preview",
      name: "Set Point",
      displayName: "Set Point",
      value: "50",
      variableType: "Value",
      userControl: true,
      enabled: true,
      precision: 0,
      format: ""
    });
  }
})();
