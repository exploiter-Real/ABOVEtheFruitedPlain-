/* =============================================================
   ELITETRIO ARCADE — Backup.js (Patched)
   ============================================================= */

const backupGames = [
    { title: "Galactic Wars",      url: "https://idev.games/embed/galactic-wars",                           category: "Space" },
    { title: "Space Attack!!",     url: "https://idev.games/embed/space-attack-",                           category: "Action" },
    { title: "Granny Horror",      url: "https://www.madkidgames.com/full/granny",                          category: "Horror" },
    { title: "FNAF Shooter",       url: "https://html5.gamemonetize.co/6p79p9p1pssq6dn7724havhlmtf38qqf/", category: "Horror" },
    { title: "Passenger Airplane", url: "https://html5.gamemonetize.co/2xuago0gm0ss2dn7724havhlmtf38qqf/", category: "Simulation" },
    { title: "Minecraft Remake",   url: "https://html5.gamemonetize.co/8uago0gm0ss2dn7724havhlmtf38qqf/", category: "Adventure" },
    { title: "Stickman Hook",      url: "https://html5.gamemonetize.co/9v1piussh2s89pdm3bg83nka1zj9qu/",   category: "Action" },
    { title: "Subway Surfers",     url: "https://html5.gamemonetize.co/ev3v1piussh2s89pdm3bg83nka1zj9qu/", category: "Skill" }
];

const categoryEmoji = { "Space":"🚀", "Action":"⚔️", "Horror":"👻", "Simulation":"✈️", "Adventure":"🗺️", "Skill":"🎯" };

function _esc(str) {
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function _forceHTTPS(url) {
    return url ? url.replace(/^http:\/\//i, 'https://') : "";
}

function runBackup() {
    const grid = document.getElementById("gameGrid");
    const dot = document.getElementById("statusDot");
    const text = document.getElementById("statusText");
    if (!grid) return;
    if (dot) dot.className = "dot gold";
    if (text) text.textContent = "STABLE BACKUP MODE";
    grid.innerHTML = "";
    buildFilters(backupGames);
    backupGames.forEach((game, i) => grid.appendChild(buildCard(game, i, true)));
}

function buildCard(game, index, isBackup) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.category = (game.category || "").toLowerCase();
    card.style.animationDelay = (index * 0.06) + "s";
    const emoji = categoryEmoji[game.category] || "🎮";
    const modeTag = isBackup ? `<p class="mode-tag">LOCAL_FALLBACK</p>` : "";
    
    card.innerHTML = `
        <div class="card-thumb-placeholder">${emoji}</div>
        <div class="card-body">
            <span class="card-category">${_esc(game.category || "Game")}</span>
            ${modeTag}
            <h3 class="card-title">${_esc(game.title)}</h3>
            <button class="play-btn">&#9654; PLAY NOW</button>
        </div>`;

    card.querySelector(".play-btn").onclick = () => {
        if (typeof window.playGame === "function") {
            window.playGame(_forceHTTPS(game.url), game.title);
        }
    };
    return card;
}

function buildFilters(games) {
    const bar = document.getElementById("filterBar");
    if (!bar) return;
    const categories = [...new Set(games.map(g => g.category).filter(Boolean))];
    bar.innerHTML = `<button class="filter-btn active" onclick="window.filterGames('all', this)">ALL (${games.length})</button>`;
    categories.forEach(cat => {
        const count = games.filter(g => g.category === cat).length;
        const btn = document.createElement("button");
        btn.className = "filter-btn";
        btn.textContent = `${cat.toUpperCase()} (${count})`;
        btn.onclick = function() { window.filterGames(cat.toLowerCase(), this); };
        bar.appendChild(btn);
    });
    bar.classList.add("visible");
}

window.filterGames = (category, btn) => {
    document.querySelectorAll(".card").forEach(c => {
        c.style.display = (category === "all" || c.dataset.category === category) ? "" : "none";
    });
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
};
