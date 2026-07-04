/**
 * 分屏图片预加载：非当前屏图片 defer 到 data-src，仅加载当前屏 ±radius。
 */
(function (global) {
  function loadImage(img) {
    if (img.dataset.loaded === '1') return;
    var src = img.dataset.src || img.getAttribute('src');
    if (!src) return;
    img.src = src;
    img.dataset.loaded = '1';
    delete img.dataset.src;
  }

  function deferImage(img) {
    if (img.dataset.src || img.dataset.loaded === '1') return;
    var src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) return;
    img.dataset.src = src;
    img.removeAttribute('src');
    img.decoding = 'async';
  }

  /**
   * @param {HTMLElement[]} sections
   * @param {{ radius?: number, eagerIndexes?: number[] }} options
   * @returns {(centerIndex: number) => void}
   */
  function init(sections, options) {
    options = options || {};
    var radius = options.radius != null ? options.radius : 1;
    var eagerSet = {};
    (options.eagerIndexes || [0]).forEach(function (i) {
      eagerSet[i] = true;
    });

    sections.forEach(function (section, index) {
      var imgs = section.querySelectorAll('img');
      imgs.forEach(function (img, imgIndex) {
        img.decoding = 'async';
        if (eagerSet[index]) {
          if (index === 0 && imgIndex < 5) {
            img.setAttribute('fetchpriority', 'high');
          }
          loadImage(img);
        } else {
          deferImage(img);
        }
      });
    });

    return function preload(centerIndex) {
      for (var d = -radius; d <= radius; d++) {
        var idx = centerIndex + d;
        if (idx < 0 || idx >= sections.length) continue;
        sections[idx].querySelectorAll('img[data-src]').forEach(loadImage);
      }
    };
  }

  global.SectionImageLoader = {
    init: init,
    loadImage: loadImage,
    deferImage: deferImage,
  };
})(window);
