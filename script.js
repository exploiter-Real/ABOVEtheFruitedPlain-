const SB_URL = "https://dleydypvpffeifmdpzqc.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZXlkeXB2cGZmZWlmbWRwenFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTc5ODUsImV4cCI6MjA5MjA5Mzk4NX0.gnI03TZkpBT7r5OIwlTKsd7bwovQYAfwRfykhnq5fjY";

let sbClient = null;
let chatInitialized = false;

async function init() {
    const grid = document.getElementById("gameGrid");
    const statusText = document.getElementById("statusText");

    // 10 Second Wait for Supabase CDN
    let attempts = 0;
    while (!window.supabase && attempts < 10) {
        await new Promise(res => setTimeout(res, 1000));
        attempts++;
    }

    if (window.supabase) {
        try {
            sbClient = window.supabase.createClient(SB_URL, SB_KEY);
            
            const { data, error } = await sbClient
                .from("arcade_games")
                .select("*")
                .order("id", { ascending: true });

            if (error) throw error;

            grid.innerHTML = "";
            data.forEach((game, i) => {
                // Uses buildCard from Backup.js
                grid.appendChild(buildCard(game, i, false));
            });

            if (statusText) statusText.innerText = "CONNECTED: " + data.length + " NODES";
            
            initChat();
            listenForEffects(); 

        } catch (err) {
            console.error("Kernel Link Failed:", err.message);
            enterBackupMode();
        }
    } else {
        enterBackupMode();
    }
}

function listenForEffects() {
    if (!sbClient) return;

    // Brute-force Realtime listener for the effects table
    sbClient
        .channel('effect-stream')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'live_effects' 
        }, payload => {
            console.log("Effect Sync:", payload.new.command);
            applyVisualEffect(payload.new.command);
        })
        .subscribe();
}

function applyVisualEffect(cmd) {
    // Force reset of classes on body
    document.body.classList.remove("effect-rainbow", "effect-shake", "effect-dark");
    if (cmd && cmd !== "none") {
        document.body.classList.add("effect-" + cmd);
    }
}

async function initChat() {
    if (chatInitialized || !sbClient) return;
    chatInitialized = true;

    // Load initial messages
    const { data } = await sbClient.from("chat_messages").select("*").limit(50).order("created_at");
    if (data) data.forEach(msg => appendMessage(msg));

    // Realtime chat sync
    sbClient.channel('chat-stream').on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages' 
    }, payload => {
        appendMessage(payload.new);
    }).subscribe();
}

function appendMessage(msg) {
    const feed = document.getElementById("chatMessages");
    if (!feed) return;
    const row = document.createElement("div");
    row.className = "chat-row";
    const user = String(msg.username || "Guest").replace(/</g, "&lt;");
    const text = String(msg.message || "").replace(/</g, "&lt;");
    row.innerHTML = `<span class="chat-username">${user}:</span> <span>${text}</span>`;
    feed.appendChild(row);
    feed.scrollTop = feed.scrollHeight;
}

window.sendMessage = async () => {
    const user = document.getElementById("chatUsername").value || "Guest";
    const msg = document.getElementById("chatInput").value;
    if (!msg || !sbClient) return;
    await sbClient.from("chat_messages").insert([{ username: user, message: msg, channel: "lobby" }]);
    document.getElementById("chatInput").value = "";
};

window.playGame = function(url, title) {
    const frame = document.getElementById("gameFrame");
    const player = document.getElementById("playerSection");
    if (!frame || !player) return;
    frame.src = url.replace(/^http:\/\//i, 'https://');
    player.style.display = "block";
    player.scrollIntoView({ behavior: "smooth" });
};

function enterBackupMode() {
    if (typeof runBackup === "function") runBackup();
}

window.onload = init;
