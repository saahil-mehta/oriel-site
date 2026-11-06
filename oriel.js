// Oriel site: evening light, Still, each film's emblem, the film players, the carousel strip, the contents.

const root = document.documentElement;
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window: the choice lasts this page */ } },
};
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

// Evening: the night teal ground. Follows the device until the reader chooses.
const theme = document.querySelector(".theme");
const isEvening = () => (root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
if (theme) {
  const show = () => theme.setAttribute("aria-pressed", String(isEvening()));
  show();
  theme.addEventListener("click", () => {
    root.dataset.theme = isEvening() ? "light" : "dark";
    store.set("oriel-theme", root.dataset.theme);
    show();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", show);
}

// Still: brings every moving picture to rest at once (SI-3, WCAG 2.2.2), remembered on this device.
const still = document.querySelector(".still");
const isStill = () => root.dataset.still === "1" || reduced.matches;
if (still) {
  still.setAttribute("aria-pressed", String(root.dataset.still === "1"));
  still.addEventListener("click", () => {
    const on = root.dataset.still !== "1";
    if (on) root.dataset.still = "1"; else delete root.dataset.still;
    store.set("oriel-still", on ? "1" : "0");
    still.setAttribute("aria-pressed", String(on));
  });
}

// Emblems. Each film's picture moves the way its idea moves (SI-2), at a drawn 24 frames a second (SI-5),
// and comes to rest when the reader attends to it (SI-3).
const FPS = 24;
const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(Math.max(x, 0), 1));
// coming to rest: eases in, overshoots slightly and settles back (SI-5)
const back = (x) => { const t = Math.min(Math.max(x, 0), 1), c = 1.4; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

const motions = {
  // Seneca, Letters 3.6: "she has created both day and night". The sun goes down as the moon comes up, and back;
  // at rest the two hang level, the balance he asks for.
  "day-and-night"(el) {
    const sun = el.querySelector(".sun"), moon = el.querySelector(".moon");
    const PERIOD = 28; // seconds for a whole day and night
    return (time, rest) => {
      const s = (1 - Math.cos((2 * Math.PI * time) / PERIOD)) / 2; // 0: day, 1: night, eased at both turns
      const k = s + (0.5 - s) * rest; // rest pulls both to the middle
      const h = el.clientHeight;
      // the sky's horizon sits at about 0.6 of its height: the sun sinks to it, the moon climbs from it
      sun.style.transform = `translateY(${(0.08 + 0.34 * k) * h}px)`;
      moon.style.transform = `translateY(${(0.42 - 0.34 * k) * h}px)`;
    };
  },
};

for (const el of document.querySelectorAll("[data-emblem]")) {
  const make = motions[el.dataset.emblem];
  if (!make) continue;
  const draw = make(el);
  let clock = 0, last = null, rest = 0, restFrom = 0, restTo = 0, restStart = 0, attending = false, visible = true, frame = 0;
  const target = () => (attending || isStill() ? 1 : 0);
  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    if (last === null) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (target() !== restTo) { restFrom = rest; restTo = target(); restStart = now; }
    const p = (now - restStart) / 1200;
    rest = restFrom + (restTo - restFrom) * (restTo > restFrom ? back(p) : ease(p));
    clock += dt * (1 - Math.min(rest, 1)); // time slows to a stop as it rests
    const q = Math.floor(clock * FPS) / FPS; // drawn rhythm
    draw(q, rest);
  };
  const start = () => { if (!frame && visible) { last = null; frame = requestAnimationFrame(tick); } };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible ? start() : stop(); }).observe(el);
  const card = el.closest(".film-entry") || el;
  card.addEventListener("pointerenter", () => { attending = true; });
  card.addEventListener("pointerleave", () => { attending = false; });
  card.addEventListener("focusin", () => { attending = true; });
  card.addEventListener("focusout", () => { attending = false; });
  if (isStill()) { rest = restTo = 1; }
  draw(0, rest);
  if (reduced.matches) { addEventListener("load", () => draw(0, 1)); continue; } // reduced motion: the resting state only
  start();
}

