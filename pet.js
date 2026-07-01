(() => {
  const petApi = window.BEIAI_PET;
  const FEED_COST = 5;
  const HINT_COST = 10;
  const helloLines = [
    "HELLO! 你今天也在上网吗？",
    "我住在一个很小但很亮的窗口里。",
    "刚才有一颗星星从网页顶端掉下来了。",
    "请不要删除我的 cookie... 啊，是 localStorage。",
    "ONLINE! ONLINE! 我一直都在这里。",
    "音乐播放器闻起来很香。"
  ];

  const device = document.querySelector(".pet-device");
  const backgroundImage = document.querySelector("[data-pet-background]");
  const characterImage = document.querySelector("[data-pet-character]");
  const petName = document.querySelector("[data-pet-name]");
  const statusLabel = document.querySelector("[data-pet-status]");
  const message = document.querySelector("[data-pet-message]");
  const moodBar = document.querySelector("[data-mood-bar]");
  const bellyBar = document.querySelector("[data-belly-bar]");
  const moodMeter = document.querySelector("[data-mood-meter]");
  const bellyMeter = document.querySelector("[data-belly-meter]");
  const moodValue = document.querySelector("[data-mood-value]");
  const bellyValue = document.querySelector("[data-belly-value]");
  const coinsValue = document.querySelector("[data-coins-value]");
  const musicBar = document.querySelector("[data-pet-music-bar]");
  const musicMeter = document.querySelector("[data-pet-music-meter]");
  const musicValue = document.querySelector("[data-pet-music-value]");
  const endingLink = document.querySelector("[data-pet-ending-link]");
  const actionButtons = Array.from(document.querySelectorAll("[data-pet-action]"));
  const rerollButton = document.querySelector("[data-pet-reroll]");
  const debugResetButton = document.querySelector("[data-pet-debug-reset]");
  const debugModeEnabled = new URLSearchParams(window.location.search).get("debug") === "1";
  const resetOverlay = document.querySelector("[data-pet-reset-overlay]");
  const resetForm = document.querySelector("[data-pet-reset-form]");
  const resetPassword = document.querySelector("[data-pet-reset-password]");
  const resetError = document.querySelector("[data-pet-reset-error]");
  const resetCancel = document.querySelector("[data-pet-reset-cancel]");

  if (debugResetButton) debugResetButton.hidden = !debugModeEnabled;

  if (!petApi || !device || !backgroundImage || !characterImage) return;

  let state = petApi.getPetState();

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, Math.round(value)));
  }

  function getCharacter() {
    return petApi.characters.find((item) => item.src === state.character) || petApi.characters[0];
  }

  function renderMusicProgress() {
    const progress = petApi.getMusicProgress();
    const percentage = progress.total ? (progress.consumed / progress.total) * 100 : 0;
    musicBar.style.width = `${percentage}%`;
    musicMeter.setAttribute("aria-valuemax", String(progress.total));
    musicMeter.setAttribute("aria-valuenow", String(progress.consumed));
    musicValue.textContent = `${progress.consumed} / ${progress.total}`;
    endingLink.hidden = !progress.complete;
    device.classList.toggle("music-full", progress.complete);
  }

  function render() {
    const character = getCharacter();
    backgroundImage.src = state.background;
    characterImage.src = character.src;
    characterImage.alt = character.alt;
    petName.textContent = character.name;
    message.textContent = state.message;
    moodBar.style.width = `${state.mood}%`;
    bellyBar.style.width = `${state.belly}%`;
    moodMeter.setAttribute("aria-valuenow", String(state.mood));
    bellyMeter.setAttribute("aria-valuenow", String(state.belly));
    moodValue.textContent = String(state.mood);
    bellyValue.textContent = String(state.belly);
    coinsValue.textContent = String(state.coins);
    statusLabel.textContent = state.sleeping ? "SLEEPING" : "ONLINE";
    device.classList.toggle("is-sleeping", state.sleeping);

    const sleepButton = actionButtons.find((button) => button.dataset.petAction === "sleep");
    if (sleepButton) sleepButton.textContent = state.sleeping ? "WAKE" : "SLEEP";
    renderMusicProgress();
  }

  function commit(nextMessage) {
    if (nextMessage) state.message = nextMessage;
    state = petApi.savePetState(state);
    render();
  }

  function wakePet() {
    state.sleeping = false;
  }

  function handleAction(action) {
    window.BEIAI_ACHIEVEMENTS?.unlock(8);

    if (action === "hello") {
      wakePet();
      commit(randomItem(helloLines));
      return;
    }

    if (action === "feed") {
      if (state.coins < FEED_COST) {
        commit("金币不够！普通 FEED 需要 5 coins，去试试 SLOT 吧。");
        return;
      }
      wakePet();
      state.coins -= FEED_COST;
      state.belly = clamp(state.belly + 18, 0, 100);
      state.mood = clamp(state.mood + 6, 0, 100);
      commit("好吃！Belly +18，Mood +6。音乐要从播放器里投喂。 ");
      return;
    }

    if (action === "play") {
      wakePet();
      state.mood = clamp(state.mood + 14, 0, 100);
      state.belly = clamp(state.belly - 10, 0, 100);
      commit("玩得好开心！Mood +14，Belly -10。");
      return;
    }

    if (action === "sleep") {
      state.sleeping = !state.sleeping;
      if (state.sleeping) {
        state.mood = clamp(state.mood + 5, 0, 100);
        commit("SLEEP MODE... zZz... 状态已切换为睡眠。");
      } else {
        commit("WAKE UP! 状态已切换为在线。");
      }
      return;
    }

    if (action === "hint") {
      // HINT 消耗 10 coins 高于 FEED(5) 以控制获取频率，但低于 JACKPOT(30) 确保老虎机中奖后能换三次提示
      if (state.coins < HINT_COST) {
        commit("金币不够！一次提示需要 " + HINT_COST + " coins，去试试 SLOT 吧。");
        return;
      }
      wakePet();
      state.coins -= HINT_COST;
      const hint = petApi.getRandomDiaryHint();
      if (!hint) {
        state.coins += HINT_COST;
        commit("所有日记已解锁或已摧毁，没有需要提示的档案。");
      } else {
        commit("档案 " + hint.puzzleId + " 的线索：" + hint.hint);
      }
      return;
    }

    if (action === "reset") {
      state = petApi.resetPetState();
      state.message = "RESET 完成。已经吃掉的音乐不会回来。";
      commit();
    }
  }

  function rerollPet() {
    const previousBackground = state.background;
    const previousCharacter = state.character;
    let attempts = 0;

    do {
      state.background = randomItem(petApi.backgrounds).src;
      state.character = randomItem(petApi.characters).src;
      attempts += 1;
    } while (state.background === previousBackground && state.character === previousCharacter && attempts < 12);

    state.sleeping = false;
    commit("RE-GENERATE 完成！新的角色与背景已保存。");
    window.BEIAI_ACHIEVEMENTS?.unlock(9);
  }

  function closeDebugReset() {
    resetOverlay.hidden = true;
    resetPassword.value = "";
    resetError.textContent = "";
  }

  function openDebugReset() {
    resetOverlay.hidden = false;
    resetPassword.value = "";
    resetError.textContent = "";
    window.setTimeout(() => resetPassword.focus(), 0);
  }

  actionButtons.forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.petAction));
  });
  rerollButton?.addEventListener("click", rerollPet);
  debugResetButton?.addEventListener("click", openDebugReset);
  resetCancel?.addEventListener("click", closeDebugReset);
  resetOverlay?.addEventListener("click", (event) => {
    if (event.target === resetOverlay) closeDebugReset();
  });
  resetForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!petApi.resetDebugProgress(resetPassword.value)) {
      resetError.textContent = "PASSWORD ERROR";
      resetPassword.select();
      return;
    }

    state = petApi.getPetState();
    state.message = "DEBUG RESET 完成。音乐、杂谈和日记解谜均已从头重置。";
    commit();
    closeDebugReset();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === petApi.keys.petState) state = petApi.getPetState();
    if (event.key === petApi.keys.petState || event.key === petApi.keys.consumedTracks) render();
  });

  window.addEventListener("beiai:pet-change", (event) => {
    if (event.detail?.type === "state") state = petApi.getPetState();
    render();
  });

  render();
})();
