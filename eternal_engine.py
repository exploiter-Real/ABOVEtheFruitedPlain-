import os
import google.generativeai as genai

# 1. Setup the AI
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel('gemini-1.5-flash')

# 2. Ask for a Daily Event
prompt = "I have an arcade site. Generate a small HTML snippet for a 'Daily Event' banner. " \
         "Today is May 16, 2026. Make it neon-blue and sci-fi themed. " \
         "Only return the <div> code, nothing else."

response = model.generate_content(prompt)
daily_html = response.text

# 3. Update your website file
with open("index.html", "r") as f:
    content = f.read()

# Replace a placeholder in your HTML with the new event
# (Make sure you have <!-- EVENT_START --> in your index.html)
new_content = content.replace("<!-- EVENT_START -->", f"<!-- EVENT_START -->\n{daily_html}")

with open("index.html", "w") as f:
    f.write(new_content)
  
