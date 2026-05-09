/* =============================================================
   ELITETRIO ARCADE — script.js
   Main engine: DB connection, game player, chat, presence,
   search, recently played, retry logic.
   ============================================================= */

const SB_URL        = "https://dleydypvpffeifmdpzqc.supabase.co";
const SB_KEY        = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZXlkeXB2cGZmZWlmbWRwenFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTc5ODUsImV4cCI6MjA5MjA5Mzk4NX0.gnI03TZkpBT7r5OIwlTKsd7bwovQYAfwRfykhnq5fjY";

/* ── Module-level state ──────────────────────────────────── */
let sbClient          = null;   /* Supabase client, set once createClient() succeeds  */
let chatInitialized   = false;  /* Guards against duplicate chat subscriptions        */
let scrollListenerSet = false;  /* Guards against duplicate scroll listener           */
let presenceChannel   = null;   /* Kept so we can untrack on retry                    */

/* Supabase free-tier cold starts can take 5–10 s.
   10 s gives the project time to wake up before we fall back. */
const DB_TIMEOUT_MS = 10000;

/* Status messages shown while waiting, one every 3 s */
const STATUS_STEPS = [
    "Connecting to database...",
    "Still connecting — waking server...",
    "Almost there..."
];

/* ═══════════════════════════════════════════════════════════
   INIT — entry point, called on boot and on retry
   ─────────────────────────────────────────────────────────
   Safety design:
     • `triggered` is LOCAL to each init() call so retries
       get a clean flag with no shared state pollution.
     • Timeout is set BEFORE any Supabase code so it always
       fires even if createClient() throws.
     • Every resolution path clears both the timeout and the
       status interval so they never leak.
═══════════════════════════════════════════════════════════ */
async function init() {
    const grid = document.getElementById("gameGrid");
    if (!grid) return;

    /* ── Local flags for this call ── */
    let triggered = false;

    /* ── Status progression while waiting ── */
    let stepIdx = 0;
    setStatus(STATUS_STEPS[0], false);

    const statusInterval = setInterval(() => {
        stepIdx++;
        if (stepIdx < STATUS_STEPS.length) setStatus(STATUS_STEPS[stepIdx], false);
    }, 3000);

    /* ── Safety timeout — fires first, guarantees a fallback ── */
    const dbTimeout = setTimeout(() => {
        if (triggered) return;
        triggered = true;
        clearInterval(statusInterval);
        console.warn("EliteTrio: DB timeout after " + DB_TIMEOUT_MS + "ms — backup.");
        enterBackupMode();
    }, DB_TIMEOUT_MS);

    /* ── Supabase attempt ── */
    try {
        if (!window.supabase || typeof window.supabase.createClient !== "function") {
            throw new Error("Supabase CDN failed to load.");
        }

        /* createClient is synchronous — safe to call before any await */
        sbClient = window.supabase.createClient(SB_URL, SB_KEY);

        const { data: games, error } = await sbClient
            .from("arcade_games")
            .select("*")
            .order("id", { ascending: true });

        /* ── DB responded — cancel the safety net ── */
        clearTimeout(dbTimeout);
        clearInterval(statusInterval);
        if (triggered) return; /* Timeout already fired while we were awaiting */

        if (error) {
            triggered = true;
            console.error("EliteTrio: DB query error:", error.message);
            /* Client is alive even if this query failed — chat can still work */
            enterBackupMode(true);
            return;
        }

        if (!games || games.length === 0) {
            triggered = true;
            console.info("EliteTrio: arcade_games is empty. Using backup games; chat is live.");
            /* Table is empty but connection is alive — chat fully works */
            enterBackupMode(true);
            return;
        }

        /* ── SUCCESS — render live games ── */
        triggered = true;
        grid.innerHTML = "";

        setStatus("LIVE — " + games.length + " Games", true);

        if (typeof buildFilters === "function") buildFilters(games);

        games.forEach((game, i) => {
            const card = typeof buildCard === "function"
                ? buildCard(game, i, false)
                : buildCardFallback(game, i);
            grid.appendChild(card);
        });

        renderRecentlyPlayed();
        attachSearchListener();

        console.log("EliteTrio: Live connection — " + games.length + " games.");
        initChat();

    } catch (err) {
        clearTimeout(dbTimeout);
        clearInterval(statusInterval);
        if (!triggered) {
            triggered = true;
            console.error("EliteTrio: Exception in init():", err.message);
            enterBackupMode();
        }
    }
}

