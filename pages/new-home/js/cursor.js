/**
 * Custom Cursor
 * - Smooth following cursor with lerp
 * - Hover scale effect on interactive elements (80px)
 * - mix-blend-mode: difference for cool effect
 * - Hidden on touch devices
 */

(function () {
  'use strict';

  // Skip on touch devices
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.documentElement.style.cursor = 'auto';
    return;
  }

  // Create cursor element
  const cursor = document.createElement('div');
  cursor.className = 'custom-cursor';
  document.body.appendChild(cursor);

  let mouseX = 0;
  let mouseY = 0;
  let cursorX = 0;
  let cursorY = 0;
  let isVisible = false;

  // Track mouse position
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (!isVisible) {
      isVisible = true;
      cursor.style.opacity = '1';
    }
  });

  // Hide cursor when mouse leaves window
  document.addEventListener('mouseleave', () => {
    isVisible = false;
    cursor.style.opacity = '0';
  });

  document.addEventListener('mouseenter', () => {
    isVisible = true;
    cursor.style.opacity = '1';
  });

  // Smooth animation loop with spring-like following
  function updateCursor() {
    // Slower lerp = more noticeable lag/spring feel
    const ease = 0.12;
    cursorX += (mouseX - cursorX) * ease;
    cursorY += (mouseY - cursorY) * ease;

    // Use translate(-50%, -50%) for centering so size changes don't cause position jumps
    cursor.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;
    requestAnimationFrame(updateCursor);
  }

  updateCursor();

  // Hover effect on interactive elements
  function addHoverListeners() {
    const interactiveElements = document.querySelectorAll(
      'a, button, .project-card, .pill, .contact__link, .site-nav__item'
    );

    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.classList.add('cursor--hover');
      });
      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('cursor--hover');
      });
    });

    // Text hover - listen on container level to avoid child element bubbling issues
    const textContainers = document.querySelectorAll(
      '.about__text-wrapper, .experience__intro, .gallery__intro, .hero__text'
    );
    textContainers.forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('cursor--text'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('cursor--text'));
    });
  }

  // Initialize after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addHoverListeners);
  } else {
    addHoverListeners();
  }

})();
