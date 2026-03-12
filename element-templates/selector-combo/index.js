(function () {
  var currentData = null;
  var selectedValue = "";
  var focusedIndex = -1;
  var isOpen = false;

  var selectEl = document.getElementById("customSelect");
  var triggerEl = document.getElementById("selectTrigger");
  var valueEl = document.getElementById("selectValue");
  var dropdownEl = document.getElementById("selectDropdown");

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function getOptions() {
    var d = currentData || {};
    if (Array.isArray(d.selectOptions) && d.selectOptions.length > 0) {
      return d.selectOptions.map(function (v) { return String(v); });
    }
    return ["Option 1", "Option 2", "Option 3"];
  }

  /* ── Open / close ── */
  function positionDropdown() {
    if (!triggerEl || !dropdownEl) return;
    var rect = triggerEl.getBoundingClientRect();
    var viewH = window.innerHeight;
    var pad = 4;
    var spaceBelow = viewH - rect.bottom - pad;
    var spaceAbove = rect.top - pad;

    /* Measure natural height of the dropdown content */
    dropdownEl.style.maxHeight = "none";
    dropdownEl.style.visibility = "hidden";
    dropdownEl.style.display = "block";
    var naturalH = dropdownEl.scrollHeight;
    dropdownEl.style.visibility = "";

    var openBelow = spaceBelow >= naturalH || spaceBelow >= spaceAbove;
    var maxH = openBelow ? Math.min(spaceBelow, 220) : Math.min(spaceAbove, 220);
    /* Ensure at least one option row is visible */
    if (maxH < 36) maxH = 36;

    dropdownEl.style.left = rect.left + "px";
    dropdownEl.style.width = rect.width + "px";
    dropdownEl.style.maxHeight = maxH + "px";

    if (openBelow) {
      dropdownEl.style.top = rect.bottom + "px";
      dropdownEl.style.bottom = "auto";
      dropdownEl.style.borderRadius = "0 0 6px 6px";
      dropdownEl.style.borderTop = "none";
      triggerEl.style.borderRadius = "6px 6px 0 0";
    } else {
      dropdownEl.style.top = "auto";
      dropdownEl.style.bottom = (viewH - rect.top) + "px";
      dropdownEl.style.borderRadius = "6px 6px 0 0";
      dropdownEl.style.borderBottom = "none";
      triggerEl.style.borderRadius = "0 0 6px 6px";
    }
  }

  function openDropdown() {
    if (isOpen || !selectEl) return;
    isOpen = true;
    selectEl.classList.add("open");
    positionDropdown();
    var options = getOptions();
    focusedIndex = options.indexOf(selectedValue);
    if (focusedIndex < 0) focusedIndex = 0;
    updateFocusedOption();
    scrollToFocused();
  }

  function closeDropdown() {
    if (!isOpen || !selectEl) return;
    isOpen = false;
    selectEl.classList.remove("open");
    focusedIndex = -1;
    /* Reset trigger border-radius */
    if (triggerEl) triggerEl.style.borderRadius = "";
    /* Clear all inline styles set by positionDropdown so CSS display:none takes over */
    if (dropdownEl) {
      dropdownEl.style.display = "";
      dropdownEl.style.top = "";
      dropdownEl.style.bottom = "";
      dropdownEl.style.left = "";
      dropdownEl.style.width = "";
      dropdownEl.style.maxHeight = "";
      dropdownEl.style.borderRadius = "";
      dropdownEl.style.borderTop = "";
      dropdownEl.style.borderBottom = "";
    }
  }

  function toggleDropdown() {
    if (isOpen) closeDropdown(); else openDropdown();
  }

  /* ── Select a value ── */
  function selectOption(value) {
    selectedValue = value;
    if (valueEl) valueEl.textContent = value || "--";
    markSelected();
    closeDropdown();
    if (window.BruControl && currentData) {
      window.BruControl.updateProperties({ value: value });
    }
  }

  /* ── Build option elements ── */
  function rebuildOptions() {
    if (!dropdownEl) return;
    var options = getOptions();
    dropdownEl.innerHTML = "";

    for (var i = 0; i < options.length; i++) {
      var div = document.createElement("div");
      div.className = "custom-select-option";
      div.setAttribute("data-value", options[i]);
      div.textContent = options[i];
      (function (val, idx) {
        div.addEventListener("click", function (e) {
          e.stopPropagation();
          selectOption(val);
        });
        div.addEventListener("mouseenter", function () {
          focusedIndex = idx;
          updateFocusedOption();
        });
      })(options[i], i);
      dropdownEl.appendChild(div);
    }

    markSelected();
  }

  function markSelected() {
    if (!dropdownEl) return;
    var items = dropdownEl.children;
    for (var i = 0; i < items.length; i++) {
      if (items[i].getAttribute("data-value") === selectedValue) {
        items[i].classList.add("selected");
      } else {
        items[i].classList.remove("selected");
      }
    }
  }

  function updateFocusedOption() {
    if (!dropdownEl) return;
    var items = dropdownEl.children;
    for (var i = 0; i < items.length; i++) {
      if (i === focusedIndex) {
        items[i].classList.add("focused");
      } else {
        items[i].classList.remove("focused");
      }
    }
  }

  function scrollToFocused() {
    if (!dropdownEl || focusedIndex < 0) return;
    var item = dropdownEl.children[focusedIndex];
    if (item) item.scrollIntoView({ block: "nearest" });
  }

  /* ── Appearance ── */
  function applyStyles() {
    var d = currentData || {};
    var elementEl = document.getElementById("element");
    var header = document.querySelector(".element-header");
    var titleEl = document.getElementById("elementTitle");
    var contentEl = document.querySelector(".element-content");

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

    if (triggerEl) {
      triggerEl.style.fontFamily = d.valueFontFamily || "";
      triggerEl.style.fontSize = numberOrNull(d.valueFontSize) !== null ? numberOrNull(d.valueFontSize) + "px" : "";
      triggerEl.style.fontWeight = d.valueFontWeight || "";
      triggerEl.style.fontStyle = d.valueFontStyle || "";
      triggerEl.style.color = d.valueColor || "var(--accent-green, #4ec9b0)";
    }
  }

  /* ── Data updates ── */
  function updateDisplay(data) {
    currentData = data;
    var titleEl = document.getElementById("elementTitle");
    if (!titleEl || !data) return;

    titleEl.textContent = data.displayName || data.name || "Variable";
    selectedValue = String(data.value ?? "");
    if (valueEl) valueEl.textContent = selectedValue || "--";
    if (triggerEl) triggerEl.disabled = false;
    rebuildOptions();
    markSelected();
    applyStyles();
  }

  /* ── Event listeners ── */
  if (triggerEl) {
    triggerEl.addEventListener("click", function (e) {
      e.stopPropagation();
      if (triggerEl.disabled) return;
      toggleDropdown();
    });
  }

  document.addEventListener("click", function () {
    closeDropdown();
  });

  if (selectEl) {
    selectEl.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (!isOpen) {
      if ((e.key === "Enter" || e.key === " " || e.key === "ArrowDown") &&
          document.activeElement === triggerEl && !triggerEl.disabled) {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    var options = getOptions();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, options.length - 1);
      updateFocusedOption();
      scrollToFocused();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
      updateFocusedOption();
      scrollToFocused();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < options.length) {
        selectOption(options[focusedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
      if (triggerEl) triggerEl.focus();
    }
  });

  /* ── Init ── */
  if (window.BruControl) {
    window.BruControl.onData(updateDisplay);
  } else {
    updateDisplay({
      elementType: "globalVariable",
      id: "preview",
      name: "Mode",
      displayName: "Mode",
      value: "Option 1",
      variableType: "String",
      userControl: true,
      enabled: true,
      precision: 0,
      format: ""
    });
  }
})();
