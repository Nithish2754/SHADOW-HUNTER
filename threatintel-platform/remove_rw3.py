import re

filepath = "src/darkweb_scanner/dashboard/templates/index.html"
with open(filepath, "r", encoding="utf-8") as f:
    html = f.read()

# Delete Recent Victims card
html = re.sub(r'<div class="hd-card hd-grid-wide">\s*<div class="hd-card-hdr">\s*<div class="hd-card-title">.*?Recent Victims.*?</div>\s*<button class="hd-card-action" onclick="hdLoadVictims\(\)">.*?</div>\s*<div class="hd-card-body" id="hdVictimFeed">.*?</div>\s*</div>', '', html, flags=re.DOTALL)

# Delete Top Active Groups card
html = re.sub(r'<div class="hd-card">\s*<div class="hd-card-hdr">\s*<div class="hd-card-title">.*?Top Active Groups.*?</div>\s*<button class="hd-card-action" onclick="hdGoTo\(\'ransomware\'\)">.*?</div>\s*<div class="hd-card-body" id="hdGroupFeed">.*?</div>\s*</div>', '', html, flags=re.DOTALL)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(html)