/* ── enterBackupMode ────────────────────────────────────────
 * Centralises all the things that happen when we can't reach
 * the live DB. Pass chatLive=true when sbClient was created
 * successfully (table empty or query error) so chat still works.
 * ────────────────────────────────────────────────────────── */
function enterBackupMode(chatLive = false) {
    runBackup();
    renderRecentlyPlayed();
    attachSearchListener();

    if (chatLive && sbClient) {
        /* Connection exists — chat can still function */
        initChat();
    } else {
        showChatOffline();
        showRetryButton();
    }
}

/* ═══════════════════════════════════════════════════════════
   RETRY
   Resets all mutable UI state and re-calls init().
   chatInitialized is intentionally NOT reset — if chat was
   already live, it stays live and we don't re-subscribe.
═══════════════════════════════════════════════════════════ */
window.retryConnection = async function() {
    console.info("EliteTrio: Retry requested.");

    /* Hide retry button */
    const retryBtn = document.getElementById("retryBtn");
    if (retryBtn) retryBtn.style.display = "none";

    /* Reset grid to loading state */
    const grid = document.getElementById("gameGrid");
    if (grid) grid.innerHTML = '<p class="loading-msg">RECONNECTING...</p>';

    /* Reset filter bar */
    const filterBar = document.getElementById("filterBar");
    if (filterBar) { filterBar.innerHTML = ""; filterBar.classList.remove("visible"); }

    /* Reset search */
    const searchWrap  = document.getElementById("searchWrap");
    const searchInput = document.getElementById("gameSearch");
    if (searchWrap)  searchWrap.style.display = "none";
    if (searchInput) { searchInput.value = ""; searchInput._attached = false; }

    /* Clear recent bar then re-render it (may already have items) */
    renderRecentlyPlayed();

    /* Reset status dot to pulsing */
    setStatus("Reconnecting...", false);

    /* Re-run — fresh triggered flag, fresh timeout */
    await init();
};

function showRetryButton() {
    const btn = document.getElementById("retryBtn");
    if (btn) btn.style.display = "inline-flex";
}

/* ═══════════════════════════════════════════════════════════
   STATUS HELPER
   Updates the text and dot colour in the status pill.
   live=true → cyan pulse; live=false → keep current (blinking)
═══════════════════════════════════════════════════════════ */
function setStatus(text, live) {
    const textEl = document.getElementById("statusText");
    const dotEl  = document.getElementById("statusDot");
    if (textEl) textEl.textContent = text;
    if (dotEl && live) dotEl.className = "dot"; /* reset to cyan pulse */
}

/* ═══════════════════════════════════════════════════════════
   FALLBACK CARD BUILDER
   Used only if Backup.js somehow failed to load.
   Safe: event binding via addEventListener, not inline JS.
═══════════════════════════════════════════════════════════ */
function buildCardFallback(game, index) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.category = (game.category || "").toLowerCase();
    card.style.animationDelay = (index * 0.06) + "s";
    card.innerHTML = `
        <div class="card-body">
            <span class="card-category">${escapeHTML(game.category || "Game")}</span>
            <h3 class="card-title">${escapeHTML(game.title || "")}</h3>
            <button class="play-btn">&#9654; PLAY NOW</button>
        </div>
    `;
    card.querySelector(".play-btn").addEventListener("click", () => {
        window.playGame(game.url, game.title);
    });
    return card;
}

/* ═══════════════════════════════════════════════════════════
   GAME PLAYER
═══════════════════════════════════════════════════════════ */
window.playGame = function(url, title) {
    const section = document.getElementById("playerSection");
    const frame   = document.getElementById("gameFrame");
    const label   = document.getElementById("playerTitle");
    if (!section || !frame || !url) return;

    addToRecent({ url, title });
    renderRecentlyPlayed();

    frame.src = url;
    if (label) label.textContent = "NOW PLAYING: " + (title || "").toUpperCase();
    section.style.display = "block";
    section.scrollIntoView({ behavior: "smooth" });
};

window.closePlayer = function() {
    const section = document.getElementById("playerSection");
    const frame   = document.getElementById("gameFrame");
    if (frame)   frame.src = "";   /* stops audio/execution in the iframe */
    if (section) section.style.display = "none";
};

