(function () {
  const root = document.getElementById("root");
  const card = document.getElementById("card");
  const referenceEl = document.getElementById("reference");
  const translationEl = document.getElementById("translation");
  const verseEl = document.getElementById("verse");
  const bilingualEl = document.getElementById("bilingual");
  const secondaryRef = document.getElementById("secondary-reference");
  const secondaryTr = document.getElementById("secondary-translation");
  const secondaryVerse = document.getElementById("secondary-verse");
  const pagesEl = document.getElementById("pages");

  const THEMES = [
    "clean-lower-third",
    "full-scripture",
    "minimal",
    "bilingual",
  ];

  let pageIndex = 0;
  let pages = [];
  let pageTimer = null;
  let ws = null;
  let reconnectMs = 1000;

  function applyTheme(theme) {
    const id = THEMES.includes(theme) ? theme : "clean-lower-third";
    root.className = "theme-" + id;
  }

  function splitPages(text, maxLen) {
    if (!text) return [""];
    if (text.length <= maxLen) return [text];
    const words = text.split(/\s+/);
    const out = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? cur + " " + w : w;
      if (next.length > maxLen && cur) {
        out.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    if (cur) out.push(cur);
    return out.length ? out : [text];
  }

  function renderPagesDots() {
    if (pages.length <= 1) {
      pagesEl.classList.add("hidden");
      pagesEl.innerHTML = "";
      return;
    }
    pagesEl.classList.remove("hidden");
    pagesEl.innerHTML = pages
      .map(function (_, i) {
        return '<span class="page-dot' + (i === pageIndex ? " active" : "") + '"></span>';
      })
      .join("");
  }

  function showPage() {
    verseEl.textContent = pages[pageIndex] || "";
    renderPagesDots();
  }

  function startPaging() {
    stopPaging();
    if (pages.length <= 1) return;
    pageTimer = setInterval(function () {
      pageIndex = (pageIndex + 1) % pages.length;
      showPage();
    }, 6000);
  }

  function stopPaging() {
    if (pageTimer) {
      clearInterval(pageTimer);
      pageTimer = null;
    }
  }

  function applyState(state) {
    if (!state) return;
    applyTheme(state.theme || "clean-lower-third");

    if (!state.visible || !state.payload) {
      card.classList.remove("visible");
      card.classList.add("hidden");
      stopPaging();
      return;
    }

    const p = state.payload;
    referenceEl.textContent = p.referenceLabel || "";
    translationEl.textContent = p.translationId || "";

    const maxLen = state.theme === "full-scripture" ? 280 : 220;
    pages = splitPages(p.verseText || "", maxLen);
    pageIndex = 0;
    showPage();
    startPaging();

    if (state.theme === "bilingual" && (p.secondaryVerseText || p.secondaryReferenceLabel)) {
      bilingualEl.classList.remove("hidden");
      secondaryRef.textContent = p.secondaryReferenceLabel || p.referenceLabel || "";
      secondaryTr.textContent = p.secondaryTranslationId || "";
      secondaryVerse.textContent = p.secondaryVerseText || "";
    } else {
      bilingualEl.classList.add("hidden");
    }

    card.classList.remove("hidden");
    // force reflow for transition
    void card.offsetWidth;
    card.classList.add("visible");
  }

  function connectWs() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = proto + "//" + location.host + "/ws";
    ws = new WebSocket(url);
    ws.onopen = function () {
      reconnectMs = 1000;
    };
    ws.onmessage = function (ev) {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "state") applyState(msg.state);
      } catch (_) {
        /* ignore */
      }
    };
    ws.onclose = function () {
      setTimeout(connectWs, reconnectMs);
      reconnectMs = Math.min(15000, reconnectMs * 1.5);
    };
    ws.onerror = function () {
      try {
        ws.close();
      } catch (_) {
        /* ignore */
      }
    };
  }

  // Initial fetch in case WS is slow
  fetch("/api/state")
    .then(function (r) {
      return r.json();
    })
    .then(applyState)
    .catch(function () {
      /* ignore */
    });

  connectWs();
})();
