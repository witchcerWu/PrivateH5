/**
 * Animations System
 * - Text splitting (character-by-character reveal)
 * - Scroll-triggered entry animations
 * - Stagger delays for child elements
 * - Role text cycling (typewriter effect)
 * - Pill drop animation on load
 */

(function () {
  'use strict';

  // ============================================
  // Text Splitting System
  // ============================================
  function splitText(el) {
    const text = el.textContent;
    el.innerHTML = '';
    [...text].forEach((char, i) => {
      const outer = document.createElement('span');
      outer.className = 'split-char';
      const inner = document.createElement('span');
      inner.textContent = char === ' ' ? '\u00A0' : char;
      inner.style.transitionDelay = i * 0.04 + 's';
      outer.appendChild(inner);
      el.appendChild(outer);
    });
    // 拆字完成：此时字符仍处于 translateY(100%) 被裁掉的隐藏态，
    // 元素可以显现但看不到文字，随后由 is-visible 触发逐字滑入
    el.classList.add('is-split-ready');
  }

  // Initialize all split-text elements
  const splitElements = document.querySelectorAll('[data-split-text]');
  splitElements.forEach(splitText);

  // ============================================
  // Typing Text Effect (dual-layer overlay)
  // Scroll-driven: characters reveal based on scroll position
  // ============================================
  function initTypingText() {
    const typingElements = document.querySelectorAll('[data-typing-text]');

    typingElements.forEach(el => {
      const text = el.textContent;
      el.innerHTML = '';
      el.style.display = 'flex';
      el.style.flexWrap = 'wrap';

      // Split by words
      const words = text.split(' ');
      words.forEach((word) => {
        const wordSpan = document.createElement('span');
        wordSpan.className = 'typing-word';

        // Each character has dual-layer structure
        [...word].forEach(char => {
          const charContainer = document.createElement('span');
          charContainer.className = 'typing-char';

          // Add special class for quotation marks
          if (char === '\u201c' || char === '\u201d' || char === '"') {
            charContainer.classList.add('typing-char--quote');
          }

          // Ghost layer (gray, always visible)
          const ghost = document.createElement('span');
          ghost.className = 'typing-char__ghost';
          ghost.textContent = char;

          // Real layer (overlay, revealed on scroll)
          const real = document.createElement('span');
          real.className = 'typing-char__real';
          real.textContent = char;

          charContainer.appendChild(ghost);
          charContainer.appendChild(real);
          wordSpan.appendChild(charContainer);
        });

        el.appendChild(wordSpan);
      });
    });
  }

  // Scroll-driven typing: reveal characters based on scroll progress
  function initScrollDrivenTyping() {
    // Handle each section with typing text independently
    const sections = ['.about', '.experience', '.gallery__intro'];

    sections.forEach(sectionSelector => {
      const section = document.querySelector(sectionSelector);
      if (!section) return;

      const typingElements = section.querySelectorAll('[data-typing-text]');
      if (typingElements.length === 0) return;

      // Collect all real chars in this section
      let allRealChars = [];
      typingElements.forEach(el => {
        const chars = el.querySelectorAll('.typing-char__real');
        chars.forEach(char => allRealChars.push(char));
      });

      let lastRevealed = -1; // 记录上次状态，避免重复操作DOM
      let ticking = false;

      function updateTypingOnScroll() {
        const rect = section.getBoundingClientRect();
        const sectionTop = rect.top;
        const sectionHeight = rect.height;
        const viewportHeight = window.innerHeight;

        const startOffset = viewportHeight * 0.7;
        const endOffset = sectionHeight * 0.05;

        let progress = 0;
        if (sectionTop < startOffset) {
          progress = (startOffset - sectionTop) / (startOffset - endOffset);
        }
        progress = Math.max(0, Math.min(1, progress));

        const charsToReveal = Math.floor(progress * allRealChars.length);

        // 只更新变化的字符，不遍历全部
        if (charsToReveal !== lastRevealed) {
          if (charsToReveal > lastRevealed) {
            for (let i = Math.max(0, lastRevealed); i < charsToReveal; i++) {
              allRealChars[i].classList.add('is-typed');
            }
          } else {
            for (let i = charsToReveal; i < Math.min(allRealChars.length, lastRevealed + 1); i++) {
              allRealChars[i].classList.remove('is-typed');
            }
          }
          lastRevealed = charsToReveal;
        }
        ticking = false;
      }

      function onScroll() {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(updateTypingOnScroll);
        }
      }

      window.addEventListener('scroll', onScroll, { passive: true });
      updateTypingOnScroll();
    });
  }

  // Initialize typing text DOM structure immediately
  initTypingText();

  // ============================================
  // IntersectionObserver - Entry Animations
  // ============================================
  const observerOptions = {
    threshold: 0.2,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');

        // Handle stagger children
        const staggerChildren = entry.target.querySelectorAll('[data-stagger-child]');
        if (staggerChildren.length > 0) {
          staggerChildren.forEach((child, i) => {
            child.style.transitionDelay = i * 0.15 + 's';
            setTimeout(() => {
              child.classList.add('is-visible');
            }, 10);
          });
        }

        // Unobserve after animation triggered
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all [data-anim] elements
  document.querySelectorAll('[data-anim]').forEach(el => {
    observer.observe(el);
  });

  // Observe split-text elements
  splitElements.forEach(el => {
    observer.observe(el);
  });

  // ============================================
  // Role Text Cycling (Typewriter delete & retype)
  // ============================================
  const roles = ['UI Designer', 'Visual System Builder', 'AI-Driven Creator', 'Creative Tech'];
  let currentRoleIndex = 0;
  const roleEl = document.getElementById('roleText');
  const TYPE_SPEED = 40;   // 打字速度 ms/字符
  const DELETE_SPEED = 25;  // 删除速度 ms/字符
  const PAUSE_BEFORE_DELETE = 2000; // 显示完整文字后停留时间
  const PAUSE_BEFORE_TYPE = 400;    // 删完后开始打字前的停顿

  function typeText(text, callback) {
    let i = 0;
    roleEl.textContent = '';
    function type() {
      if (i < text.length) {
        roleEl.textContent += text.charAt(i);
        i++;
        setTimeout(type, TYPE_SPEED);
      } else if (callback) {
        callback();
      }
    }
    type();
  }

  function deleteText(callback) {
    function del() {
      const current = roleEl.textContent;
      if (current.length > 0) {
        roleEl.textContent = current.slice(0, -1);
        setTimeout(del, DELETE_SPEED);
      } else if (callback) {
        callback();
      }
    }
    del();
  }

  function cycleRole() {
    if (!roleEl) return;
    deleteText(() => {
      currentRoleIndex = (currentRoleIndex + 1) % roles.length;
      setTimeout(() => {
        typeText(roles[currentRoleIndex], () => {
          setTimeout(cycleRole, PAUSE_BEFORE_DELETE);
        });
      }, PAUSE_BEFORE_TYPE);
    });
  }

  // 首次显示后启动循环
  setTimeout(cycleRole, PAUSE_BEFORE_DELETE);

  // ============================================
  // Pill Drop Animation — 真实刚体重力下落 + 着地回弹
  // 每个胶囊一个独立的重力积分器：加速度下坠 → 触地反弹(带恢复系数) →
  // 阻尼衰减多次弹跳 → 落地微幅角度晃动 → 精确停在设计好的散落位置(translateY 0)
  // 全部静止后交接给气球浮动动画。
  // ============================================
  function initPillDrop() {
    const pills = Array.from(document.querySelectorAll('.hero__pills .pill'));
    if (pills.length === 0) return;

    const floatAnimations = ['balloon-float-1', 'balloon-float-2', 'balloon-float-3'];

    // 读取每个胶囊 CSS 里设定的最终旋转角(--rotate)
    const readBaseRot = (pill) => {
      const raw = getComputedStyle(pill).getPropertyValue('--rotate').trim();
      return parseFloat(raw) || 0;
    };

    // 尊重「减少动态」偏好：直接落位，不做物理
    const prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      pills.forEach((pill) => {
        pill.style.opacity = '1';
        pill.style.transform = `translateY(0) rotate(${readBaseRot(pill)}deg)`;
      });
      return;
    }

    // ---- 物理参数（px / 秒）----
    const G = 2600;      // 重力加速度
    const REST = 0.36;   // 恢复系数(反弹能量保留比例)
    const STOP_V = 45;   // 垂直静止阈值
    const ANG_K = 90;    // 角度回正弹簧刚度
    const ANG_C = 18;    // 角度阻尼(≈临界阻尼，快速收敛不乱晃)

    const states = pills.map((pill, i) => ({
      pill,
      baseRot: readBaseRot(pill),
      y: -(560 + Math.random() * 260), // 从设计位置上方开始下落
      v: 0,
      ang: 0,      // 落地晃动的角度偏移(deg)
      angV: 0,     // 角速度(deg/s)
      delay: 60 + i * 55, // 逐个错峰下落
      started: false,
      grounded: false,
      settled: false,
    }));

    let startTime = null;
    let lastT = null;

    function frame(t) {
      if (startTime === null) { startTime = t; lastT = t; }
      let dt = (t - lastT) / 1000;
      lastT = t;
      if (dt > 1 / 30) dt = 1 / 30; // 卡顿/切后台时钳制步长，避免穿透
      const elapsed = t - startTime;

      let allSettled = true;

      for (const s of states) {
        if (s.settled) continue;
        allSettled = false;

        // 错峰：到点才开始下落并显形
        if (!s.started) {
          if (elapsed >= s.delay) {
            s.started = true;
            s.pill.style.opacity = '1';
          } else {
            continue;
          }
        }

        // 垂直：重力积分
        s.v += G * dt;
        s.y += s.v * dt;

        // 触地：y=0 即设计位置(地面)
        if (s.y >= 0) {
          s.y = 0;
          if (Math.abs(s.v) < STOP_V) {
            s.v = 0;
            s.grounded = true;
          } else {
            s.v = -s.v * REST; // 反弹
            // 撞击给一个随机角冲量，产生真实的翻晃感
            s.angV += (Math.random() - 0.5) * Math.min(Math.abs(s.v), 600) * 0.06;
          }
        }

        // 角度：弹簧回正 + 阻尼
        const angA = -ANG_K * s.ang - ANG_C * s.angV;
        s.angV += angA * dt;
        s.ang += s.angV * dt;

        // 完全静止判定：落地且角度晃动收敛
        if (s.grounded && Math.abs(s.angV) < 6 && Math.abs(s.ang) < 0.4) {
          s.ang = 0;
          s.settled = true;
        }

        s.pill.style.transform =
          `translateY(${s.y.toFixed(2)}px) rotate(${(s.baseRot + s.ang).toFixed(2)}deg)`;
      }

      if (!allSettled) {
        requestAnimationFrame(frame);
        return;
      }

      // 全部静止：精确归位，随后交接给气球浮动
      states.forEach((s) => {
        s.pill.style.transform = `translateY(0) rotate(${s.baseRot}deg)`;
      });
      setTimeout(() => {
        pills.forEach((pill, i) => {
          const floatName = floatAnimations[i % floatAnimations.length];
          const duration = 3 + (i % 3) * 0.8;
          pill.style.animation = `${floatName} ${duration}s ease-in-out 0s infinite`;
        });
      }, 120);
    }

    requestAnimationFrame(frame);
  }

  // ============================================
  // Gallery Scroll-Driven Zoom Into Collage
  // 中心图放大至全屏，周围图向四周散开并淡出
  // ============================================
  function initGalleryZoom() {
    const container = document.querySelector('.gallery__scroll-container');
    const centerItem = document.querySelector('.gallery__item--center');
    const otherItems = document.querySelectorAll('.gallery__item:not(.gallery__item--center)');

    if (!container || !centerItem) return;

    // 中心视频控件(进度条 + 声音开关)：视频放大较明显时显示
    const progressEl = document.querySelector('.gallery__progress');
    const muteBtnEl = document.querySelector('.gallery__mute');
    const PROGRESS_SHOW = 0.5; // 缩放进度超过此值显示控件

    // Toast 提示：视频全屏后提示用户继续下滑关闭
    // 挂载到 body 上用 fixed 定位，避免被 gallery 内部层叠上下文遮挡
    const toast = document.createElement('div');
    toast.className = 'gallery__toast';
    toast.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12l7 7 7-7"/></svg><span>继续下滑可关闭视频</span>';
    document.body.appendChild(toast);
    let toastShown = false;
    let toastTimer = null;

    // 周围图片的推开方向（与视频保持等距推开）
    // DOM顺序: 1,2,3(行1), 4(行2左), 5(行2右), 6,7,8(行3)
    const pushDirections = [
      { x: 0, y: -1 },   // item1: 向上
      { x: 0, y: -1 },   // item2: 向上
      { x: 0, y: -1 },   // item3: 向上
      { x: -1, y: 0 },   // item4: 向左
      { x: 1, y: 0 },    // item5: 向右
      { x: 0, y: 1 },    // item6: 向下
      { x: 0, y: 1 },    // item7: 向下
      { x: 0, y: 1 },    // item8: 向下
    ];

    let ticking = false;
    
    function onScroll() {
      if (ticking) return;
      ticking = true;
    
      requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const containerTop = rect.top;
        const containerHeight = rect.height;
        const viewportHeight = window.innerHeight;
    
        // 总滚动进度 0→1
        let progress = 0;
        if (containerTop <= 0) {
          progress = Math.min(1, Math.abs(containerTop) / (containerHeight - viewportHeight));
        }
    
        // 三阶段动画：
        // Phase 1 (0 ~ 0.4): 放大 (eased 0→1)
        // Phase 2 (0.4 ~ 0.55): 保持全屏
        // Phase 3 (0.55 ~ 0.95): 缩小回去 (eased 1→0)
        // 末尾 0.95~1.0: 完全归位缓冲
        const ZOOM_IN_END = 0.4;
        const HOLD_END = 0.55;
        const ZOOM_OUT_END = 0.95;
    
        let eased;
        if (progress <= ZOOM_IN_END) {
          eased = progress / ZOOM_IN_END;
        } else if (progress <= HOLD_END) {
          eased = 1;
        } else if (progress <= ZOOM_OUT_END) {
          eased = 1 - (progress - HOLD_END) / (ZOOM_OUT_END - HOLD_END);
        } else {
          eased = 0;
        }
        eased = Math.max(0, Math.min(1, eased));

        // toast：接近全屏时显示，缩小时隐藏
        if (eased >= 0.95 && !toastShown) {
          toastShown = true;
          toast.classList.add('is-visible');
          toastTimer = setTimeout(() => { toast.classList.remove('is-visible'); }, 3000);
        } else if (eased < 0.9 && toastShown) {
          toast.classList.remove('is-visible');
          if (toastTimer) clearTimeout(toastTimer);
        }
    
        // 中心视频放大：使用 transform:scale 实现渐进式缩放
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const startW = centerItem.dataset.initW ? parseFloat(centerItem.dataset.initW) : centerItem.offsetWidth;
        const startH = centerItem.dataset.initH ? parseFloat(centerItem.dataset.initH) : centerItem.offsetHeight;
        if (!centerItem.dataset.initW) {
          centerItem.dataset.initW = startW;
          centerItem.dataset.initH = startH;
        }

        // 计算缩放比例：从 1x 到分满视口宽度
        const targetScale = vw / startW;
        const currentScale = 1 + (targetScale - 1) * eased;
    
        if (eased > 0) {
          centerItem.style.transform = `scale(${currentScale})`;
          centerItem.style.zIndex = '100';
          // 圆角随缩放逐渐消失（视觉圆角从8px渐变0）
          const visualRadius = 8 * (1 - eased);
          centerItem.style.borderRadius = (visualRadius / currentScale) + 'px';
        } else {
          centerItem.style.transform = '';
          centerItem.style.zIndex = '';
          centerItem.style.borderRadius = '';
        }
    
        // 放大较明显时显示控件(进度条 + 声音开关)
        const showControls = eased >= PROGRESS_SHOW;
        if (progressEl) progressEl.classList.toggle('is-visible', showControls);
        if (muteBtnEl) muteBtnEl.classList.toggle('is-visible', showControls);
    
        // 推开周围图片：保持与视频边缘的间距不变
        const growthW = startW * (currentScale - 1);
        const growthH = startH * (currentScale - 1);
    
        otherItems.forEach((item, i) => {
          const dir = pushDirections[i % pushDirections.length];
          const tx = dir.x * growthW / 2;
          const ty = dir.y * growthH / 2;
          const opacity = Math.max(0, 1 - eased * 2);
    
          item.style.transform = `translate(${tx}px, ${ty}px)`;
          item.style.opacity = opacity;
        });
    
        ticking = false;
      });
    }

    // 窗口尺寸变化时重置缓存的初始尺寸
    window.addEventListener('resize', () => {
      delete centerItem.dataset.initW;
      delete centerItem.dataset.initH;
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ============================================
  // Gallery 中心视频：滚动到可视区域才播放
  // ============================================
  // 中心视频：进入视口播放 + 离开视口暂停 + 自定义可拖动进度条
  function initGalleryVideo() {
    const video = document.querySelector('.gallery__item--center video');
    if (!video) return;

    // 满足自动播放策略
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.playsInline = true;

    let firstPlay = true;

    const tryPlay = () => {
      // 首次播放时从第1秒开始
      if (firstPlay) {
        video.currentTime = 1;
        firstPlay = false;
      }
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };

    // 使用 IntersectionObserver 监听 .gallery 区域进入视口再播放
    const gallerySection = document.querySelector('.gallery');
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tryPlay();
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.15 }); // gallery 区域 15% 可见时触发
    videoObserver.observe(gallerySection || video);

    // 声音只通过点击声音按钮开启，移除全局手势自动解锁
    const muteBtn = document.querySelector('.gallery__mute');
    const syncIcon = () => {
      if (muteBtn) muteBtn.classList.toggle('is-on', !video.muted);
    };

    // ---- 声音开关（仅通过此按钮控制） ----
    syncIcon();
    if (muteBtn) {
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        video.muted = !video.muted;
        if (!video.muted) {
          video.volume = 1;
          tryPlay(); // 确保开声后仍在播放
        }
        syncIcon();
      });
      // 兼容触摸
      muteBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    }

    // ---- 进度条 ----
    const progress = document.querySelector('.gallery__progress');
    if (!progress) return;
    const track = progress.querySelector('.gallery__progress-track');
    const fill = progress.querySelector('.gallery__progress-fill');
    const thumb = progress.querySelector('.gallery__progress-thumb');
    let dragging = false;

    const render = (ratio) => {
      const pct = Math.max(0, Math.min(1, ratio)) * 100;
      if (fill) fill.style.width = pct + '%';
      if (thumb) thumb.style.left = pct + '%';
    };

    // 播放时更新进度（拖动中不跟随，避免抖动）
    video.addEventListener('timeupdate', () => {
      if (dragging || !video.duration) return;
      render(video.currentTime / video.duration);
    });

    // 根据指针位置计算比例并 seek
    const ratioFromEvent = (e) => {
      const rect = track.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      return rect.width ? x / rect.width : 0;
    };
    const seek = (e) => {
      const ratio = Math.max(0, Math.min(1, ratioFromEvent(e)));
      render(ratio);
      if (video.duration) video.currentTime = ratio * video.duration;
    };

    const onDown = (e) => {
      dragging = true;
      progress.classList.add('is-dragging');
      seek(e);
      e.preventDefault();
    };
    const onMove = (e) => { if (dragging) seek(e); };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      progress.classList.remove('is-dragging');
      tryPlay();
    };

    // 指针事件（兼容鼠标/触摸）
    progress.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    // 触摸兜底（部分老设备无 pointer 事件）
    progress.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }

  // ============================================
  // Trigger hero animations once fonts are ready
  // (不再等待所有图片/视频加载完毕，仅等字体就绪即可启动动画)
  // ============================================
  function startAnimations() {
    // Delay slightly for smooth visual
    setTimeout(() => {
      splitElements.forEach(el => {
        el.classList.add('is-visible');
        el.querySelectorAll('.split-char').forEach(char => {
          char.classList.add('is-visible');
        });
      });
    }, 300);

    // Start pill drop animation
    initPillDrop();

    // Initialize gallery zoom
    initGalleryZoom();

    // Initialize gallery center video autoplay
    initGalleryVideo();

    // Initialize scroll-driven typing
    initScrollDrivenTyping();
  }

  // 仅等首屏 Hero 所需的 Bold 字体加载完就启动动画，不必等全部字体
  // document.fonts.ready 会等页面所有字重全部加载（5个woff2），导致动画延迟
  // 改为：只等 Bold 700（Hero 标题字体），加超时兜底
  if (document.fonts && document.fonts.load) {
    const heroFont = document.fonts.load('bold 1em AlibabaPuHuiTi');
    const timeout = new Promise(resolve => setTimeout(resolve, 1500));
    Promise.race([heroFont, timeout]).then(startAnimations);
  } else {
    // 回退：DOMContentLoaded 后立即启动
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startAnimations);
    } else {
      startAnimations();
    }
  }

})();
