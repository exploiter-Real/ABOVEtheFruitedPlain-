
const SB_URL = "https://dleydypvpffeifmdpzqc.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZXlkeXB2cGZmZWlmbWRwenFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTc5ODUsImV4cCI6MjA5MjA5Mzk4NX0.gnI03TZkpBT7r5OIwlTKsd7bwovQYAfwRfykhnq5fjY";

let sbClient = null;
let isAdmin = false; 
let currentUser = "Guest";

// 1. INITIALIZE & CHECK ADMIN STATUS
async function init() {
    let attempts = 0;
    while (!window.supabase && attempts < 10) {
        await new Promise(res => setTimeout(res, 1000));
        attempts++;
    }

    if (window.supabase) {
        sbClient = window.supabase.createClient(SB_URL, SB_KEY);
        
        // Simple Admin Check (matching your 'admins' table)
        const storedUser = localStorage.getItem("username");
        if (storedUser === "EliteTrio") {
            isAdmin = true;
            currentUser = "EliteTrio";
        }

        loadGames();
        initChat();
        listenForEffects();
    }
}

// 2. CHAT ENGINE WITH MODERATION
async function initChat() {
    const { data } = await sbClient.from("chat_messages").select("*").limit(50).order("created_at");
    if (data) data.forEach(msg => appendMessage(msg));

    // Realtime Listener for Chat & Moderation
    sbClient.channel('chat-room').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, payload => {
        if (payload.eventType === 'INSERT') appendMessage(payload.new);
        if (payload.eventType === 'DELETE') document.getElementById(`msg-${payload.old.id}`)?.remove();
    }).subscribe();
}

function appendMessage(msg) {
    const feed = document.getElementById("chatMessages");
    const row = document.createElement("div");
    row.className = "chat-row";
    row.id = `msg-${msg.id}`;
    
    // Tap & Hold Logic for Mobile Moderation
    let timer;
    row.ontouchstart = () => { if(isAdmin) timer = setTimeout(() => showModMenu(msg), 800); };
    row.ontouchend = () => clearTimeout(timer);
    // Desktop right-click fallback
    row.oncontextmenu = (e) => { if(isAdmin) { e.preventDefault(); showModMenu(msg); } };

    row.innerHTML = `<span class="chat-username">${msg.username}:</span> <span>${msg.message}</span>`;
    feed.appendChild(row);
    feed.scrollTop = feed.scrollHeight;
}

// 3. THE MODERATION ACTIONS
async function showModMenu(msg) {
    const action = confirm(`MODERATION: ${msg.username}\n1. Delete Message\n2. Mute Person\n3. Timeout (10m)`);
    
    if (!action) return;

    if (confirm("Execute Delete?")) {
        await sbClient.from("chat_messages").delete().eq("id", msg.id);
    } 
    
    // Linking to your chat_moderation table
    if (confirm("Add to Moderation Table (Mute/Timeout)?")) {
        await sbClient.from("chat_moderation").insert([
            { user_id: msg.user_id || null, reason: "Admin Action", admin_actor: "EliteTrio" }
        ]);
        alert(`${msg.username} added to moderation list.`);
    }
}

// 4. LIVE EFFECTS ENGINE
function listenForEffects() {
    sbClient.channel('effects').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_effects' }, p => {
        const cmd = p.new.command;
        document.body.classList.remove("effect-rainbow", "effect-shake", "effect-dark");
        if (cmd && cmd !== "none") document.body.classList.add("effect-" + cmd);
    }).subscribe();
}

// 5. GAME ENGINE
async function loadGames() {
    const { data } = await sbClient.from("arcade_games").select("*").order("id");
    const grid = document.getElementById("gameGrid");
    if (data) {
        grid.innerHTML = "";
        data.forEach(game => {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `<h3>${game.title}</h3><button class="play-btn" onclick="playGame('${game.url}')">LAUNCH</button>`;
            grid.appendChild(card);
        });
    }
}

window.sendMessage = async () => {
    const msg = document.getElementById("chatInput").value;
    if (!msg) return;
    await sbClient.from("chat_messages").insert([{ username: currentUser, message: msg }]);
    document.getElementById("chatInput").value = "";
};

window.playGame = (url) => {
    document.getElementById("gameFrame").src = url.replace(/^http:\/\//i, 'https://');
    document.getElementById("playerSection").style.display = "block";
};

window.onload = init;