// Players: the poster stays until the reader presses play; only then does YouTube load.
for (const p of document.querySelectorAll(".player[data-youtube]")) {
  p.querySelector(".play").addEventListener("click", () => {
    const f = document.createElement("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(p.dataset.youtube)}?autoplay=1&rel=0`;
    f.title = p.dataset.title;
    f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    f.allowFullscreen = true;
    p.replaceChildren(f);
    f.focus();
  });
}

// The carousel strip: swipe, scroll, the arrows, or the arrow, Home and End keys. The count names the slide being
// read. Where the strip shows several slides at once it cannot scroll each one to its left edge, so the reading point
// runs from the strip's left edge (at the start) to its right edge (at the end): every slide, the last ones too, comes
// under it in turn, and the count reaches the last at every width.
for (const block of document.querySelectorAll(".carousel")) {
  const strip = block.querySelector(".strip");
  if (!strip) continue;
  const slides = [...strip.querySelectorAll("li")];
  const prev = block.querySelector(".prev"), next = block.querySelector(".next"), count = block.querySelector(".count");
  const max = () => Math.max(1, strip.scrollWidth - strip.clientWidth);
  const centre = (i) => slides[i].offsetLeft - slides[0].offsetLeft + slides[i].offsetWidth / 2;
  // the reading point for a scroll position, and the scroll position that puts slide i under it
  const point = (s) => s + strip.clientWidth * (s / max());
  const scrollFor = (i) => Math.min(max(), Math.max(0, centre(i) / (1 + strip.clientWidth / max())));
  let current = 0, target = null;
  const nearest = () => {
    const x = point(strip.scrollLeft);
    let best = 0;
    slides.forEach((_, i) => { if (Math.abs(centre(i) - x) < Math.abs(centre(best) - x)) best = i; });
    return best;
  };
  const show = () => {
    count.textContent = `${current + 1} of ${slides.length}`;
    prev.disabled = current === 0;
    next.disabled = current === slides.length - 1;
  };
  const go = (i) => {
    current = Math.min(Math.max(i, 0), slides.length - 1);
    target = current;
    strip.scrollTo({ left: scrollFor(current), behavior: reduced.matches ? "auto" : "smooth" });
    show();
  };
  prev.addEventListener("click", () => go(current - 1));
  next.addEventListener("click", () => go(current + 1));
  strip.addEventListener("keydown", (ev) => {
    const k = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: slides.length - 1 }[ev.key];
    if (k === undefined) return;
    ev.preventDefault();
    go(k);
  });
  let queued = false;
  strip.addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      // while the strip glides to a chosen slide, keep that slide; a reader's own scroll takes over after
      if (target !== null) { if (Math.abs(strip.scrollLeft - scrollFor(target)) < 2) target = null; else return; }
      current = nearest();
      show();
    });
  }, { passive: true });
  strip.addEventListener("pointerdown", () => { target = null; });
  strip.addEventListener("wheel", () => { target = null; }, { passive: true });
  show();
}

// Wallpaper: the device, then its model or orientation, set the one download. The reader's own screen is chosen
// first, from its size, shape and pixel ratio.
const ownScreen = () => {
  const dpr = devicePixelRatio || 1, w = screen.width * dpr, h = screen.height * dpr;
  const long = Math.max(w, h), short = Math.min(w, h), ratio = long / short, portrait = h >= w;
  const ua = navigator.userAgent, touch = navigator.maxTouchPoints > 1;
  if (/iPhone|iPod/.test(ua)) return "phone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch)) return portrait ? "tablet-portrait" : "tablet-landscape";
  if (/Android/.test(ua)) {
    if (/Mobile/.test(ua)) return ratio > 2.35 ? "fold-cover" : ratio < 1.45 ? "fold-inner" : "android";
    return portrait ? "tablet-portrait" : "tablet-landscape";
  }
  if (ratio > 2.1) return "ultrawide";
  return long >= 5000 ? "desktop-5k" : "desktop-4k";
};
for (const block of document.querySelectorAll(".wallpaper .choose")) {
  const devices = [...block.querySelectorAll(".devices.screens input")];
  const designs = [...block.querySelectorAll(".devices.designs input")];
  const design = () => (designs.find((d) => d.checked) || designs[0])?.value;
  const variants = [...block.querySelectorAll(".variants label")];
  const a = block.querySelector(".download a"), label = a.querySelector(".device"), file = block.querySelector(".download .file");
  const frame = block.closest(".wallpaper").querySelector(".device-frame"), shot = frame?.querySelector("img");
  const pickFormat = (input) => {
    input.checked = true;
    // each screen carries every design's preview and file; the chosen design picks one
    const all = JSON.parse(input.dataset.designs), d = all[design()] || Object.values(all)[0];
    if (shot && d.preview) {
      frame.className = `device-frame ${input.dataset.shape}`;
      shot.srcset = d.preview;
      shot.src = d.preview.split(" ")[0];  // the first width, for browsers without srcset
      const chosen = designs.find((x) => x.checked);
      if (chosen) shot.alt = chosen.dataset.alt;
      // the frame's size comes from the screen's shape; the box around it never changes size
      shot.width = +input.dataset.cw;
      shot.height = +input.dataset.ch;
      shot.style.width = `${input.dataset.cw}px`;
      shot.style.height = `${input.dataset.ch}px`;
      shot.sizes = `${input.dataset.cw}px`;
    }
    a.href = d.href;
    a.setAttribute("download", d.name);
    label.textContent = input.dataset.label;
    file.textContent = d.detail;
  };
  const pickDevice = (device, format) => {
    const mine = variants.filter((l) => l.dataset.device === device);
    variants.forEach((l) => { l.hidden = l.dataset.device !== device; });
    devices.forEach((d) => { d.checked = d.value === device; });
    const chosen = mine.find((l) => l.querySelector("input").value === format) || mine[0];
    pickFormat(chosen.querySelector("input"));
  };
  devices.forEach((d) => d.addEventListener("change", () => pickDevice(d.value)));
  designs.forEach((d) => d.addEventListener("change", () => pickFormat(block.querySelector(".variants input:checked"))));
  variants.forEach((l) => l.querySelector("input").addEventListener("change", (ev) => pickFormat(ev.target)));
  const own = ownScreen();
  const ownLabel = variants.find((l) => l.querySelector("input").value === own) || variants[0];
  pickDevice(ownLabel.dataset.device, own);
}

// Contents: mark the section being read.
const links = [...document.querySelectorAll(".contents a")];
if (links.length) {
  const sections = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  let queued = false;
  const update = () => {
    queued = false;
    let i = 0;
    sections.forEach((s, j) => { if (s.getBoundingClientRect().top < innerHeight / 3) i = j; });
    links.forEach((a, j) => a.setAttribute("aria-current", String(j === i)));
  };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}
