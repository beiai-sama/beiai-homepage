const STORAGE_KEY = "beiaiChatMessages";
const API_BASE_URL = "https://beiaichat-api.kathleenjacksonskjshsh.workers.dev/";
const API_ROUTES = [API_BASE_URL];
const SYSTEM_PROMPT = "你是北艾个人主页中的 AI 助手。请根据对话语言自然回复，保持友好、清楚和简洁。";
const LEGACY_DEFAULT_MESSAGES = new Set([
  "你好。这里是 beiaiCHAT 的本地雏形。完整聊天页和右下角悬浮窗会显示同一份内容。",
  "现在还没有接入真正模型。之后建议用 Cloudflare Worker 做中转，不要把 API Key 放进前端页面。"
]);

const defaultMessages = [
  {
    type: "ai",
    text: "你好。这里是 beiaiCHAT。完整聊天页和右下角悬浮窗会显示同一份内容。"
  },
  {
    type: "ai",
    text: "对话现已通过 Cloudflare Worker 接入 DeepSeek。"
  }
];

let messages = loadMessages();
let requestPending = false;
const mobilePerformanceQuery = window.matchMedia?.("(max-width: 768px)");
const reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");

function shouldReduceAmbientMotion() {
  return Boolean(mobilePerformanceQuery?.matches || reducedMotionQuery?.matches);
}

window.requestPetMusicFeed = function requestPetMusicFeed(track) {
  return new Promise((resolve) => {
    const existing = document.querySelector("[data-pet-feed-dialog]");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    const dialog = document.createElement("form");
    const title = document.createElement("h2");
    const trackName = document.createElement("p");
    const warning = document.createElement("p");
    const input = document.createElement("input");
    const actions = document.createElement("div");
    const cancelButton = document.createElement("button");
    const confirmButton = document.createElement("button");

    overlay.className = "pet-feed-overlay";
    overlay.dataset.petFeedDialog = "";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "petFeedTitle");
    dialog.className = "pet-feed-dialog";
    title.id = "petFeedTitle";
    title.textContent = "MUSIC CONSUMPTION WARNING";
    trackName.className = "pet-feed-track";
    trackName.textContent = `即将投喂：《${track?.title || "UNKNOWN"}》`;
    warning.textContent = "该音频将被宠物永久消化，之后无法在本站播放器中再次播放，并会显示为乱码。请输入“确认投喂”继续。";
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "输入：确认投喂";
    input.setAttribute("aria-label", "输入确认投喂");
    actions.className = "pet-feed-actions";
    cancelButton.type = "button";
    cancelButton.textContent = "取消";
    confirmButton.type = "submit";
    confirmButton.textContent = "投喂";
    confirmButton.disabled = true;
    actions.append(cancelButton, confirmButton);
    dialog.append(title, trackName, warning, input, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    let finished = false;
    const close = (answer) => {
      if (finished) return;
      finished = true;
      document.removeEventListener("keydown", handleKeydown);
      overlay.classList.add("closing");
      window.setTimeout(() => overlay.remove(), 180);
      resolve(answer);
    };
    const handleKeydown = (event) => {
      if (event.key === "Escape") close(false);
    };

    input.addEventListener("input", () => {
      confirmButton.disabled = input.value.trim() !== "确认投喂";
    });
    cancelButton.addEventListener("click", () => close(false));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(false);
    });
    dialog.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!confirmButton.disabled) close(true);
    });
    document.addEventListener("keydown", handleKeydown);
    window.requestAnimationFrame(() => overlay.classList.add("open"));
    input.focus();
  });
};

const aiWindow = document.getElementById("aiWindow");
const chatLogs = Array.from(document.querySelectorAll("[data-chat-log]"));
const chatForms = Array.from(document.querySelectorAll("[data-chat-form]"));
const chatToggles = Array.from(document.querySelectorAll("[data-chat-toggle]"));
const clearButtons = Array.from(document.querySelectorAll("[data-chat-clear]"));

function loadMessages() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [...defaultMessages];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [...defaultMessages];

    const normalized = parsed
      .filter((msg) => msg && typeof msg.text === "string")
      .map((msg) => ({
        type: msg.type === "user" ? "user" : "ai",
        text: msg.text
      }));

    const migrated = normalized.filter((msg) => !LEGACY_DEFAULT_MESSAGES.has(msg.text));
    return migrated.length === normalized.length
      ? migrated
      : [...defaultMessages, ...migrated];
  } catch (error) {
    return [...defaultMessages];
  }
}

