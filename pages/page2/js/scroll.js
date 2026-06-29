/**
 * Page2 全页翻页控制器（transform 版）
 *
 * 核心策略：
 * - 通过 CSS transform: translateY() 移动内容，不使用 scrollTop
 * - 17 个 section 均为 1440×1080 单屏设计，无帧切换、无屏内滚动
 * - wheel 事件永远正常触发，无光标位置依赖
 */
(function () {
  var DESIGN_W = 1440;
  var DESIGN_H = 1080;

  var wrapper = document.getElementById('pageWrapper');
  var inner = document.getElementById('pageInner');
  if (!wrapper || !inner) return;

  // ========== 响应式缩放 ==========
  function updatePageScale() {
    var scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H, 1);
    wrapper.style.setProperty('--page-scale', scale);
  }
  updatePageScale();

  var sections = inner.querySelectorAll('.section');

  // ========== 构建翻页偏移表 ==========
  var pages = [];
  var pageHeights = [];

  function buildPages() {
    pages = [];
    pageHeights = [];
    for (var i = 0; i < sections.length; i++) {
      pages.push(sections[i].offsetTop);
      pageHeights.push(sections[i].offsetHeight);
    }
  }
  buildPages();

  window.addEventListener('resize', function () {
    updatePageScale();
    buildPages();
    // 修正当前页偏移
    if (currentPage < pages.length) {
      currentOffset = pages[currentPage];
      inner.style.transform = 'translateY(' + (-currentOffset) + 'px)';
    }
  });

  // ========== 页码指示器 ==========
  var indicatorEl = document.getElementById('pageIndicator');
  var indicatorDots = [];

  function buildIndicator() {
    if (!indicatorEl) return;
    indicatorEl.innerHTML = '';
    indicatorDots = [];
    for (var i = 0; i < pages.length; i++) {
      var dot = document.createElement('button');
      dot.className = 'page-indicator__dot';
      dot.setAttribute('data-page', i + 1);
      dot.setAttribute('data-index', i);
      dot.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-index'));
        goToPage(idx);
      });
      indicatorEl.appendChild(dot);
      indicatorDots.push(dot);
    }
    updateIndicator();
  }

  function updateIndicator() {
    for (var i = 0; i < indicatorDots.length; i++) {
      if (i === currentPage) {
        indicatorDots[i].classList.add('page-indicator__dot--active');
      } else {
        indicatorDots[i].classList.remove('page-indicator__dot--active');
      }
    }
  }

  // ========== 核心状态 ==========
  var currentPage = 0;
  var isAnimating = false;
  var currentOffset = 0;

  // ========== 动画引擎 ==========
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateTo(targetOffset, duration, callback) {
    var startOffset = currentOffset;
    var distance = targetOffset - startOffset;
    if (Math.abs(distance) < 1) {
      currentOffset = targetOffset;
      inner.style.transform = 'translateY(' + (-currentOffset) + 'px)';
      isAnimating = false;
      if (callback) callback();
      return;
    }
    var startTime = null;
    var unlocked = false;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = Math.min(elapsed / duration, 1);
      currentOffset = startOffset + distance * easeOutCubic(progress);
      inner.style.transform = 'translateY(' + (-currentOffset) + 'px)';

      // 5% 时提前解锁，允许接受下一次输入
      if (!unlocked && progress >= 0.05) {
        unlocked = true;
        isAnimating = false;
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        currentOffset = targetOffset;
        inner.style.transform = 'translateY(' + (-currentOffset) + 'px)';
        isAnimating = false;
        if (callback) callback();
      }
    }

    requestAnimationFrame(step);
  }

  // ========== 翻页逻辑 ==========
  function goNext() {
    if (isAnimating) return false;
    var nextPage = currentPage + 1;
    if (nextPage >= pages.length) return false;
    isAnimating = true;
    currentPage = nextPage;
    triggerSectionAnim(currentPage);
    updateIndicator();
    animateTo(pages[currentPage], 500);
  }

  function goPrev() {
    if (isAnimating) return false;
    var prevPage = currentPage - 1;
    if (prevPage < 0) return false;
    isAnimating = true;
    currentPage = prevPage;
    triggerSectionAnim(currentPage);
    updateIndicator();
    animateTo(pages[currentPage], 500);
  }

  // ========== 跳转到指定页 ==========
  function goToPage(targetPage) {
    if (isAnimating || targetPage === currentPage || targetPage < 0 || targetPage >= pages.length) return;
    isAnimating = true;
    currentPage = targetPage;
    triggerSectionAnim(currentPage);
    updateIndicator();
    animateTo(pages[currentPage], 500);
  }

  // ========== 滚轮事件（累积量触发 + scroll-alive） ==========
  // macOS 触控板策略：
  // 1. html 保持可滚动（10000px 空间），wheel 事件永远不断
  // 2. 不做每帧归位，scrollTop 自然漂移，仅在接近边缘时重置
  // 3. 通过 deltaY 累积量判断「新手势」：
  //    - 动量尾巴 deltaY 很小且递减，累积很慢，不会误触发
  //    - 新手势 deltaY 大，快速达到阈值，立即翻页
  var htmlEl = document.documentElement;
  var SCROLL_CENTER = 5000;
  htmlEl.scrollTop = SCROLL_CENTER;

  // 空闲时才归位（300ms 无事件），避免打扰活跃手势
  var idleResetTimer = null;
  function scheduleIdleReset() {
    clearTimeout(idleResetTimer);
    idleResetTimer = setTimeout(function () {
      htmlEl.scrollTop = SCROLL_CENTER;
    }, 300);
  }

  // 边缘保护：在 wheel 事件中检测
  function checkEdge() {
    var st = htmlEl.scrollTop;
    if (st < 1000 || st > 9000) {
      htmlEl.scrollTop = SCROLL_CENTER;
    }
  }

  // 累积式翻页检测
  var accumulated = 0;
  var FLIP_THRESHOLD = 120;
  var lastWheelTime = 0;
  var lastAbsDelta = 0;
  var waitingForNewGesture = false;
  var decayCount = 0;

  document.addEventListener('wheel', function (e) {
    var now = Date.now();
    var absDelta = Math.abs(e.deltaY);

    // 超过 200ms 没有事件 = 新手势开始
    if (now - lastWheelTime > 200) {
      accumulated = 0;
      waitingForNewGesture = false;
      decayCount = 0;
    }
    lastWheelTime = now;
    scheduleIdleReset();
    checkEdge();

    // 动画中：吃掉事件，不累积
    if (isAnimating) {
      accumulated = 0;
      lastAbsDelta = absDelta;
      return;
    }

    // 方向反转 = 明确的新意图，直接清除等待状态
    var directionChanged = (accumulated > 0 && e.deltaY < 0) || (accumulated < 0 && e.deltaY > 0);
    if (directionChanged) {
      accumulated = 0;
      waitingForNewGesture = false;
      decayCount = 0;
    }

    // 翻页后等待新手势：通过检测加速来判断是否是新的真实手势
    if (waitingForNewGesture) {
      if (absDelta <= lastAbsDelta) {
        decayCount++;
        lastAbsDelta = absDelta;
        return;
      } else if (decayCount >= 3 && absDelta > lastAbsDelta * 1.5) {
        waitingForNewGesture = false;
        decayCount = 0;
        accumulated = 0;
      } else {
        lastAbsDelta = absDelta;
        return;
      }
    }

    lastAbsDelta = absDelta;
    accumulated += e.deltaY;

    if (accumulated >= FLIP_THRESHOLD) {
      accumulated = 0;
      if (goNext() !== false) {
        waitingForNewGesture = true;
        decayCount = 0;
      }
    } else if (accumulated <= -FLIP_THRESHOLD) {
      accumulated = 0;
      if (goPrev() !== false) {
        waitingForNewGesture = true;
        decayCount = 0;
      }
    }
  }, { passive: true });

  // ========== 触摸事件 ==========
  var touchStartY = 0;
  var touchMoved = false;

  wrapper.addEventListener('touchstart', function (e) {
    touchStartY = e.touches[0].clientY;
    touchMoved = false;
  }, { passive: true });

  wrapper.addEventListener('touchmove', function (e) {
    touchMoved = true;
    e.preventDefault();
  }, { passive: false });

  wrapper.addEventListener('touchend', function (e) {
    if (isAnimating || !touchMoved) return;
    var diff = touchStartY - e.changedTouches[0].clientY;

    if (diff > 50) {
      goNext();
    } else if (diff < -50) {
      goPrev();
    }
  }, { passive: true });

  // ========== 键盘支持 ==========
  document.addEventListener('keydown', function (e) {
    if (isAnimating) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      goNext();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      goPrev();
    }
  });

  // ========== 入场动画系统 ==========
  var animatedSections = {};

  function triggerSectionAnim(pageIdx) {
    if (animatedSections[pageIdx]) return;
    animatedSections[pageIdx] = true;
    var sec = sections[pageIdx];
    if (!sec) return;
    sec.classList.add('anim-active');
    var animEls = sec.querySelectorAll('[data-anim]');
    var maxDelay = 0;
    for (var i = 0; i < animEls.length; i++) {
      var d = parseFloat(animEls[i].style.getPropertyValue('--d')) || 0;
      if (d > maxDelay) maxDelay = d;
    }
    setTimeout(function () {
      sec.classList.add('anim-done');
    }, (maxDelay + 0.9) * 1000);
  }

  // 首屏立即触发动画
  setTimeout(function () {
    triggerSectionAnim(0);
  }, 300);

  // 初始化指示器
  buildIndicator();
  document.body.classList.add('ready');
})();
