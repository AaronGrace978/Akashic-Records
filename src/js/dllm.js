(() => {
  const NOISE = "░▒▓█▀▄▌▐■□▪▫●○◆◇◈▲△▼▽✚✦✧⋆✶✺※∞øþæ§¶†‡•∙∘◐◑◒◓◔◕¤ø¤╪╫╬╔╗╚╝═║╱╲╳░▒";

  function hash(n) {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  }

  class DLLMText {
    constructor(el, { speed = 1, alphabet = NOISE } = {}) {
      this.el = el;
      this.alphabet = alphabet;
      this.target = "";
      this.shown = [];
      this.heat = [];
      this.locked = [];
      this.speed = speed;
      this.raf = 0;
      this.done = false;
      this.onDone = null;
    }

    setTarget(text, { reset = false } = {}) {
      this.target = text;
      if (reset) {
        this.shown = [];
        this.heat = [];
        this.locked = [];
        this.done = false;
      }
      while (this.shown.length < text.length) {
        this.shown.push(this.rand());
        this.heat.push(0);
        this.locked.push(false);
      }
      if (this.shown.length > text.length) {
        this.shown.length = text.length;
        this.heat.length = text.length;
        this.locked.length = text.length;
      }
      this.play();
    }

    rand() {
      return this.alphabet[(Math.random() * this.alphabet.length) | 0];
    }

    play() {
      if (this.raf) return;
      const tick = () => {
        this.step();
        this.render();
        if (!this.done) this.raf = requestAnimationFrame(tick);
        else this.raf = 0;
      };
      this.raf = requestAnimationFrame(tick);
    }

    step() {
      const t = this.target;
      if (!t.length) return;
      let all = true;
      for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (ch === "\n" || ch === " " || ch === "\t") {
          this.shown[i] = ch;
          this.locked[i] = true;
          continue;
        }
        if (this.locked[i]) continue;
        all = false;
        this.heat[i] += 0.045 * this.speed + (i < 8 ? 0.02 : 0);
        const p = Math.min(0.92, this.heat[i]);
        if (Math.random() < p) this.shown[i] = ch;
        else this.shown[i] = this.rand();
        if (this.shown[i] === ch && this.heat[i] > 0.55) this.locked[i] = true;
      }
      if (all && this.shown.length === t.length) {
        this.done = true;
        this.onDone?.();
      }
    }

    render() {
      const t = this.target;
      let html = "";
      for (let i = 0; i < this.shown.length; i++) {
        const ch = this.shown[i];
        const safe = ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === "&" ? "&amp;" : ch;
        if (this.locked[i] || t[i] === " " || t[i] === "\n") html += safe;
        else html += `<span class="noise-char">${safe}</span>`;
      }
      this.el.innerHTML = html;
    }

    snap() {
      this.shown = this.target.split("");
      this.locked = this.shown.map(() => true);
      this.done = true;
      this.render();
    }
  }

  async function denoiseInto(el, text, opts = {}) {
    const d = new DLLMText(el, opts);
    d.setTarget(text, { reset: true });
    if (!text) return;
    await new Promise((resolve) => {
      d.onDone = resolve;
      setTimeout(resolve, Math.min(4000, 280 + text.length * 18));
    });
    d.snap();
  }

  window.DLLM = { DLLMText, denoiseInto, NOISE };
})();
