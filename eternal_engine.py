import os
from google import genai

# 1. SETUP - Using the modern 2026 Client
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

SYSTEM_RULES = "You are a sci-fi arcade engine. Output ONLY a <div> with neon-blue sci-fi styling. Topic: Countdown to Monday's Data Bridge."

# 2. GENERATE
try:
    response = client.models.generate_content(
        model="gemini-1.5-flash",
        config={'system_instruction': SYSTEM_RULES},
        contents="Status report for May 16, 2026."
    )
    
    # In the new library, the text is accessed directly from response.text
    daily_html = response.text.strip()
    
    # 3. INJECT
    with open("index.html", "r", encoding="utf-8") as f:
        content = f.read()

    if "<!-- EVENT_START -->" in content:
        new_content = content.replace("<!-- EVENT_START -->", f"<!-- EVENT_START -->\n{daily_html}")
        with open("index.html", "w", encoding="utf-8") as f:
            f.write(new_content)
        print("Success: Eternal Engine Active.")
    else:
        print("Error: Anchor tag missing.")

except Exception as e:
    print(f"System Crash: {e}")
    
