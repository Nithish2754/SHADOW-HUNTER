import re
import os

def remove_from_file(filepath, patterns):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    for p in patterns:
        content = re.sub(p, "", content, flags=re.DOTALL)
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

# 1. Update index.html
index_path = "src/darkweb_scanner/dashboard/templates/index.html"
with open(index_path, "r", encoding="utf-8") as f:
    html = f.read()

# Remove Ransomware tab
html = re.sub(r'<button class="nav-tab" onclick="switchTab\(\'ransomware\'[^>]*>.*?Ransomware</button>', '', html, flags=re.DOTALL)
# Remove Ransomware Panel
html = re.sub(r'<!-- ── Ransomware Tracker Tab ── -->.*?<div class="tab-panel" id="panel-investigations">', '<!-- ── Investigations Tab ── -->\n  <div class="tab-panel" id="panel-investigations">', html, flags=re.DOTALL)
# Remove RW GROUPS kpi
html = re.sub(r'<div class="hd-kpi"><div class="hd-kpi-val" style="color:var\(--red\)" id="hdKpiGroups">-</div><div class="hd-kpi-lbl">RW Groups</div></div>', '', html)
# Remove Recent Victims card
html = re.sub(r'<div class="hd-card" id="hdVictimsCard">.*?<!-- /hd-card -->', '<!-- removed victims card -->', html, flags=re.DOTALL)
# Remove Quick Action for Ransomware
html = re.sub(r'<button class="hd-qa-btn" onclick="hdGoTo\(\'ransomware\'\)">.*?<span class="hd-qa-label">Ransomware</span>.*?</button>', '', html, flags=re.DOTALL)
# Remove Ransomware Press section
html = re.sub(r'<div class="hd-card" style="grid-column: 1 / -1">.*?Ransomware Press - SEA Focus.*?</div>\s*</div>', '', html, flags=re.DOTALL)
# Remove system status for rwlive
html = re.sub(r'<div class="hd-sys-row"><span>ransomware.live PRO.*?</div>', '', html, flags=re.DOTALL)

with open(index_path, "w", encoding="utf-8") as f:
    f.write(html)


# 2. Update dashboard_routes.py
dashboard_routes = "src/darkweb_scanner/dashboard/dashboard_routes.py"
patterns = [
    r'# ── Ransomware Tracker API ──.*?return jsonify\(\{"ok": True, "added": added\}\)',
    r'"ransomware",\s*'
]
remove_from_file(dashboard_routes, patterns)


# 3. Update app.py
app_path = "src/darkweb_scanner/dashboard/app.py"
app_patterns = [
    r'from \.ransomware_live_routes import rw_live_bp\s*',
    r'app\.register_blueprint\(rw_live_bp\)\s*'
]
remove_from_file(app_path, app_patterns)

# 4. Delete python modules
files_to_delete = [
    "src/darkweb_scanner/ransomware_data.py",
    "src/darkweb_scanner/ransomware_live.py",
    "src/darkweb_scanner/dashboard/ransomware_live_routes.py"
]
for f in files_to_delete:
    if os.path.exists(f):
        os.remove(f)

