(() => {
  const STORAGE_KEY = "beiaiDiaryExpandedEntries";
  const PUZZLE_STORAGE_KEY = "beiaiDiarySolvedPuzzles";
  const PUZZLE_ATTEMPTS_STORAGE_KEY = "beiaiDiaryPuzzleAttempts";
  const UNLOCK_KEYS_STORAGE_KEY = "beiaiDiaryUnlockKeysV1";
  const ATTEMPT_LIMITS = {
    2021: 7,
    2022: 5,
    2023: 3,
    2024: 2,
    2025: 1
  };
  const GARBLED_CHARACTERS = "锟斤拷烫屯汞咣铪钴铯蜿縺譁亂碼▓▒░◆◇◎※�";
  const encryptedArchive = window.BEIAI_ENCRYPTED_DIARY;
  const encryptedEntries = encryptedArchive?.entries || {};
  const symbolKeyArchive = window.BEIAI_DIARY_SYMBOL_KEYS;
  const symbolKeyEntries = symbolKeyArchive?.entries || {};
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();
  const entries = Array.from(document.querySelectorAll(".diary-post"));
  const expandAllButton = document.querySelector("[data-diary-expand-all]");
  const collapseAllButton = document.querySelector("[data-diary-collapse-all]");
  const statusSummary = document.querySelector("[data-diary-status-summary]");

  if (!entries.length) return;

  function isEditableElement(element) {
    return Boolean(element?.closest?.('input, textarea, [contenteditable="true"]'));
  }

  function selectionIsInsideDiary() {
    const selection = window.getSelection?.();
    const node = selection?.anchorNode;
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return Boolean(element?.closest?.(".diary-post, .diary-preface"));
  }

  document.addEventListener("copy", (event) => {
    if (isEditableElement(event.target) || !selectionIsInsideDiary()) return;
    event.preventDefault();
    event.clipboardData?.setData("text/plain", "ARCHIVE COPY DENIED // 日记内容禁止复制");
  });

  document.addEventListener("cut", (event) => {
    if (!isEditableElement(event.target) && selectionIsInsideDiary()) event.preventDefault();
  });

  document.addEventListener("dragstart", (event) => {
    if (event.target.closest?.(".diary-post, .diary-preface")) event.preventDefault();
  });

  function loadExpandedEntries() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(saved) ? new Set(saved) : new Set();
    } catch (error) {
      return new Set();
    }
  }

  const expandedEntries = loadExpandedEntries();

  function saveExpandedEntries() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expandedEntries)));
    } catch (error) {
      // Folding still works in-memory if storage is unavailable.
    }
  }

  function loadPublishedSolvedPuzzles() {
    try {
      const saved = JSON.parse(localStorage.getItem(PUZZLE_STORAGE_KEY));
      return Array.isArray(saved) ? new Set(saved) : new Set();
    } catch (error) {
      return new Set();
    }
  }

  const publishedSolvedPuzzles = loadPublishedSolvedPuzzles();

  function loadUnlockKeys() {
    try {
      const saved = JSON.parse(localStorage.getItem(UNLOCK_KEYS_STORAGE_KEY));
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch (error) {
      return {};
    }
  }

  const unlockKeys = loadUnlockKeys();
  const solvedPuzzles = new Set(Object.keys(unlockKeys));

  function saveUnlockKeys() {
    try {
      localStorage.setItem(UNLOCK_KEYS_STORAGE_KEY, JSON.stringify(unlockKeys));
    } catch (error) {
      // The current page remains unlocked if storage is unavailable.
    }
  }

  function saveSolvedPuzzles() {
    try {
      const published = new Set([...publishedSolvedPuzzles, ...solvedPuzzles]);
      localStorage.setItem(PUZZLE_STORAGE_KEY, JSON.stringify(Array.from(published)));
    } catch (error) {
      // Puzzle verification still works in-memory if storage is unavailable.
    }
  }

  function loadPuzzleAttempts() {
    try {
      const saved = JSON.parse(localStorage.getItem(PUZZLE_ATTEMPTS_STORAGE_KEY));
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch (error) {
      return {};
    }
  }

  const puzzleAttempts = loadPuzzleAttempts();

  function savePuzzleAttempts() {
    try {
      localStorage.setItem(PUZZLE_ATTEMPTS_STORAGE_KEY, JSON.stringify(puzzleAttempts));
    } catch (error) {
      // Attempt limits still work in-memory if storage is unavailable.
    }
  }

  function getAttemptLimit(puzzleId) {
    return ATTEMPT_LIMITS[Number(puzzleId.slice(0, 4))] || 1;
  }

  function getRemainingAttempts(puzzleId) {
    const limit = getAttemptLimit(puzzleId);
    const stored = Number(puzzleAttempts[puzzleId]);
    return Number.isInteger(stored) ? Math.max(0, Math.min(stored, limit)) : limit;
  }

  function createSeededRandom(value) {
    let seed = Array.from(value).reduce(
      (current, character) => Math.imul(current ^ character.codePointAt(0), 16777619) >>> 0,
      2166136261
    );

    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function destroyDiaryContent(container, puzzleId) {
    if (!container || container.dataset.destroyed === "true") return;

    if (!container.textContent.trim()) {
      container.textContent = "ARCHIVE DATA LOST // 此档案已经无法恢复";
    }

    const random = createSeededRandom(puzzleId);
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const textNodes = [];

    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach((node) => {
      node.nodeValue = Array.from(node.nodeValue, (character) => {
        if (/\s/.test(character)) return character;
        return GARBLED_CHARACTERS[Math.floor(random() * GARBLED_CHARACTERS.length)];
      }).join("");
    });

    container.dataset.destroyed = "true";
  }

  function normalizeAnswer(value) {
    return value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
  }

  function normalizeAnswerIgnoringSymbols(value) {
    return value.normalize("NFKC").replace(/[\p{P}\p{S}\s]+/gu, "").toUpperCase();
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function bytesToBase64(value) {
    let binary = "";
    value.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  async function deriveDiaryKey(answer, encryptedEntry) {
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(normalizeAnswer(answer)),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: base64ToBytes(encryptedEntry.salt),
        iterations: encryptedArchive.iterations,
        hash: "SHA-256"
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );
  }

  async function unwrapSymbolInsensitiveDiaryKey(puzzleId, answer, wrappedEntry) {
    const normalizedAnswer = normalizeAnswerIgnoringSymbols(answer);
    if (!normalizedAnswer) throw new Error("EMPTY NORMALIZED ANSWER");

    const passwordKey = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(normalizedAnswer),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    const wrappingKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: base64ToBytes(wrappedEntry.salt),
        iterations: symbolKeyArchive.iterations,
        hash: "SHA-256"
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    const rawDiaryKey = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(wrappedEntry.iv),
        additionalData: textEncoder.encode(`beiai-diary-symbol-key:${puzzleId}:v1`)
      },
      wrappingKey,
      base64ToBytes(wrappedEntry.ciphertext)
    );

    return crypto.subtle.importKey(
      "raw",
      rawDiaryKey,
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );
  }

  async function importDiaryKey(encodedKey) {
    return crypto.subtle.importKey(
      "raw",
      base64ToBytes(encodedKey),
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );
  }

  async function decryptDiaryEntry(puzzleId, encryptedEntry, key) {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(encryptedEntry.iv),
        additionalData: textEncoder.encode(`beiai-diary:${puzzleId}:v1`)
      },
      key,
      base64ToBytes(encryptedEntry.ciphertext)
    );
    return textDecoder.decode(plaintext);
  }

  function updateDiaryStatus() {
    if (!statusSummary) return;

    const destroyed = entries.filter((entry) => entry.classList.contains("puzzle-destroyed")).length;
    const locked = entries.filter(
      (entry) => entry.hasAttribute("data-diary-puzzle") && !entry.classList.contains("puzzle-solved")
    ).length;
    const unlocked = entries.length - locked - destroyed;

    statusSummary.textContent = `一共（${entries.length}）篇，解锁（${unlocked}）篇，锁定（${locked}）篇，摧毁（${destroyed}）篇`;
  }

  function reportDiaryAchievement(type) {
    const puzzleIds = Object.keys(encryptedEntries);
    const hadMistake = Object.entries(puzzleAttempts).some(
      ([puzzleId, remaining]) => Number(remaining) < getAttemptLimit(puzzleId)
    );
    const allSolved = puzzleIds.length > 0 && puzzleIds.every((puzzleId) => Boolean(unlockKeys[puzzleId]));
    const allDestroyed = puzzleIds.length > 0 && puzzleIds.every(
      (puzzleId) => !unlockKeys[puzzleId] && getRemainingAttempts(puzzleId) === 0
    );
    window.BEIAI_ACHIEVEMENTS?.recordDiary(type, { hadMistake, allSolved, allDestroyed });
  }

  function updateEntryLock(entry) {
    const lock = entry.querySelector(".diary-lock-marker");
    const stateText = entry.querySelector(".diary-lock-state-text");
    const button = entry.querySelector(".diary-entry-toggle");
    if (!lock || !stateText || !button) return;

    const unlocked = !entry.hasAttribute("data-diary-puzzle") || entry.classList.contains("puzzle-solved");
    const stateLabel = unlocked ? "已解锁" : "尚未解锁";
    const expanded = !entry.classList.contains("collapsed");

    lock.textContent = unlocked ? "🔓" : "🔒";
    lock.classList.toggle("is-unlocked", unlocked);
    lock.title = stateLabel;
    stateText.textContent = `，${stateLabel}`;
    button.title = `${expanded ? "收起" : "展开"}这篇日记 · ${stateLabel}`;
  }

  function setEntryExpanded(entry, expanded, save = true) {
    const button = entry.querySelector(".diary-entry-toggle");
    const marker = entry.querySelector(".diary-toggle-marker");
    const key = entry.dataset.diaryKey;

    entry.classList.toggle("collapsed", !expanded);
    button.setAttribute("aria-expanded", String(expanded));
    marker.textContent = expanded ? "−" : "+";
    button.title = expanded ? "收起这篇日记" : "展开这篇日记";

    if (expanded) {
      expandedEntries.add(key);
    } else {
      expandedEntries.delete(key);
    }

    updateEntryLock(entry);
    if (save) saveExpandedEntries();
  }

  entries.forEach((entry, index) => {
    const heading = entry.querySelector(":scope > h3");
    if (!heading) return;

    const date = heading.textContent.trim();
    const key = date || `entry-${index + 1}`;
    const bodyId = `diary-entry-body-${index + 1}`;
    const body = document.createElement("div");
    const bodyInner = document.createElement("div");
    const button = document.createElement("button");
    const dateLabel = document.createElement("span");
    const lockStateText = document.createElement("span");
    const toggleStatus = document.createElement("span");
    const lock = document.createElement("span");
    const marker = document.createElement("span");

    entry.dataset.diaryKey = key;
    body.className = "diary-entry-body";
    body.id = bodyId;
    bodyInner.className = "diary-entry-body-inner";
    button.type = "button";
    button.className = "diary-entry-toggle";
    button.setAttribute("aria-controls", bodyId);
    dateLabel.textContent = date;
    lockStateText.className = "visually-hidden diary-lock-state-text";
    toggleStatus.className = "diary-toggle-status";
    lock.className = "diary-lock-marker";
    lock.setAttribute("aria-hidden", "true");
    marker.className = "diary-toggle-marker";
    marker.setAttribute("aria-hidden", "true");
    toggleStatus.append(lock, marker);
    button.append(dateLabel, lockStateText, toggleStatus);
    heading.replaceChildren(button);

    while (heading.nextSibling) {
      bodyInner.appendChild(heading.nextSibling);
    }

    body.appendChild(bodyInner);
    entry.appendChild(body);
    setEntryExpanded(entry, expandedEntries.has(key), false);

    button.addEventListener("click", () => {
      setEntryExpanded(entry, entry.classList.contains("collapsed"));
    });
  });

  document.querySelectorAll("[data-diary-puzzle]").forEach((entry) => {
    const puzzleId = entry.dataset.diaryPuzzle;
    const encryptedEntry = encryptedEntries[puzzleId];
    const form = entry.querySelector("[data-diary-puzzle-form]");
    const input = entry.querySelector("[data-diary-puzzle-input]");
    const submitButton = form?.querySelector('button[type="submit"]');
    const kicker = entry.querySelector(".diary-puzzle-kicker");
    const protectedContent = entry.querySelector(".diary-protected-content");

    if (!form || !input || !submitButton || !kicker || !protectedContent) return;

    const attemptCounter = document.createElement("span");
    attemptCounter.className = "diary-attempt-count";
    attemptCounter.setAttribute("aria-live", "polite");
    kicker.appendChild(attemptCounter);

    function updateAttemptCounter(remaining) {
      attemptCounter.textContent = `剩余尝试 ${remaining}`;
    }

    function showSolvedState(decryptedHtml) {
      protectedContent.innerHTML = decryptedHtml;
      delete protectedContent.dataset.destroyed;
      entry.classList.add("puzzle-solved");
      entry.classList.remove("puzzle-destroyed");
      input.value = "";
      input.disabled = true;
      submitButton.disabled = true;
      submitButton.textContent = "档案已解锁";
      attemptCounter.textContent = "已解锁";
      updateEntryLock(entry);
      updateDiaryStatus();
      reportDiaryAchievement("solved");
    }

    function showAvailableState() {
      input.disabled = false;
      submitButton.disabled = false;
      submitButton.textContent = "解锁档案";
      updateAttemptCounter(remainingAttempts);
      updateEntryLock(entry);
      updateDiaryStatus();
    }

    function showDestroyedState(expandNow = false) {
      entry.classList.add("puzzle-solved", "puzzle-destroyed");
      input.value = "";
      input.disabled = true;
      submitButton.disabled = true;
      submitButton.textContent = "档案已摧毁";
      attemptCounter.textContent = "剩余尝试 0";
      destroyDiaryContent(protectedContent, puzzleId);
      if (expandNow) setEntryExpanded(entry, true);
      updateEntryLock(entry);
      updateDiaryStatus();
      reportDiaryAchievement("destroyed");
    }

    let remainingAttempts = getRemainingAttempts(puzzleId);

    if (!encryptedEntry) {
      input.disabled = true;
      submitButton.disabled = true;
      submitButton.textContent = "加密数据缺失";
      attemptCounter.textContent = "无法读取档案";
    } else if (unlockKeys[puzzleId] && globalThis.crypto?.subtle) {
      input.disabled = true;
      submitButton.disabled = true;
      submitButton.textContent = "正在解密";
      attemptCounter.textContent = "正在恢复已解锁档案";

      (async () => {
        try {
          const storedKey = await importDiaryKey(unlockKeys[puzzleId]);
          const decryptedHtml = await decryptDiaryEntry(puzzleId, encryptedEntry, storedKey);
          showSolvedState(decryptedHtml);
        } catch (error) {
          delete unlockKeys[puzzleId];
          solvedPuzzles.delete(puzzleId);
          saveUnlockKeys();
          protectedContent.replaceChildren();
          if (remainingAttempts === 0) {
            showDestroyedState();
          } else {
            showAvailableState();
          }
        }
      })();
    } else if (remainingAttempts === 0) {
      showDestroyedState();
    } else {
      showAvailableState();
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (entry.classList.contains("puzzle-solved")) return;
      if (!encryptedEntry) return;
      entry.classList.remove("puzzle-error");

      if (!globalThis.crypto?.subtle) {
        attemptCounter.textContent = "当前浏览器不支持安全解密";
        return;
      }

      const submittedAnswer = input.value;
      input.disabled = true;
      submitButton.disabled = true;
      submitButton.textContent = "正在验证";
      attemptCounter.textContent = "正在解密档案";

      try {
        const wrappedEntry = symbolKeyEntries[puzzleId];
        const key = wrappedEntry
          ? await unwrapSymbolInsensitiveDiaryKey(puzzleId, submittedAnswer, wrappedEntry)
          : await deriveDiaryKey(submittedAnswer, encryptedEntry);
        const decryptedHtml = await decryptDiaryEntry(puzzleId, encryptedEntry, key);
        const exportedKey = await crypto.subtle.exportKey("raw", key);
        unlockKeys[puzzleId] = bytesToBase64(new Uint8Array(exportedKey));
        solvedPuzzles.add(puzzleId);
        saveUnlockKeys();
        saveSolvedPuzzles();
        showSolvedState(decryptedHtml);
        return;
      } catch (error) {
        // AES-GCM authentication fails when the submitted answer derives the wrong key.
      }

      input.value = "";
      remainingAttempts = Math.max(0, remainingAttempts - 1);
      puzzleAttempts[puzzleId] = remainingAttempts;
      savePuzzleAttempts();
      reportDiaryAchievement("mistake");

      if (remainingAttempts === 0) {
        showDestroyedState(true);
        return;
      }

      showAvailableState();
      entry.classList.add("puzzle-error");
      window.setTimeout(() => entry.classList.remove("puzzle-error"), 420);
      input.focus();
    });
  });

  updateDiaryStatus();

  function setAllEntries(expanded) {
    entries.forEach((entry) => setEntryExpanded(entry, expanded, false));
    saveExpandedEntries();
  }

  expandAllButton?.addEventListener("click", () => setAllEntries(true));
  collapseAllButton?.addEventListener("click", () => setAllEntries(false));
})();
