BruControl.onData(function(data) {
  var nameEl = document.getElementById('name');
  var widget = document.getElementById('widget');
  if (nameEl) {
    nameEl.textContent = data.displayName || data.name || 'Generic';
    if (data.textColor) nameEl.style.color = data.textColor;
  }
  if (widget) {
    if (data.backgroundColor) widget.style.background = data.backgroundColor;
  }
});
