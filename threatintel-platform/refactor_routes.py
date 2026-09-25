import os
import re

dashboard_routes_path = "src/darkweb_scanner/dashboard/dashboard_routes.py"
with open(dashboard_routes_path, "r", encoding="utf-8") as f:
    routes_code = f.read()

# Remove proxy routes for threatfox
routes_code = re.sub(r'# ── ThreatFox proxy.*?def proxy_threatfox\(\):.*?return jsonify\(\{.*?\}\), 500', '', routes_code, flags=re.DOTALL)
routes_code = re.sub(r'@dashboard_bp\.route\("/api/proxy/threatfox", methods=\["POST"\]\)\s*def proxy_threatfox\(\):.*?return jsonify\(\{.*?\}\), 500\n', '', routes_code, flags=re.DOTALL)

with open(dashboard_routes_path, "w", encoding="utf-8") as f:
    f.write(routes_code)