function saveMessages() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    // Static pages can still chat in-memory if storage is unavailable.
  }
}

function renderLogs() {
  chatLogs.forEach((log) => {
    log.innerHTML = "";

    messages.forEach((message) => {
      const div = document.createElement("div");
      div.className = "msg " + message.type;
      div.textContent = message.text;
      log.appendChild(div);
    });

    if (requestPending) {
      const loading = document.createElement("div");
      loading.className = "msg ai loading";
      loading.textContent = "AI 正在书写回复...";
      log.appendChild(loading);
    }

    log.scrollTop = log.scrollHeight;
  });
}

function addMessage(type, text) {
  messages.push({ type, text });
  saveMessages();
  renderLogs();
}

function toggleAI(forceOpen) {
  if (!aiWindow) return;

  const shouldOpen = typeof forceOpen === "boolean"
    ? forceOpen
    : !aiWindow.classList.contains("open");

  aiWindow.classList.toggle("open", shouldOpen);
  document.body.classList.toggle("ai-chat-open", shouldOpen);

  if (shouldOpen) {
    const input = aiWindow.querySelector("[data-chat-input]");
    setTimeout(() => input && input.focus(), 50);
  }
}

function extractReply(payload) {
  if (typeof payload === "string") return payload.trim();

  const content = payload?.choices?.[0]?.message?.content
    ?? payload?.choices?.[0]?.text
    ?? payload?.reply
    ?? payload?.response
    ?? payload?.answer
    ?? payload?.content
    ?? (typeof payload?.message === "string" ? payload.message : payload?.message?.content);

  return typeof content === "string" ? content.trim() : "";
}

function buildWorkerHistory(currentMessage) {
  const history = [...messages];
  const latest = history[history.length - 1];

  if (latest?.type === "user" && latest.text === currentMessage) {
    history.pop();
  }

  return history
    .filter((message) => !message.text.startsWith("连接 AI 失败"))
    .slice(-30)
    .map((message) => ({
      role: message.type === "user" ? "user" : "assistant",
      content: message.text
    }));
}

function extractErrorMessage(payload, responseText) {
  const error = payload?.error?.message
    ?? payload?.error
    ?? payload?.message;

  if (typeof error === "string" && error.trim()) return error.trim();
  return responseText.trim().slice(0, 800);
}

async function callApi(message) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(API_ROUTES[0], {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: buildWorkerHistory(message)
      }),
      signal: controller.signal
    });

    const responseText = await response.text();
    let payload = null;

    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      // A plain-text response is still useful for debugging or as a reply.
    }

    if (!response.ok) {
      const details = extractErrorMessage(payload, responseText);
      throw new Error(`HTTP ${response.status}${details ? `: ${details}` : ""}`);
    }

    if (payload?.ok === false) {
      throw new Error(extractErrorMessage(payload, responseText) || "Worker 返回失败状态");
    }

    const reply = payload ? extractReply(payload) : responseText.trim();
    if (!reply) throw new Error("API 返回了空回复");
    return reply;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestAIReply(message) {
  return callApi(message);
}

function setRequestState(isPending) {
  requestPending = isPending;

  chatForms.forEach((form) => {
    const button = form.querySelector("button[type='submit']");
    if (!button) return;

    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = isPending;
    button.textContent = isPending ? "..." : button.dataset.label;
  });

  clearButtons.forEach((button) => {
    button.disabled = isPending;
  });

  renderLogs();
}

chatForms.forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (requestPending) return;

    const input = form.querySelector("[data-chat-input]");
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    addMessage("user", text);
    input.value = "";
    setRequestState(true);

    let reply;
    let requestSucceeded = false;
    try {
      reply = await requestAIReply(text);
      requestSucceeded = true;
    } catch (error) {
      reply = error.name === "AbortError"
        ? "连接 AI 失败：请求超时，请稍后再试。"
        : `连接 AI 失败：${error.message || "请检查 Worker 与 CORS 配置。"}`;
    } finally {
      setRequestState(false);
    }

    addMessage("ai", reply);
    if (requestSucceeded) window.BEIAI_ACHIEVEMENTS?.unlock(7);
  });
});

