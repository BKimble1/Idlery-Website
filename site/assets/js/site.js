/* idlery.com — the only script on the site.
 *
 * Everything here is an enhancement. With scripting off, the menu is laid out
 * inline, the hero shows its still image, and the featured projects are a grid
 * (see the (scripting: none) rules in site.css). Loaded with `defer` from
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

    var portrait = window.matchMedia("(max-width: 760px) and (orientation: portrait)");
    var saveData = !!(navigator.connection && navigator.connection.saveData);
    var loadedFor = null;   // which rendition the <source>s currently point at
    var wanted = !reduceMotion.matches && !saveData;
    var userPaused = false;
    var visible = true;

    function rendition() {
      return portrait.matches && video.getAttribute("data-portrait") ? "portrait" : "landscape";
    }

    function load() {
      var which = rendition();
      if (loadedFor === which) return;
      var base = video.getAttribute("data-" + which);
      while (video.firstChild) video.removeChild(video.firstChild);
      // AV1 first (smaller); every browser that cannot play it takes the H.264 file.
      [["av1.mp4", 'video/mp4; codecs="av01.0.08M.08"'], ["mp4", "video/mp4"]].forEach(function (f) {
        var s = document.createElement("source");
        s.src = base + "." + f[0];
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
    portrait.addEventListener("change", function () {
      if (loadedFor && loadedFor !== rendition()) {
        var playing = !video.paused;
        load();
        if (playing) play();
      }
    });

    if (wanted) play(); else show("paused");
  }

  /* --------------------------------------------------------- carousel -- */

  function initCarousel(root) {
    var track = root.querySelector(".carousel-track");
    var prev = root.querySelector('[data-dir="-1"]');
    var next = root.querySelector('[data-dir="1"]');
    if (!track || !prev || !next) return;
    var slides = Array.prototype.slice.call(track.children);

    root.querySelector(".carousel-buttons").hidden = false;

    function stepWidth() {
      if (slides.length < 2) return track.clientWidth;
      return slides[1].offsetLeft - slides[0].offsetLeft;
    }
    function behavior() { return reduceMotion.matches ? "auto" : "smooth"; }
    function update() {
      var max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft >= max - 4;
    }
    prev.addEventListener("click", function () { track.scrollBy({ left: -stepWidth(), behavior: behavior() }); });
    next.addEventListener("click", function () { track.scrollBy({ left: stepWidth(), behavior: behavior() }); });
    track.addEventListener("scroll", function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener("resize", update);

    // Arrow keys move between projects once focus is inside the carousel.
    track.addEventListener("keydown", function (e) {
      var keys = { ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last" };
      if (!(e.key in keys)) return;
      var links = slides.map(function (s) { return s.querySelector("a"); });
      var i = links.indexOf(document.activeElement);
      if (i === -1) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          track.scrollBy({ left: keys[e.key] * stepWidth(), behavior: behavior() });
        }
        return;
      }
      var k = keys[e.key];
      var j = k === "first" ? 0 : k === "last" ? links.length - 1 : Math.max(0, Math.min(links.length - 1, i + k));
      e.preventDefault();
      links[j].focus({ preventScroll: true });
      slides[j].scrollIntoView({ behavior: behavior(), block: "nearest", inline: "start" });
    });

    update();
  }

  /* ------------------------------------------------------------- boot -- */

  function boot() {
    initMenu();
    Array.prototype.forEach.call(document.querySelectorAll("video[data-ambient]"), initAmbientVideo);
    Array.prototype.forEach.call(document.querySelectorAll("[data-carousel]"), initCarousel);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
