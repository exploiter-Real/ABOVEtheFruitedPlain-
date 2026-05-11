const SB_URL = "https://dleydypvpffeifmdpzqc.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZXlkeXB2cGZmZWlmbWRwenFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTc5ODUsImV4cCI6MjA5MjA5Mzk4NX0.gnI03TZkpBT7r5OIwlTKsd7bwovQYAfwRfykhnq5fjY";

let sbClient = null;

async function init() {
    if (!window.supabase) return;
    sbClient = window.supabase.createClient(SB_URL, SB_KEY);
    
    document.getElementById("statusText").innerText = "LINK ESTABLISHED";
    
    loadGames();
    initChat();
    listenForEffects();
}

async function initChat() {
    const userID = document.getElementById("chatUsername").value;
    
    // Initial load
    let query = sbClient.from("chat_messages").select("*");
    
    // Simple logic: non-admins only see general channel
    if (userID !== "EliteTrio") {
        query = query.eq("channel", "general");
    }

    const { data } = await query.order("created_at", { ascending: true }).limit(50);
    if (data) data.forEach(msg => appendMessage(msg));

    // Realtime Listener
    sbClient.channel('chat-room').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, payload => {
        if (payload.eventType === 'INSERT') {
            // Only append if it's general OR if we are admin
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
    row.className = "chat-row";
    row.id = `msg-${msg.id || msg.msg_id}`;

    // Admin Long-Press Deletion
    let pressTimer;
    row.addEventListener('touchstart', () => {
        if(document.getElementById("chatUsername").value === "EliteTrio") {
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
        // Targets 'id' or 'msg_id' depending on which one you have in DB
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
    const player = document.getElementById("playerSection");
    document.getElementById("gameFrame").src = url;
    player.style.display = "block";
}

function listenForEffects() {
    sbClient.channel('fx').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_effects' }, p => {
        document.body.className = "effect-" + p.new.command;
    }).subscribe();
}

window.onload = init;