chatToggles.forEach((button) => {
  button.addEventListener("click", () => toggleAI());
});

clearButtons.forEach((button) => {
  button.addEventListener("click", () => {
    messages = [...defaultMessages];

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // The in-memory reset still works if storage is unavailable.
    }

    renderLogs();
  });
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  messages = loadMessages();
  renderLogs();
});

window.toggleAI = toggleAI;

const musicThemePaletteCache = new Map();
const precomputedMusicColors = new Map(
  (window.BEIAI_MUSIC_TRACKS || [])
    .filter((track) => Array.isArray(track.themeColor) && track.themeColor.length === 3)
    .map((track) => [new URL(track.cover, document.baseURI).href, track.themeColor])
);
let musicThemeRequestId = 0;
let musicThemeClearTimer = 0;

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const lightness = (maximum + minimum) / 2;
  const difference = maximum - minimum;

  if (difference === 0) return [0, 0, lightness];

  const saturation = difference / (1 - Math.abs(2 * lightness - 1));
  let hue;

  if (maximum === r) hue = 60 * (((g - b) / difference) % 6);
  else if (maximum === g) hue = 60 * ((b - r) / difference + 2);
  else hue = 60 * ((r - g) / difference + 4);

  return [(hue + 360) % 360, saturation, lightness];
}

function hslToRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const intermediate = chroma * (1 - Math.abs((section % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (section < 1) [red, green] = [chroma, intermediate];
  else if (section < 2) [red, green] = [intermediate, chroma];
  else if (section < 3) [green, blue] = [chroma, intermediate];
  else if (section < 4) [green, blue] = [intermediate, chroma];
  else if (section < 5) [red, blue] = [intermediate, chroma];
  else [red, blue] = [chroma, intermediate];

  const match = lightness - chroma / 2;
  return [
    clampColorChannel((red + match) * 255),
    clampColorChannel((green + match) * 255),
    clampColorChannel((blue + match) * 255)
  ];
}

function createMusicPalette(color) {
  const [hue, originalSaturation, originalLightness] = rgbToHsl(...color);
  const isNeutral = originalSaturation < 0.14;
  const saturation = isNeutral
    ? Math.min(0.12, originalSaturation * 1.15)
    : Math.max(0.34, Math.min(0.8, originalSaturation));
  const primaryLightness = Math.max(0.4, Math.min(0.57, originalLightness));

  return {
    primary: hslToRgb(hue, saturation, primaryLightness),
    accent: hslToRgb(hue, isNeutral ? saturation : Math.min(0.88, saturation + 0.08), 0.68),
    secondary: hslToRgb(
      isNeutral ? hue : (hue + 38) % 360,
      isNeutral ? saturation : Math.max(0.4, saturation * 0.78),
      0.7
    ),
    deep: hslToRgb(hue, Math.min(0.74, saturation), 0.2),
    pale: hslToRgb(hue, Math.min(0.5, saturation * 0.55), 0.9)
  };
}

function getDominantImageColor(image) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas color analysis is unavailable");

  canvas.width = 48;
  canvas.height = 48;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Map();
  let fallbackRed = 0;
  let fallbackGreen = 0;
  let fallbackBlue = 0;
  let fallbackCount = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 180) continue;

    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);

    fallbackRed += red;
    fallbackGreen += green;
    fallbackBlue += blue;
    fallbackCount += 1;

    if (maximum < 22 || minimum > 240) continue;

    const key = `${red >> 5}-${green >> 5}-${blue >> 5}`;
    const weight = 1 + (maximum - minimum) / 180;
    const bucket = buckets.get(key) || { red: 0, green: 0, blue: 0, weight: 0 };
    bucket.red += red * weight;
    bucket.green += green * weight;
    bucket.blue += blue * weight;
    bucket.weight += weight;
    buckets.set(key, bucket);
  }

  const dominant = Array.from(buckets.values()).sort((left, right) => right.weight - left.weight)[0];
  if (dominant) {
    return [
      dominant.red / dominant.weight,
      dominant.green / dominant.weight,
      dominant.blue / dominant.weight
    ];
  }

  if (!fallbackCount) throw new Error("Cover has no visible pixels");
  return [fallbackRed / fallbackCount, fallbackGreen / fallbackCount, fallbackBlue / fallbackCount];
}

