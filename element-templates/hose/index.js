(function () {
  /* ── State ──────────────────────────────────────────────────────── */

  var state = {
    startEndpoint: null,
    endEndpoint:   null,
    bendPoints:    [],
    focused:       false,
    activeHandle:  null,
    dragging:      false,

    tubeColor:     "#b4d2e6",
    fluidColor:    "#1e90ff",
    flowDirection: "forward",
    flowSpeed:     1.0,
    bubbleDensity: 5,
    hoseThickness: 20,
    showHandles:   true,
    showResetBtn:  true,
  };

  var anchorsRestored = false;
  var currentData     = null;

  /* ── DOM refs ───────────────────────────────────────────────────── */

  var elementEl   = document.getElementById("element");
  var svg         = document.getElementById("hoseSvg");
  var fluidPath   = document.getElementById("fluidPath");
  var tubePath    = document.getElementById("tubePath");
  var glossPath   = document.getElementById("glossPath");
  var hitPath     = document.getElementById("hitPath");
  var bubbleGroup = document.getElementById("bubbleGroup");
  var handleGroup = document.getElementById("handleGroup");
  var startHandle = document.getElementById("startHandle");
  var endHandle   = document.getElementById("endHandle");
  var resetBtn    = document.getElementById("resetBtn");

  /* ── Geometry helpers ───────────────────────────────────────────── */

  function getRect() {
    var w = svg.clientWidth  || svg.getBoundingClientRect().width;
    var h = svg.clientHeight || svg.getBoundingClientRect().height;
    return { w: w, h: h };
  }

  function clampToPerimeter(px, py, rect) {
    var w = rect.w, h = rect.h;
    if (w === 0 || h === 0) return { x: px, y: py };
    var cx = w / 2, cy = h / 2;
    var dx = px - cx, dy = py - cy;
    if (dx === 0 && dy === 0) return { x: 0, y: cy };
    var scaleX = cx > 0 ? Math.abs(dx) / cx : Infinity;
    var scaleY = cy > 0 ? Math.abs(dy) / cy : Infinity;
    var scale  = Math.max(scaleX, scaleY);
    if (scale === 0) return { x: px, y: py };
    return {
      x: Math.max(0, Math.min(w, cx + dx / scale)),
      y: Math.max(0, Math.min(h, cy + dy / scale)),
    };
  }

  function clampToBounds(px, py, rect) {
    return {
      x: Math.max(0, Math.min(rect.w, px)),
      y: Math.max(0, Math.min(rect.h, py)),
    };
  }

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pointOnSegment(p, a, b) {
    var abx = b.x - a.x, aby = b.y - a.y;
    var len2 = abx * abx + aby * aby;
    if (len2 === 0) return { dist: dist(p, a), t: 0 };
    var t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
    var proj = { x: a.x + t * abx, y: a.y + t * aby };
    return { dist: dist(p, proj), t: t, proj: proj };
  }

  /* ── Path building ──────────────────────────────────────────────── */

  function allPoints() {
    var s = state.startEndpoint || { x: 0, y: 0 };
    var e = state.endEndpoint   || { x: 0, y: 0 };
    return [s].concat(state.bendPoints, [e]);
  }

  function buildSmoothPath(pts) {
    if (pts.length < 2) return "";
    if (pts.length === 2) {
      return "M" + pts[0].x + "," + pts[0].y + " L" + pts[1].x + "," + pts[1].y;
    }
    var d = "M" + pts[0].x + "," + pts[0].y;
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i], p1 = pts[i + 1];
      var mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
      d += " Q" + p0.x + "," + p0.y + " " + mx + "," + my;
    }
    d += " T" + pts[pts.length - 1].x + "," + pts[pts.length - 1].y;
    return d;
  }

  /* ── Hit testing ────────────────────────────────────────────────── */

  function findClosestSegment(px, py) {
    var pts = allPoints();
    var best = { segIndex: -1, dist: Infinity, t: 0 };
    for (var i = 0; i < pts.length - 1; i++) {
      var r = pointOnSegment({ x: px, y: py }, pts[i], pts[i + 1]);
      if (r.dist < best.dist) {
        best = { segIndex: i, dist: r.dist, t: r.t, proj: r.proj };
      }
    }
    return best;
  }

  /* ── CSS variable application ───────────────────────────────────── */

  function applyCssVars() {
    var t = state.hoseThickness;
    elementEl.style.setProperty("--tube-color", state.tubeColor);
    elementEl.style.setProperty("--fluid-color", state.fluidColor);
    elementEl.style.setProperty("--tube-width", t + "px");
    elementEl.style.setProperty("--fluid-width", Math.round(t * 0.65) + "px");
    elementEl.style.setProperty("--hit-width", (t + 10) + "px");
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  function render() {
    if (!state.startEndpoint || !state.endEndpoint) return;
    var pts = allPoints();
    var d   = buildSmoothPath(pts);

    fluidPath.setAttribute("d", d);
    tubePath.setAttribute("d", d);
    glossPath.setAttribute("d", d);
    hitPath.setAttribute("d", d);

    startHandle.setAttribute("cx", state.startEndpoint.x);
    startHandle.setAttribute("cy", state.startEndpoint.y);
    endHandle.setAttribute("cx", state.endEndpoint.x);
    endHandle.setAttribute("cy", state.endEndpoint.y);

    var existing = handleGroup.querySelectorAll(".bend-handle");
    for (var e = 0; e < existing.length; e++) handleGroup.removeChild(existing[e]);

    for (var i = 0; i < state.bendPoints.length; i++) {
      var bp = state.bendPoints[i];
      var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("class", "handle bend-handle");
      c.setAttribute("cx", bp.x);
      c.setAttribute("cy", bp.y);
      c.setAttribute("r", "6");
      c.dataset.bendIndex = String(i);
      handleGroup.appendChild(c);
    }

    elementEl.classList.toggle("has-bends", state.bendPoints.length > 0);
    elementEl.classList.toggle("handles-on", state.showHandles);
    elementEl.classList.toggle("reset-on", state.showResetBtn);
    applyCssVars();
  }

  /* ── Focus model ────────────────────────────────────────────────── */

  function setFocused(val) {
    state.focused = val;
    elementEl.classList.toggle("focused", val);
  }

  elementEl.addEventListener("pointerdown", function () { setFocused(true); });
  document.addEventListener("pointerdown", function (e) {
    if (!elementEl.contains(e.target)) setFocused(false);
  });

  /* ── Anchor persistence ─────────────────────────────────────────── */

  function sendPatch(patch) {
    if (!window.BruControl || !window.BruControl.updateProperties) return;
    window.BruControl.updateProperties(patch);
  }

  var persistTimer = null;
  function persistAnchors() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      sendPatch({
        anchors: JSON.stringify({
          start: state.startEndpoint,
          end:   state.endEndpoint,
          bends: state.bendPoints,
        }),
      });
    }, 250);
  }

  /* ── Pointer interaction ────────────────────────────────────────── */

  function svgPoint(e) {
    var r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  handleGroup.addEventListener("pointerdown", function (e) {
    e.stopPropagation();
    setFocused(true);
    var target = e.target;
    if (target === startHandle) {
      state.activeHandle = { type: "start" };
    } else if (target === endHandle) {
      state.activeHandle = { type: "end" };
    } else if (target.classList.contains("bend-handle")) {
      state.activeHandle = { type: "bend", index: parseInt(target.dataset.bendIndex, 10) };
    } else {
      return;
    }
    state.dragging = true;
    target.classList.add("active");
    svg.setPointerCapture(e.pointerId);
  });

  svg.addEventListener("pointermove", function (e) {
    if (!state.dragging || !state.activeHandle) return;
    var p    = svgPoint(e);
    var rect = getRect();
    var h    = state.activeHandle;

    if (h.type === "start") {
      state.startEndpoint = clampToPerimeter(p.x, p.y, rect);
    } else if (h.type === "end") {
      state.endEndpoint = clampToPerimeter(p.x, p.y, rect);
    } else if (h.type === "bend") {
      state.bendPoints[h.index] = clampToBounds(p.x, p.y, rect);
    }
    render();
  });

  svg.addEventListener("pointerup", function (e) {
    if (!state.dragging) return;
    state.dragging = false;
    state.activeHandle = null;
    svg.releasePointerCapture(e.pointerId);
    var active = handleGroup.querySelector(".active");
    if (active) active.classList.remove("active");
    persistAnchors();
  });

  /* ── Segment click → add bend point ─────────────────────────────── */

  hitPath.addEventListener("pointerdown", function (e) {
    if (state.dragging) return;
    e.stopPropagation();
    setFocused(true);
    var p   = svgPoint(e);
    var seg = findClosestSegment(p.x, p.y);
    if (seg.segIndex < 0) return;

    state.bendPoints.splice(seg.segIndex, 0, { x: p.x, y: p.y });
    state.activeHandle = { type: "bend", index: seg.segIndex };
    state.dragging = true;
    svg.setPointerCapture(e.pointerId);
    render();
  });

  /* ── Double-click bend handle → remove ──────────────────────────── */

  handleGroup.addEventListener("dblclick", function (e) {
    var target = e.target;
    if (!target.classList.contains("bend-handle")) return;
    var idx = parseInt(target.dataset.bendIndex, 10);
    if (idx >= 0 && idx < state.bendPoints.length) {
      state.bendPoints.splice(idx, 1);
      render();
      persistAnchors();
    }
  });

  /* ── Reset button ───────────────────────────────────────────────── */

  resetBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    state.bendPoints = [];
    render();
    persistAnchors();
  });

  /* ── Keyboard shortcuts ─────────────────────────────────────────── */

  document.addEventListener("keydown", function (e) {
    if (!state.focused) return;
    if (e.key === "Escape") {
      state.bendPoints = [];
      render();
      persistAnchors();
    }
  });

  /* ── Flow animation ─────────────────────────────────────────────── */

  var animOffset = 0;
  var bubbles    = [];
  var animId     = null;

  function getPathLength() {
    try { return fluidPath.getTotalLength(); } catch (_) { return 0; }
  }

  function getPointAtLength(len) {
    try { return fluidPath.getPointAtLength(len); } catch (_) { return { x: 0, y: 0 }; }
  }

  function initBubbles() {
    bubbles = [];
    bubbleGroup.innerHTML = "";
    var count = Math.max(0, Math.min(20, state.bubbleDensity));
    if (count === 0) return;
    for (var i = 0; i < count; i++) {
      var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      var r = 1.0 + Math.random() * 2.2;
      c.setAttribute("r", String(r));
      c.setAttribute("cx", "0");
      c.setAttribute("cy", "0");
      c.setAttribute("fill", "rgba(255, 255, 255, 0.7)");
      c.setAttribute("stroke", "rgba(0, 100, 200, 0.3)");
      c.setAttribute("stroke-width", "0.5");
      c.style.opacity = String(0.4 + Math.random() * 0.4);
      bubbleGroup.appendChild(c);
      bubbles.push({ el: c, phase: Math.random(), radius: r, wobble: (Math.random() - 0.5) * 3 });
    }
  }

  function animateFrame() {
    var totalLen = getPathLength();
    if (totalLen <= 0) { animId = requestAnimationFrame(animateFrame); return; }

    var speed = state.flowSpeed;
    var dir   = state.flowDirection === "reverse" ? -1 : 1;
    animOffset += speed * dir * 1.2;

    var dashCycle = 6 + 14;
    elementEl.style.setProperty("--fluid-offset", String(animOffset % (dashCycle * 4)));

    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      var t = ((b.phase + animOffset * 0.003 * dir) % 1 + 1) % 1;
      var pt = getPointAtLength(t * totalLen);
      b.el.setAttribute("cx", String(pt.x + b.wobble));
      b.el.setAttribute("cy", String(pt.y + b.wobble * 0.5));
    }

    animId = requestAnimationFrame(animateFrame);
  }

  function startAnimation() {
    if (animId) return;
    initBubbles();
    animId = requestAnimationFrame(animateFrame);
  }

  function stopAnimation() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
  }

  /* ── Data binding ───────────────────────────────────────────────── */

  function onDataReceived(data) {
    if (!data) return;
    currentData = data;
    var d = data;

    state.tubeColor     = d.tubeColor     || "#b4d2e6";
    state.fluidColor    = d.fluidColor    || "#1e90ff";
    state.flowDirection = d.flowDirection  || "forward";
    state.flowSpeed     = typeof d.flowSpeed     === "number" ? d.flowSpeed     : 1.0;
    state.bubbleDensity = typeof d.bubbleDensity === "number" ? d.bubbleDensity : 5;
    state.hoseThickness = typeof d.hoseThickness === "number" ? d.hoseThickness : 20;
    state.showHandles   = d.showHandles  !== false;
    state.showResetBtn  = d.showResetBtn !== false;

    if (!state.dragging && d.anchors && typeof d.anchors === "string" && d.anchors.length > 0) {
      try {
        var parsed = JSON.parse(d.anchors);
        if (parsed && parsed.start) state.startEndpoint = parsed.start;
        if (parsed && parsed.end)   state.endEndpoint   = parsed.end;
        if (parsed && Array.isArray(parsed.bends)) state.bendPoints = parsed.bends;
        anchorsRestored = true;
      } catch (_) { /* malformed JSON — keep current state */ }
    }

    stopAnimation();

    if (!state.startEndpoint || !state.endEndpoint) {
      initEndpoints();
    }

    render();
    startAnimation();
  }

  /* ── Init ────────────────────────────────────────────────────────── */

  var isPreview = false;

  function initEndpoints() {
    if (anchorsRestored && state.startEndpoint && state.endEndpoint) return true;
    var rect = getRect();
    if (rect.w < 2 || rect.h < 2) return false;
    var pad = 10;
    if (!state.startEndpoint) {
      state.startEndpoint = { x: pad, y: rect.h / 2 };
    }
    if (!state.endEndpoint) {
      state.endEndpoint = { x: rect.w - pad, y: rect.h / 2 };
    }

    if (isPreview) {
      var w = rect.w, h = rect.h;
      state.startEndpoint = { x: pad, y: h * 0.75 };
      state.endEndpoint   = { x: w - pad, y: h * 0.25 };
      state.bendPoints = [
        { x: w * 0.30, y: h * 0.20 },
        { x: w * 0.55, y: h * 0.80 },
        { x: w * 0.78, y: h * 0.35 },
      ];
    }
    return true;
  }

  function init() {
    if (initEndpoints()) {
      render();
      startAnimation();
      return;
    }
    var attempts = 0;
    var poll = setInterval(function () {
      attempts++;
      if (initEndpoints() || attempts > 30) {
        clearInterval(poll);
        render();
        startAnimation();
      }
    }, 50);
  }

  /* ── BruControl SDK wiring ──────────────────────────────────────── */

  if (window.BruControl) {
    if (window.BruControl.getData) {
      try {
        var initial = window.BruControl.getData();
        if (initial) onDataReceived(initial);
      } catch (_) { /* ignore */ }
    }

    window.BruControl.onData(onDataReceived);
  } else {
    isPreview = true;
    onDataReceived({
      tubeColor:     "#90c0dd",
      fluidColor:    "#1a85ff",
      flowDirection: "forward",
      flowSpeed:     1.2,
      bubbleDensity: 8,
      hoseThickness: 20,
      showHandles:   true,
      showResetBtn:  true,
    });
  }

  /* ── Resize handling ────────────────────────────────────────────── */

  var resizeTimer = null;
  new ResizeObserver(function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var rect = getRect();
      if (rect.w < 2 || rect.h < 2) return;
      if (state.startEndpoint) {
        state.startEndpoint = clampToPerimeter(state.startEndpoint.x, state.startEndpoint.y, rect);
      }
      if (state.endEndpoint) {
        state.endEndpoint = clampToPerimeter(state.endEndpoint.x, state.endEndpoint.y, rect);
      }
      for (var i = 0; i < state.bendPoints.length; i++) {
        state.bendPoints[i] = clampToBounds(state.bendPoints[i].x, state.bendPoints[i].y, rect);
      }
      render();
    }, 60);
  }).observe(elementEl);

  init();
})();
