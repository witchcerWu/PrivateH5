(function () {
  // Entrance animations via IntersectionObserver
  var sections = document.querySelectorAll('.section');

  var ANIM_SELECTORS = [
    '.hero__badge', '.hero__title', '.hero__desc', '.hero__tags',
    '.hero__cta', '.hero__deco-circle', '.hero__scroll-hint', '.hero__side-text',
    '.about__label', '.about__title', '.about__text', '.about__stats', '.about__right',
    '.projects__label', '.projects__title', '.projects__subtitle', '.project-card'
  ];

  sections.forEach(function (sec) {
    var found = [];
    ANIM_SELECTORS.forEach(function (sel) {
      sec.querySelectorAll(sel).forEach(function (el) {
        if (found.indexOf(el) === -1) found.push(el);
      });
    });
    var idx = 0;
    found.forEach(function (el) {
      if (el.hasAttribute('data-anim')) return;
      el.setAttribute('data-anim', 'up');
      el.style.setProperty('--d', Math.min(idx * 0.08, 0.8) + 's');
      idx++;
    });
  });

  function triggerAnim(sec) {
    if (sec.classList.contains('anim-active')) return;
    sec.classList.add('anim-active');
    var maxDelay = 0;
    sec.querySelectorAll('[data-anim]').forEach(function (el) {
      var d = parseFloat(el.style.getPropertyValue('--d')) || 0;
      if (d > maxDelay) maxDelay = d;
    });
    setTimeout(function () {
      sec.classList.add('anim-done');
    }, (maxDelay + 0.9) * 1000);
  }

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          triggerAnim(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    sections.forEach(function (sec) { observer.observe(sec); });
  } else {
    sections.forEach(triggerAnim);
  }

  // Smooth anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.getElementById(this.getAttribute('href').slice(1));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.body.classList.add('ready');
})();
