const DEFAULT_MODELS = {
  "ollama-cloud": [
    { id: "kimi-k2.6", label: "Kimi K2.6" },
    { id: "glm-5.2", label: "GLM-5.2" },
    { id: "qwen3.5:397b", label: "Qwen 3.5 397B" },
    { id: "qwen3.5", label: "Qwen 3.5" },
    { id: "minimax-m3", label: "MiniMax M3" },
    { id: "minimax-m2.7", label: "MiniMax M2.7" },
    { id: "gemma4:31b", label: "Gemma 4 31B" },
    { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
    { id: "mistral-large-3:675b", label: "Mistral Large 3 675B" },
    { id: "gpt-oss:120b", label: "GPT-OSS 120B" },
    { id: "gpt-oss:20b", label: "GPT-OSS 20B" },
  ],
  "ollama-local": [
    { id: "llama3.3", label: "Llama 3.3" },
    { id: "qwen3", label: "Qwen 3" },
    { id: "gemma4", label: "Gemma 4" },
    { id: "mistral", label: "Mistral" },
  ],
  openai: [
    { id: "gpt-5.2", label: "GPT-5.2" },
    { id: "gpt-5", label: "GPT-5" },
    { id: "gpt-4.1", label: "GPT-4.1" },
    { id: "o3", label: "o3" },
    { id: "o4-mini", label: "o4-mini" },
    { id: "gpt-4o", label: "GPT-4o" },
  ],
  anthropic: [
    { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-5", label: "Claude Opus 4.5" },
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
    { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
    { id: "qwen/qwen3-32b", label: "Qwen 3 32B" },
    { id: "moonshotai/kimi-k2-instruct", label: "Kimi K2 Instruct" },
  ],
  gemini: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ],
  openrouter: [
    { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
    { id: "openai/gpt-5", label: "GPT-5" },
    { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5" },
    { id: "qwen/qwen3.5-397b", label: "Qwen 3.5 397B" },
  ],
  custom: [],
};

function headersJson(extra = {}) {
  return { "Content-Type": "application/json", ...extra };
}

async function readNdjson(response, { onToken, onThink, signal }) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let json;
      try {
        json = JSON.parse(trimmed);
      } catch {
        continue;
      }
      const think = json.message?.thinking || json.thinking;
      if (think) onThink?.(think);
      const content = json.message?.content || json.response || "";
      if (content) onToken?.(content);
    }
  }
}

async function readSse(response, { onEvent, signal }) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const part of parts) {
      const dataLines = part
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      const data = dataLines.join("\n");
      if (!data || data === "[DONE]") continue;
      try {
        onEvent(JSON.parse(data));
      } catch {
        /* ignore keepalives */
      }
    }
  }
}

async function streamOllama({ base, key, model, messages, temperature, think, signal, onToken, onThink }) {
  const headers = headersJson();
  if (key) headers.Authorization = `Bearer ${key}`;
  const body = { model, messages, stream: true, options: { temperature } };
  if (think) body.think = typeof think === "string" ? think : "medium";
  const res = await fetch(`${base.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Ollama ${res.status}`);
  }
  await readNdjson(res, { onToken, onThink, signal });
}

async function streamOpenAICompat({ url, key, model, messages, temperature, signal, onToken, extraHeaders = {} }) {
  const res = await fetch(url, {
    method: "POST",
    headers: headersJson({
      Authorization: `Bearer ${key}`,
      ...extraHeaders,
    }),
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: true,
    }),
    signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Provider ${res.status}`);
  }
  await readSse(res, {
    signal,
    onEvent: (json) => {
      const delta = json.choices?.[0]?.delta;
      const content = delta?.content || json.choices?.[0]?.message?.content;
      if (content) onToken(content);
    },
  });
}

async function streamAnthropic({ key, model, messages, temperature, signal, onToken }) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const converted = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature,
      system: system || undefined,
      messages: converted,
      stream: true,
    }),
    signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Anthropic ${res.status}`);
  }
  await readSse(res, {
    signal,
    onEvent: (json) => {
      if (json.type === "content_block_delta" && json.delta?.text) onToken(json.delta.text);
    },
  });
}

