(() => {
  const Astro = window.AkashicAstro;

  const ANCHORS = {
    crown: [0, 0.9],
    brow: [0, 0.78],
    throat: [0, 0.54],
    heart: [0.015, 0.28],
    core: [0, 0.05],
    shoulderL: [-0.42, 0.46],
    shoulderR: [0.42, 0.46],
    elbowL: [-0.64, 0.16],
    elbowR: [0.64, 0.16],
    handL: [-0.58, -0.1],
    handR: [0.58, -0.1],
    hipL: [-0.2, -0.1],
    hipR: [0.2, -0.1],
    kneeL: [-0.18, -0.5],
    kneeR: [0.18, -0.5],
    footL: [-0.2, -0.96],
    footR: [0.18, -0.96],
  };

  const HEAD = { x: 0, y: 0.72, r: 0.175 };

  const CHAINS = [
    ["shoulderL", "throat", "shoulderR"],
    ["shoulderL", "elbowL", "handL"],
    ["shoulderR", "elbowR", "handR"],
    ["throat", "heart", "core"],
    ["shoulderL", "hipL"],
    ["shoulderR", "hipR"],
    ["core", "hipL", "kneeL", "footL"],
    ["core", "hipR", "kneeR", "footR"],
  ];

  const SUN_ANCHORS = [
    "crown", "brow", "heart", "throat", "handL", "handR",
    "shoulderL", "shoulderR", "core", "elbowL", "elbowR",
    "hipL", "hipR", "footL", "footR",
  ];

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rand() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function wrap01(v) {
    v %= 1;
    return v < 0 ? v + 1 : v;
  }

  function samplePoly(pts, count) {
    const out = [];
    if (pts.length < 2 || count < 1) return out;
    const seg = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(len);
      total += len;
    }
    if (total < 1e-6) return out;
    for (let k = 0; k < count; k++) {
      let dist = (k / count) * total;
      let placed = false;
      for (let i = 1; i < pts.length; i++) {
        if (dist <= seg[i - 1] || i === pts.length - 1) {
          const span = seg[i - 1] || 1;
          const t = clamp(dist / span, 0, 1);
          out.push({
            x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t,
            y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t,
          });
          placed = true;
          break;
        }
        dist -= seg[i - 1];
      }
      if (!placed) out.push({ x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] });
    }
    return out;
  }

  function buildSamples() {
    const pts = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      pts.push({ x: HEAD.x + Math.cos(a) * HEAD.r, y: HEAD.y + Math.sin(a) * HEAD.r });
    }
    const chains = [
      [ANCHORS.shoulderL, ANCHORS.elbowL, ANCHORS.handL],
      [ANCHORS.shoulderR, ANCHORS.elbowR, ANCHORS.handR],
      [ANCHORS.shoulderL, ANCHORS.throat, ANCHORS.shoulderR],
      [ANCHORS.throat, ANCHORS.heart, ANCHORS.core],
      [ANCHORS.shoulderL, ANCHORS.hipL],
      [ANCHORS.shoulderR, ANCHORS.hipR],
      [ANCHORS.hipL, ANCHORS.kneeL, ANCHORS.footL],
      [ANCHORS.hipR, ANCHORS.kneeR, ANCHORS.footR],
    ];
    const counts = [16, 16, 12, 12, 10, 10, 16, 16];
    chains.forEach((chain, i) => pts.push(...samplePoly(chain, counts[i])));
    for (let i = 0; i < 10; i++) {
      pts.push({ x: (i - 4.5) * 0.035, y: 0.18 + (i % 4) * 0.035 });
    }
    return pts;
  }

  function makeSphere(count, seed, mag0, mag1) {
    const rnd = mulberry32(seed);
    const stars = [];
    for (let i = 0; i < count; i++) {
      const ra = rnd() * 360;
      const dec = Math.asin(rnd() * 2 - 1) * (180 / Math.PI);
      const mag = mag0 + rnd() * (mag1 - mag0);
      const star = { ra, dec, mag, phase: rnd() * Math.PI * 2, home: null, role: null };
      star.v = Astro.toVec(ra, dec);
      stars.push(star);
    }
    return stars;
  }

  function makeMilky(count, seed) {
    const rnd = mulberry32(seed);
    const stars = [];
    for (let i = 0; i < count; i++) {
      const l = rnd() * 360;
      const b = (rnd() + rnd() + rnd() - 1.5) * 8.5;
      const eq = Astro.galacticToEquatorial(l, b);
      const star = {
        ra: eq.ra,
        dec: eq.dec,
        mag: 4.1 + rnd() * 1.7,
        phase: rnd() * Math.PI * 2,
        home: null,
        role: null,
        milky: true,
      };
      star.v = Astro.toVec(eq.ra, eq.dec);
      stars.push(star);
    }
    return stars;
  }

  function makeWarp(count, seed) {
    const rnd = mulberry32(seed);
    const stars = [];
    for (let i = 0; i < count; i++) {
      let x = rnd() * 2 - 1;
      let y = rnd() * 2 - 1;
      if (x * x + y * y < 0.015) {
        x = Math.sign(x || 1) * (0.15 + rnd());
        y = Math.sign(y || 1) * (0.15 + rnd());
      }
      stars.push({ x, y, z0: rnd(), gold: rnd() });
    }
    return stars;
  }

  function makeEcliptic() {
    const pts = [];
    for (let lon = 0; lon < 360; lon += 3) {
      const eq = Astro.eclipticToEquatorial(lon, 0);
      pts.push({ lon, v: Astro.toVec(eq.ra, eq.dec) });
    }
    return pts;
  }

  const SAMPLES = buildSamples();
  const FIELD = makeSphere(1500, 0x51a7, 3.6, 6.1);
  const MILKY = makeMilky(720, 0xc0de);
  const WARP = makeWarp(1500, 0x5eed);
  const ECLIPTIC = makeEcliptic();

  function warpSpeed(t, dur) {
    const u = clamp(t / dur, 0, 1);
    return 0.22 + 3.15 * Math.sin(u * Math.PI) ** 0.7;
  }

  function warpTravel(t, dur) {
    const end = Math.min(Math.max(t, 0), dur);
    const steps = 28;
    if (end <= 0) return 0;
    let acc = 0;
    let prev = warpSpeed(0, dur);
    const dt = end / steps;
    for (let i = 1; i <= steps; i++) {
      const sp = warpSpeed(dt * i, dur);
      acc += ((prev + sp) * 0.5) * dt;
      prev = sp;
    }
    return acc;
  }

  function figurePoint(nx, ny, view) {
    return {
      x: view.cx + nx * view.scale + view.shiftX,
      y: view.cy - (ny - view.focusY) * view.scale + view.shiftY,
    };
  }

  function mixPoint(sky, body, morph) {
    if (!body) return sky ? { x: sky.x, y: sky.y, a: 1 } : null;
    if (!sky) return morph > 0.06 ? { x: body.x, y: body.y, a: morph } : null;
    return {
      x: sky.x + (body.x - sky.x) * morph,
      y: sky.y + (body.y - sky.y) * morph,
      a: 1,
    };
  }

  class NatalSky {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      if (!this.ctx) throw new Error("Canvas unavailable");
      this.running = false;
      this.chart = null;
      this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.mouse = [0.5, 0.5];
      this.hudKey = "";
      this.w = 1;
      this.h = 1;
      this._raf = 0;
      this._onResize = () => this.resize();
      this._onMove = (e) => {
        this.mouse = [e.clientX / window.innerWidth, e.clientY / window.innerHeight];
      };
      this._onClick = () => this.advance();
      this._bound = false;
      this._loop = (now) => {
        if (!this.running) return;
        this.draw((now - this.t0) / 1000);
        this._raf = requestAnimationFrame(this._loop);
      };
    }

    edgesFor() {
      if (this.reduce) return { warp: 0.7, slew: 1.6, chart: 2.8, subject: 4.6 };
      return { warp: 4.6, slew: 10.0, chart: 16.8, subject: 26.2 };
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      const bw = Math.floor(w * dpr);
      const bh = Math.floor(h * dpr);
      if (this.canvas.width !== bw || this.canvas.height !== bh) {
        this.canvas.width = bw;
        this.canvas.height = bh;
      }
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w;
      this.h = h;
    }

    open(profile) {
      const chart = Astro.chartFor(profile || {});
      if (chart.error) return chart;
      this.chart = chart;
      this.edges = this.edgesFor();
      this.assignHomes();
      this.hudKey = "";
      this.t0 = performance.now();
      this.running = true;
      this.resize();
      document.body.classList.add("sky-open");
      const hud = document.getElementById("sky-hud");
      if (hud) hud.hidden = false;
      this.attach();
      this.draw(0);
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(this._loop);
      return chart;
    }

    close() {
      this.running = false;
      cancelAnimationFrame(this._raf);
      document.body.classList.remove("sky-open");
      const hud = document.getElementById("sky-hud");
      if (hud) hud.hidden = true;
      this.detach();
    }

    attach() {
      if (this._bound) return;
      this._bound = true;
      window.addEventListener("resize", this._onResize);
      window.addEventListener("mousemove", this._onMove);
      this.canvas.addEventListener("click", this._onClick);
    }

    detach() {
      if (!this._bound) return;
      this._bound = false;
      window.removeEventListener("resize", this._onResize);
      window.removeEventListener("mousemove", this._onMove);
      this.canvas.removeEventListener("click", this._onClick);
    }

    summary() {
      return this.chart && !this.chart.error ? this.chart.copy.summary : "";
    }

    reading() {
      return this.chart && !this.chart.error ? this.chart.brief : null;
    }

    advance() {
      if (!this.running || !this.edges) return;
      const t = (performance.now() - this.t0) / 1000;
      const marks = [this.edges.warp, this.edges.slew, this.edges.chart, this.edges.subject];
      const next = marks.find((mark) => mark > t + 0.08);
      if (!next) return;
      this.t0 = performance.now() - next * 1000;
    }

    seek(seconds) {
      this.t0 = performance.now() - seconds * 1000;
    }

    assignHomes() {
      const chart = this.chart;
      for (const c of Astro.constellations) {
        for (const star of c.stars) {
          star.home = null;
          star.role = null;
        }
      }
      for (const star of FIELD) {
        star.home = null;
        star.role = null;
      }

      const sunStars = Astro.byId[chart.sun.constellationId].stars;
      sunStars.forEach((star, i) => {
        const key = SUN_ANCHORS[i % SUN_ANCHORS.length];
        const [x, y] = ANCHORS[key];
        const lap = Math.floor(i / SUN_ANCHORS.length);
        star.home = { x: x + lap * 0.02, y: y - lap * 0.015 };
        star.role = "sun";
      });

      if (chart.moon.constellationId !== chart.sun.constellationId) {
        const moonStars = Astro.byId[chart.moon.constellationId].stars;
        moonStars.forEach((star, i) => {
          const a = -Math.PI / 2 + (i / moonStars.length) * Math.PI * 2;
          star.home = { x: Math.cos(a) * 0.32, y: HEAD.y + Math.sin(a) * 0.32 };
          star.role = "moon";
        });
      }

      const riseId = chart.rising && chart.rising.constellationId;
      if (riseId && riseId !== chart.sun.constellationId && riseId !== chart.moon.constellationId) {
        const riseStars = Astro.byId[riseId].stars;
        riseStars.forEach((star, i) => {
          const x = -0.78 + (i / Math.max(1, riseStars.length - 1)) * 1.56;
          star.home = { x, y: -1.08 };
          star.role = "rise";
        });
      }

      const center = Astro.centroid(Astro.byId[chart.sun.constellationId]);
      const ranked = FIELD.map((star) => ({
        star,
        d: Astro.angSep(star.ra, star.dec, center.ra, center.dec),
      }))
        .filter((item) => item.d < 72)
        .sort((a, b) => a.d - b.d)
        .slice(0, SAMPLES.length);
      ranked.forEach((item, i) => {
        const sample = SAMPLES[i % SAMPLES.length];
        item.star.home = { x: sample.x, y: sample.y };
        item.star.role = "body";
      });
    }

    scene(t) {
      const edges = this.edges;
      const chart = this.chart;
      const w = this.w;
      const h = this.h;
      let morph = 0;
      let zoom = 0;
      if (t >= edges.chart) {
        const s = clamp((t - edges.chart) / (edges.subject - edges.chart), 0, 1);
        morph = easeInOut(clamp(s / 0.5, 0, 1));
        zoom = easeInOut(clamp((s - 0.2) / 0.8, 0, 1));
      }
      if (t >= edges.subject) {
        morph = 1;
        zoom = 1;
      }

      let u = easeInOut(clamp((t - edges.warp) / (edges.slew - edges.warp), 0, 1));
      let look = Astro.slerp(chart.camStart, chart.camEnd, u);
      let fov = lerp(100, chart.fov, u);
      if (t >= edges.slew) {
        const c = easeInOut(clamp((t - edges.slew) / (edges.chart - edges.slew), 0, 1));
        look = Astro.slerp(
          chart.camEnd,
          { ra: (chart.camEnd.ra + 6.5) % 360, dec: chart.camEnd.dec + 1.4 },
          c * 0.5
        );
        fov = lerp(chart.fov, Math.max(34, chart.fov * 0.76), c);
      }
      if (t >= edges.chart) {
        const s = clamp((t - edges.chart) / (edges.subject - edges.chart), 0, 1);
        fov = lerp(Math.max(34, chart.fov * 0.76), 18, easeInOut(Math.min(1, s * 1.3)));
      }

      const parallax = 1 - morph;
      look = {
        ra: (look.ra + (this.mouse[0] - 0.5) * 5.5 * parallax + 360) % 360,
        dec: clamp(look.dec + (0.5 - this.mouse[1]) * 3.6 * parallax, -75, 75),
      };

      const breath = t >= edges.subject ? 1 + Math.sin(t * 0.65) * 0.012 : 1;
      const minSide = Math.min(w, h);
      const view = {
        w,
        h,
        cx: w * 0.5,
        cy: h * 0.36,
        focusY: lerp(0.0, 0.74, zoom),
        scale: lerp(minSide * 0.18, minSide * 0.78, zoom) * breath,
        shiftX: (this.mouse[0] - 0.5) * 20 * morph,
        shiftY: (this.mouse[1] - 0.5) * 14 * morph,
      };

      const warpLeft = edges.warp - t;
      const warpAlpha = t >= edges.warp ? 0 : warpLeft < 1.2 ? clamp(warpLeft / 1.2, 0, 1) : 1;
      const skyFade = t <= edges.warp - 1.4 ? 0 : clamp((t - (edges.warp - 1.4)) / 1.15, 0, 1);

      let phase = "warp";
      if (t >= edges.subject) phase = "hold";
      else if (t >= edges.chart) phase = zoom > 0.62 ? "near" : "subject";
      else if (t >= edges.slew) phase = "chart";
      else if (t >= edges.warp) phase = "slew";

      return { morph, zoom, look, fov, view, warpAlpha, skyFade, phase, t };
    }

    draw(t) {
      if (!this.chart) return;
      this.resize();
      const ctx = this.ctx;
      const scene = this.scene(Math.max(0, t));
      this._scene = scene;
      const { w, h } = scene.view;
      this.paintGround(ctx, scene);
      this.paintWarp(ctx, scene);
      if (scene.skyFade > 0.01) this.paintSky(ctx, scene);
      this.paintHud(scene);
    }

    place(v, cam) {
      const scene = this._scene;
      const p = Astro.projectVec(v, cam, scene.view.w, scene.view.h);
      if (!p) return null;
      p.y -= (1 - scene.morph) * scene.view.h * 0.075;
      return p;
    }

    paintGround(ctx, scene) {
      const { w, h } = scene.view;
      const g = ctx.createRadialGradient(w * 0.5, h * 0.44, h * 0.04, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
      if (scene.morph < 0.35) {
        g.addColorStop(0, "#151821");
        g.addColorStop(0.5, "#090a0e");
        g.addColorStop(1, "#050508");
      } else {
        g.addColorStop(0, "#1c1810");
        g.addColorStop(0.42, "#0c0c12");
        g.addColorStop(1, "#050508");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (scene.t < 1.8 && !this.reduce) {
        const u = scene.t / 1.8;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.5, u * Math.min(w, h) * 0.66, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(228, 194, 122, ${(1 - u) * (1 - u) * 0.45})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        if (scene.t > 0.28) {
          const u2 = (scene.t - 0.28) / 1.5;
          ctx.beginPath();
          ctx.arc(w * 0.5, h * 0.5, u2 * Math.min(w, h) * 0.4, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(126, 232, 255, ${(1 - u2) * 0.22})`;
          ctx.stroke();
        }
      }
    }

    paintWarp(ctx, scene) {
      const alpha = scene.warpAlpha * (this.reduce ? 0.35 : 1);
      if (alpha <= 0.01) return;
      const { w, h } = scene.view;
      const cx = w * 0.5;
      const cy = h * 0.5;
      const span = Math.min(w, h) * 0.62;
      const dur = this.edges.warp;
      const travel = warpTravel(scene.t, dur) * 0.62;
      const speed = warpSpeed(Math.min(scene.t, dur), dur);
      const streak = 0.02 + speed * 0.03;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.22);
      glow.addColorStop(0, `rgba(228, 194, 122, ${alpha * 0.22})`);
      glow.addColorStop(0.45, `rgba(126, 232, 255, ${alpha * 0.05})`);
      glow.addColorStop(1, "rgba(228, 194, 122, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.lineCap = "round";
      for (const star of WARP) {
        const z = Math.max(0.04, wrap01(star.z0 - travel));
        const prev = Math.max(0.04, wrap01(star.z0 - travel - streak));
        const wrapped = Math.abs(z - prev) > 0.45;
        const x = cx + (star.x / z) * span;
        const y = cy + (star.y / z) * span;
        const near = 1 - z;
        const a = alpha * (0.22 + near * 0.95) * (star.gold > 0.82 ? 1 : 0.8);
        if (a < 0.04) continue;
        const rgb = star.gold > 0.84 ? "228, 194, 122" : star.gold < 0.1 ? "126, 232, 255" : "232, 228, 216";
        ctx.strokeStyle = `rgba(${rgb}, ${a})`;
        ctx.lineWidth = 0.7 + near * 2.5;
        ctx.beginPath();
        if (wrapped) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + 0.6, y);
        } else {
          ctx.moveTo(cx + (star.x / prev) * span, cy + (star.y / prev) * span);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    paintSky(ctx, scene) {
      const chart = this.chart;
      const cam = Astro.prepCamera(scene.look.ra, scene.look.dec, scene.fov);
      const { view } = scene;
      const fade = scene.skyFade;

      this.paintDust(ctx, MILKY, cam, scene, "rgba(176, 186, 204, 0.9)", 0.22);
      this.paintDust(ctx, FIELD, cam, scene, "rgba(214, 218, 226, 0.95)", 0.62);
      this.paintEcliptic(ctx, cam, scene);
      this.paintLines(ctx, cam, scene);
      this.paintThreads(ctx, cam, scene);
      this.paintCatalog(ctx, cam, scene);
      this.paintBodies(ctx, cam, scene);
      this.paintDisc(ctx, cam, scene, chart.sun.v, ANCHORS.heart, "242, 214, 140", 3.2 + scene.zoom * 2.4);
      this.paintDisc(ctx, cam, scene, chart.moon.v, ANCHORS.brow, "186, 236, 255", 2.3 + scene.zoom * 1.3);
      if (chart.rising) {
        this.paintDisc(ctx, cam, scene, Astro.toVec(chart.rising.eq.ra, chart.rising.eq.dec), [0, -1.02], "186, 168, 255", 2.1);
      }
      this.paintFigure(ctx, scene);
      this.paintLabels(ctx, cam, scene);
    }

    paintDust(ctx, stars, cam, scene, color, gain) {
      const { view, morph, skyFade } = scene;
      ctx.fillStyle = color;
      for (const star of stars) {
        const sky = this.place(star.v, cam);
        let x;
        let y;
        let a;
        if (star.home) {
          const body = figurePoint(star.home.x, star.home.y, view);
          const mixed = mixPoint(sky, body, morph);
          if (!mixed) continue;
          x = mixed.x;
          y = mixed.y;
          a = mixed.a;
        } else {
          if (!sky || morph > 0.98) continue;
          const dx = sky.x - view.cx;
          const dy = sky.y - view.cy;
          x = sky.x + dx * morph * 0.85;
          y = sky.y + dy * morph * 0.85;
          a = 1 - morph;
        }
        a *= skyFade * gain;
        if (a < 0.025) continue;
        if (x < -8 || y < -8 || x > view.w + 8 || y > view.h + 8) continue;
        const size = star.home
          ? Math.min(2.5, Math.max(0.8, (5.2 - star.mag) * 0.4) * (1 + morph * Math.min(1.1, view.scale / 520)))
          : star.milky
            ? 1.15
            : star.mag > 5.2
              ? 0.9
              : 1.25;
        ctx.globalAlpha = a;
        if (size > 1.8) {
          ctx.beginPath();
          ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;
    }

    paintEcliptic(ctx, cam, scene) {
      const alpha = scene.skyFade * (1 - scene.morph);
      if (alpha < 0.02) return;
      const { view } = scene;
      const sector = this.chart.sun.sector;
      ctx.lineWidth = 1;
      let prev = null;
      for (let i = 0; i <= ECLIPTIC.length; i++) {
        const pt = ECLIPTIC[i % ECLIPTIC.length];
        const p = this.place(pt.v, cam);
        if (prev && p) {
          const dist = Math.hypot(p.x - prev.p.x, p.y - prev.p.y);
          const dLon = (pt.lon - prev.lon + 360) % 360;
          if (dist < Math.max(view.w, view.h) * 0.28 && dLon < 8) {
            const mid = (prev.lon + 1.5) % 360;
            const inSector = mid >= sector[0] && mid < sector[1];
            ctx.strokeStyle = inSector
              ? `rgba(228, 194, 122, ${alpha * 0.7})`
              : `rgba(228, 194, 122, ${alpha * 0.13})`;
            ctx.beginPath();
            ctx.moveTo(prev.p.x, prev.p.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        }
        prev = p ? { p, lon: pt.lon } : null;
      }
    }

    roleOf(id) {
      const chart = this.chart;
      if (id === chart.sun.constellationId) return "sun";
      if (id === chart.moon.constellationId) return "moon";
      if (chart.rising && id === chart.rising.constellationId) return "rise";
      if (!chart.sun.agrees && id === chart.sun.among.constellation.id) return "among";
      return "other";
    }

    lineStyle(role, alpha) {
      if (role === "sun") return `rgba(228, 194, 122, ${alpha * 0.9})`;
      if (role === "moon") return `rgba(126, 232, 255, ${alpha * 0.6})`;
      if (role === "rise") return `rgba(176, 156, 255, ${alpha * 0.55})`;
      if (role === "among") return `rgba(228, 194, 122, ${alpha * 0.4})`;
      return `rgba(190, 184, 168, ${alpha * 0.28})`;
    }

    paintLines(ctx, cam, scene) {
      const fade = scene.skyFade * (1 - clamp(scene.morph * 1.35, 0, 1));
      if (fade < 0.02) return;
      const reveal = clamp((scene.t - this.edges.warp * 0.82) / 3.4, 0, 1);
      const { view } = scene;
      ctx.lineWidth = 1.15;
      ctx.lineCap = "round";
      Astro.constellations.forEach((c, index) => {
        const local = clamp(reveal * 1.4 - index * 0.03, 0, 1);
        if (local <= 0) return;
        const role = this.roleOf(c.id);
        ctx.strokeStyle = this.lineStyle(role, fade * local);
        for (const [a, b] of c.lines) {
          const pa = this.place(c.stars[a].v, cam);
          const pb = this.place(c.stars[b].v, cam);
          if (!pa || !pb) continue;
          if (Math.hypot(pb.x - pa.x, pb.y - pa.y) > Math.max(view.w, view.h) * 0.45) continue;
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pa.x + (pb.x - pa.x) * local, pa.y + (pb.y - pa.y) * local);
          ctx.stroke();
        }
      });
    }

    paintThreads(ctx, cam, scene) {
      const alpha = scene.skyFade * (1 - scene.morph) * clamp((scene.t - this.edges.slew) / 1.6, 0, 1);
      if (alpha < 0.03) return;
      const { view } = scene;
      const sun = this.place(this.chart.sun.v, cam);
      if (!sun) return;
      const stars = Astro.byId[this.chart.sun.constellationId].stars;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(228, 194, 122, ${alpha * 0.35})`;
      for (const star of stars) {
        const p = this.place(star.v, cam);
        if (!p) continue;
        if (Math.hypot(p.x - sun.x, p.y - sun.y) > Math.max(view.w, view.h) * 0.5) continue;
        ctx.beginPath();
        ctx.moveTo(sun.x, sun.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }

    paintCatalog(ctx, cam, scene) {
      const { view, skyFade, morph } = scene;
      const lists = [];
      for (const c of Astro.constellations) lists.push(...c.stars);
      lists.push(...Astro.beacons);
      for (const star of lists) {
        if (star.home) continue;
        const sky = this.place(star.v, cam);
        if (!sky) continue;
        const dx = sky.x - view.cx;
        const dy = sky.y - view.cy;
        const x = sky.x + dx * morph * 0.85;
        const y = sky.y + dy * morph * 0.85;
        const a = skyFade * (1 - morph);
        if (a < 0.03 || x < -20 || y < -20 || x > view.w + 20 || y > view.h + 20) continue;
        const tw = 0.84 + 0.16 * Math.sin(scene.t * (1.1 + star.mag * 0.15) + (star.phase || star.ra));
        this.paintStar(ctx, x, y, star.mag, a * tw, star.constellationId ? this.roleOf(star.constellationId) : "other", 1);
      }
    }

    paintBodies(ctx, cam, scene) {
      const { view, skyFade, morph } = scene;
      const stars = [];
      for (const c of Astro.constellations) {
        for (const star of c.stars) if (star.home) stars.push(star);
      }
      for (const star of stars) {
        const sky = this.place(star.v, cam);
        const body = figurePoint(star.home.x, star.home.y, view);
        const mixed = mixPoint(sky, body, morph);
        if (!mixed) continue;
        const boost = 1 + morph * Math.min(1.15, view.scale / 520);
        const tw = 0.86 + 0.14 * Math.sin(scene.t * 1.3 + star.ra);
        this.paintStar(ctx, mixed.x, mixed.y, star.mag, skyFade * mixed.a * tw, star.role || "sun", boost);
      }
    }

    paintStar(ctx, x, y, mag, alpha, role, boost) {
      if (alpha < 0.03) return;
      const base = Math.max(0.55, (5.6 - mag) * 0.5);
      const cap = role === "body" ? 2.4 : 4.2;
      const radius = Math.min(base * boost, cap);
      let rgb = "232, 228, 216";
      if (role === "sun") rgb = "228, 194, 122";
      else if (role === "moon") rgb = "126, 232, 255";
      else if (role === "rise") rgb = "186, 168, 255";
      else if (role === "among") rgb = "214, 196, 150";
      else if (role === "body") rgb = "236, 230, 214";
      if (radius > 1.6 || role === "sun" || role === "moon") {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${rgb}, ${alpha * 0.14})`;
        ctx.arc(x, y, radius * 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    paintFigure(ctx, scene) {
      const { view, morph, zoom } = scene;
      const lineA = clamp((morph - 0.22) / 0.48, 0, 1) * scene.skyFade;
      if (lineA < 0.02 && zoom < 0.3) return;
      const gold = "228, 194, 122";
      const a = lineA;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, view.w, view.h - 248);
      ctx.clip();
      ctx.lineWidth = lerp(1.1, 1.7, zoom);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = `rgba(${gold}, ${a * 0.8})`;

      const head = figurePoint(HEAD.x, HEAD.y, view);
      ctx.beginPath();
      ctx.arc(head.x, head.y, HEAD.r * view.scale, 0, Math.PI * 2);
      ctx.stroke();

      if (zoom > 0.35) {
        ctx.beginPath();
        ctx.arc(head.x, head.y, HEAD.r * view.scale * 1.28, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${gold}, ${(zoom - 0.35) * 0.45})`;
        ctx.stroke();
      }

      ctx.strokeStyle = `rgba(${gold}, ${a * 0.72})`;
      for (const chain of CHAINS) {
        ctx.beginPath();
        chain.forEach((key, i) => {
          const p = figurePoint(ANCHORS[key][0], ANCHORS[key][1], view);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }

      const ground = this.chart.rising ? "176, 156, 255" : gold;
      ctx.strokeStyle = `rgba(${ground}, ${a * 0.45})`;
      const g0 = figurePoint(-0.62, -1.05, view);
      const g1 = figurePoint(0.62, -1.05, view);
      ctx.beginPath();
      ctx.moveTo(g0.x, g0.y);
      ctx.lineTo(g1.x, g1.y);
      ctx.stroke();

      const eyeA = clamp((zoom - 0.34) / 0.4, 0, 1) * scene.skyFade;
      if (eyeA > 0.02) {
        for (const ex of [-0.055, 0.055]) {
          const eye = figurePoint(ex, 0.755, view);
          const eyeR = Math.max(1.4, view.scale * 0.005);
          ctx.beginPath();
          ctx.fillStyle = `rgba(232, 226, 206, ${eyeA * 0.2})`;
          ctx.arc(eye.x, eye.y, eyeR * 3.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.fillStyle = `rgba(255, 246, 224, ${eyeA})`;
          ctx.arc(eye.x, eye.y, eyeR, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (zoom > 0.45) {
        const heart = figurePoint(ANCHORS.heart[0], ANCHORS.heart[1], view);
        const s = Math.max(5, view.scale * 0.04);
        const sigil = this.chart.veilOpen ? "126, 232, 255" : gold;
        ctx.save();
        ctx.translate(heart.x, heart.y);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = `rgba(${sigil}, ${(zoom - 0.45) * 0.9})`;
        ctx.lineWidth = 1.3;
        ctx.strokeRect(-s, -s, s * 2, s * 2);
        ctx.restore();
      }
      ctx.restore();
    }

    paintDisc(ctx, cam, scene, vec, home, rgb, radius) {
      const sky = this.place(vec, cam);
      const body = figurePoint(home[0], home[1], scene.view);
      const p = mixPoint(sky, body, scene.morph);
      if (!p) return;
      if (scene.morph > 0.3 && (p.y > scene.view.h - 200 || p.y < 48)) return;
      const a = scene.skyFade * (p.a == null ? 1 : p.a);
      ctx.beginPath();
      ctx.fillStyle = `rgba(${rgb}, ${a * 0.18})`;
      ctx.arc(p.x, p.y, radius * 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = `rgba(${rgb}, ${a})`;
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    paintLabels(ctx, cam, scene) {
      if (scene.morph > 0.34 || scene.skyFade < 0.4) return;
      const reveal = clamp((scene.t - this.edges.warp) / 2.4, 0, 1);
      if (reveal <= 0) return;
      const { view } = scene;
      const labels = [];
      for (const c of Astro.constellations) {
        const center = Astro.centroid(c);
        const p = Astro.project(center.ra, center.dec, cam.ra, cam.dec, cam.fov, view.w, view.h);
        if (!p) continue;
        p.y -= (1 - scene.morph) * view.h * 0.075;
        if (p.x < 36 || p.x > view.w - 36 || p.y < 78 || p.y > view.h - 210) continue;
        const role = this.roleOf(c.id);
        const priority = role === "sun" ? 0 : role === "among" ? 1 : role === "moon" ? 2 : role === "rise" ? 3 : c.zodiac ? 4 : 5;
        labels.push({ x: p.x, y: p.y - 16, name: c.name, role, priority });
      }
      labels.sort((a, b) => a.priority - b.priority);
      const kept = [];
      for (const label of labels) {
        if (label.priority > 3 && kept.length >= 4) continue;
        if (kept.some((k) => Math.hypot(k.x - label.x, k.y - label.y) < 78)) continue;
        kept.push(label);
        if (kept.length >= 5) break;
      }
      ctx.font = "500 12px Cinzel, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0.22em";
      const fitted = kept.filter((label) => {
        const width = ctx.measureText(label.name.toUpperCase()).width;
        return label.x - width / 2 > 48 && label.x + width / 2 < view.w - 48;
      });
      for (const label of fitted) {
        ctx.fillStyle = this.lineStyle(label.role, scene.skyFade * reveal);
        ctx.fillText(label.name.toUpperCase(), label.x, label.y);
      }
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    }

    paintHud(scene) {
      const copy = this.chart.copy;
      const map = {
        warp: ["warpKicker", "warpTitle", "warpCaption"],
        slew: ["slewKicker", "slewTitle", "slewCaption"],
        chart: ["chartKicker", "chartTitle", "chartCaption"],
        subject: ["subjectKicker", "subjectTitle", "subjectCaption"],
        near: ["holdKicker", "holdTitle", "holdCaption"],
        hold: ["holdKicker", "holdTitle", "holdCaption"],
      };
      const key = scene.phase;
      if (key === this.hudKey) return;
      this.hudKey = key;
      const [kickerId, titleId, captionId] = map[key];
      const kicker = document.getElementById("sky-kicker");
      const title = document.getElementById("sky-title");
      const caption = document.getElementById("sky-caption");
      if (!kicker || !title || !caption) return;
      kicker.textContent = copy[kickerId];
      title.textContent = copy[titleId];
      caption.textContent = copy[captionId];
      title.classList.remove("swap");
      void title.offsetWidth;
      title.classList.add("swap");
      const signs = document.getElementById("sky-signs");
      if (signs) signs.hidden = key === "warp";
      const sun = document.getElementById("sky-sun");
      const moon = document.getElementById("sky-moon");
      const rise = document.getElementById("sky-rise");
      if (sun) sun.textContent = this.chart.sun.sign.name;
      if (moon) moon.textContent = this.chart.moon.sign.name;
      if (rise) rise.textContent = this.chart.rising ? this.chart.rising.sign.name : "—";
      const closer = document.getElementById("sky-closer");
      if (closer) closer.disabled = key === "hold";
    }
  }

  window.NatalSky = NatalSky;
})();
