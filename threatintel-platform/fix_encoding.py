import re

file_path = "src/darkweb_scanner/dashboard/dashboard_routes.py"
with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

text = re.sub(r'\.read_text\(\)', '.read_text(encoding="utf-8")', text)
text = re.sub(r'\.write_text\((.*?)\)', r'.write_text(\1, encoding="utf-8")', text)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)
