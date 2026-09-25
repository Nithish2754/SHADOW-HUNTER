import re
import os

with open("src/darkweb_scanner/dashboard/templates/index.html", "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    # Remove Nav Tab
    if "switchTab('ransomware'" in line:
        continue
    # Remove RW GROUPS kpi
    if 'id="hdKpiGroups"' in line:
        continue
    # Remove Recent Victims card
    if 'id="hdVictimsCard"' in line:
        skip = True
    if skip and '<!-- /hd-card -->' in line:
        skip = False
        continue
    if skip:
        continue
        
    # Remove SEA Breakdown card
    if 'SEA Victim Breakdown' in line:
        skip = True
    if skip and '</div>' in line and i > 0 and 'SEA Victim Breakdown' not in lines[i-1] and 'SEA Victim Breakdown' not in line:
        # Wait, skipping by div is dangerous. Let's not do that naively.
        pass

    # Actually, it's safer to just replace known strings.
    new_lines.append(line)

html = "".join(new_lines)

html = re.sub(r'<div class="hd-card" id="hdVictimsCard">.*?<!-- /hd-card -->', '', html, flags=re.DOTALL)
html = re.sub(r'<div class="hd-card"[^>]*>\s*<div class="hd-card-title">.*?SEA Victim Breakdown.*?</div>\s*</div>', '', html, flags=re.DOTALL)
html = re.sub(r'<div class="hd-card" style="grid-column: 1 / -1">\s*<div class="hd-card-title">.*?Ransomware Press - SEA Focus.*?</div>\s*</div>', '', html, flags=re.DOTALL)
html = re.sub(r'<button class="hd-qa-btn" onclick="hdGoTo\(\'ransomware\'\)">.*?</button>', '', html, flags=re.DOTALL)
html = re.sub(r'<div class="hd-sys-row"><span>ransomware\.live PRO</span>.*?</div>', '', html, flags=re.DOTALL)
html = re.sub(r'<!-- ── Ransomware Tracker Tab ── -->.*?<div class="tab-panel" id="panel-investigations">', '<!-- ── Investigations Tab ── -->\n  <div class="tab-panel" id="panel-investigations">', html, flags=re.DOTALL)
html = re.sub(r'// ── Ransomware Tracker ──.*?// ── Investigations ──', '// ── Investigations ──', html, flags=re.DOTALL)
html = re.sub(r'if \(tab === \'ransomware\'\) loadRansomware\(\);', '', html)

with open("src/darkweb_scanner/dashboard/templates/index.html", "w", encoding="utf-8") as f:
    f.write(html)


# Update dashboard_routes.py
with open("src/darkweb_scanner/dashboard/dashboard_routes.py", "r", encoding="utf-8") as f:
    dhtml = f.read()

dhtml = re.sub(r'# ── Ransomware Tracker API ──.*?@dashboard_bp\.route\("/api/threat-actors"', '@dashboard_bp.route("/api/threat-actors"', dhtml, flags=re.DOTALL)
dhtml = re.sub(r'# ── Ransomware Tracker API ──.*?(# ── Threat Actors API ──|# ── Investigations API ──|# ── Users API ──)', r'\1', dhtml, flags=re.DOTALL)

with open("src/darkweb_scanner/dashboard/dashboard_routes.py", "w", encoding="utf-8") as f:
    f.write(dhtml)
