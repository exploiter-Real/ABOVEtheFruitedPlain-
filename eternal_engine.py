import os
import google.generativeai as genai

# 1. AUTHENTICATION
# Pulls the key you saved in GitHub Secrets
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# 2. SYSTEM INSTRUCTIONS (The "Brain" Rules)
# This ensures the AI only speaks in code and stays in the sci-fi vibe.
SYSTEM_RULES = (
    "You are the ABOVEtheFruitedPlain- Core Engine. "
    "Rules: "
    "1. ONLY output raw HTML <div> snippets. "
    "2. NEVER include conversational text, greetings, or backticks (```). "
    "3. Aesthetic: Deep-blue sci-fi, neon-blue accents, Orbitron font style. "
    "4. Context: Today is May 16, 2026. The 'Data Bridge' backend migration is Monday, May 18. "
    "5. Use punchy, 'system-access' style language (e.g., 'NODE ACTIVE', 'LINK STABILIZED')."
)

# 3. INITIALIZE MODEL
model = genai.GenerativeModel(
    model_name='gemini-1.5-flash',
    system_instruction=SYSTEM_RULES
)

# 4. GENERATE CONTENT
# We ask for a "Daily Pulse" banner
prompt = "Generate a short daily status banner for the arcade. Mention the countdown to Monday's Data Bridge."
response = model.generate_content(prompt)
daily_html = response.text.strip()

# 5. UPDATE INDEX.HTML
# This part opens your site, finds your anchor tag, and injects the AI code.
FILE_NAME = "index.html"
ANCHOR_TAG = "<!-- EVENT_START -->"

try:
    with open(FILE_NAME, "r", encoding="utf-8") as f:
        content = f.read()

    # Check if the anchor exists to avoid breaking the file
    if ANCHOR_TAG in content:
        # We replace the anchor with the anchor + the new HTML
        # This keeps the anchor there for tomorrow's update too!
        new_content = content.replace(ANCHOR_TAG, f"{ANCHOR_TAG}\n{daily_html}")
        
        with open(FILE_NAME, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("Successfully injected Daily Pulse.")
    else:
        print("Error: Could not find <!-- EVENT_START --> in index.html")

except Exception as e:
    print(f"An error occurred: {e}")
         
