/**
 * Navigation Slider Controller + Page Transition
 * 导航胶囊滑动指示器 + 页面过渡遮罩
 *
 * 原理：
 * 1. 每个页面导航栏包含一个 .site-nav__slider 绝对定位元素
 * 2. 点击导航项时，记录当前 active 的 tab index 到 sessionStorage
 * 3. 新页面加载后，将 slider 先定位到来源 tab 位置，再动画滑到当前 active tab
 * 4. 页面离开时先显示目标页背景色遮罩，再跳转，避免闪烁
 * 5. 导航栏永远可见（不参与 opacity 动画）
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'navFromIndex';

  // 各页面对应的背景色（与各页面 html background 一致）
  var PAGE_BG_MAP = {
    0: '#FFFFFF',   // Home
    1: '#F0F0F0',   // UX Design (page1)
    2: '#FAF9FF',   // Visual Design (page2)
    3: '#000000'    // Others
  };

  // ============ 获取导航元素 ============
  function getNavItems() {
    return document.querySelectorAll('.site-nav__item');
  }

  function getSlider() {
    return document.querySelector('.site-nav__slider');
  }

  function getActiveIndex() {
    var items = getNavItems();
    for (var i = 0; i < items.length; i++) {
      if (items[i].classList.contains('site-nav__item--active')) return i;
    }
    return 0;
  }

  // ============ 定位 slider 到指定 item ============
  function positionSliderAt(slider, items, index) {
    if (!slider || !items[index]) return;
    var item = items[index];
    var parent = slider.parentElement;
    var parentRect = parent.getBoundingClientRect();
    var itemRect = item.getBoundingClientRect();

    var left = itemRect.left - parentRect.left;
    var width = itemRect.width;

    slider.style.setProperty('--slider-left', left + 'px');
    slider.style.setProperty('--slider-width', width + 'px');
  }

  // ============ 入场滑动动画 ============
  function playSliderAnimation() {
    var slider = getSlider();
    var items = getNavItems();
    if (!slider || items.length === 0) return;

    var activeIndex = getActiveIndex();
    var fromIndexStr = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);

    if (fromIndexStr !== null) {
      var fromIndex = parseInt(fromIndexStr, 10);

      // 先定位到来源 tab（无动画）
      slider.classList.remove('site-nav__slider--animated');
      positionSliderAt(slider, items, fromIndex);

      // 定位完成后显示 slider
      slider.classList.add('site-nav__slider--visible');

      // 强制 reflow 确保初始位置渲染
      void slider.offsetWidth;

      // 再加上过渡并滑到当前 active tab
      slider.classList.add('site-nav__slider--animated');
      positionSliderAt(slider, items, activeIndex);
    } else {
      // 无来源信息：直接定位到 active（无动画）
      slider.classList.remove('site-nav__slider--animated');
      positionSliderAt(slider, items, activeIndex);
      slider.classList.add('site-nav__slider--visible');
    }
  }

  // ============ 页面离开过渡 ============
  function navigateWithTransition(href, targetIndex) {
    var bgColor = PAGE_BG_MAP[targetIndex] || '#F0F0F0';

    // 创建遮罩
    var overlay = document.createElement('div');
    overlay.className = 'page-exit-overlay';
    overlay.style.background = bgColor;
    document.body.appendChild(overlay);

    // 强制 reflow 使 transition 生效
    void overlay.offsetWidth;

    // 激活遮罩
    overlay.classList.add('page-exit-overlay--active');

    // 等待遮罩动画完成后跳转
    overlay.addEventListener('transitionend', function () {
      window.location.href = href;
    });

    // 兜底：如果 transitionend 没触发，250ms 后也跳转
    setTimeout(function () {
      window.location.href = href;
    }, 280);
  }

  // ============ 点击导航项：记录来源并跳转 ============
  function initNavClick() {
    var items = getNavItems();
    var activeIndex = getActiveIndex();

    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function (e) {
        var href = this.getAttribute('href');
        var targetIndex = parseInt(this.getAttribute('data-nav-index'), 10);

        // 当前项不跳转
        if (this.classList.contains('site-nav__item--active')) {
          e.preventDefault();
          return;
        }

        e.preventDefault();

        // 记录当前 active index 作为来源
        sessionStorage.setItem(STORAGE_KEY, String(activeIndex));

        // 带过渡效果跳转
        navigateWithTransition(href, targetIndex);
      });
    }
  }

  // ============ 首页项目卡片也记录来源 ============
  function initProjectCardNav() {
    var cards = document.querySelectorAll('.project-card');
    if (cards.length === 0) return;

    var currentIndex = getActiveIndex();

    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function (e) {
        var href = this.getAttribute('href');
        if (!href) return;

        e.preventDefault();
        sessionStorage.setItem(STORAGE_KEY, String(currentIndex));

        // 判断目标页面索引
        var targetIndex = 1; // 默认 page1
        if (href.indexOf('page2') !== -1) targetIndex = 2;
        else if (href.indexOf('others') !== -1) targetIndex = 3;

        navigateWithTransition(href, targetIndex);
      });
    }
  }

  // ============ 暴露给 scroll.js 用的工具函数 ============
  window.__navSetFrom = function (index) {
    sessionStorage.setItem(STORAGE_KEY, String(index));
  };

  // 暴露带过渡的跳转（供 scroll.js 自动切换时使用）
  window.__navigateWithTransition = function (href, targetIndex) {
    navigateWithTransition(href, targetIndex);
  };

  // ============ 初始化 ============
  function init() {
    // 等字体加载完后再显示导航并定位 slider，避免 font-swap 导致缩窄
    function doInit() {
      playSliderAnimation();
      initNavClick();
      initProjectCardNav();
      // 显示导航栏
      var nav = document.querySelector('.site-nav');
      if (nav) nav.classList.add('site-nav--ready');
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(doInit);
    } else {
      doInit();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
