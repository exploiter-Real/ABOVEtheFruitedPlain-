// --- CONFIGURATION ---
const SB_URL = "https://dleydypvpffeifmdpzqc.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZXlkeXB2cGZmZWlmbWRwenFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTc5ODUsImV4cCI6MjA5MjA5Mzk4NX0.gnI03TZkpBT7r5OIwlTKsd7bwovQYAfwRfykhnq5fjY";

let sbClient = null;

// --- ROADMAP DATA ---
const Roadmap = {
    dates: {
        bridge: "2026-05-18",
        faceAI: "2026-06-01",
        ghost:  "2026-07-01",
        phoenix: "2026-07-20",
        birthday: { m: 7, d: 22 }, // August 22nd
        gamble: "2027-08-24"
    }
};

// --- CORE INITIALIZATION ---
async function init() {
    if (!window.supabase) return;
    sbClient = window.supabase.createClient(SB_URL, SB_KEY);
    
    // Automation Check
    runRoadmapCheck();
    
    loadGames();
    initChat();
    listenForEffects();
}

// --- ROADMAP & AUTOMATION LOGIC ---
function runRoadmapCheck() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // May 18: Bridge Activation
    if (today >= Roadmap.dates.bridge) {
        document.getElementById("statusText").innerText = "LINK ESTABLISHED";
    } else {
        document.getElementById("statusText").innerText = "LINKING TO DATABASE...";
    }

    // July 1: Ghost Protocol (Teaser AI)
    if (today >= Roadmap.dates.ghost && today < Roadmap.dates.phoenix) {
        startGhostProtocol();
    }

    // July 20: Project Phoenix Rework
    if (today >= Roadmap.dates.phoenix) {
        document.body.classList.add('phoenix-mode');
    }

    // August 22: Birthday Event
    if (now.getMonth() === Roadmap.dates.birthday.m && now.getDate() === Roadmap.dates.birthday.d) {
        const header = document.querySelector('header h1');
        if (header) header.innerText = "🎂 ABOVEtheFruitedPlain- 🎂";
    }
}

function startGhostProtocol() {
    setInterval(() => {
        if (Math.random() < 0.1) { // 10% chance every 45s
            const ghostData = {
                id: 'ghost-' + Date.now(),
                username: "???",
                message: "The Bridge is thinning...",
                isGhost: true
            };
            appendMessage(ghostData);
            sessionStorage.setItem('ghostActive', 'true');
        }
    }, 45000);
}

// --- CHAT SYSTEM ---
async function initChat() {
    const userID = document.getElementById("chatUsername").value;
    let query = sbClient.from("chat_messages").select("*");
    
    if (userID !== "EliteTrio") {
        query = query.eq("channel", "general");
    }

    const { data } = await query.order("created_at", { ascending: true }).limit(50);
    if (data) data.forEach(msg => appendMessage(msg));

    sbClient.channel('chat-room').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, payload => {
        if (payload.eventType === 'INSERT') {
            if (payload.new.channel === "general" || document.getElementById("chatUsername").value === "EliteTrio") {
                appendMessage(payload.new);
            }
        }
        if (payload.eventType === 'DELETE') {
            const el = document.getElementById(`msg-${payload.old.id || payload.old.msg_id}`);
            if (el) el.remove();
        }
    }).subscribe();
}

function appendMessage(msg) {
    const feed = document.getElementById("chatMessages");
    if (!feed) return;

    const row = document.createElement("div");
    row.className = msg.isGhost ? "chat-row ghost-msg" : "chat-row";
    row.id = `msg-${msg.id || msg.msg_id}`;

    let pressTimer;
    row.addEventListener('touchstart', () => {
        if(document.getElementById("chatUsername").value === "EliteTrio" && !msg.isGhost) {
            pressTimer = setTimeout(() => deleteMessage(msg), 800);
        }
    });
    row.addEventListener('touchend', () => clearTimeout(pressTimer));

    row.innerHTML = `
        <span class="chat-username">${msg.username}:</span>
        <span class="chat-text">${msg.message}</span>
    `;

    feed.appendChild(row);
    feed.scrollTop = feed.scrollHeight;
}

async function deleteMessage(msg) {
    const confirmDelete = confirm("Purge this message from the stream?");
    if (confirmDelete) {
        const targetId = msg.id || msg.msg_id;
        const targetColumn = msg.id ? "id" : "msg_id";
        await sbClient.from("chat_messages").delete().eq(targetColumn, targetId);
    }
}

window.sendMessage = async () => {
    const userBox = document.getElementById("chatUsername");
    const msgBox = document.getElementById("chatInput");
    const user = userBox.value || "Guest";
    const msg = msgBox.value;

    if (!msg.trim()) return;

    // Logic to clear ghost messages if user types '?'
    if (msg.includes('?') && sessionStorage.getItem('ghostActive')) {
        const ghosts = document.querySelectorAll('.ghost-msg');
        ghosts.forEach(g => g.remove());
        sessionStorage.removeItem('ghostActive');
    }

    let chan = "general";
    if (user === "EliteTrio" && msg.startsWith("/a ")) {
        chan = "admin";
    }

    await sbClient.from("chat_messages").insert([{ 
        username: user, 
        message: msg.replace("/a ", ""), 
        channel: chan 
    }]);
    
    msgBox.value = "";
};

// --- GAME SYSTEM ---
async function loadGames() {
    const { data } = await sbClient.from("arcade_games").select("*");
    const grid = document.getElementById("gameGrid");
    if (data) {
        grid.innerHTML = "";
        data.forEach(game => {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <h3>${game.title}</h3>
                <button onclick="playGame('${game.url}')">INITIATE</button>
            `;
            grid.appendChild(card);
        });
    }
}

function playGame(url) {
    const today = new Date().toISOString().split('T')[0];

    // August 24, 2027: Rickroll Gamble (3% chance)
    if (today >= Roadmap.dates.gamble && Math.random() < 0.03) {
        const stealth = document.getElementById("stealthPlayer");
        stealth.src = "rickroll.mp4";
        stealth.style.display = "block";
        stealth.play();
        if (stealth.requestFullscreen) stealth.requestFullscreen();
        return;
    }

    const player = document.getElementById("playerSection");
    document.getElementById("gameFrame").src = url;
    player.style.display = "block";
}

// --- LIVE EFFECTS ---
function listenForEffects() {
    sbClient.channel('fx').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_effects' }, p => {
        document.body.className = "effect-" + p.new.command;
    }).subscribe();
}

window.onload = init;
        
