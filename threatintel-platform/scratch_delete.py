import re

def process_file(filepath, patterns_to_remove):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    for pattern in patterns_to_remove:
        content = re.sub(pattern, "", content, flags=re.DOTALL)
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

# For dashboard_routes.py
dashboard_patterns = [
    r'@dashboard_bp\.route\("/api/threat-actors".*?return jsonify\(\{"ok": True, "added": added\}\)\n',
    r'# ── Projects API ──.*',
]

process_file("src/darkweb_scanner/dashboard/dashboard_routes.py", dashboard_patterns)

# For storage.py
storage_patterns = [
    r'# ── Projects Models ──.*?# ── API Keys ──',
    r'    # ── Projects ──.*?    # ── Settings ──',
    r'    # ── Paste Monitor ──.*?    # ── Webhook ──'
]

with open("src/darkweb_scanner/storage.py", "r", encoding="utf-8") as f:
    s_content = f.read()

s_content = re.sub(r'# ── Projects Models ──.*?# ── Paste Monitor Models ──.*?# ── API Keys ──', '# ── API Keys ──', s_content, flags=re.DOTALL)
s_content = re.sub(r'    # ── Projects ──.*?    # ── Paste Monitor ──.*?    # ── Settings ──', '    # ── Settings ──', s_content, flags=re.DOTALL)

with open("src/darkweb_scanner/storage.py", "w", encoding="utf-8") as f:
    f.write(s_content)