function createFallbackMusicColor(value) {
  let hash = 0;
  for (const character of value) {
    hash = (Math.imul(hash, 31) + character.codePointAt(0)) | 0;
  }
  return hslToRgb(Math.abs(hash) % 360, 0.62, 0.52);
}

function extractMusicPalette(coverUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const imageUrl = new URL(coverUrl, document.baseURI);

    if (/^https?:$/.test(imageUrl.protocol) && imageUrl.origin !== window.location.origin) {
      image.crossOrigin = "anonymous";
    }

    image.onload = () => {
      try {
        resolve(createMusicPalette(getDominantImageColor(image)));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("Cover could not be loaded for color analysis"));
    image.src = imageUrl.href;
  });
}

function colorToCss(color) {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

const DEFAULT_MUSIC_PALETTE = Object.freeze({
  primary: [22, 143, 216],
  accent: [115, 230, 255],
  secondary: [255, 120, 200],
  deep: [8, 44, 102],
  pale: [223, 250, 255]
});

function applyMusicPalette(palette) {
  const root = document.documentElement;
  window.clearTimeout(musicThemeClearTimer);
  root.style.setProperty("--music-theme-primary", colorToCss(palette.primary));
  root.style.setProperty("--music-theme-accent", colorToCss(palette.accent));
  root.style.setProperty("--music-theme-secondary", colorToCss(palette.secondary));
  root.style.setProperty("--music-theme-deep", colorToCss(palette.deep));
  root.style.setProperty("--music-theme-pale", colorToCss(palette.pale));
  root.style.setProperty(
    "--music-theme-glow",
    `rgba(${palette.primary[0]}, ${palette.primary[1]}, ${palette.primary[2]}, 0.46)`
  );
  root.classList.add("music-theme-active");
}

let recentBassEnergy = 0.16;
let previousBassEnergy = 0;
let previousBassSpectrum = null;
let lastMusicBeatAt = 0;
let musicBeatCleanupTimer = 0;
const MUSIC_MOTION_STORAGE_KEY = "beiaiMusicBeatMotionEnabled";
const MUSIC_MOTION_STRENGTH_STORAGE_KEY = "beiaiMusicBeatMotionStrength";
let musicBeatMotionEnabled = loadMusicBeatMotionPreference();
let musicBeatMotionStrength = loadMusicBeatMotionStrength();

function loadMusicBeatMotionPreference() {
  try {
    const saved = localStorage.getItem(MUSIC_MOTION_STORAGE_KEY);
    if (saved !== null) return saved !== "0";
    return !shouldReduceAmbientMotion();
  } catch (error) {
    return !shouldReduceAmbientMotion();
  }
}

function loadMusicBeatMotionStrength() {
  try {
    const saved = Number(localStorage.getItem(MUSIC_MOTION_STRENGTH_STORAGE_KEY));
    return Number.isFinite(saved) && saved >= 0.25 && saved <= 2 ? saved : 1;
  } catch (error) {
    return 1;
  }
}

function syncMusicMotionButtons() {
  document.documentElement.classList.toggle("music-motion-disabled", !musicBeatMotionEnabled);
  document.querySelectorAll("[data-music-motion-toggle]").forEach((button) => {
    button.textContent = musicBeatMotionEnabled ? "震" : "静";
    button.setAttribute("aria-pressed", String(musicBeatMotionEnabled));
    button.setAttribute("aria-label", musicBeatMotionEnabled ? "关闭页面抖动" : "开启页面抖动");
    button.title = musicBeatMotionEnabled ? "关闭页面抖动" : "开启页面抖动";
  });
  document.querySelectorAll("[data-music-motion-strength]").forEach((input) => {
    input.value = String(musicBeatMotionStrength);
    input.title = `页面抖动幅度 ${Math.round(musicBeatMotionStrength * 100)}%`;
  });
  document.querySelectorAll("[data-music-motion-strength-value]").forEach((output) => {
    output.textContent = `${Math.round(musicBeatMotionStrength * 100)}%`;
  });
}

function setMusicBeatMotionEnabled(enabled) {
  musicBeatMotionEnabled = Boolean(enabled);
  try {
    localStorage.setItem(MUSIC_MOTION_STORAGE_KEY, musicBeatMotionEnabled ? "1" : "0");
  } catch (error) {
    // The toggle still works for this page when storage is unavailable.
  }
  if (!musicBeatMotionEnabled) resetMusicBeatPulse();
  syncMusicMotionButtons();
}

function setMusicBeatMotionStrength(value) {
  const normalized = Math.max(0.25, Math.min(2, Number(value) || 1));
  musicBeatMotionStrength = Math.round(normalized * 20) / 20;
  try {
    localStorage.setItem(MUSIC_MOTION_STRENGTH_STORAGE_KEY, String(musicBeatMotionStrength));
  } catch (error) {
    // The slider still works for this page when storage is unavailable.
  }
  syncMusicMotionButtons();
}

function resetMusicBeatPulse() {
  recentBassEnergy = 0.16;
  previousBassEnergy = 0;
  previousBassSpectrum = null;
  lastMusicBeatAt = 0;
  window.clearTimeout(musicBeatCleanupTimer);
  const site = document.querySelector(".site");
  if (site) {
    site.classList.remove("music-beat-pulse");
    site.style.removeProperty("--music-beat-scale");
  }
}

function triggerMusicBeatPulse(energy, threshold) {
  if (!musicBeatMotionEnabled) return;
  if (shouldReduceAmbientMotion()) return;

  const site = document.querySelector(".site");
  if (!site) return;

  const extraStrength = Math.max(0, Math.min(1, (energy - threshold) * 5.5));
  const detectedScale = 1.008 + extraStrength * 0.022;
  const scale = 1 + (detectedScale - 1) * musicBeatMotionStrength;
  const currentScale = Number.parseFloat(site.style.getPropertyValue("--music-beat-scale")) || 1;

  if (site.classList.contains("music-beat-pulse")) {
    if (scale > currentScale) site.style.setProperty("--music-beat-scale", scale.toFixed(4));
    return;
  }

  site.style.setProperty("--music-beat-scale", scale.toFixed(4));
  site.classList.add("music-beat-pulse");
  window.clearTimeout(musicBeatCleanupTimer);
  musicBeatCleanupTimer = window.setTimeout(() => {
    site.classList.remove("music-beat-pulse");
    site.style.removeProperty("--music-beat-scale");
  }, 120);
}

window.reportMusicFrequencyData = function reportMusicFrequencyData(frequencyData, sampleRate, fftSize) {
  if (!musicBeatMotionEnabled) return;
  if (shouldReduceAmbientMotion()) return;
  if (!frequencyData?.length || !Number.isFinite(sampleRate) || !Number.isFinite(fftSize)) return;

  const binSize = sampleRate / fftSize;
  const firstBin = Math.max(1, Math.floor(32 / binSize));
  const lastBin = Math.min(frequencyData.length - 1, Math.ceil(250 / binSize));
  let total = 0;
  let peak = 0;
  let positiveFlux = 0;
  let count = 0;

  if (!previousBassSpectrum || previousBassSpectrum.length !== frequencyData.length) {
    previousBassSpectrum = new Uint8Array(frequencyData.length);
  }

  for (let index = firstBin; index <= lastBin; index += 1) {
    const value = frequencyData[index];
    total += value;
    peak = Math.max(peak, value);
    positiveFlux += Math.max(0, value - previousBassSpectrum[index]);
    previousBassSpectrum[index] = value;
    count += 1;
  }

  if (!count) return;

  const energy = ((total / count) * 0.62 + peak * 0.38) / 255;
  const flux = positiveFlux / count / 255;
  const energyRise = Math.max(0, energy - previousBassEnergy);
  recentBassEnergy = recentBassEnergy * 0.97 + energy * 0.03;
  const threshold = Math.max(0.12, recentBassEnergy * 1.035);
  const now = performance.now();
  const isBassOnset = flux > 0.014 || energyRise > 0.018;

  if (energy > 0.13 && (energy > threshold || isBassOnset) && now - lastMusicBeatAt > 10) {
    lastMusicBeatAt = now;
    const onsetBoost = Math.min(0.18, flux * 2.4 + energyRise * 1.8);
    triggerMusicBeatPulse(energy + onsetBoost, threshold);
  }

  previousBassEnergy = energy;
};

window.resetMusicBeatPulse = resetMusicBeatPulse;
window.syncMusicMotionButtons = syncMusicMotionButtons;

document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-music-motion-toggle]");
  if (!toggle) return;
  setMusicBeatMotionEnabled(!musicBeatMotionEnabled);
});

