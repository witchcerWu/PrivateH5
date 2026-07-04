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

  // 入场滑动进行中标志：滑动期间字体校正不要插手，避免打断/跳过动画
  var sliderSliding = false;

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

  // ============ 首帧定位滑块（解析期调用，先于首次绘制）============
  // 由每个页面 <nav> 之后的内联脚本立即调用，确保滑块在首帧就已定位并可见，
  // 彻底避免“滑块先消失再出现”（等到 DOMContentLoaded 才定位会晚于首帧绘制）。
  // 定位到来源 tab（无来源则定位到 active），不清除 sessionStorage，
  // 后续 playSliderAnimation 仍能读取来源并执行滑动动画。
  function paintInitialSlider() {
    var slider = getSlider();
    var items = getNavItems();
    if (!slider || items.length === 0) return;
    var activeIndex = getActiveIndex();
    var fromStr = sessionStorage.getItem(STORAGE_KEY);
    var startIndex = (fromStr !== null) ? parseInt(fromStr, 10) : activeIndex;
    if (isNaN(startIndex)) startIndex = activeIndex;
    slider.classList.remove('site-nav__slider--animated');
    positionSliderAt(slider, items, startIndex);
    slider.classList.add('site-nav__slider--visible');
    slider.dataset.painted = '1';
    if (startIndex === activeIndex) {
      // 直达/同 tab：滑块首帧就在 active 下，文字立即变黑（无滑动可等）
      if (items[activeIndex]) items[activeIndex].classList.add('is-slider-arrived');
    } else if (items[startIndex]) {
      // 切页入场：滑块首帧在来源 tab 下，来源 tab 先呈选中态(黑字)，
      // 待滑块滑走时再渐变回普通色（见 playSliderAnimation）。
      items[startIndex].classList.add('is-slider-source');
    }
  }
  window.__navPaintSlider = paintInitialSlider;

  // ============ 入场滑动动画 ============
  function playSliderAnimation() {
    var slider = getSlider();
    var items = getNavItems();
    if (!slider || items.length === 0) return;

    var activeIndex = getActiveIndex();
    var activeItem = items[activeIndex];
    var fromIndexStr = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);

    // 标记滑块已到位 → active 文字变黑
    function markArrived() {
      if (activeItem) activeItem.classList.add('is-slider-arrived');
    }

    var fromIndex = (fromIndexStr !== null) ? parseInt(fromIndexStr, 10) : NaN;

    if (!isNaN(fromIndex) && fromIndex !== activeIndex) {
      // 有真实滑动：滑块从来源滑到 active，滑到位后文字才变黑
      sliderSliding = true;

      // 先确保滑块处于来源位置（首帧通常已由 paintInitialSlider 画好，
      // 这里兜底并在字体变化时校正来源位置），此时不带过渡。
      slider.classList.remove('site-nav__slider--animated');
      positionSliderAt(slider, items, fromIndex);
      slider.classList.add('site-nav__slider--visible');

      // 关键：用双 rAF 稳定触发过渡——先让来源位置真正渲染一帧，
      // 下一帧再开启过渡并滑到 active。避免与同步样式刷新/微任务合并
      // 导致浏览器“跳过”过渡（这正是之前偶发无滑动动画的原因）。
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          slider.classList.add('site-nav__slider--animated');
          positionSliderAt(slider, items, activeIndex);

          // 滑块开始离开来源 tab：由选中态(黑)切到 deselecting，用 ease-out
          // 快速渐变回可见亮色，避免深色页面上黑字失去绿块背景时的文字闪烁。
          var srcItem = items[fromIndex];
          if (srcItem) {
            srcItem.classList.remove('is-slider-source');
            srcItem.classList.add('is-slider-deselecting');
            // 渐变结束后清理，恢复普通状态（含 hover 行为）
            setTimeout(function () {
              srcItem.classList.remove('is-slider-deselecting');
            }, 450);
          }

          // 等滑块 left 过渡结束（到位）再让文字变黑；加超时兜底
          var done = false;
          var finish = function () {
            if (done) return;
            done = true;
            sliderSliding = false;
            slider.removeEventListener('transitionend', onEnd);
            markArrived();
          };
          var onEnd = function (e) {
            if (e.propertyName && e.propertyName !== 'left') return;
            finish();
          };
          slider.addEventListener('transitionend', onEnd);
          setTimeout(finish, 700);
        });
      });
    } else {
      // 无滑动（直达/同 tab）：滑块已在 active 下，文字立即变黑
      slider.classList.remove('site-nav__slider--animated');
      positionSliderAt(slider, items, activeIndex);
      slider.classList.add('site-nav__slider--visible');
      markArrived();
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
    // 立即定位并显示滑块：不再等字体 Promise（那会把定位推到首帧绘制之后，
    // 导致滑块“先消失再出现”）。字体已在各页 <head> 预加载，度量基本准确。
    playSliderAnimation();
    initNavClick();
    initProjectCardNav();
    var nav = document.querySelector('.site-nav');
    if (nav) nav.classList.add('site-nav--ready');

    // 字体真正就绪后，把滑块重新对齐到当前 active，修正首访时字体 swap
    // 造成的轻微偏移。若此刻正在滑动，则跳过——否则会把滑块直接设到
    // active 位置，打断/跳过“从来源 tab 滑过来”的动画（缓存命中时该回调
    // 会作为微任务在绘制前立即执行，正是之前偶发无动画的元凶之一）。
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (sliderSliding) return;
        var slider = getSlider();
        var items = getNavItems();
        if (!slider || items.length === 0) return;
        positionSliderAt(slider, items, getActiveIndex());
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
