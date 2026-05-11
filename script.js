const SB_URL = "https://dleydypvpffeifmdpzqc.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZXlkeXB2cGZmZWlmbWRwenFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTc5ODUsImV4cCI6MjA5MjA5Mzk4NX0.gnI03TZkpBT7r5OIwlTKsd7bwovQYAfwRfykhnq5fjY";

let sbClient = null;
let isAdmin = false;

async function init() {
    console.log("Initializing Kernel...");
    let attempts = 0;
    while (!window.supabase && attempts < 10) {
        await new Promise(res => setTimeout(res, 1000));
        attempts++;
    }

    if (window.supabase) {
        sbClient = window.supabase.createClient(SB_URL, SB_KEY);
        
        // Admin Validation
        const userCheck = document.getElementById("chatUsername").value;
        if (userCheck === "EliteTrio" || localStorage.getItem("adminMode") === "true") {
            isAdmin = true;
        }

        loadGames();
        initChat();
        listenForEffects();
        document.getElementById("statusText").innerText = "LINK ESTABLISHED";
    }
}

// --- Chat & Moderation Logic ---
async function initChat() {
    const { data } = await sbClient.from("chat_messages").select("*").limit(50).order("created_at", { ascending: true });
    if (data) {
        data.forEach(msg => appendMessage(msg));
    }

    sbClient.channel('chat-room').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, payload => {
        if (payload.eventType === 'INSERT') appendMessage(payload.new);
        if (payload.eventType === 'DELETE') {
            const el = document.getElementById(`msg-${payload.old.id}`);
            if (el) el.remove();
        }
    }).subscribe();
}

function appendMessage(msg) {
    const feed = document.getElementById("chatMessages");
    if (!feed) return;

    const row = document.createElement("div");
    row.className = "chat-row";
    row.id = `msg-${msg.id}`;

    // Admin Long-Press Setup
    let pressTimer;
    row.addEventListener('touchstart', () => {
        if(isAdmin) pressTimer = setTimeout(() => openModMenu(msg), 800);
    });
    row.addEventListener('touchend', () => clearTimeout(pressTimer));
    row.oncontextmenu = (e) => {
        if(isAdmin) { e.preventDefault(); openModMenu(msg); }
    };

    row.innerHTML = `
        <span class="chat-username">${msg.username || 'ANON'}</span>
        <span class="chat-text">${msg.message}</span>
    `;

    feed.appendChild(row);
    feed.scrollTop = feed.scrollHeight;
}

async function openModMenu(msg) {
    const choice = confirm(`MODERATION - Target: ${msg.username}\n\nOK: Delete Message\nCancel: Dismiss`);
    if (choice) {
        const { error } = await sbClient.from("chat_messages").delete().eq("id", msg.id);
        if (error) alert("Deletion failed: " + error.message);
    }
}

window.sendMessage = async () => {
    const userBox = document.getElementById("chatUsername");
    const msgBox = document.getElementById("chatInput");
    const user = userBox.value || "Guest";
    const msg = msgBox.value;

    if (msg.trim() !== "" && sbClient) {
        if (user === "EliteTrio") isAdmin = true; // Local toggle
        await sbClient.from("chat_messages").insert([{ username: user, message: msg }]);
        msgBox.value = "";
    }
};

// --- Games & Effects ---
async function loadGames() {
    const { data } = await sbClient.from("arcade_games").select("*").order("id");
    const grid = document.getElementById("gameGrid");
    if (data) {
        grid.innerHTML = "";
        data.forEach(game => {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <h3>${game.title}</h3>
                <button class="play-btn" onclick="playGame('${game.url}')">INITIATE</button>
            `;
            grid.appendChild(card);
        });
    }
}

function listenForEffects() {
    sbClient.channel('effects').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_effects' }, p => {
        const cmd = p.new.command;
        document.body.classList.remove("effect-rainbow", "effect-shake", "effect-dark");
        if (cmd && cmd !== "none") {
            document.body.classList.add("effect-" + cmd);
        }
    }).subscribe();
}

window.playGame = (url) => {
    const player = document.getElementById("playerSection");
    document.getElementById("gameFrame").src = url;
    player.style.display = "block";
    player.scrollIntoView({ behavior: "smooth" });
};

window.onload = init;
