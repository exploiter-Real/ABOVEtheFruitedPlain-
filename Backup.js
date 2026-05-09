/* =============================================================
   ELITETRIO ARCADE — Backup.js
   Loaded BEFORE script.js so runBackup(), buildCard(),
   buildFilters(), and filterGames() are always defined.
   ============================================================= */

const backupGames = [
    { title: "Galactic Wars",      url: "https://idev.games/embed/galactic-wars",                           category: "Space",      thumb: "" },
    { title: "Space Attack!!",     url: "https://idev.games/embed/space-attack-",                           category: "Action",     thumb: "" },
    { title: "Granny Horror",      url: "https://www.madkidgames.com/full/granny",                          category: "Horror",     thumb: "" },
    { title: "FNAF Shooter",       url: "https://html5.gamemonetize.co/6p79p9p1pssq6dn7724havhlmtf38qqf/", category: "Horror",     thumb: "" },
    { title: "Passenger Airplane", url: "https://html5.gamemonetize.co/2xuago0gm0ss2dn7724havhlmtf38qqf/", category: "Simulation", thumb: "" },
    { title: "Minecraft Remake",   url: "https://html5.gamemonetize.co/8uago0gm0ss2dn7724havhlmtf38qqf/", category: "Adventure",  thumb: "" },
    { title: "Stickman Hook",      url: "https://html5.gamemonetize.co/9v1piussh2s89pdm3bg83nka1zj9qu/",   category: "Action",     thumb: "" },
    { title: "Subway Surfers",     url: "https://html5.gamemonetize.co/ev3v1piussh2s89pdm3bg83nka1zj9qu/", category: "Skill",      thumb: "" }
];

const categoryEmoji = {
    "Space":      "🚀",
    "Action":     "⚔️",
    "Horror":     "👻",
    "Simulation": "✈️",
    "Adventure":  "🗺️",
    "Skill":      "🎯",
    "Puzzle":     "🧩",
    "Racing":     "🏎️"
};

/* ── Local HTML escape ──────────────────────────────────────
 * script.js loads after Backup.js, so we can't call its
 * escapeHTML here. This local copy is identical.
 * ────────────────────────────────────────────────────────── */
function _esc(str) {
    return String(str)
        .replace(/&/g,  "&amp;")
        .replace(/</g,  "&lt;")
        .replace(/>/g,  "&gt;")
        .replace(/"/g,  "&quot;")
        .replace(/'/g,  "&#039;");
}

/* ── runBackup ── */
function runBackup() {
    const grid = document.getElementById("gameGrid");
    if (!grid) return;

    const dot  = document.getElementById("statusDot");
    const text = document.getElementById("statusText");
    if (dot)  dot.className = "dot gold";
    if (text) text.textContent = "BACKUP MODE — " + backupGames.length + " Games";

    grid.innerHTML = "";
    buildFilters(backupGames);
    backupGames.forEach((game, i) => grid.appendChild(buildCard(game, i, true)));

    console.log("EliteTrio: Backup mode — " + backupGames.length + " games.");
}

/* ── buildCard ──────────────────────────────────────────────
 * Used for both backup AND live data (script.js calls this).
 *
 * SAFE: game.url and game.title are stored in data-* attributes
 * and bound via addEventListener — never injected into onclick.
 *
 * SAFE: game.title and game.category are HTML-escaped before
 * being set as innerHTML.
 * ────────────────────────────────────────────────────────── */
function buildCard(game, index, isBackup) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.category = (game.category || "").toLowerCase();
    card.style.animationDelay = (index * 0.06) + "s";

    const emoji     = categoryEmoji[game.category] || "🎮";
    const safeTitle = _esc(game.title    || "Untitled");
    const safeCat   = _esc(game.category || "Game");

    const thumbHTML = game.thumb
        ? `<img class="card-thumb" src="${_esc(game.thumb)}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="card-thumb-placeholder" aria-hidden="true">${emoji}</div>`;

    const modeTag = isBackup ? `<p class="mode-tag">STABLE BACKUP</p>` : "";

    card.innerHTML = `
        ${thumbHTML}
        <div class="card-body">
            <span class="card-category">${safeCat}</span>
            ${modeTag}
            <h3 class="card-title">${safeTitle}</h3>
            <button class="play-btn">&#9654; PLAY NOW</button>
        </div>
    `;

    card.querySelector(".play-btn").addEventListener("click", function() {
        window.playGame(game.url, game.title);
    });

    return card;
}

/* ── buildFilters ───────────────────────────────────────────
 * Builds category filter buttons from any games array.
 * Each button shows a count badge: "ACTION (3)".
 * Always creates a fresh ALL button — no stale DOM references.
 * ────────────────────────────────────────────────────────── */
function buildFilters(games) {
    const bar = document.getElementById("filterBar");
    if (!bar) return;

    const categories = [...new Set(games.map(g => g.category).filter(Boolean))];
    bar.innerHTML = "";

    /* ALL button */
    const allBtn = document.createElement("button");
    allBtn.className = "filter-btn active";
    allBtn.textContent = "ALL (" + games.length + ")";
    allBtn.addEventListener("click", function() { window.filterGames("all", this); });
    bar.appendChild(allBtn);

    /* Per-category buttons with count */
    categories.forEach(cat => {
        const count = games.filter(g => g.category === cat).length;
        const btn   = document.createElement("button");
        btn.className   = "filter-btn";
        btn.textContent = cat.toUpperCase() + " (" + count + ")";
        btn.addEventListener("click", function() { window.filterGames(cat.toLowerCase(), this); });
        bar.appendChild(btn);
    });

    bar.classList.add("visible");
}

/* ── filterGames ────────────────────────────────────────────
 * Filters cards by category. display="" (empty string) lets
 * CSS Grid decide the display value — never hardcodes "block".
 * Also clears the search input so filter and search are never
 * in a conflicting state.
 * ────────────────────────────────────────────────────────── */
window.filterGames = function(category, clickedBtn) {
    /* Clear search to avoid conflicting states */
    const searchInput = document.getElementById("gameSearch");
    if (searchInput && searchInput.value) {
        searchInput.value = "";
    }

    document.querySelectorAll(".card").forEach(card => {
        const match = category === "all" || card.dataset.category === category.toLowerCase();
        card.style.display = match ? "" : "none";
    });

    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    if (clickedBtn) clickedBtn.classList.add("active");
};
