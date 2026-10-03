const MAX_SESSIONS = 36;
const MAX_MESSAGES = 40;
const MAX_CONTENT = 20000;
const MAX_THINK = 8000;

function clip(value, max) {
  return String(value || "").slice(0, max);
}

function sanitizeMessage(input) {
  if (!input || (input.role !== "user" && input.role !== "assistant")) return null;
  const content = clip(input.content, MAX_CONTENT).trim();
  if (!content) return null;
  return {
    role: input.role,
    content,
    who: clip(input.who, 40).trim() || (input.role === "user" ? "Seeker" : "Threshold"),
    think: clip(input.think, MAX_THINK),
    pinned: Boolean(input.pinned),
  };
}

function sanitizeSession(input) {
  if (!input || typeof input.id !== "string" || !input.id.trim()) return null;
  const messages = Array.isArray(input.messages) ? input.messages.map(sanitizeMessage).filter(Boolean) : [];
  if (!messages.some((m) => m.role === "user")) return null;
  const titleSource = messages.find((m) => m.role === "user").content.replace(/\s+/g, " ").trim();
  return {
    id: clip(input.id, 64).trim(),
    title: clip(input.title, 72).trim() || titleSource.slice(0, 72),
    created: Number(input.created) || Date.now(),
    updated: Number(input.updated) || Date.now(),
    resonance: Math.max(0, Math.min(100, Number(input.resonance) || 0)),
    opened: Boolean(input.opened),
    returned: Boolean(input.returned),
    witnessed: Array.isArray(input.witnessed)
      ? input.witnessed.map((key) => clip(key, 180)).filter(Boolean).slice(-24)
      : [],
    messages: messages.slice(-MAX_MESSAGES),
  };
}

function upsertSession(shelf, session) {
  const clean = sanitizeSession(session);
  const next = {
    activeId: shelf?.activeId || null,
    sessions: Array.isArray(shelf?.sessions) ? shelf.sessions.slice() : [],
  };
  if (!clean) return next;
  const index = next.sessions.findIndex((item) => item.id === clean.id);
  if (index >= 0) {
    clean.created = next.sessions[index].created || clean.created;
    next.sessions[index] = clean;
  } else {
    next.sessions.unshift(clean);
  }
  next.sessions.sort((a, b) => b.updated - a.updated);
  next.sessions = next.sessions.slice(0, MAX_SESSIONS);
  next.activeId = clean.id;
  return next;
}

function listShelf(shelf) {
  const sessions = Array.isArray(shelf?.sessions) ? shelf.sessions : [];
  return {
    activeId: shelf?.activeId || null,
    sessions: sessions.map((session) => ({
      id: session.id,
      title: session.title,
      updated: session.updated,
      opened: Boolean(session.opened),
      pinned: (session.messages || []).filter((m) => m.pinned).length,
    })),
  };
}

function mapPlaces(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.slice(0, 6).map((place) => ({
    label: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
    lat: place.latitude,
    lon: place.longitude,
    timeZone: place.timezone || null,
  })).filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon) && place.label);
}

function tabletName(title) {
  const base = String(title || "tablet")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 60);
  return `${base || "tablet"}.txt`;
}

module.exports = {
  MAX_SESSIONS,
  sanitizeSession,
  upsertSession,
  listShelf,
  mapPlaces,
  tabletName,
};
