/**
 * 简单页面懒加载：gallery 长图列表 / new-home 分 section 预加载
 */
(function () {
  function init() {
    if (window.__lazyImagesInit) return;
    window.__lazyImagesInit = true;

    var gallery = document.querySelector('main.gallery-scroll');
    if (gallery) {
      gallery.querySelectorAll('img').forEach(function (img, index) {
        img.decoding = 'async';
        if (index === 0) img.setAttribute('fetchpriority', 'high');
        else img.loading = 'lazy';
      });
      return;
    }

    if (document.getElementById('pageInner')) return;

    var sections = Array.prototype.slice.call(document.querySelectorAll('body > section'));
    if (sections.length < 2 || !window.SectionImageLoader) return;

    var preload = SectionImageLoader.init(sections, { radius: 1, eagerIndexes: [0] });
    preload(0);

    if (!('IntersectionObserver' in window)) {
      sections.forEach(function (_, index) {
        preload(index);
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var index = sections.indexOf(entry.target);
          if (index >= 0) preload(index);
        });
      },
      { rootMargin: '80% 0px', threshold: 0.01 }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