/* ═══════════════════════════════════════════════════════════
   GAME SEARCH
   Real-time title filter. Guard (_attached) prevents the
   listener being bound twice if attachSearchListener() is
   called from multiple paths (backup, live, retry).
═══════════════════════════════════════════════════════════ */
function attachSearchListener() {
    const input     = document.getElementById("gameSearch");
    const searchWrap = document.getElementById("searchWrap");
    if (!input) return;
    if (input._attached) return; /* already bound — do nothing */
    input._attached = true;

    if (searchWrap) searchWrap.style.display = "block";

    input.addEventListener("input", function() {
        const query = this.value.trim().toLowerCase();

        document.querySelectorAll(".card").forEach(card => {
            if (!query) {
                card.style.display = "";
                return;
            }
            const titleEl = card.querySelector(".card-title");
            const text    = titleEl ? titleEl.textContent.toLowerCase() : "";
            card.style.display = text.includes(query) ? "" : "none";
        });

        /* Visually sync filter buttons — ALL is active while searching */
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        const allBtn = document.querySelector(".filter-btn");
        if (allBtn) allBtn.classList.add("active");
    });

    input.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
            this.value = "";
            this.dispatchEvent(new Event("input"));
            this.blur();
        }
    });
}

/* ═══════════════════════════════════════════════════════════
   RECENTLY PLAYED
   Stores last 3 games in localStorage.
   Called after every render path and again each time a game
   is launched so the strip is always up-to-date.
═══════════════════════════════════════════════════════════ */
const LS_RECENT  = "et_recent";
const MAX_RECENT = 3;

function addToRecent(game) {
    try {
        let recent = JSON.parse(localStorage.getItem(LS_RECENT) || "[]");
        recent = recent.filter(g => g.url !== game.url); /* deduplicate */
        recent.unshift({ title: game.title, url: game.url });
        if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
        localStorage.setItem(LS_RECENT, JSON.stringify(recent));
    } catch (e) { /* private browser / localStorage blocked — silent */ }
}

