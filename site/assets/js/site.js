/* idlery.com: the only script on the site.
 *
 * Everything here is an enhancement. With scripting off, the menu is laid out
 * inline, the hero shows its still image, and the featured projects are a row
 * you scroll (see the (scripting: none) rules in site.css). Loaded with `defer` from
 * /assets/js/, which is what the Content-Security-Policy in _headers allows.
 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ------------------------------------------------------ mobile menu -- */

  function initMenu() {
    var toggle = document.querySelector(".nav-toggle");
    if (!toggle) return;
    var nav = document.getElementById(toggle.getAttribute("aria-controls"));
    if (!nav) return;

    function set(open) {
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
    }
    toggle.addEventListener("click", function () {
      set(toggle.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        set(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (toggle.getAttribute("aria-expanded") === "true" && !nav.contains(e.target) && !toggle.contains(e.target)) set(false);
    });
    window.matchMedia("(min-width: 761px)").addEventListener("change", function (e) {
      if (e.matches) set(false);
    });
  }

  /* ------------------------------------------------ background videos --
   * <video data-ambient> plays muted and looped, and only when that is
   * welcome: never under prefers-reduced-motion or Save-Data, never while it
   * is off screen, and never again once the visitor has paused it. The
   * button next to it is the pause control WCAG 2.2.2 asks for. */

  function initAmbientVideo(video) {
    var root = video.closest("[data-ambient-root]") || video.parentElement;
    var button = root.querySelector("[data-ambient-toggle]");
    var label = button && button.querySelector("[data-ambient-label]");
    var now = root.querySelector("[data-ambient-now]");
    var chapters = [];
    function readChapters(which) {
      try { chapters = JSON.parse(video.getAttribute("data-chapters-" + which) || "[]"); } catch (e) { chapters = []; }
    }

    // Three cuts, each framed for its screen: phones (about 9:19.5), portrait
    // tablets (9:16) and everything wider (16:9).
    var phone = window.matchMedia("(max-width: 600px) and (orientation: portrait)");
    var portrait = window.matchMedia("(max-width: 1100px) and (orientation: portrait)");
    var saveData = !!(navigator.connection && navigator.connection.saveData);
    var loadedFor = null;   // which rendition the <source>s currently point at
    var wanted = !reduceMotion.matches && !saveData;
    var userPaused = false;
    var visible = true;

    function rendition() {
      if (phone.matches && video.getAttribute("data-phone")) return "phone";
      return portrait.matches && video.getAttribute("data-portrait") ? "portrait" : "landscape";
    }

    function load() {
      var which = rendition();
      if (loadedFor === which) return;
      var base = video.getAttribute("data-" + which);
      // build.py stamps a hash of the video files, so a new cut is never
      // mixed up with a cached old one.
      var v = video.getAttribute("data-video-v");
      while (video.firstChild) video.removeChild(video.firstChild);
      // AV1 first (smaller); every browser that cannot play it takes the H.264 file.
      [["av1.mp4", 'video/mp4; codecs="av01.0.08M.08"'], ["mp4", "video/mp4"]].forEach(function (f) {
        var s = document.createElement("source");
        s.src = base + "." + f[0] + (v ? "?v=" + v : "");
        s.type = f[1];
        video.appendChild(s);
      });
      loadedFor = which;
      readChapters(which);
      video.load();
    }

    function show(state) {
      if (!button) return;
      button.hidden = false;
      button.setAttribute("data-state", state);
      if (label) label.textContent = state === "playing" ? "Pause" : "Play";
    }

    function play() {
      load();
      var p = video.play();
      if (p && p.then) {
        p.then(function () { video.classList.add("is-playing"); show("playing"); })
         .catch(function () { show("paused"); });
      } else {
        video.classList.add("is-playing");
        show("playing");
      }
    }

    function pause() {
      video.pause();
      show("paused");
    }

    if (button) {
      button.addEventListener("click", function () {
        if (video.paused || !video.classList.contains("is-playing")) {
          userPaused = false;
          play();
        } else {
          userPaused = true;
          pause();
        }
      });
    }

    if (now) {
      video.addEventListener("timeupdate", function () {
        if (!chapters.length) return;
        var t = video.currentTime, cur = chapters[0];
        for (var i = 0; i < chapters.length; i++) if (t >= chapters[i].t) cur = chapters[i];
        var text = cur.name;
        if (now.getAttribute("data-current") !== text) {
          now.setAttribute("data-current", text);
          now.textContent = "";
          if (!text) return;                    // the closing card names nothing
          var b = document.createElement("b");
          b.textContent = cur.name;
          now.appendChild(document.createTextNode("Now showing "));
          now.appendChild(b);
          if (cur.kind) now.appendChild(document.createTextNode(" · " + cur.kind));
        }
      });
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (!visible && !video.paused) video.pause();
        else if (visible && wanted && !userPaused && video.paused && loadedFor) play();
      }, { threshold: 0.15 }).observe(root);
    }

    reduceMotion.addEventListener("change", function (e) {
      wanted = !e.matches && !saveData;
      if (e.matches) pause();
    });
    function reframe() {
      if (loadedFor && loadedFor !== rendition()) {
        var playing = !video.paused;
        load();
        if (playing) play();
      }
    }
    portrait.addEventListener("change", reframe);
    phone.addEventListener("change", reframe);

    if (wanted) play(); else show("paused");
  }

  /* ------------------------------------------------------------- reel --
   * Featured work drifts slowly to the right, forever. The list is copied
   * (copies are inert and aria-hidden) so the loop has no end, and the track
   * is moved with a transform. It eases to a stop while the pointer is over
   * it, while a project has keyboard focus, and after the Pause button; it
   * does not run off screen, and never under prefers-reduced-motion, where
   * the list stays a row you scroll. A drag moves it by hand. */

  function initReel(root) {
    var track = root.querySelector(".reel-track");
    if (!track) return;
    var section = root.closest("section") || document;
    var button = section.querySelector("[data-reel-toggle]");
    var label = button && button.querySelector("[data-reel-label]");
    var originals = Array.prototype.slice.call(track.children);
    var SPEED = 26;           // px per second at rest
    var on = false, raf = 0, last = 0;
    var x = 0, speed = 0, span = 0, boost = 0;
    var userPaused = false, hover = false, focused = false, visible = true;
    var drag = null, lastY = window.scrollY;

    function measure() {
      span = 0;
      originals.forEach(function (li) {
        var cs = getComputedStyle(li);
        span += li.getBoundingClientRect().width + parseFloat(cs.marginRight || 0) + parseFloat(cs.marginLeft || 0);
      });
    }

    function clearCopies() {
      Array.prototype.forEach.call(track.querySelectorAll("[data-copy]"), function (n) { n.remove(); });
    }

    function fill() {
      clearCopies();
      measure();
      if (!span) return;
      var copies = Math.ceil(root.clientWidth / span) + 1;
      for (var c = 1; c < copies; c++) {
        originals.forEach(function (li) {
          var copy = li.cloneNode(true);
          copy.setAttribute("data-copy", "");
          copy.setAttribute("aria-hidden", "true");
          copy.inert = true;
          Array.prototype.forEach.call(copy.querySelectorAll("a, button"), function (a) { a.tabIndex = -1; });
          Array.prototype.forEach.call(copy.querySelectorAll("[id]"), function (el) { el.removeAttribute("id"); });
          Array.prototype.forEach.call(copy.querySelectorAll("img[loading]"), function (img) { img.loading = "eager"; });
          track.appendChild(copy);
        });
      }
    }

    function place() {
      track.style.transform = "translate3d(" + (x - span).toFixed(2) + "px, 0, 0)";
    }

    function tick(t) {
      raf = 0;
      if (!on) return;
      var dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      if (!drag) {
        var goal = userPaused || hover || focused ? 0 : SPEED * (1 + boost);
        speed += (goal - speed) * Math.min(1, dt * 3.5);
        boost *= Math.exp(-dt * 2.2);
        x += speed * dt;
      }
      if (span) { x %= span; if (x < 0) x += span; }
      place();
      if (visible) raf = requestAnimationFrame(tick);
    }

    function run() {
      if (on && visible && !raf) { last = 0; raf = requestAnimationFrame(tick); }
    }

    function showButton() {
      if (!button) return;
      button.hidden = !on;
      button.setAttribute("data-state", userPaused ? "paused" : "playing");
      if (label) label.textContent = userPaused ? "Play" : "Pause";
    }

    function enable() {
      if (on) return;
      on = true;
      root.classList.add("is-moving");
      fill();
      x = span * 0.35;
      place();
      showButton();
      run();
    }

    function disable() {
      if (!on) return;
      on = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      root.classList.remove("is-moving");
      clearCopies();
      track.style.transform = "";
      showButton();
    }

    if (button) {
      button.addEventListener("click", function () {
        userPaused = !userPaused;
        showButton();
      });
    }

    root.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") hover = true; });
    root.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") hover = false; });

    // Keyboard: stop, and bring the focused project fully into view.
    root.addEventListener("focusin", function (e) {
      if (!on) return;
      focused = true;
      var li = e.target.closest(".reel-track > li");
      if (!li) return;
      var box = root.getBoundingClientRect(), r = li.getBoundingClientRect();
      var pad = Math.max(16, box.width * 0.06);
      if (r.left < box.left + pad || r.right > box.right - pad) {
        x = Math.min(span - 0.01, Math.max(0, span - li.offsetLeft + pad));
        place();
      }
      root.scrollLeft = 0;   // focus may scroll the clipped box; the transform does the moving
    });
    root.addEventListener("focusout", function (e) {
      if (!root.contains(e.relatedTarget)) focused = false;
    });
    root.addEventListener("scroll", function () { if (on) root.scrollLeft = 0; });

    // Drag (touch, pen or mouse) moves the reel by hand; a drag is not a click.
    root.addEventListener("pointerdown", function (e) {
      if (!on || (e.pointerType === "mouse" && e.button !== 0)) return;
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, xStart: x, moved: false };
    });
    root.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
        drag.moved = true;
        root.classList.add("is-dragging");
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
      }
      x = drag.xStart + dx;
      speed = 0;
      run();
    });
    function endDrag(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var moved = drag.moved;
      drag = null;
      root.classList.remove("is-dragging");
      if (moved) {
        // the click that ends a drag is not a click on a project
        swallowClick = true;
        setTimeout(function () { swallowClick = false; }, 0);
      }
    }
    var swallowClick = false;
    root.addEventListener("click", function (e) {
      if (swallowClick) { e.preventDefault(); e.stopPropagation(); swallowClick = false; }
    }, true);
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);

    // Scrolling the page nudges the reel along a little faster for a moment.
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      boost = Math.min(2.5, boost + Math.abs(y - lastY) * 0.004);
      lastY = y;
    }, { passive: true });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        run();
      }).observe(root);
    }

    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      if (!on) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var old = span || 1;
        fill();
        x = x / old * span;
        place();
      }, 150);
    });

    function decide() { if (reduceMotion.matches) disable(); else enable(); }
    reduceMotion.addEventListener("change", decide);
    decide();
  }

  /* ------------------------------------------------------------- boot -- */

  function boot() {
    initMenu();
    Array.prototype.forEach.call(document.querySelectorAll("video[data-ambient]"), initAmbientVideo);
    Array.prototype.forEach.call(document.querySelectorAll("[data-reel]"), initReel);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
