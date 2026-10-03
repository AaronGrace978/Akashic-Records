(() => {
  class Tone {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.hissGain = null;
      this.filter = null;
      this.hushed = false;
      this.veilPlayed = false;
      this.field = null;
    }

    setHush(on) {
      this.hushed = Boolean(on);
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(this.hushed ? 0 : 1, this.ctx.currentTime, 0.05);
      }
    }

    markVeil(open) {
      this.veilPlayed = Boolean(open);
    }

    ensure() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = this.hushed ? 0 : 1;
      master.connect(ctx.destination);

      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.02;
        b2 = 0.95 * b2 + white * 0.012;
        data[i] = (b0 + b1 + b2) * 0.28;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 700;
      filter.Q.value = 0.4;
      const hissGain = ctx.createGain();
      hissGain.gain.value = 0.02;
      source.connect(filter);
      filter.connect(hissGain);
      hissGain.connect(master);
      source.start();

      this.ctx = ctx;
      this.master = master;
      this.filter = filter;
      this.hissGain = hissGain;
      if (ctx.state === "suspended") ctx.resume();
    }

    follow(field) {
      this.field = field;
      const tick = () => {
        this.mix();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    mix() {
      if (!this.ctx || !this.field || !this.hissGain) return;
      const mean = this.field.meaning || 0;
      const rec = this.field.records || 0;
      const think = this.field.think || 0;
      const targetRecords = this.field.target?.records ?? rec;
      const hiss = 0.045 * (1 - mean * 0.72) * (1 - rec * 0.82) + think * 0.016;
      const now = this.ctx.currentTime;
      this.hissGain.gain.setTargetAtTime(Math.max(0.004, hiss), now, 0.12);
      this.filter.frequency.setTargetAtTime(420 + mean * 1600 + think * 700, now, 0.12);
      if (targetRecords < 0.15 && rec < 0.2) this.veilPlayed = false;
      if (rec > 0.82 && !this.veilPlayed) this.chime();
    }

    chime() {
      this.veilPlayed = true;
      if (!this.ctx || this.hushed) return;
      const now = this.ctx.currentTime;
      [196, 294, 392].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const peak = i === 0 ? 0.07 : 0.035;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + 2.7);
      });
    }
  }

  window.AkashicTone = Tone;
})();
