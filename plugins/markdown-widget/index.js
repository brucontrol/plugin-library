(function () {
  var titleEl = document.getElementById('widgetTitle');
  var viewEl = document.getElementById('markdownView');
  var editEl = document.getElementById('markdownEdit');
  var toggleBtn = document.getElementById('modeToggle');
  var editIcon = document.getElementById('editIcon');
  var viewIcon = document.getElementById('viewIcon');
  var widget = document.getElementById('widget');

  var isEditing = false;
  var currentData = null;

  function parseMarkdown(src) {
    if (typeof marked !== 'undefined' && marked.parse) {
      var raw = marked.parse(src || '', { breaks: true, gfm: true });
      if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
        return DOMPurify.sanitize(raw);
      }
      return raw;
    }
    var el = document.createElement('pre');
    el.textContent = src || '';
    return el.outerHTML;
  }

  function getContent() {
    return (currentData && currentData.markdownContent) || '';
  }

  function renderView() {
    var content = getContent();
    if (!content.trim()) {
      viewEl.innerHTML = '<p class="placeholder">No content yet. Click the edit button to add markdown.</p>';
    } else {
      viewEl.innerHTML = parseMarkdown(content);
    }
  }

  function enterEditMode() {
    isEditing = true;
    editEl.value = getContent();
    viewEl.style.display = 'none';
    editEl.style.display = 'block';
    editIcon.style.display = 'none';
    viewIcon.style.display = 'block';
    toggleBtn.title = 'Save and preview';
    toggleBtn.classList.add('mode-toggle--active');
    editEl.focus();
  }

  function saveContent() {
    var newContent = editEl.value;
    if (currentData) {
      currentData.markdownContent = newContent;
    }
    if (window.BruControl && window.BruControl.updateProperties) {
      window.BruControl.updateProperties({ markdownContent: newContent });
    }
  }

  function exitEditMode() {
    isEditing = false;
    saveContent();
    viewEl.style.display = 'block';
    editEl.style.display = 'none';
    editIcon.style.display = 'block';
    viewIcon.style.display = 'none';
    toggleBtn.title = 'Edit markdown';
    toggleBtn.classList.remove('mode-toggle--active');
    renderView();
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      if (isEditing) {
        exitEditMode();
      } else {
        enterEditMode();
      }
    });
  }

  if (editEl) {
    editEl.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var start = editEl.selectionStart;
        var end = editEl.selectionEnd;
        editEl.value = editEl.value.substring(0, start) + '  ' + editEl.value.substring(end);
        editEl.selectionStart = editEl.selectionEnd = start + 2;
      }
      if (e.key === 'Escape') {
        exitEditMode();
      }
    });
  }

  function applyStyles() {
    var d = currentData || {};

    if (widget && d.backgroundColor) {
      widget.style.background = d.backgroundColor;
    }

    if (viewEl && d.textColor) {
      viewEl.style.color = d.textColor;
    }

    if (titleEl) {
      if (d.textColor) titleEl.style.color = d.textColor;
      titleEl.textContent = d.displayName || d.name || 'Markdown';
    }

    if (toggleBtn) {
      toggleBtn.style.display = d.showEditButton === false ? 'none' : '';
    }
  }

  function render(data) {
    currentData = data || {};
    applyStyles();
    if (!isEditing) {
      renderView();
    }
  }

  function getPreviewData() {
    return {
      elementType: 'generic',
      name: 'Markdown',
      displayName: 'Markdown',
      markdownContent:
        '# Hello World\n\n' +
        'This is a **markdown** widget with _rich text_ support.\n\n' +
        '## Features\n\n' +
        '- Headings, bold, italic\n' +
        '- Ordered and unordered lists\n' +
        '- [Links](https://example.com)\n' +
        '- `inline code` and code blocks\n' +
        '- Blockquotes and tables\n\n' +
        '> Click the pencil icon to edit.\n\n' +
        '| Column A | Column B |\n' +
        '|----------|----------|\n' +
        '| Cell 1   | Cell 2   |\n' +
        '| Cell 3   | Cell 4   |'
    };
  }

  if (window.BruControl) {
    if (window.BruControl.getData) {
      try {
        var initial = window.BruControl.getData();
        if (initial) render(initial);
      } catch (e) {}
    }
    window.BruControl.onData(render);
  } else {
    render(getPreviewData());
  }
})();
