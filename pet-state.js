(() => {
  const PET_STATE_KEY = "beiaiCyberPetState";
  const CONSUMED_TRACKS_KEY = "beiaiPetConsumedTracks";
  const ENDING_KEY = "beiaiPetMusicEndingUnlocked";
  const TALK_RESTORED_KEY = "beiaiTalkRestored";
  const MUSIC_STATE_KEY = "beiaiGlobalMusicState";
  const DIARY_EXPANDED_KEY = "beiaiDiaryExpandedEntries";
  const DIARY_SOLVED_KEY = "beiaiDiarySolvedPuzzles";
  const DIARY_ATTEMPTS_KEY = "beiaiDiaryPuzzleAttempts";
  const DIARY_UNLOCK_KEYS_KEY = "beiaiDiaryUnlockKeysV1";
  const DEBUG_RESET_PASSWORD = "111222555";
  const backgrounds = [
    { src: "assets/pet/backgrounds/bg-room.svg", name: "ROOM" },
    { src: "assets/pet/backgrounds/bg-grass.svg", name: "GRASS" },
    { src: "assets/pet/backgrounds/bg-night.svg", name: "NIGHT" }
  ];
  const characters = [
    { src: "assets/pet/characters/pet-cat.svg", name: "MIMI", alt: "粉色像素猫" },
    { src: "assets/pet/characters/pet-bunny.svg", name: "USAGI", alt: "蓝白像素兔" },
    { src: "assets/pet/characters/pet-ghost.svg", name: "BOO", alt: "薄荷色像素幽灵" }
  ];
  const tracks = Array.isArray(window.BEIAI_MUSIC_TRACKS) ? window.BEIAI_MUSIC_TRACKS : [];
  const noiseCharacters = "锟斤拷烫屯汞咣铪譁縺蜿亂碼▓▒░◆◇◎※�";

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, Math.round(value)));
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function createFreshPetState() {
    return {
      background: randomItem(backgrounds).src,
      character: randomItem(characters).src,
      mood: 70,
      belly: 65,
      coins: 20,
      sleeping: false,
      message: "连接成功！点击 HELLO 和我说话吧。"
    };
  }

  function normalizePetState(saved) {
    const fallback = createFreshPetState();
    const validBackground = backgrounds.some((item) => item.src === saved?.background);
    const validCharacter = characters.some((item) => item.src === saved?.character);

    return {
      background: validBackground ? saved.background : fallback.background,
      character: validCharacter ? saved.character : fallback.character,
      mood: clamp(finiteNumber(saved?.mood, fallback.mood), 0, 100),
      belly: clamp(finiteNumber(saved?.belly, fallback.belly), 0, 100),
      coins: Math.max(0, Math.round(finiteNumber(saved?.coins, fallback.coins))),
      sleeping: Boolean(saved?.sleeping),
      message: typeof saved?.message === "string" ? saved.message : fallback.message
    };
  }

  function emitChange(type, detail) {
    window.dispatchEvent(new CustomEvent("beiai:pet-change", { detail: { type, ...detail } }));
  }

  function getPetState() {
    try {
      const saved = JSON.parse(localStorage.getItem(PET_STATE_KEY));
      if (saved) return normalizePetState(saved);
    } catch (error) {
      // A fresh state is returned when browser storage is unavailable or damaged.
    }

    const fresh = createFreshPetState();
    savePetState(fresh);
    return fresh;
  }

  function savePetState(value) {
    const state = normalizePetState(value);
    try {
      localStorage.setItem(PET_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      // The current document can continue with its in-memory state.
    }
    emitChange("state", { state });
    return state;
  }

  function resetPetState() {
    try {
      localStorage.removeItem(PET_STATE_KEY);
    } catch (error) {
      // Saving the replacement state below is sufficient when removal is blocked.
    }
    return savePetState(createFreshPetState());
  }

  function getConsumedTracks() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONSUMED_TRACKS_KEY));
      return new Set(Array.isArray(saved) ? saved.filter((value) => typeof value === "string") : []);
    } catch (error) {
      return new Set();
    }
  }

  function isTrackConsumed(trackOrSource) {
    const source = typeof trackOrSource === "string" ? trackOrSource : trackOrSource?.src;
    return Boolean(source && getConsumedTracks().has(source));
  }

  function getMusicProgress() {
    const consumed = getConsumedTracks();
    const currentSources = new Set(tracks.map((track) => track.src));
    const consumedCount = Array.from(consumed).filter((source) => currentSources.has(source)).length;
    return {
      consumed: consumedCount,
      total: tracks.length,
      complete: tracks.length > 0 && consumedCount >= tracks.length
    };
  }

  function consumeTrack(track) {
    if (!track?.src) return { changed: false, ...getMusicProgress() };

    const consumed = getConsumedTracks();
    if (consumed.has(track.src)) return { changed: false, ...getMusicProgress() };

    consumed.add(track.src);
    try {
      localStorage.setItem(CONSUMED_TRACKS_KEY, JSON.stringify(Array.from(consumed)));
    } catch (error) {
      return { changed: false, ...getMusicProgress() };
    }

    const state = getPetState();
    state.sleeping = false;
    state.mood = clamp(state.mood + 9, 0, 100);
    state.belly = clamp(state.belly + 14, 0, 100);
    state.message = `我吃掉了《${track.title}》。它正在身体里变成噪点。`;
    savePetState(state);

    const progress = getMusicProgress();
    if (progress.complete) {
      try {
        localStorage.setItem(ENDING_KEY, "1");
      } catch (error) {
        // Completion can still be inferred from the consumed track list.
      }
    }

    const result = { changed: true, track, ...progress };
    emitChange("consumed", result);
    return result;
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

  function garbleText(value, seedValue = value) {
    const random = createSeededRandom(seedValue);
    return Array.from(String(value), (character) => {
      if (/\s/.test(character)) return character;
      return noiseCharacters[Math.floor(random() * noiseCharacters.length)];
    }).join("");
  }

  function garbleTrack(track) {
    return {
      title: garbleText(track?.title || "UNKNOWN", track?.src || "title"),
      artist: garbleText(track?.artist || "UNKNOWN", `${track?.src || "artist"}:artist`)
    };
  }

  function isEndingUnlocked() {
    try {
      return localStorage.getItem(ENDING_KEY) === "1" || getMusicProgress().complete;
    } catch (error) {
      return getMusicProgress().complete;
    }
  }

  function restoreTalk() {
    try {
      localStorage.setItem(TALK_RESTORED_KEY, "1");
    } catch (error) {
      return false;
    }
    emitChange("talk-restored", {});
    return true;
  }

  function isTalkRestored() {
    try {
      return localStorage.getItem(TALK_RESTORED_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function resetDebugProgress(password) {
    if (String(password) !== DEBUG_RESET_PASSWORD) return false;

    try {
      localStorage.removeItem(CONSUMED_TRACKS_KEY);
      localStorage.removeItem(ENDING_KEY);
      localStorage.removeItem(TALK_RESTORED_KEY);
      localStorage.removeItem(MUSIC_STATE_KEY);
      localStorage.removeItem(DIARY_EXPANDED_KEY);
      localStorage.removeItem(DIARY_SOLVED_KEY);
      localStorage.removeItem(DIARY_ATTEMPTS_KEY);
      localStorage.removeItem(DIARY_UNLOCK_KEYS_KEY);
    } catch (error) {
      return false;
    }

    const state = resetPetState();
    emitChange("debug-reset", { state, diaryReset: true });
    return true;
  }

  // 只返回 未解锁且未摧毁 的谜题，已摧毁的给提示也没用了，已解锁的不需要提示
  const DIARY_PUZZLE_IDS = [
    "2021-02-30","2021-04-31","2021-06-31","2021-09-31","2021-11-31",
    "2022-02-29","2022-05-32","2022-13-08",
    "2023-00-17","2023-02-30","2023-07-32","2023-11-31",
    "2024-04-31","2024-06-31","2024-09-31",
    "2025-02-29","2025-05-32","2025-09-31","2025-12-32"
  ];
  const DIARY_HINTS = {
    "2021-02-30": "第1日记提示",
    "2021-04-31": "第2日记提示",
    "2021-06-31": "第3日记提示",
    "2021-09-31": "第4日记提示",
    "2021-11-31": "第5日记提示",
    "2022-02-29": "第6日记提示",
    "2022-05-32": "第7日记提示",
    "2022-13-08": "第8日记提示",
    "2023-00-17": "第9日记提示",
    "2023-02-30": "第10日记提示",
    "2023-07-32": "第11日记提示",
    "2023-11-31": "第12日记提示",
    "2024-04-31": "第13日记提示",
    "2024-06-31": "第14日记提示",
    "2024-09-31": "第15日记提示",
    "2025-02-29": "第16日记提示",
    "2025-05-32": "第17日记提示",
    "2025-09-31": "第18日记提示",
    "2025-12-32": "第19日记提示"
  };

  function getUnsolvedPuzzleIds() {
    const solved = new Set(
      (() => { try { const v = JSON.parse(localStorage.getItem(DIARY_SOLVED_KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; } })()
    );
    const attempts = (() => { try { const v = JSON.parse(localStorage.getItem(DIARY_ATTEMPTS_KEY)); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } })();
    return DIARY_PUZZLE_IDS.filter((id) => {
      if (solved.has(id)) return false;   // 已解锁
      if (attempts[id] === 0) return false;   // 已摧毁
      return true;
    });
  }

  function getRandomDiaryHint() {
    const unsolved = getUnsolvedPuzzleIds();
    if (!unsolved.length) return null;
    const id = unsolved[Math.floor(Math.random() * unsolved.length)];
    return { puzzleId: id, hint: DIARY_HINTS[id] || "这条谜题的答案藏在音乐库里。" };   // fallback 机制，防止出错时给用户返回 undefined
  }

  window.BEIAI_PET = Object.freeze({
    keys: Object.freeze({
      petState: PET_STATE_KEY,
      consumedTracks: CONSUMED_TRACKS_KEY,
      ending: ENDING_KEY,
      talkRestored: TALK_RESTORED_KEY
    }),
    backgrounds,
    characters,
    createFreshPetState,
    getPetState,
    savePetState,
    resetPetState,
    getConsumedTracks,
    isTrackConsumed,
    getMusicProgress,
    consumeTrack,
    garbleText,
    garbleTrack,
    isEndingUnlocked,
    restoreTalk,
    isTalkRestored,
    resetDebugProgress,
    getUnsolvedPuzzleIds,
    getRandomDiaryHint
  });
})();
