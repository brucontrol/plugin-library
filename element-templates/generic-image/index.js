(function() {
  var imageEl = document.getElementById('image');
  if (!imageEl) return;

  function applyData(data) {
    var d = data && typeof data === 'object' ? data : {};
    var nextUrl = typeof d.image === 'string' ? d.image.trim() : '';
    if (!nextUrl) {
      imageEl.removeAttribute('src');
    } else {
      imageEl.src = nextUrl;
    }
  }

  if (window.BruControl) {
    window.BruControl.onData(applyData);
  } else {
    applyData({});
  }
})();
