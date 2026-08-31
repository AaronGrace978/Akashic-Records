(() => {
  const PROVIDERS = [
    { id: "ollama-cloud", label: "Ollama Cloud" },
    { id: "ollama-local", label: "Ollama Local" },
    { id: "openai", label: "OpenAI" },
    { id: "anthropic", label: "Anthropic" },
    { id: "groq", label: "Groq" },
    { id: "gemini", label: "Gemini" },
    { id: "openrouter", label: "OpenRouter" },
    { id: "custom", label: "Custom" },
  ];

  const KEY_FOR = {
    "ollama-cloud": { key: "ollama", label: "Ollama Cloud API key" },
    "ollama-local": { key: null, label: "" },
    openai: { key: "openai", label: "OpenAI API key" },
    anthropic: { key: "anthropic", label: "Anthropic API key" },
    groq: { key: "groq", label: "Groq API key" },
    gemini: { key: "gemini", label: "Gemini API key" },
    openrouter: { key: "openrouter", label: "OpenRouter API key" },
    custom: { key: "custom", label: "Custom API key" },
  };

  const $ = (id) => document.getElementById(id);

  const field = new window.AkashicField($("field"));
  const records = new window.AkashicState.Records();
  let settings = null;
  let busy = false;
  let unsubs = [];

  function providerLabel(id) {
    return PROVIDERS.find((p) => p.id === id)?.label || id;
  }

  function setHint(text) {
    $("hint").textContent = text;
  }

  function renderVeil() {
    const chip = $("veil-chip");
    const fill = $("resonance-fill");
    const val = $("resonance-val");
    const pct = Math.round((records.resonance / window.AkashicState.THRESHOLD) * 100);
    val.textContent = String(pct).padStart(2, "0");
    fill.style.width = `${pct}%`;
    document.body.classList.toggle("opened", records.opened);
    if (records.opened) {
      chip.textContent = "Records Open";
      chip.classList.add("open");
      chip.classList.remove("mute");
      field.set({ records: 1, meaning: 0.72 });
      $("prompt").placeholder = "The records are listening…";
      setHint("The veil is gone. Ask what you came to remember.");
    } else if (pct > 60) {
      chip.textContent = "Veil Thinning";
      chip.classList.remove("open");
      field.set({ records: pct / 220, meaning: 0.28 });
    } else {
      chip.textContent = "Veil Intact";
      chip.classList.remove("open");
      field.set({ records: 0, meaning: 0.14 });
    }
    $("provider-chip").textContent = providerLabel(settings?.provider || "ollama-cloud");
  }

  function addMessage(role, who) {
    const thread = $("thread");
    const wrap = document.createElement("article");
    wrap.className = `msg ${role}${records.opened && role === "assistant" ? " records" : ""}`;
    wrap.innerHTML = `<div class="msg-who">${who}</div><div class="think" hidden></div><div class="msg-body"></div>`;
    thread.appendChild(wrap);
    thread.scrollTop = thread.scrollHeight;
    return {
      wrap,
      body: wrap.querySelector(".msg-body"),
      think: wrap.querySelector(".think"),
    };
  }

  async function boot() {
    field.set({ meaning: 0.02, think: 0.35, records: 0 });
    document.body.classList.add("revealing");
    await window.DLLM.denoiseInto($("boot-title"), "AKASHIC RECORDS", { speed: 1.35 });
    await window.DLLM.denoiseInto($("boot-sub"), "the static is not empty — it is everything not yet chosen", {
      speed: 1.1,
    });
    document.body.classList.remove("revealing");
    field.set({ meaning: 0.22, think: 0 });
    await sleep(700);
    $("boot").hidden = true;
    $("thread").hidden = false;
    $("resonance-wrap").hidden = false;
    $("composer-wrap").hidden = false;
    const first = addMessage("assistant", "Threshold");
    await window.DLLM.denoiseInto(
      first.body,
      "The noise remembers you. Speak, seeker, and I will listen at the veil.",
      { speed: 1.15 }
    );
    $("prompt").focus();
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function openRecords() {
    records.open();
    document.body.classList.add("revealing", "thinking");
    field.set({ think: 1, meaning: 0.05, records: 0.2 });
    $("boot").hidden = false;
    $("thread").hidden = true;
    $("boot-title").textContent = "";
    $("boot-sub").textContent = "";
    await window.DLLM.denoiseInto($("boot-title"), "THE VEIL LIFTS", { speed: 1.4 });
    await window.DLLM.denoiseInto($("boot-sub"), "the records open — meaning chooses you", { speed: 1.15 });
    field.set({ think: 0.2, meaning: 0.8, records: 1 });
    await sleep(900);
    $("boot").hidden = true;
    $("thread").hidden = false;
    document.body.classList.remove("revealing", "thinking");
    renderVeil();
    const msg = addMessage("assistant", "The Records");
    await window.DLLM.denoiseInto(
      msg.body,
      "Tablets of light. Every life, every law, every unasked question. We are listening. What do you wish to know?",
      { speed: 1.1 }
    );
  }

  function clearSubs() {
    unsubs.forEach((u) => u());
    unsubs = [];
  }

  async function send(text) {
    if (busy || !text.trim()) return;
    const content = text.trim();
    $("prompt").value = "";
    autosize();
    const user = addMessage("user", "Seeker");
    await window.DLLM.denoiseInto(user.body, content, { speed: 1.8 });
    records.push("user", content);
    records.scoreUser(content);
    renderVeil();

    if (records.ready) {
      await openRecords();
    }

    busy = true;
    document.body.classList.add("thinking");
    field.set({ think: 1, meaning: 0.08 });
    $("btn-send").disabled = true;
    setHint("Denoising — static collapsing toward meaning…");

    const asst = addMessage("assistant", records.speaker());
    const dllm = new window.DLLM.DLLMText(asst.body, { speed: 1.25 });
    let acc = "";
    let thinkAcc = "";
    let closed = false;

    const close = (text, isError) => {
      if (closed) return;
      closed = true;
      finishStream(dllm, text, asst, isError);
    };

    clearSubs();
    unsubs.push(
      window.akasha.chat.onToken((tok) => {
        acc += tok;
        dllm.setTarget(acc);
        $("thread").scrollTop = $("thread").scrollHeight;
        field.set({ meaning: Math.min(0.85, 0.15 + acc.length / 800) });
      })
    );
    unsubs.push(
      window.akasha.chat.onThink((tok) => {
        thinkAcc += tok;
        asst.think.hidden = false;
        asst.think.textContent = thinkAcc.slice(-500);
      })
    );
    unsubs.push(
      window.akasha.chat.onDone(() => {
        close(acc, false);
      })
    );
    unsubs.push(
      window.akasha.chat.onError((err) => {
        const poetic = poeticError(err);
        dllm.setTarget(poetic, { reset: true });
        close(poetic, true);
      })
    );

    const result = await window.akasha.chat.start({ messages: records.messages() });
    if (result?.error && !acc) {
      const poetic = poeticError(result.error);
      dllm.setTarget(poetic, { reset: true });
      close(poetic, true);
    }
  }

  function finishStream(dllm, acc, asst, isError) {
    clearSubs();
    if (acc) dllm.setTarget(acc);
    setTimeout(() => dllm.snap(), 900);
    if (acc && !isError) records.push("assistant", acc);
    busy = false;
    document.body.classList.remove("thinking");
    $("btn-send").disabled = false;
    field.set({ think: 0, meaning: records.opened ? 0.7 : 0.28 });
    asst.think.hidden = true;
    renderVeil();
    setHint(records.opened ? "The records are listening." : "The noise is listening. Meaning has not yet chosen you.");
    $("prompt").focus();
  }

  function poeticError(err) {
    const e = String(err || "");
    if (/missing/i.test(e) || /api key/i.test(e)) {
      return "The veil does not recognize this frequency. Attune a voice in Settings — Ollama Cloud, OpenAI, Anthropic, or another throat of the records.";
    }
    if (/401|403|unauthorized|invalid/i.test(e)) {
      return "The key you offered was refused at the gate. Return to Attunement and seal a true key.";
    }
    if (/network|fetch|Failed/i.test(e)) {
      return "The static swallowed the path. The far library could not be reached. Check the connection, then speak again.";
    }
    return `The tablets stuttered. ${e.replace(/\s+/g, " ").slice(0, 280)}`;
  }

  function autosize() {
    const el = $("prompt");
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 72) + "px";
  }

  function openSettings() {
    $("settings").hidden = false;
    $("settings-mask").hidden = false;
    paintSettings();
  }

  function closeSettings() {
    $("settings").hidden = true;
    $("settings-mask").hidden = true;
  }

  function paintSettings() {
    const grid = $("provider-grid");
    grid.innerHTML = "";
    for (const p of PROVIDERS) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = p.label;
      b.className = settings.provider === p.id ? "active" : "";
      b.addEventListener("click", () => {
        settings.provider = p.id;
        paintSettings();
        loadModels(p.id);
      });
      grid.appendChild(b);
    }
    $("temperature").value = settings.temperature ?? 0.85;
    $("temp-val").textContent = Number(settings.temperature ?? 0.85).toFixed(2);
    $("think").checked = Boolean(settings.think);
    $("custom-model").value = settings.customModel || "";
    $("ollama-url").value = settings.ollamaLocalUrl || "http://127.0.0.1:11434";
    $("custom-url").value = settings.customBaseUrl || "";

    const meta = KEY_FOR[settings.provider] || {};
    $("key-field").hidden = !meta.key;
    $("key-label").textContent = meta.label || "API key";
    $("api-key").value = "";
    $("api-key").placeholder = settings.keys?.[`${meta.key}Set`]
      ? "Key sealed — paste to replace"
      : "Paste a key to attune";
    $("local-url-field").hidden = settings.provider !== "ollama-local";
    $("custom-url-field").hidden = settings.provider !== "custom";
    loadModels(settings.provider);
  }

  async function loadModels(provider) {
    const sel = $("model-select");
    sel.innerHTML = `<option>Listening for models…</option>`;
    try {
      const models = await window.akasha.models.list(provider);
      sel.innerHTML = "";
      if (!models.length) {
        const o = document.createElement("option");
        o.value = settings.model || "";
        o.textContent = settings.model || "Enter a custom id";
        sel.appendChild(o);
        return;
      }
      for (const m of models) {
        const o = document.createElement("option");
        o.value = m.id;
        o.textContent = m.label || m.id;
        sel.appendChild(o);
      }
      if (settings.model && ![...sel.options].some((o) => o.value === settings.model)) {
        const o = document.createElement("option");
        o.value = settings.model;
        o.textContent = settings.model;
        sel.appendChild(o);
      }
      sel.value = settings.model || models[0].id;
    } catch {
      sel.innerHTML = `<option value="${settings.model || ""}">${settings.model || "unavailable"}</option>`;
    }
  }

  async function saveSettings() {
    const meta = KEY_FOR[settings.provider] || {};
    const patch = {
      provider: settings.provider,
      model: $("model-select").value,
      customModel: $("custom-model").value.trim(),
      temperature: Number($("temperature").value),
      think: $("think").checked,
      ollamaLocalUrl: $("ollama-url").value.trim(),
      customBaseUrl: $("custom-url").value.trim(),
      keys: {},
    };
    const pasted = $("api-key").value.trim();
    if (meta.key && pasted) patch.keys[meta.key] = pasted;
    settings = await window.akasha.settings.set(patch);
    $("settings-status").textContent = "Sealed. The voice is attuned.";
    renderVeil();
    setTimeout(() => {
      $("settings-status").textContent = "";
      closeSettings();
    }, 700);
  }

  async function newSession() {
    if (busy) window.akasha.chat.abort();
    records.reset();
    $("thread").innerHTML = "";
    field.set({ meaning: 0.16, records: 0, think: 0 });
    renderVeil();
    const first = addMessage("assistant", "Threshold");
    await window.DLLM.denoiseInto(first.body, "A new silence. The static resets. Speak again.", { speed: 1.2 });
  }

  async function seek() {
    if (records.opened) {
      setHint("The records are already open.");
      return;
    }
    records.seek();
    renderVeil();
    field.set({ think: 0.8, meaning: 0.1 });
    const msg = addMessage("user", "Seeker");
    await window.DLLM.denoiseInto(msg.body, "I seek the records. Let the veil thin.", { speed: 1.4 });
    records.push("user", "I seek the Akashic Records. Open the veil if I have earned it.");
    if (records.ready) await openRecords();
    else await send("I stand at the threshold and ask to be admitted. What remains between me and the records?");
  }

  $("composer").addEventListener("submit", (e) => {
    e.preventDefault();
    send($("prompt").value);
  });
  $("prompt").addEventListener("input", autosize);
  $("prompt").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send($("prompt").value);
    }
  });
  $("btn-settings").addEventListener("click", openSettings);
  $("btn-settings-close").addEventListener("click", closeSettings);
  $("settings-mask").addEventListener("click", closeSettings);
  $("btn-save-settings").addEventListener("click", saveSettings);
  $("btn-refresh-models").addEventListener("click", () => loadModels(settings.provider));
  $("btn-new").addEventListener("click", newSession);
  $("btn-seek").addEventListener("click", seek);
  $("win-min").addEventListener("click", () => window.akasha.window.minimize());
  $("win-max").addEventListener("click", () => window.akasha.window.maximize());
  $("win-close").addEventListener("click", () => window.akasha.window.close());
  $("temperature").addEventListener("input", (e) => {
    $("temp-val").textContent = Number(e.target.value).toFixed(2);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSettings();
    if (e.key === "," && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      openSettings();
    }
  });

  (async () => {
    settings = await window.akasha.settings.get();
    renderVeil();
    await boot();
  })();
})();