function renderRecentlyPlayed() {
    try {
        const recent = JSON.parse(localStorage.getItem(LS_RECENT) || "[]");
        const bar    = document.getElementById("recentBar");
        const chips  = document.getElementById("recentChips");
        if (!bar || !chips) return;

        if (!recent.length) { bar.style.display = "none"; return; }

        chips.innerHTML = "";
        recent.forEach(game => {
            const btn = document.createElement("button");
            btn.className = "recent-chip";
            btn.title     = game.title;
            btn.innerHTML = "&#9654; " + escapeHTML(game.title);
            btn.addEventListener("click", () => window.playGame(game.url, game.title));
            chips.appendChild(btn);
        });

        bar.style.display = "flex";
    } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════
   LOBBY CHAT
═══════════════════════════════════════════════════════════ */
const CHAT_CHANNEL = "lobby";
const CHAT_LIMIT   = 50;
const MAX_MESSAGES = 100;
const LS_USERNAME  = "et_username";

/* ── initChat ───────────────────────────────────────────────
 * Guard: chatInitialized prevents duplicate subscriptions if
 * initChat() is somehow called more than once (e.g. on retry
 * when the empty-table path still has a live sbClient).
 * ────────────────────────────────────────────────────────── */
async function initChat() {
    if (chatInitialized) return;
    chatInitialized = true;

    const panel   = document.getElementById("chatSection");
    const input   = document.getElementById("chatInput");
    const sendBtn = document.getElementById("chatSendBtn");
    if (panel)   panel.style.display = "block";
    if (input)   input.disabled = false;   /* re-enable if showChatOffline() ran */
    if (sendBtn) sendBtn.disabled = false;

    restoreUsername();
    attachFeedScrollListener();
    await fetchRecentMessages();
    subscribeToChat();
    initPresence();
    console.log("EliteTrio Chat: Live lobby connected.");
}

/* ── showChatOffline ── */
function showChatOffline() {
    const panel   = document.getElementById("chatSection");
    const feed    = document.getElementById("chatMessages");
    const input   = document.getElementById("chatInput");
    const sendBtn = document.getElementById("chatSendBtn");

    if (panel)   panel.style.display = "block";
    if (feed)    feed.innerHTML = '<div class="chat-system-msg">&#9888; Chat unavailable — server offline.</div>';
    if (input)   input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
}

/* ── fetchRecentMessages ── */
async function fetchRecentMessages() {
    if (!sbClient) return;
    const feed = document.getElementById("chatMessages");
    if (!feed) return;

    try {
        const { data: messages, error } = await sbClient
            .from("chat_messages")
            .select("username, message, created_at, role")
            .eq("channel", CHAT_CHANNEL)
            .order("created_at", { ascending: false })
            .limit(CHAT_LIMIT);

        if (error) { console.warn("EliteTrio Chat: History fetch failed:", error.message); return; }

        feed.innerHTML = "";
        (messages || []).reverse().forEach(msg => appendMessage(msg, false));
        scrollChatToBottom();
    } catch (err) {
        console.error("EliteTrio Chat: fetchRecentMessages error:", err.message);
    }
}

/* ── subscribeToChat ── */
function subscribeToChat() {
    if (!sbClient) return;

    sbClient
        .channel("et-chat-" + CHAT_CHANNEL)
        .on("postgres_changes", {
            event:  "INSERT",
            schema: "public",
            table:  "chat_messages",
            filter: "channel=eq." + CHAT_CHANNEL
        }, (payload) => {
            appendMessage(payload.new, true);
        })
        .subscribe((status) => {
            console.log("EliteTrio Chat: Realtime status —", status);
        });
}

/* ── appendMessage ── */
function appendMessage(msg, animate) {
    const feed = document.getElementById("chatMessages");
    if (!feed || !msg) return;

    /* Trim oldest rows once cap is hit */
    while (feed.children.length >= MAX_MESSAGES) {
        feed.removeChild(feed.firstChild);
    }

    const isAdmin       = (msg.role || "").toLowerCase() === "admin";
    const usernameClass = isAdmin ? "chat-username admin" : "chat-username";
    const adminBadge    = isAdmin ? '<span class="chat-admin-badge">MOD</span>' : "";

    const time     = msg.created_at
        ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";
    const safeUser = escapeHTML(msg.username || "Guest");
    const safeMsg  = escapeHTML(msg.message  || "");

    const row = document.createElement("div");
    row.className = "chat-row" + (animate ? " chat-row-new" : "");
    row.innerHTML = `
        <span class="chat-time">${time}</span>
        <span class="${usernameClass}">${safeUser}${adminBadge}</span>
        <span class="chat-msg-text">${safeMsg}</span>
    `;

    feed.appendChild(row);

    if (animate && !isFeedAtBottom()) {
        showNewMsgIndicator();
    } else {
        scrollChatToBottom();
    }
}

/* ── sendMessage ────────────────────────────────────────────
 * Button is disabled for the duration of the async insert to
 * prevent double-sends. Always re-enabled in `finally`.
 * ────────────────────────────────────────────────────────── */
window.sendMessage = async function() {
    if (!sbClient) return;

    const usernameEl = document.getElementById("chatUsername");
    const inputEl    = document.getElementById("chatInput");
    const sendBtn    = document.getElementById("chatSendBtn");
    if (!usernameEl || !inputEl) return;

    const username = usernameEl.value.trim() || "Guest";
    const message  = inputEl.value.trim();
    if (!message) return;

    saveUsername(username);
    if (sendBtn) sendBtn.disabled = true;
    inputEl.value = "";
    inputEl.focus();

    try {
        const { error } = await sbClient
            .from("chat_messages")
            .insert([{ username, message, channel: CHAT_CHANNEL, role: "user" }]);

        if (error) {
            console.warn("EliteTrio Chat: Send failed:", error.message);
            inputEl.value = message; /* restore on failure */
        }
    } catch (err) {
        console.error("EliteTrio Chat: sendMessage error:", err.message);
        inputEl.value = message;
    } finally {
        if (sendBtn) sendBtn.disabled = false;
        inputEl.focus();
    }
};

window.chatKeyHandler = function(e) {
    if (e.key === "Enter") { e.preventDefault(); window.sendMessage(); }
};

/* ═══════════════════════════════════════════════════════════
   PRESENCE — ONLINE PLAYER COUNT
   Entirely non-critical. Any failure is swallowed so it
   never affects the rest of the app.
═══════════════════════════════════════════════════════════ */
function initPresence() {
    if (!sbClient) return;
    try {
        presenceChannel = sbClient.channel("et-presence");
        presenceChannel
            .on("presence", { event: "sync" }, () => {
                const count = Object.keys(presenceChannel.presenceState()).length;
                updateOnlineCount(count);
            })
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await presenceChannel.track({ joined_at: Date.now() });
                }
            });
    } catch (err) {
        console.warn("EliteTrio Presence: init failed (non-critical):", err.message);
    }
}

function updateOnlineCount(count) {
    const el = document.getElementById("onlineCount");
    if (!el) return;
    el.textContent = count + " online";
    el.style.display = count > 0 ? "flex" : "none";
}

/* ═══════════════════════════════════════════════════════════
   USERNAME PERSISTENCE
═══════════════════════════════════════════════════════════ */
function restoreUsername() {
    try {
        const saved = localStorage.getItem(LS_USERNAME);
        const el    = document.getElementById("chatUserna
