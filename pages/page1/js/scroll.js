/**
 * 全页翻页控制器（transform 版）
 *
 * 核心策略：
 * - 通过 CSS transform: translateY() 移动内容，不使用 scrollTop
 * - s5 作为单页，帧切换通过内部状态控制（不依赖滚动距离）
 * - wheel 事件永远正常触发，无光标位置依赖
 */
(function () {
  const DESIGN_W = 1440;
  const DESIGN_H = 1080;

  const wrapper = document.getElementById('pageWrapper');
  const inner = document.getElementById('pageInner');
  if (!wrapper || !inner) return;

  function updatePageScale() {
    var scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H, 1);
    wrapper.style.setProperty('--page-scale', scale);
  }
  updatePageScale();

  const sections = inner.querySelectorAll('.section');
  let preloadSectionImages = null;
  if (window.SectionImageLoader) {
    preloadSectionImages = SectionImageLoader.init(Array.from(sections), {
      radius: 1,
      eagerIndexes: [0],
    });
  }
  const s5 = document.getElementById('s5');
  const s5Frames = s5 ? s5.querySelectorAll('.s5__frame') : [];
  const s5Dots = s5 ? s5.querySelectorAll('.s5__dot') : [];

  const s7 = document.getElementById('s7');
  const s7Frames = s7 ? s7.querySelectorAll('.s7__frame') : [];
  const s7Dots = s7 ? s7.querySelectorAll('.s7__dot') : [];

  const s11 = document.getElementById('s11');
  const s11Frames = s11 ? s11.querySelectorAll('.s11__frame') : [];
  const s11Dots = s11 ? s11.querySelectorAll('.s11__dot') : [];

  const s14 = document.getElementById('s14');
  const s14Frames = s14 ? s14.querySelectorAll('.s14__frame') : [];

  // 构建翻页点（每个 section 一个点，s5/s7/s11 也只有一个）
  let pages = [];
  let pageHeights = []; // 每个 section 的实际高度
  let s5PageIndex = -1; // s5 在 pages 中的索引
  let s7PageIndex = -1; // s7 在 pages 中的索引
  let s11PageIndex = -1; // s11 在 pages 中的索引
  let s14PageIndex = -1; // s14 在 pages 中的索引
  function buildPages() {
    pages = [];
    pageHeights = [];
    sections.forEach((sec, i) => {
      if (sec === s5) s5PageIndex = pages.length;
      if (sec === s7) s7PageIndex = pages.length;
      if (sec === s11) s11PageIndex = pages.length;
      if (sec === s14) s14PageIndex = pages.length;
      pages.push(sec.offsetTop);
      pageHeights.push(sec.offsetHeight);
    });
  }

  buildPages();
  window.addEventListener('resize', function () {
    updatePageScale();
    buildPages();
  });

  // ========== 页码指示器 ==========
  const indicatorEl = document.getElementById('pageIndicator');
  let indicatorDots = [];
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
    indicatorDots.forEach(function (dot, i) {
      dot.classList.toggle('page-indicator__dot--active', i === currentPage);
    });
  }

  let currentPage = 0;
  let isAnimating = false;
  let currentOffset = 0;
  let intraOffset = 0; // 屏内滚动偏移（相对于 section 顶部）

  function getViewportHeight() {
    return wrapper.offsetHeight;
  }

  // 获取当前 section 的最大屏内可滚动距离
  var INTRA_SCROLL_MIN = 50; // 差距小于此值不做屏内滚动，直接翻页
  function getMaxIntraScroll(pageIdx) {
    var vh = getViewportHeight();
    var sectionH = pageHeights[pageIdx] || 0;
    var diff = sectionH - vh;
    return diff > INTRA_SCROLL_MIN ? diff : 0;
  }

  // 判断是否为帧切换 section（不需要屏内滚动）
  function isFrameSection(pageIdx) {
    return pageIdx === s5PageIndex || pageIdx === s7PageIndex || pageIdx === s11PageIndex || pageIdx === s14PageIndex;
  }

  // 屏内滚动步长（每次滚动的距离）
  var INTRA_SCROLL_STEP_RATIO = 0.75; // 视口高度的 75%

  // s5 帧状态
  let s5Frame = 0;
  const S5_TOTAL_FRAMES = s5Frames.length || 3;

  // s7 帧状态
  let s7Frame = 0;
  const S7_TOTAL_FRAMES = s7Frames.length || 2;

  // s11 帧状态
  let s11Frame = 0;
  const S10_TOTAL_FRAMES = s11Frames.length || 3;

  // s14 帧状态
  let s14Frame = 0;
  const S14_TOTAL_FRAMES = s14Frames.length || 2;

  // ========== 动画引擎 ==========
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateTo(targetOffset, duration, callback) {
    const startOffset = currentOffset;
    const distance = targetOffset - startOffset;
    if (Math.abs(distance) < 1) {
      currentOffset = targetOffset;
      inner.style.transform = 'translateY(' + (-currentOffset) + 'px)';
      isAnimating = false;
      if (callback) callback();
      return;
    }
    let startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      currentOffset = startOffset + distance * easeOutCubic(progress);
      inner.style.transform = 'translateY(' + (-currentOffset) + 'px)';

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

  // ========== S5 帧切换 ==========
  function switchS5Frame(index) {
    s5Frame = index;
    s5Frames.forEach(function (f, i) {
      f.classList.remove('s5__frame--active', 's5__frame--below');
      if (i === index) {
        f.classList.add('s5__frame--active');
      } else if (i < index) {
        f.classList.add('s5__frame--below');
      }
    });
    s5Dots.forEach(function (d, i) {
      d.classList.toggle('s5__dot--active', i === index);
    });
  }

  // ========== S7 帧切换 ==========
  function switchS7Frame(index) {
    s7Frame = index;
    s7Frames.forEach(function (f, i) {
      f.classList.remove('s7__frame--active');
      if (i === index) {
        f.classList.add('s7__frame--active');
      }
    });
    s7Dots.forEach(function (d, i) {
      d.classList.toggle('s7__dot--active', i === index);
    });
  }

  // ========== S14 帧切换 ==========
  function switchS14Frame(index) {
    s14Frame = index;
    s14Frames.forEach(function (f, i) {
      f.classList.remove('s14__frame--active');
      if (i === index) {
        f.classList.add('s14__frame--active');
      }
    });
  }

  // ========== S10 帧切换 ==========
  function switchS10Frame(index) {
    s11Frame = index;
    s11Frames.forEach(function (f, i) {
      f.classList.remove('s11__frame--active', 's11__frame--below');
      if (i === index) {
        f.classList.add('s11__frame--active');
      } else if (i < index) {
        f.classList.add('s11__frame--below');
      }
    });
    s11Dots.forEach(function (d, i) {
      d.classList.toggle('s11__dot--active', i === index);
    });
  }

  // ========== 翻页逻辑 ==========
  function goNext() {
    if (isAnimating) return false;

    // 在 s5 页面：先切换帧
    if (currentPage === s5PageIndex && s5Frame < S5_TOTAL_FRAMES - 1) {
      isAnimating = true;
      switchS5Frame(s5Frame + 1);
      setTimeout(function () { isAnimating = false; }, 300);
      return;
    }

    // 在 s7 页面：先切换帧
    if (currentPage === s7PageIndex && s7Frame < S7_TOTAL_FRAMES - 1) {
      isAnimating = true;
      switchS7Frame(s7Frame + 1);
      setTimeout(function () { isAnimating = false; }, 500);
      return;
    }

    // 在 s11 页面：先切换帧
    if (currentPage === s11PageIndex && s11Frame < S10_TOTAL_FRAMES - 1) {
      isAnimating = true;
      switchS10Frame(s11Frame + 1);
      setTimeout(function () { isAnimating = false; }, 300);
      return;
    }

    // 在 s14 页面：先切换帧
    if (currentPage === s14PageIndex && s14Frame < S14_TOTAL_FRAMES - 1) {
      isAnimating = true;
      switchS14Frame(s14Frame + 1);
      setTimeout(function () { isAnimating = false; }, 500);
      return;
    }

    // 非帧切换 section：如果内容超出视口，先屏内滚动
    if (!isFrameSection(currentPage)) {
      var maxIntra = getMaxIntraScroll(currentPage);
      if (maxIntra > 0 && intraOffset < maxIntra) {
        isAnimating = true;
        var step = getViewportHeight() * INTRA_SCROLL_STEP_RATIO;
        var newIntra = Math.min(intraOffset + step, maxIntra);
        intraOffset = newIntra;
        var targetOffset = pages[currentPage] + intraOffset;
        animateTo(targetOffset, 500);
        return;
      }
    }

    // 翻到下一个 section
    var nextPage = currentPage + 1;
    if (nextPage >= pages.length) {
      // 已到最后一页末尾 → 跳转到 page2（双向连续滚动）
      if (window.__navSetFrom) window.__navSetFrom(1);
      sessionStorage.setItem('projectEntryDirection', 'forward');
      if (window.__navigateWithTransition) { window.__navigateWithTransition('../page2/index.html', 2); }
      else { window.location.href = '../page2/index.html'; }
      return;
    }
    isAnimating = true;
    currentPage = nextPage;
    intraOffset = 0;
    if (preloadSectionImages) preloadSectionImages(currentPage);
    triggerSectionAnim(currentPage);

    // 如果进入 s5，重置到第一帧
    if (currentPage === s5PageIndex) {
      s5Frame = 0;
      switchS5Frame(0);
    }
    // 如果进入 s7，重置到第一帧
    if (currentPage === s7PageIndex) {
      s7Frame = 0;
      switchS7Frame(0);
    }
    // 如果进入 s11，重置到第一帧
    if (currentPage === s11PageIndex) {
      s11Frame = 0;
      switchS10Frame(0);
    }
    // 如果进入 s14，重置到第一帧
    if (currentPage === s14PageIndex) {
      s14Frame = 0;
      switchS14Frame(0);
    }
    updateIndicator();
    animateTo(pages[currentPage], 500);
  }

  function goPrev() {
    if (isAnimating) return false;

    // 在 s5 页面：先回退帧
    if (currentPage === s5PageIndex && s5Frame > 0) {
      isAnimating = true;
      switchS5Frame(s5Frame - 1);
      setTimeout(function () { isAnimating = false; }, 300);
      return;
    }

    // 在 s7 页面：先回退帧
    if (currentPage === s7PageIndex && s7Frame > 0) {
      isAnimating = true;
      switchS7Frame(s7Frame - 1);
      setTimeout(function () { isAnimating = false; }, 500);
      return;
    }

    // 在 s11 页面：先回退帧
    if (currentPage === s11PageIndex && s11Frame > 0) {
      isAnimating = true;
      switchS10Frame(s11Frame - 1);
      setTimeout(function () { isAnimating = false; }, 300);
      return;
    }

    // 在 s14 页面：先回退帧
    if (currentPage === s14PageIndex && s14Frame > 0) {
      isAnimating = true;
      switchS14Frame(s14Frame - 1);
      setTimeout(function () { isAnimating = false; }, 500);
      return;
    }

    // 非帧切换 section：如果当前有屏内偏移，先往回滚
    if (!isFrameSection(currentPage) && intraOffset > 0) {
      isAnimating = true;
      var step = getViewportHeight() * INTRA_SCROLL_STEP_RATIO;
      var newIntra = Math.max(intraOffset - step, 0);
      intraOffset = newIntra;
      var targetOffset = pages[currentPage] + intraOffset;
      animateTo(targetOffset, 500);
      return;
    }

    // 翻到上一个 section
    var prevPage = currentPage - 1;
    if (prevPage < 0) return false;
    isAnimating = true;
    currentPage = prevPage;
    if (preloadSectionImages) preloadSectionImages(currentPage);

    // 如果回到 s5，定位到最后一帧
    if (currentPage === s5PageIndex) {
      s5Frame = S5_TOTAL_FRAMES - 1;
      switchS5Frame(s5Frame);
    }
    // 如果回到 s7，定位到最后一帧
    if (currentPage === s7PageIndex) {
      s7Frame = S7_TOTAL_FRAMES - 1;
      switchS7Frame(s7Frame);
    }
    // 如果回到 s11，定位到最后一帧
    if (currentPage === s11PageIndex) {
      s11Frame = S10_TOTAL_FRAMES - 1;
      switchS10Frame(s11Frame);
    }
    // 如果回到 s14，定位到最后一帧
    if (currentPage === s14PageIndex) {
      s14Frame = S14_TOTAL_FRAMES - 1;
      switchS14Frame(s14Frame);
    }
    // 回到上一个 section 时，定位到其底部（展示最后一屏内容）
    triggerSectionAnim(currentPage);
    updateIndicator();
    var maxIntraPrev = getMaxIntraScroll(currentPage);
    if (!isFrameSection(currentPage) && maxIntraPrev > 0) {
      intraOffset = maxIntraPrev;
      animateTo(pages[currentPage] + intraOffset, 500);
    } else {
      intraOffset = 0;
      animateTo(pages[currentPage], 500);
    }
  }

  // ========== 跳转到指定页 ==========
  function goToPage(targetPage) {
    if (isAnimating || targetPage === currentPage || targetPage < 0 || targetPage >= pages.length) return;
    isAnimating = true;
    currentPage = targetPage;
    intraOffset = 0;
    if (preloadSectionImages) preloadSectionImages(currentPage);
    if (currentPage === s5PageIndex) { s5Frame = 0; switchS5Frame(0); }
    if (currentPage === s7PageIndex) { s7Frame = 0; switchS7Frame(0); }
    if (currentPage === s11PageIndex) { s11Frame = 0; switchS10Frame(0); }
    if (currentPage === s14PageIndex) { s14Frame = 0; switchS14Frame(0); }
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
  const htmlEl = document.documentElement;
  const SCROLL_CENTER = 5000;
  htmlEl.scrollTop = SCROLL_CENTER;

  // 空闲时才归位（300ms 无事件），避免打扰活跃手势
  let idleResetTimer = null;
  function scheduleIdleReset() {
    clearTimeout(idleResetTimer);
    idleResetTimer = setTimeout(function () {
      htmlEl.scrollTop = SCROLL_CENTER;
    }, 300);
  }

  // 边缘保护：在 wheel 事件中检测，不用 RAF 轮询
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
  var waitingForNewGesture = false; // 翻页后等待新手势
  var decayCount = 0; // 连续衰减计数

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
  let touchStartY = 0;
  let touchMoved = false;

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
  var ANIM_SELECTORS = [
    '.section-header',
    '.s4__header',
    '.s5__header',
    '.s6__header',
    '.s6__main-content',
    '.s6__right-col',
    '.s6b__header',
    '.s6b__left-content',
    '.s6b__right-content',
    '.s7__title-block',
    '.s9__header',
    '.s10__header',
    '.s11__header',
    '.s13__header',
    '.s15__header',
    '.s1__title-top',
    '.s1__title-bottom',
    '.s1__display',
    '.s1__deco-icon',
    '.capsule-btn',
    '.quote-block',
    '.s2__stats-bar',
    '.s2__left-deco',
    '.s3__quote-banner',
    '.s3__layer-card',
    '.s3__problem-row',
    '.s4__col-content',
    '.s4__bottom-bar',
    '.s5__bottom-info',
    '.s5__left-diagram',
    '.s6__left',
    '.s6__right',
    '.s7__left-annotation',
    '.s7__phone-center',
    '.s7__anno-row',
    '.s9__left',
    '.s9__right',
    '.s10__col-marker',
    '.s10__body',
    '.s11__col-marker',
    '.s11__phone-img',
    '.s11__frame-content',
    '.s13__subtitle-row',
    '.s13__left-content',
    '.s13__right-content',
    '.s14__header',
    '.s14__bottom-strip',
    '.s14__phone-1',
    '.s14__phone-2',
    '.s14b__header',
    '.s14b__subtitle-text',
    '.s14b__before-col',
    '.s14b__after-col',
    '.s14b__annotations',
    '.s15__carousel',
    '.phone-card'
  ];

  function initAnimElements() {
    sections.forEach(function (sec) {
      var found = [];
      ANIM_SELECTORS.forEach(function (sel) {
        var els = sec.querySelectorAll(sel);
        els.forEach(function (el) {
          if (found.indexOf(el) === -1) found.push(el);
        });
      });
      var idx = 0;
      found.forEach(function (el) {
        if (el.hasAttribute('data-anim')) return;
        el.setAttribute('data-anim', 'up');
        var d = Math.min(idx * 0.08, 0.8);
        el.style.setProperty('--d', d + 's');
        idx++;
      });
    });
  }

  var animatedSections = {};
  function triggerSectionAnim(pageIdx) {
    if (animatedSections[pageIdx]) return;
    animatedSections[pageIdx] = true;
    var sec = sections[pageIdx];
    if (!sec) return;
    sec.classList.add('anim-active');
    var animEls = sec.querySelectorAll('[data-anim]');
    var maxDelay = 0;
    animEls.forEach(function (el) {
      var d = parseFloat(el.style.getPropertyValue('--d')) || 0;
      if (d > maxDelay) maxDelay = d;
    });
    setTimeout(function () {
      sec.classList.add('anim-done');
    }, (maxDelay + 0.9) * 1000);
  }

  initAnimElements();

  // ========== 反向进入支持（从 page2 回退到 page1 时定位到末尾） ==========
  var entryDir = sessionStorage.getItem('projectEntryDirection');
  sessionStorage.removeItem('projectEntryDirection');

  if (entryDir === 'backward' && pages.length > 0) {
    // 定位到最后一个 section
    currentPage = pages.length - 1;
    intraOffset = 0;

    // 如果最后一页是帧切换 section，定位到最后一帧
    if (currentPage === s5PageIndex) { s5Frame = S5_TOTAL_FRAMES - 1; switchS5Frame(s5Frame); }
    if (currentPage === s7PageIndex) { s7Frame = S7_TOTAL_FRAMES - 1; switchS7Frame(s7Frame); }
    if (currentPage === s11PageIndex) { s11Frame = S10_TOTAL_FRAMES - 1; switchS10Frame(s11Frame); }
    if (currentPage === s14PageIndex) { s14Frame = S14_TOTAL_FRAMES - 1; switchS14Frame(s14Frame); }

    // 如果非帧切换且内容超过视口，定位到底部
    if (!isFrameSection(currentPage)) {
      var maxIntraInit = getMaxIntraScroll(currentPage);
      if (maxIntraInit > 0) intraOffset = maxIntraInit;
    }

    currentOffset = pages[currentPage] + intraOffset;
    inner.style.transform = 'translateY(' + (-currentOffset) + 'px)';

    // 触发所有已经过的 section 动画
    for (var ai = 0; ai <= currentPage; ai++) {
      triggerSectionAnim(ai);
    }
    buildIndicator();
    wrapper.classList.add('ready');
    if (preloadSectionImages) preloadSectionImages(currentPage);
  } else {
    // 正常进入：从第一页开始
    switchS5Frame(0);
    switchS7Frame(0);
    switchS10Frame(0);
    setTimeout(function () {
      triggerSectionAnim(0);
    }, 300);
    buildIndicator();
    wrapper.classList.add('ready');
    if (preloadSectionImages) preloadSectionImages(currentPage);
  }

  // ========== S11 鼠标跟随视差 ==========
  (function () {
    var s11Section = document.querySelector('.s11');
    if (!s11Section) return;
    var cards = s11Section.querySelectorAll('.s11__card');
    var phone = s11Section.querySelector('.s11__phone-hero');
    var allEls = [];
    for (var i = 0; i < cards.length; i++) allEls.push(cards[i]);
    if (phone) allEls.push(phone);

    // 每个元素不同的跟随强度
    var factors = [12, 18, 8, 14, 10, 20, 16, 9, 11, 6];
    var rafId = null;
    var targetX = 0;
    var targetY = 0;
    var currentX = 0;
    var currentY = 0;
    var entered = false;
    var s11Idx = Array.prototype.indexOf.call(sections, s11Section);

    function triggerEntrance() {
      if (entered) return;
      entered = true;
      var entranceOffsets = [
        [-14, -10], [12, -8], [-16, 10], [8, 14], [-10, 6],
        [14, -12], [-8, 10], [10, -14], [16, 8], [-6, -8]
      ];
      for (var i = 0; i < allEls.length; i++) {
        var ox = entranceOffsets[i] ? entranceOffsets[i][0] : 0;
        var oy = entranceOffsets[i] ? entranceOffsets[i][1] : 0;
        allEls[i].style.transition = 'transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        allEls[i].style.transform = 'translate(' + ox + 'px, ' + oy + 'px)';
      }
      setTimeout(function () {
        for (var i = 0; i < allEls.length; i++) {
          allEls[i].style.transition = '';
        }
      }, 1300);
    }

    var observer = new MutationObserver(function (mutations) {
      if (s11Section.classList.contains('anim-active')) {
        triggerEntrance();
        observer.disconnect();
      }
    });
    observer.observe(s11Section, { attributes: true, attributeFilter: ['class'] });
    if (s11Section.classList.contains('anim-active')) {
      triggerEntrance();
      observer.disconnect();
    }

    document.addEventListener('mousemove', function (e) {
      if (currentPage !== s11Idx) return;
      targetX = e.clientX / window.innerWidth - 0.5;
      targetY = e.clientY / window.innerHeight - 0.5;
      if (!rafId) {
        rafId = requestAnimationFrame(updateParallax);
      }
    });

    document.addEventListener('mouseleave', function () {
      targetX = 0;
      targetY = 0;
      if (!rafId) {
        rafId = requestAnimationFrame(updateParallax);
      }
    });

    function updateParallax() {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      for (var i = 0; i < allEls.length; i++) {
        var f = factors[i] || 10;
        var dx = currentX * f;
        var dy = currentY * f;
        allEls[i].style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
      }

      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        rafId = requestAnimationFrame(updateParallax);
      } else {
        rafId = null;
      }
    }
  })();
})();
