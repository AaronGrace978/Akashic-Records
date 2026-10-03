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
  const sky = new window.NatalSky($("sky"));
  const records = new window.AkashicState.Records();
  const PLACES = [
    { id: "none", label: "Unspecified — face the sun" },
    { id: "nyc", label: "New York", lat: 40.7128, lon: -74.006, timeZone: "America/New_York" },
    { id: "london", label: "London", lat: 51.5074, lon: -0.1278, timeZone: "Europe/London" },
    { id: "paris", label: "Paris", lat: 48.8566, lon: 2.3522, timeZone: "Europe/Paris" },
    { id: "cairo", label: "Cairo", lat: 30.0444, lon: 31.2357, timeZone: "Africa/Cairo" },
    { id: "lagos", label: "Lagos", lat: 6.5244, lon: 3.3792, timeZone: "Africa/Lagos" },
    { id: "mumbai", label: "Mumbai", lat: 19.076, lon: 72.8777, timeZone: "Asia/Kolkata" },
    { id: "tokyo", label: "Tokyo", lat: 35.6762, lon: 139.6503, timeZone: "Asia/Tokyo" },
    { id: "sydney", label: "Sydney", lat: -33.8688, lon: 151.2093, timeZone: "Australia/Sydney" },
    { id: "mexico", label: "Mexico City", lat: 19.4326, lon: -99.1332, timeZone: "America/Mexico_City" },
    { id: "sao", label: "São Paulo", lat: -23.5505, lon: -46.6333, timeZone: "America/Sao_Paulo" },
    { id: "reykjavik", label: "Reykjavík", lat: 64.1466, lon: -21.9426, timeZone: "Atlantic/Reykjavik" },
    { id: "custom", label: "Custom coordinates" },
  ];

  let settings = null;
  let tone = null;
  let busy = false;
  let busyEpoch = -1;
  let composing = false;
  let epoch = 0;
  let booted = false;
  let skyMode = "birth";
  let placeOverride = null;
  let placeTimer = 0;
  let placeToken = 0;
  let persistChain = Promise.resolve();
  let sessionId = uid();
  let sessionCreated = Date.now();
  let sessionReturned = false;
  let witnessedSkies = new Set();

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function providerLabel(id) {
    return PROVIDERS.find((p) => p.id === id)?.label || id;
  }

  function setHint(text) {
    $("hint").textContent = text;
  }

  function locked() {
    return busy || composing;
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

  function enqueue(task) {
    persistChain = persistChain.then(task).catch(() => {});
    return persistChain;
  }

  function snapshot() {
    if (!records.history.some((m) => m.role === "user")) return null;
    const first = records.history.find((m) => m.role === "user");
    return {
      id: sessionId,
      title: first.content.replace(/\s+/g, " ").trim().slice(0, 72),
      created: sessionCreated,
      updated: Date.now(),
      resonance: records.resonance,
      opened: records.opened,
      returned: sessionReturned,
      witnessed: [...witnessedSkies],
      messages: records.history.map((m) => ({
        role: m.role,
        content: m.content,
        who: m.who,
        think: m.think || "",
        pinned: Boolean(m.pinned),
      })),
    };
  }

  function persist() {
    if (!settings) return persistChain;
    const veil = { resonance: records.resonance, opened: records.opened };
    const snap = snapshot();
    return enqueue(async () => {
      settings = await window.akasha.settings.set({ veil });
      if (snap) await window.akasha.shelf.save(snap);
    });
  }

  function adopt(session, { bonus = false } = {}) {
    sessionId = session.id;
    sessionCreated = session.created || Date.now();
    witnessedSkies = new Set(session.witnessed || []);
    records.history = (session.messages || []).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      who: m.who || (m.role === "assistant" ? "Threshold" : "Seeker"),
      think: m.think || "",
      pinned: Boolean(m.pinned),
    }));
    if (settings.veil?.opened || session.opened) {
      records.open();
      sessionReturned = true;
    } else {
      records.opened = false;
      records.resonance = Math.max(0, Math.min(100, Number(session.resonance) || 0));
      sessionReturned = Boolean(session.returned);
      if (bonus && !sessionReturned) {
        records.noteReturn();
        sessionReturned = true;
      }
    }
  }

  function addMessage(role, who, opts = {}) {
    const thread = $("thread");
    const wrap = document.createElement("article");
    wrap.className = `msg ${role}${who === "The Records" ? " records" : ""}`;
    wrap.innerHTML = `<div class="msg-who-row"><div class="msg-who"></div><button class="pin" type="button" hidden>Pin</button></div><details class="trace" hidden><summary>Trace</summary><div class="think"></div></details><div class="msg-body"></div>`;
    wrap.querySelector(".msg-who").textContent = who;
    const pin = wrap.querySelector(".pin");
    pin.addEventListener("click", () => togglePin(wrap));
    const body = wrap.querySelector(".msg-body");
    const think = wrap.querySelector(".think");
    const trace = wrap.querySelector(".trace");
    if (opts.text != null) body.textContent = opts.text;
    if (opts.think) {
      trace.hidden = false;
      think.textContent = opts.think;
    }
    if (opts.entry) bindEntry(wrap, opts.entry);
    thread.appendChild(wrap);
    thread.scrollTop = thread.scrollHeight;
    return { wrap, body, think, trace };
  }

  function bindEntry(wrap, entry) {
    wrap._entry = entry;
    const pin = wrap.querySelector(".pin");
    if (!pin || entry.role !== "assistant") return;
    pin.hidden = false;
    pin.classList.toggle("on", Boolean(entry.pinned));
    pin.textContent = entry.pinned ? "Kept" : "Pin";
  }

  function togglePin(wrap) {
    const entry = wrap._entry;
    if (!entry || entry.role !== "assistant") return;
    entry.pinned = !entry.pinned;
    bindEntry(wrap, entry);
    persist();
  }

  function paintThread() {
    const thread = $("thread");
    thread.innerHTML = "";
    for (const entry of records.history) {
      addMessage(entry.role, entry.who || (entry.role === "user" ? "Seeker" : "Threshold"), {
        text: entry.content,
        think: entry.think,
        entry,
      });
    }
    thread.scrollTop = thread.scrollHeight;
  }

  async function boot(restored) {
    const held = records.opened;
    field.set({ meaning: 0.02, think: 0.35, records: held ? 0.4 : 0 });
    document.body.classList.add("revealing");
    await window.DLLM.denoiseInto($("boot-title"), "AKASHIC RECORDS", { speed: 1.35 });
    await window.DLLM.denoiseInto($("boot-sub"), "the static is not empty — it is everything not yet chosen", {
      speed: 1.1,
    });
    document.body.classList.remove("revealing");
    field.set({ meaning: held ? 0.7 : 0.22, think: 0, records: held ? 1 : 0 });
    await sleep(700);
    $("boot").hidden = true;
    $("thread").hidden = false;
    $("resonance-wrap").hidden = false;
    $("composer-wrap").hidden = false;
    if (restored) paintThread();
    else {
      const first = addMessage("assistant", held ? "The Records" : "Threshold");
      await window.DLLM.denoiseInto(
        first.body,
        held
          ? "The records are already open. Speak, and we will answer."
          : "The noise remembers you. Speak, seeker, and I will listen at the veil.",
        { speed: 1.15 }
      );
    }
    renderVeil();
    $("prompt").focus();
    $("btn-sky").disabled = false;
    $("btn-shelf").disabled = false;
    booted = true;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function openRecords() {
    records.open();
    persist();
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

  async function deliverUser(content) {
    const mine = epoch;
    const user = addMessage("user", "Seeker");
    await window.DLLM.denoiseInto(user.body, content, { speed: 1.8 });
    if (mine !== epoch) return false;
    const entry = records.push("user", content, { who: "Seeker" });
    user.wrap._entry = entry;
    records.scoreUser(content);
    renderVeil();
    persist();
    return true;
  }

  async function send(text) {
    if (locked() || !text.trim()) return;
    const content = text.trim();
    $("prompt").value = "";
    autosize();
    composing = true;
    try {
      const kept = await deliverUser(content);
      if (!kept) return;
      if (records.ready) await openRecords();
      await streamFromHistory();
    } finally {
      composing = false;
    }
  }

  async function streamFromHistory() {
    if (busy) return;
    const mine = epoch;
    setBusy(true);
    field.set({ think: 1, meaning: 0.08 });
    setHint("Denoising — static collapsing toward meaning…");
    const asst = addMessage("assistant", records.speaker());
    const dllm = new window.DLLM.DLLMText(asst.body, { speed: 1.25 });
    let acc = "";
    let thinkAcc = "";
    let closed = false;
    const stops = [];
    const stopMine = () => {
      while (stops.length) stops.pop()();
    };
    const close = (text, isError, aborted) => {
      if (closed) return;
      closed = true;
      stopMine();
      if (mine !== epoch) {
        if (busy && busyEpoch === mine) setBusy(false);
        return;
      }
      finishStream(dllm, text, asst, isError, aborted, thinkAcc);
    };
    stops.push(
      window.akasha.chat.onToken((tok) => {
        if (mine !== epoch) return;
        acc += tok;
        dllm.setTarget(acc);
        $("thread").scrollTop = $("thread").scrollHeight;
        field.set({ meaning: Math.min(0.85, 0.15 + acc.length / 800) });
      })
    );
    stops.push(
      window.akasha.chat.onThink((tok) => {
        if (mine !== epoch) return;
        thinkAcc = (thinkAcc + tok).slice(-8000);
        asst.trace.hidden = false;
        asst.trace.open = true;
        asst.think.textContent = thinkAcc;
      })
    );
    stops.push(
      window.akasha.chat.onDone((data) => {
        close(acc, false, Boolean(data?.aborted));
      })
    );
    stops.push(
      window.akasha.chat.onError((err) => {
        const poetic = poeticError(err);
        dllm.setTarget(poetic, { reset: true });
        close(poetic, true, false);
      })
    );
    const result = await window.akasha.chat.start({ messages: records.messages() });
    if (result?.error && !acc) {
      const poetic = poeticError(result.error);
      dllm.setTarget(poetic, { reset: true });
      close(poetic, true, false);
    }
  }

  function finishStream(dllm, acc, asst, isError, aborted, thinkAcc) {
    if (!acc && aborted) asst.wrap.remove();
    else if (acc) {
      dllm.setTarget(acc);
      setTimeout(() => dllm.snap(), 900);
    }
    if (acc && !isError) {
      const who = asst.wrap.querySelector(".msg-who").textContent;
      const entry = records.push("assistant", acc, { who, think: thinkAcc || "" });
      bindEntry(asst.wrap, entry);
    }
    if (thinkAcc && thinkAcc.trim() && acc) {
      asst.trace.hidden = false;
      asst.think.textContent = thinkAcc;
      asst.trace.open = false;
    }
    setBusy(false);
    renderVeil();
    if (aborted) setHint("The voice fell silent.");
    else setHint(records.opened ? "The records are listening." : "The noise is listening. Meaning has not yet chosen you.");
    if (acc && !isError) persist();
    $("prompt").focus();
  }

  function setBusy(on) {
    busy = on;
    if (on) busyEpoch = epoch;
    document.body.classList.toggle("thinking", on);
    $("btn-send-label").textContent = on ? "Stop" : "Inquire";
    $("btn-send").classList.toggle("stop", on);
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
    closeNatal();
    closeShelf();
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
    $("hush").checked = Boolean(settings.hush);
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

  function saveSettings() {
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
    enqueue(async () => {
      settings = await window.akasha.settings.set(patch);
      $("settings-status").textContent = "Sealed. The voice is attuned.";
      renderVeil();
      setTimeout(() => {
        $("settings-status").textContent = "";
        closeSettings();
      }, 700);
    });
  }

  function fillPlaces() {
    const sel = $("natal-place");
    for (const place of PLACES) {
      const option = document.createElement("option");
      option.value = place.id;
      option.textContent = place.label;
      sel.appendChild(option);
    }
  }

  function selectedPlace() {
    if (placeOverride) return placeOverride;
    const id = $("natal-place").value;
    if (id === "custom") {
      const lat = $("natal-lat").value.trim();
      const lon = $("natal-lon").value.trim();
      return {
        lat: lat === "" ? null : Number(lat),
        lon: lon === "" ? null : Number(lon),
        place: "custom place",
        timeZone: null,
      };
    }
    const preset = PLACES.find((place) => place.id === id);
    if (!preset || preset.lat == null) return { lat: null, lon: null, place: "", timeZone: null };
    return { lat: preset.lat, lon: preset.lon, place: preset.label, timeZone: preset.timeZone };
  }

  function paintNatalMode() {
    const now = skyMode === "now";
    $("natal-when").hidden = now;
    $("natal-heading").textContent = now ? "This Hour" : "The Hour";
    $("natal-lead").textContent = now
      ? "The sky as it stands. Name a place, and the records will look up."
      : "Name the subject. The sky will leave the veil, find the stars that stood at that birth, and come back to the person.";
    $("btn-open-sky").textContent = now ? "Open this hour" : "Open the sky";
    $("natal-mode-birth").classList.toggle("active", !now);
    $("natal-mode-now").classList.toggle("active", now);
    $("natal-name").placeholder = now ? "This hour" : "Name";
  }

  function nowInZone(timeZone) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone || "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
      const parts = {};
      for (const part of fmt.formatToParts(new Date())) parts[part.type] = part.value;
      const hour = parts.hour === "24" ? "00" : parts.hour;
      return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${hour}:${parts.minute}` };
    } catch {
      return nowMeanSolar(0);
    }
  }

  function nowMeanSolar(lon) {
    const shifted = new Date(Date.now() + ((Number(lon) || 0) / 15) * 3600000);
    const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
    const day = String(shifted.getUTCDate()).padStart(2, "0");
    const hour = String(shifted.getUTCHours()).padStart(2, "0");
    const minute = String(shifted.getUTCMinutes()).padStart(2, "0");
    return {
      date: `${shifted.getUTCFullYear()}-${month}-${day}`,
      time: `${hour}:${minute}`,
    };
  }

  function openNatal() {
    if (!booted) return;
    closeSettings();
    closeShelf();
    $("natal").hidden = false;
    $("natal-mask").hidden = false;
    $("natal-status").textContent = "";
    paintNatalMode();
    $("natal-name").focus();
  }

  function closeNatal() {
    $("natal").hidden = true;
    $("natal-mask").hidden = true;
  }

  function launchSky() {
    if (!placeOverride && $("natal-place").value === "custom") {
      const lat = $("natal-lat").value.trim();
      const lon = $("natal-lon").value.trim();
      if (!lat || !lon) {
        $("natal-status").textContent = "A custom place needs latitude and longitude.";
        return;
      }
    }
    const where = selectedPlace();
    let date = $("natal-date").value;
    let time = $("natal-time").value;
    let name = $("natal-name").value;
    if (skyMode === "now") {
      const clock = where.timeZone ? nowInZone(where.timeZone) : nowMeanSolar(where.lon);
      date = clock.date;
      time = clock.time;
      if (!name.trim()) name = "This hour";
    }
    const chart = sky.open({
      mode: skyMode,
      name,
      date,
      time,
      lat: where.lat,
      lon: where.lon,
      place: where.place,
      timeZone: where.timeZone,
      veilOpen: records.opened,
    });
    if (chart.error) {
      $("natal-status").textContent = chart.error;
      return;
    }
    closeNatal();
    $("btn-sky").textContent = "Return";
    field.set({ think: 1, meaning: 0.42, records: records.opened ? 0.85 : 0.2 });
  }

  function skyAsk(brief) {
    const stars = brief.sunAgrees
      ? `The sun stands in ${brief.sun}, and those stars answer.`
      : `The sun is in ${brief.sun}. Its light rests among the stars of ${brief.sunStars}.`;
    const rise = brief.rising
      ? `${brief.rising} ${brief.mode === "now" ? "is" : "was"} rising.`
      : "The rising was withheld.";
    const lead = brief.mode === "now"
      ? "I have come back from the sky of this hour. Read what stands above."
      : "I have come back from the natal sky. Read this birth.";
    const where = brief.place || "unspecified";
    return `${lead} Subject: ${brief.name}. When: ${brief.when}. Place: ${where}. ${stars} The moon is ${brief.moon}. ${rise}`;
  }

  async function consultSky() {
    const brief = sky.reading();
    sky.close();
    $("btn-sky").textContent = "Sky";
    field.set({
      think: 0,
      meaning: records.opened ? 0.7 : 0.22,
      records: records.opened ? 1 : 0,
    });
    if (!brief) return;
    if ($("thread").hidden || locked()) {
      setHint(brief.summary);
      return;
    }
    const key = [brief.mode, brief.when, brief.place, brief.sun, brief.moon, brief.rising || ""].join("|");
    if (!witnessedSkies.has(key)) {
      witnessedSkies.add(key);
      records.witnessSky();
      renderVeil();
      persist();
    }
    composing = true;
    try {
      const kept = await deliverUser(skyAsk(brief));
      if (!kept) return;
      if (records.ready) await openRecords();
      await streamFromHistory();
    } finally {
      composing = false;
    }
  }

  async function closeSky() {
    if (!document.body.classList.contains("sky-open")) return;
    await consultSky();
  }

  function leaveSkyQuiet() {
    if (!document.body.classList.contains("sky-open")) return;
    sky.close();
    $("btn-sky").textContent = "Sky";
  }

  function abandonStream() {
    epoch += 1;
    if (!busy) return;
    window.akasha.chat.abort();
    setBusy(false);
  }

  async function newSession() {
    if (!settings || composing) return;
    const opened = records.opened;
    const leaving = snapshot();
    abandonStream();
    leaveSkyQuiet();
    records.reset();
    if (opened) records.open();
    sessionId = uid();
    sessionCreated = Date.now();
    sessionReturned = false;
    witnessedSkies = new Set();
    const veil = { resonance: records.resonance, opened: records.opened };
    enqueue(async () => {
      settings = await window.akasha.settings.set({ veil });
      if (leaving) await window.akasha.shelf.save(leaving);
      await window.akasha.shelf.clearActive();
    });
    $("thread").innerHTML = "";
    field.set({ meaning: opened ? 0.7 : 0.16, records: opened ? 1 : 0, think: 0 });
    renderVeil();
    const first = addMessage("assistant", opened ? "The Records" : "Threshold");
    await window.DLLM.denoiseInto(
      first.body,
      opened
        ? "The records remain open. A new silence. Speak again."
        : "A new silence. The static resets. Speak again.",
      { speed: 1.2 }
    );
  }

  async function seek() {
    if (records.opened) {
      setHint("The records are already open.");
      return;
    }
    if (locked()) return;
    records.seek();
    renderVeil();
    persist();
    field.set({ think: 0.8, meaning: 0.1 });
    composing = true;
    try {
      const msg = addMessage("user", "Seeker");
      await window.DLLM.denoiseInto(msg.body, "I seek the records. Let the veil thin.", { speed: 1.4 });
      records.push("user", "I seek the Akashic Records. Open the veil if I have earned it.", { who: "Seeker" });
      persist();
      if (records.ready) await openRecords();
    } finally {
      composing = false;
    }
    if (!records.opened) {
      await send("I stand at the threshold and ask to be admitted. What remains between me and the records?");
    }
  }

  function whenLabel(ts) {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function paintShelf(list) {
    const root = $("shelf-list");
    root.innerHTML = "";
    if (!list.sessions.length) {
      const empty = document.createElement("p");
      empty.className = "settings-lead";
      empty.textContent = "The shelf is bare. Speak, and the first inquiry will be kept.";
      root.appendChild(empty);
      return;
    }
    for (const session of list.sessions) {
      const row = document.createElement("div");
      row.className = `shelf-item${session.id === sessionId ? " current" : ""}`;
      const open = document.createElement("button");
      open.type = "button";
      open.className = "shelf-open";
      const title = document.createElement("strong");
      title.textContent = session.title;
      const meta = document.createElement("em");
      const bits = [whenLabel(session.updated)];
      if (session.opened) bits.push("records open");
      if (session.pinned) bits.push(session.pinned === 1 ? "1 kept" : `${session.pinned} kept`);
      meta.textContent = bits.filter(Boolean).join(" · ");
      open.append(title, meta);
      open.addEventListener("click", () => openSession(session.id));
      const release = document.createElement("button");
      release.type = "button";
      release.className = "shelf-release";
      release.textContent = "Release";
      release.addEventListener("click", async () => {
        if (release.dataset.arm !== "1") {
          release.dataset.arm = "1";
          release.textContent = "Release?";
          return;
        }
        await window.akasha.shelf.remove(session.id);
        if (session.id === sessionId) {
          abandonStream();
          records.history = [];
          sessionId = uid();
          sessionCreated = Date.now();
          sessionReturned = false;
          witnessedSkies = new Set();
          $("thread").innerHTML = "";
          const note = addMessage("assistant", records.speaker());
          note.body.textContent = "That inquiry has left the shelf. The silence is new.";
        }
        paintShelf(await window.akasha.shelf.list());
      });
      row.append(open, release);
      root.appendChild(row);
    }
  }

  async function openShelf() {
    if (!booted) return;
    closeSettings();
    closeNatal();
    $("shelf").hidden = false;
    $("shelf-mask").hidden = false;
    $("shelf-status").textContent = "";
    paintShelf(await window.akasha.shelf.list());
  }

  function closeShelf() {
    $("shelf").hidden = true;
    $("shelf-mask").hidden = true;
  }

  async function openSession(id) {
    if (id === sessionId) {
      closeShelf();
      return;
    }
    if (composing) return;
    const session = await window.akasha.shelf.get(id);
    if (!session) return;
    const leaving = snapshot();
    abandonStream();
    leaveSkyQuiet();
    if (leaving && leaving.id !== session.id) {
      enqueue(async () => {
        await window.akasha.shelf.save(leaving);
      });
    }
    adopt(session, { bonus: true });
    $("boot").hidden = true;
    $("thread").hidden = false;
    paintThread();
    renderVeil();
    persist();
    closeShelf();
    $("prompt").focus();
    if (records.ready) await openRecords();
  }

  function inquiryTitle() {
    const first = records.history.find((m) => m.role === "user");
    if (!first) return "tablet";
    return first.content.replace(/\s+/g, " ").trim().slice(0, 72);
  }

  function tabletText() {
    const lines = ["Akashic Records", inquiryTitle(), ""];
    for (const message of records.history) {
      lines.push(message.pinned ? `${message.who} · kept` : message.who);
      lines.push(message.content);
      if (message.think) {
        lines.push("");
        lines.push("Trace");
        lines.push(message.think);
      }
      lines.push("");
    }
    return `${lines.join("\n").trim()}\n`;
  }

  async function keepTablet() {
    if (!records.history.some((m) => m.role === "user")) {
      $("shelf-status").textContent = "Nothing has been spoken yet.";
      return;
    }
    const result = await window.akasha.tablet.write({ title: inquiryTitle(), text: tabletText() });
    if (result?.canceled) return;
    $("shelf-status").textContent = result?.ok ? "The tablet was kept." : "The tablet could not be written.";
  }

  function choosePlace(place) {
    placeOverride = {
      lat: place.lat,
      lon: place.lon,
      place: place.label,
      timeZone: place.timeZone,
    };
    $("natal-place").value = "none";
    $("natal-custom").hidden = true;
    $("natal-results").hidden = true;
    $("natal-results").innerHTML = "";
    $("natal-find").value = place.label;
    $("natal-picked").hidden = false;
    $("natal-picked").textContent = place.label;
    $("natal-status").textContent = "";
  }

  function schedulePlaceSearch() {
    clearTimeout(placeTimer);
    const query = $("natal-find").value.trim();
    const box = $("natal-results");
    if (query.length < 2) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    placeTimer = setTimeout(async () => {
      const token = ++placeToken;
      try {
        const places = await window.akasha.places.search(query);
        if (token !== placeToken) return;
        box.innerHTML = "";
        if (!places.length) {
          box.hidden = true;
          $("natal-status").textContent = "No city answered to that name.";
          return;
        }
        $("natal-status").textContent = "";
        for (const place of places) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = place.label;
          button.addEventListener("click", () => choosePlace(place));
          box.appendChild(button);
        }
        box.hidden = false;
      } catch {
        if (token !== placeToken) return;
        box.hidden = true;
        $("natal-status").textContent = "The atlas is quiet. Use the list, or enter coordinates.";
      }
    }, 320);
  }

  $("composer").addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) {
      window.akasha.chat.abort();
      return;
    }
    if (composing) return;
    send($("prompt").value);
  });
  $("prompt").addEventListener("input", autosize);
  $("prompt").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (busy) window.akasha.chat.abort();
      else send($("prompt").value);
    }
  });
  $("btn-sky").addEventListener("click", () => {
    if (document.body.classList.contains("sky-open")) closeSky();
    else openNatal();
  });
  $("btn-natal-close").addEventListener("click", closeNatal);
  $("natal-mask").addEventListener("click", closeNatal);
  $("natal-form").addEventListener("submit", (e) => {
    e.preventDefault();
    launchSky();
  });
  $("natal-mode-birth").addEventListener("click", () => {
    skyMode = "birth";
    paintNatalMode();
  });
  $("natal-mode-now").addEventListener("click", () => {
    skyMode = "now";
    paintNatalMode();
  });
  $("natal-place").addEventListener("change", () => {
    placeOverride = null;
    $("natal-picked").hidden = true;
    $("natal-custom").hidden = $("natal-place").value !== "custom";
  });
  $("natal-find").addEventListener("input", () => {
    placeOverride = null;
    $("natal-picked").hidden = true;
    schedulePlaceSearch();
  });
  $("natal-find").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const first = $("natal-results").querySelector("button");
    if (first) first.click();
  });
  $("sky-closer").addEventListener("click", () => sky.advance());
  $("sky-return").addEventListener("click", () => closeSky());
  $("btn-settings").addEventListener("click", openSettings);
  $("btn-settings-close").addEventListener("click", closeSettings);
  $("settings-mask").addEventListener("click", closeSettings);
  $("btn-save-settings").addEventListener("click", saveSettings);
  $("btn-refresh-models").addEventListener("click", () => loadModels(settings.provider));
  $("btn-new").addEventListener("click", newSession);
  $("btn-seek").addEventListener("click", seek);
  $("btn-shelf").addEventListener("click", openShelf);
  $("btn-shelf-close").addEventListener("click", closeShelf);
  $("shelf-mask").addEventListener("click", closeShelf);
  $("btn-tablet").addEventListener("click", keepTablet);
  $("hush").addEventListener("change", () => {
    const on = $("hush").checked;
    if (tone) tone.setHush(on);
    if (!settings) return;
    enqueue(async () => {
      settings = await window.akasha.settings.set({ hush: on });
    });
  });
  $("win-min").addEventListener("click", () => window.akasha.window.minimize());
  $("win-max").addEventListener("click", () => window.akasha.window.maximize());
  $("win-close").addEventListener("click", () => window.akasha.window.close());
  $("temperature").addEventListener("input", (e) => {
    $("temp-val").textContent = Number(e.target.value).toFixed(2);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (document.body.classList.contains("sky-open")) {
        closeSky();
        return;
      }
      closeNatal();
      closeSettings();
      closeShelf();
    }
    if (e.key === "," && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      openSettings();
    }
  });
  document.addEventListener("pointerdown", () => {
    if (tone) tone.ensure();
  });
  window.addEventListener("beforeunload", () => {
    try {
      const session = snapshot();
      window.akasha.shelf.flush({
        veil: { resonance: records.resonance, opened: records.opened },
        session,
        clearActive: !session,
      });
    } catch {
      /* the window is already leaving */
    }
  });

  fillPlaces();

  (async () => {
    try {
      settings = await window.akasha.settings.get();
      tone = new window.AkashicTone();
      tone.setHush(Boolean(settings.hush));
      tone.ensure();
      const active = await window.akasha.shelf.active();
      if (active) adopt(active, { bonus: false });
      else if (settings.veil?.opened) records.open();
      else if (settings.veil) {
        records.resonance = Math.max(0, Math.min(100, Number(settings.veil.resonance) || 0));
      }
      tone.markVeil(records.opened);
      tone.follow(field);
      renderVeil();
      await boot(Boolean(active));
    } catch (err) {
      console.error(err);
    }
  })();
})();
