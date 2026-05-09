/* =============================================================
   ELITETRIO ARCADE — script.js (Patched)
   ============================================================= */

const SB_URL = "https://dleydypvpffeifmdpzqc.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZXlkeXB2cGZmZWlmbWRwenFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTc5ODUsImV4cCI6MjA5MjA5Mzk4NX0.gnI03TZkpBT7r5OIwlTKsd7bwovQYAfwRfykhnq5fjY";

let sbClient = null;
let chatInitialized = false;

async function init() {
    const grid = document.getElementById("gameGrid");
    if (!grid) return;
    try {
        if (!window.supabase) throw new Error("Supabase Load Error");
        sbClient = window.supabase.createClient(SB_URL, SB_KEY);
        
        const { data, error } = await sbClient.from("arcade_games").select("*").order("id");
        if (error || !data || data.length === 0) throw new Error("DB Query Failed");
        
        grid.innerHTML = "";
        data.forEach((g, i) => grid.appendChild(buildCard(g, i, false)));
        
        renderRecentlyPlayed();
        attachSearchListener();
        initChat();
        setStatus("LIVE: " + data.length + " Games", true);
    } catch (e) {
        console.error("Kernel Error: ", e.message);
        enterBackupMode();
    }
}

window.playGame = function(url, title) {
    const frame = document.getElementById("gameFrame");
    const sec = document.getElementById("playerSection");
    if (!frame || !sec) return;
    
    const secureUrl = url.replace(/^http:\/\//i, 'https://');
    frame.src = secureUrl;
    sec.style.display = "block";
    sec.scrollIntoView({ behavior: "smooth" });
    
    addToRecent({ url: secureUrl, title });
};

async function initChat() {
    if (chatInitialized || !sbClient) return;
    chatInitialized = true;
    
    document.getElementById("chatSection").style.display = "block";
    const { data } = await sbClient.from("chat_messages").select("*").limit(50).order("created_at");
    data?.forEach(m => appendMessage(m));
    
    sbClient.channel("lobby").on("postgres_changes", { 
        event: "INSERT", 
        schema: "public", 
        table: "chat_messages" 
    }, p => appendMessage(p.new)).subscribe();
}

function appendMessage(msg) {
    const feed = document.getElementById("chatMessages");
    if (!feed) return;
    const row = document.createElement("div");
    row.className = "chat-row";
    const safeUser = msg.username.replace(/</g, "&lt;");
    const safeMsg = msg.message.replace(/</g, "&lt;");
    row.innerHTML = `<span class="chat-username">${safeUser}:</span> <span class="chat-msg-text">${safeMsg}</span>`;
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

window.chatKeyHandler = (e) => { if (e.key === "Enter") window.sendMessage(); };

function setStatus(t, live) {
    document.getElementById("statusText").textContent = t;
    if (live) document.getElementById("statusDot").className = "dot";
}

function enterBackupMode() { 
    runBackup(); 
    document.getElementById("retryBtn").style.display = "inline-flex";
}

window.retryConnection = () => location.reload();
window.closePlayer = () => {
    document.getElementById("gameFrame").src = "";
    document.getElementById("playerSection").style.display = "none";
};

window.onload = init;
           
