(() => {
  const VERT = `#version 300 es
  in vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
  precision highp float;
  uniform vec2 u_res;
  uniform float u_time;
  uniform float u_meaning;
  uniform float u_records;
  uniform float u_think;
  uniform vec2 u_mouse;
  out vec4 fragColor;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 uv = frag / u_res;
    vec2 p = (frag - 0.5 * u_res) / min(u_res.x, u_res.y);

    float t = u_time;
    float think = clamp(u_think, 0.0, 1.0);
    float mean = clamp(u_meaning, 0.0, 1.0);
    float rec = clamp(u_records, 0.0, 1.0);

    float snowRate = mix(18.0, 48.0, think);
    float snow = hash(frag + vec2(t * snowRate * 1.7, t * snowRate * 0.9));
    float snowB = hash(frag * 1.61 + vec2(-t * 13.0, t * 22.0));
    float analog = snow * 0.62 + snowB * 0.38;

    vec2 grid = mix(vec2(140.0, 78.0), vec2(72.0, 40.0), mean);
    vec2 cell = floor(uv * grid);
    vec2 fuv = fract(uv * grid);
    float flicker = floor(t * mix(14.0, 3.5, mean));
    float token = hash21(cell + flicker);
    vec2 gc = fuv * 2.0 - 1.0;
    float stem = smoothstep(0.18, 0.04, abs(gc.x - (token - 0.5) * 0.9)) *
                 smoothstep(1.0, 0.15, abs(gc.y));
    float arm = smoothstep(0.16, 0.04, abs(gc.y - (hash21(cell + 19.0) - 0.5) * 0.7)) *
                smoothstep(0.95, 0.2, abs(gc.x));
    float glyph = max(stem, arm) * step(0.38, token);

    float row = abs(sin(uv.y * mix(90.0, 46.0, mean) + t * 0.15));
    float textRow = smoothstep(0.22, 0.0, row);
    float script = glyph * mix(0.2, 1.0, mean) + textRow * 0.12 * mean;

    float d = length(uv - u_mouse);
    float well = smoothstep(0.42, 0.0, d);

    float ring = abs(length(p) - mix(0.18, 0.46, rec) + 0.02 * sin(t * 0.7));
    float sacred = smoothstep(0.02, 0.0, ring) * rec;
    float vesica = smoothstep(0.03, 0.0, abs(length(p - vec2(-0.08, 0.0)) - 0.28))
                 + smoothstep(0.03, 0.0, abs(length(p - vec2(0.08, 0.0)) - 0.28));
    sacred += vesica * 0.35 * rec;

    float noiseAmt = mix(1.0, 0.14, mean * 0.9);
    noiseAmt = mix(noiseAmt, 1.15, think * 0.55);
    float signal = mix(analog, mix(analog * 0.25, script, mean), 1.0 - noiseAmt + 0.18);
    signal += sacred * 0.55;
    signal += well * 0.08 * (0.4 + think);

    vec3 idle = vec3(0.52, 0.55, 0.60);
    vec3 cyan = vec3(0.49, 0.91, 1.0);
    vec3 gold = vec3(0.89, 0.76, 0.45);
    vec3 viol = vec3(0.55, 0.42, 1.0);
    vec3 tint = mix(idle, mix(viol, cyan, 0.55), think);
    tint = mix(tint, gold, rec);

    vec3 col = vec3(signal) * tint;
    float vein = smoothstep(0.018, 0.0, abs(uv.x - 0.5 + 0.12 * sin(uv.y * 7.0 + t * 0.4)));
    col += gold * vein * rec * 0.7;
    col += cyan * well * think * 0.12;

    float aberr = (hash(frag + t) - 0.5) * mix(0.03, 0.01, mean);
    col.r += aberr;
    col.b -= aberr;

    float vig = smoothstep(1.18, 0.28, length(p));
    col *= vig;
    col += analog * 0.035;

    float scan = 0.9 + 0.1 * sin(frag.y * 2.2 + t * 8.0);
    col *= scan;

    fragColor = vec4(col, 1.0);
  }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  class Field {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        powerPreference: "high-performance",
      });
      if (!this.gl) throw new Error("WebGL2 unavailable");
      this.meaning = 0.12;
      this.records = 0;
      this.think = 0;
      this.mouse = [0.5, 0.5];
      this.target = { meaning: 0.12, records: 0, think: 0 };
      this._init();
      this.resize();
      this.running = true;
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
      window.addEventListener("resize", () => this.resize());
      window.addEventListener("mousemove", (e) => {
        this.mouse = [e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight];
      });
    }

    _init() {
      const gl = this.gl;
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog));
      }
      this.prog = prog;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {
        res: gl.getUniformLocation(prog, "u_res"),
        time: gl.getUniformLocation(prog, "u_time"),
        meaning: gl.getUniformLocation(prog, "u_meaning"),
        records: gl.getUniformLocation(prog, "u_records"),
        think: gl.getUniformLocation(prog, "u_think"),
        mouse: gl.getUniformLocation(prog, "u_mouse"),
      };
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (this.canvas.width === w && this.canvas.height === h) return;
      this.canvas.width = w;
      this.canvas.height = h;
    }

    set(partial) {
      Object.assign(this.target, partial);
    }

    loop(now) {
      if (!this.running) return;
      const gl = this.gl;
      const k = 0.045;
      this.meaning += (this.target.meaning - this.meaning) * k;
      this.records += (this.target.records - this.records) * k;
      this.think += (this.target.think - this.think) * k;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this.prog);
      gl.uniform2f(this.u.res, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.u.time, now * 0.001);
      gl.uniform1f(this.u.meaning, this.meaning);
      gl.uniform1f(this.u.records, this.records);
      gl.uniform1f(this.u.think, this.think);
      gl.uniform2f(this.u.mouse, this.mouse[0], this.mouse[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(this.loop);
    }
  }

  window.AkashicField = Field;
})();