async function streamGemini({ key, model, messages, temperature, signal, onToken }) {
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: headersJson(),
    body: JSON.stringify({
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: { temperature },
    }),
    signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Gemini ${res.status}`);
  }
  await readSse(res, {
    signal,
    onEvent: (json) => {
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
      if (text) onToken(text);
    },
  });
}

async function streamChat(settings, { messages, signal, onToken, onThink }) {
  const { provider, model, keys, temperature, think, ollamaLocalUrl, customBaseUrl, customModel } = settings;
  const temp = typeof temperature === "number" ? temperature : 0.85;
  const chosen = customModel?.trim() || model;

  if (provider === "ollama-cloud") {
    if (!keys.ollama) throw new Error("Ollama Cloud API key is missing.");
    return streamOllama({
      base: "https://ollama.com",
      key: keys.ollama,
      model: chosen,
      messages,
      temperature: temp,
      think,
      signal,
      onToken,
      onThink,
    });
  }
  if (provider === "ollama-local") {
    return streamOllama({
      base: ollamaLocalUrl || "http://127.0.0.1:11434",
      model: chosen,
      messages,
      temperature: temp,
      think,
      signal,
      onToken,
      onThink,
    });
  }
  if (provider === "openai") {
    if (!keys.openai) throw new Error("OpenAI API key is missing.");
    return streamOpenAICompat({
      url: "https://api.openai.com/v1/chat/completions",
      key: keys.openai,
      model: chosen,
      messages,
      temperature: temp,
      signal,
      onToken,
    });
  }
  if (provider === "anthropic") {
    if (!keys.anthropic) throw new Error("Anthropic API key is missing.");
    return streamAnthropic({
      key: keys.anthropic,
      model: chosen,
      messages,
      temperature: temp,
      signal,
      onToken,
    });
  }
  if (provider === "groq") {
    if (!keys.groq) throw new Error("Groq API key is missing.");
    return streamOpenAICompat({
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: keys.groq,
      model: chosen,
      messages,
      temperature: temp,
      signal,
      onToken,
    });
  }
  if (provider === "gemini") {
    if (!keys.gemini) throw new Error("Gemini API key is missing.");
    return streamGemini({
      key: keys.gemini,
      model: chosen,
      messages,
      temperature: temp,
      signal,
      onToken,
    });
  }
  if (provider === "openrouter") {
    if (!keys.openrouter) throw new Error("OpenRouter API key is missing.");
    return streamOpenAICompat({
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: keys.openrouter,
      model: chosen,
      messages,
      temperature: temp,
      signal,
      onToken,
      extraHeaders: {
        "HTTP-Referer": "https://akashic.records.local",
        "X-Title": "Akashic Records",
      },
    });
  }
  if (provider === "custom") {
    if (!customBaseUrl) throw new Error("Custom base URL is missing.");
    const url = customBaseUrl.replace(/\/$/, "") + "/chat/completions";
    return streamOpenAICompat({
      url,
      key: keys.custom || keys.openai || "",
      model: chosen,
      messages,
      temperature: temp,
      signal,
      onToken,
    });
  }
  throw new Error(`Unknown provider: ${provider}`);
}

async function listModels(settings, provider) {
  const p = provider || settings.provider;
  if (p === "ollama-cloud" && settings.keys.ollama) {
    try {
      const res = await fetch("https://ollama.com/api/tags", {
        headers: { Authorization: `Bearer ${settings.keys.ollama}` },
      });
      if (res.ok) {
        const data = await res.json();
        const remote = (data.models || data || [])
          .map((m) => m.name || m.model || m)
          .filter(Boolean)
          .map((id) => ({ id, label: id }));
        const merged = [...DEFAULT_MODELS["ollama-cloud"]];
        for (const r of remote) {
          if (!merged.some((x) => x.id === r.id)) merged.push(r);
        }
        return merged;
      }
    } catch {
      /* fall through */
    }
  }
  if (p === "ollama-local") {
    try {
      const base = (settings.ollamaLocalUrl || "http://127.0.0.1:11434").replace(/\/$/, "");
      const res = await fetch(`${base}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        return (data.models || []).map((m) => ({ id: m.name, label: m.name }));
      }
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_MODELS[p] || [];
}

module.exports = { streamChat, listModels, DEFAULT_MODELS };