document.addEventListener("input", (event) => {
  const slider = event.target.closest?.("[data-music-motion-strength]");
  if (!slider) return;
  setMusicBeatMotionStrength(slider.value);
});

window.addEventListener("storage", (event) => {
  if (event.key === MUSIC_MOTION_STORAGE_KEY) {
    musicBeatMotionEnabled = loadMusicBeatMotionPreference();
    if (!musicBeatMotionEnabled) resetMusicBeatPulse();
  } else if (event.key === MUSIC_MOTION_STRENGTH_STORAGE_KEY) {
    musicBeatMotionStrength = loadMusicBeatMotionStrength();
  } else {
    return;
  }
  syncMusicMotionButtons();
});

syncMusicMotionButtons();

async function updateMusicTheme(coverUrl) {
  const requestId = ++musicThemeRequestId;
  const root = document.documentElement;
  const animateThemeEntry = !shouldReduceAmbientMotion() && !root.classList.contains("music-theme-active");
  if (animateThemeEntry) applyMusicPalette(DEFAULT_MUSIC_PALETTE);
  const absoluteCoverUrl = new URL(coverUrl, document.baseURI).href;
  let palette = musicThemePaletteCache.get(absoluteCoverUrl);

  if (!palette) {
    const precomputedColor = precomputedMusicColors.get(absoluteCoverUrl);

    if (precomputedColor) {
      palette = createMusicPalette(precomputedColor);
    } else {
      try {
        palette = await extractMusicPalette(absoluteCoverUrl);
      } catch (error) {
        palette = createMusicPalette(createFallbackMusicColor(absoluteCoverUrl));
      }
    }
    musicThemePaletteCache.set(absoluteCoverUrl, palette);
  }

  if (requestId !== musicThemeRequestId) return;
  if (!animateThemeEntry) {
    applyMusicPalette(palette);
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (requestId === musicThemeRequestId) applyMusicPalette(palette);
    });
  });
}

