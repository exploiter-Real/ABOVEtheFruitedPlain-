/* =============================================================
   ELITETRIO ARCADE — script.js
   Core Engine with 10s CDN Wait Logic
   ============================================================= */

const SB_URL = "https://dleydypvpffeifmdpzqc.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZXlkeXB2cGZmZWlmbWRwenFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTc5ODUsImV4cCI6MjA5MjA5Mzk4NX0.gnI03TZkpBT7r5OIwlTKsd7bwovQYAfwRfykhnq5fjY";

let sbClient = null;
let chatInitialized = false;

async function init() {
    const grid = document.getElementById("gameGrid");
    const statusText = document.getElementById("statusText");
    const dot = document.getElementById("statusDot");

    if (statusText) statusText.innerText = "Connecting to Kernel...";

    // ─── 10 SECOND CDN WAIT LOOP ───
    let attempts = 0;
    const maxAttempts = 10; 

    while (!window.supabase && attempts < maxAttempts) {
        console.log(`Waiting for Supabase... Attempt ${attempts + 1}/${maxAttempts}`);
        await new Promise(res => setTimeout(res, 1000)); // Wait 1 second
        attempts++;
    }

    // ─── CONNECTION LOGIC ───
    if (window.supabase) {
        try {
            sbClient = window.supabase.createClient(SB_URL, SB_KEY);
            
            // Fetch Games
            const { data, error } = await sbClient
                .from("arcade_games")
                .select("*")
                .order("id", { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                grid.innerHTML = "";
                data.forEach((game, i) => {
                    // buildCard is defined in Backup.js
                    grid.appendChild(buildCard(game, i, false));
                });

                if (statusText) statusText.innerText = "LIVE — " + data.length + " Games";
                if (dot) dot.className = "dot"; // Remove gold/red status

                initChat();
                listenForEffects();
            } else {
                throw new Error("No data returned");
            }

        } catch (err) {
            console.error("Supabase Connection Error:", err.message);
            enterBackupMode();
        }
    } else {
        console.error("Supabase CDN failed to load after 10 seconds.");
        enterBackupMode();
    }
}

/* ─── LIVE EFFECTS SUBSCRIPTION ─── */
function listenForEffects() {
    if (!sbClient) return;

    sbClient
        .channel('public:live_effects')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'live_effects' 
        }, payload => {
            const cmd = payload.new.command;
            console.log("Remote Command Received:", cmd);
            applyVisualEffect(cmd);
        })
        .subscribe();
}

function applyVisualEffect(cmd) {
    // Removes all effect classes from body
    document.body.classList.remove("effect-rainbow", "effect-shake", "effect-dark");
    
    if (cmd !== "none") {
        document.body.classList.add("effect-" + cmd);
    }
}

/* ─── CHAT LOGIC ─── */
async function initChat() {
    if (chatInitialized || !sbClient) return;
    chatInitialized = true;

    const chatSection = document.getElementById("chatSection");
    if (chatSection) chatSection.style.display = "block";

    // Load last 50 messages
    const { data } = await sbClient
        .from("chat_messages")
        .select("*")
        .limit(50)
        .order("created_at", { ascending: true });

    if (data) data.forEach(msg => appendMessage(msg));

    // Realtime listener for new messages
    sbClient
        .channel('public:chat_messages')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'chat_messages' 
        }, payload => {
            appendMessage(payload.new);
        })
        .subscribe();
}

function appendMessage(msg) {
    const feed = document.getElementById("chatMessages");
    if (!feed) return;

    const row = document.createElement("div");
    row.className = "chat-row";
    
    // Simple sanitization
    const user = String(msg.username || "Guest").replace(/</g, "&lt;");
    const text = String(msg.message || "").replace(/</g, "&lt;");

    row.innerHTML = `<span class="chat-username">${user}:</span> <span class="chat-msg-text">${text}</span>`;
    feed.appendChild(row);
    feed.scrollTop = feed.scrollHeight;
}

window.sendMessage = async () => {
    const userInput = document.getElementById("chatUsername");
    const msgInput = document.getElementById("chatInput");
    
    const user = userInput.value.trim() || "Guest";
    const msg = msgInput.value.trim();

    if (!msg || !sbClient) return;

    await sbClient.from("chat_messages").insert([
        { username: user, message: msg, channel: "lobby" }
    ]);

    msgInput.value = "";
};

/* ─── UTILITIES ─── */
window.playGame = function(url, title) {
    const frame = document.getElementById("gameFrame");
    const player = document.getElementById("playerSection");
    const pTitle = document.getElementById("playerTitle");

    if (!frame || !player) return;

    frame.src = url.replace(/^http:\/\//i, 'https://');
    if (pTitle) pTitle.innerText = title;
    player.style.display = "block";
    player.scrollIntoView({ behavior: "smooth" });
};

function enterBackupMode() {
    console.warn("System entering Local Backup Mode.");
    if (typeof runBackup === "function") {
        runBackup();
    }
}

window.onload = init;