function clearMusicTheme() {
  const requestId = ++musicThemeRequestId;
  const root = document.documentElement;
  window.clearTimeout(musicThemeClearTimer);

  if (shouldReduceAmbientMotion() || !root.classList.contains("music-theme-active")) {
    root.classList.remove("music-theme-active");
    resetMusicBeatPulse();
    return;
  }

  applyMusicPalette(DEFAULT_MUSIC_PALETTE);
  musicThemeClearTimer = window.setTimeout(() => {
    if (requestId === musicThemeRequestId) root.classList.remove("music-theme-active");
  }, 800);
  resetMusicBeatPulse();
}

window.setMusicPageCover = function setMusicPageCover(coverUrl) {
  if (shouldReduceAmbientMotion()) {
    if (coverUrl) {
      updateMusicTheme(String(coverUrl));
    } else {
      clearMusicTheme();
    }
    return;
  }

  let backdrop = document.querySelector("[data-music-cover-backdrop]");

  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "music-cover-backdrop";
    backdrop.dataset.musicCoverBackdrop = "";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.innerHTML = '<span class="music-cover-layer"></span><span class="music-cover-layer"></span>';
    document.body.appendChild(backdrop);
  }

  const layers = Array.from(backdrop.querySelectorAll(".music-cover-layer"));
  const current = layers.find((layer) => layer.classList.contains("active"));

  if (!coverUrl) {
    layers.forEach((layer) => layer.classList.remove("active"));
    clearMusicTheme();
    return;
  }

  updateMusicTheme(String(coverUrl));

  const incoming = layers.find((layer) => layer !== current) || layers[0];
  const safeUrl = String(coverUrl).replace(/"/g, "%22");
  incoming.style.backgroundImage = `linear-gradient(rgba(17, 14, 30, 0.25), rgba(17, 14, 30, 0.48)), url("${safeUrl}")`;

  requestAnimationFrame(() => {
    incoming.classList.add("active");
    if (current) current.classList.remove("active");
  });
};

function syncMarqueeMotion() {
  document.querySelectorAll("marquee").forEach((marquee) => {
    const method = shouldReduceAmbientMotion() ? "stop" : "start";
    if (typeof marquee[method] === "function") marquee[method]();
  });
}

mobilePerformanceQuery?.addEventListener?.("change", syncMarqueeMotion);
reducedMotionQuery?.addEventListener?.("change", syncMarqueeMotion);
syncMarqueeMotion();

renderLogs();
