import os
import re

dashboard_routes_path = "src/darkweb_scanner/dashboard/dashboard_routes.py"
with open(dashboard_routes_path, "r", encoding="utf-8") as f:
    routes_code = f.read()

# Remove proxy routes for urlhaus and feodo
routes_code = re.sub(r'# ── URLhaus & Feodo proxies.*?return jsonify\(\{"error": "Feodo Tracker unavailable", "details": str\(e\)\}\), 500', '', routes_code, flags=re.DOTALL)
routes_code = re.sub(r'@dashboard_bp\.route\("/api/proxy/urlhaus", methods=\["POST"\]\).*?def proxy_urlhaus\(\):.*?return jsonify\(\{.*?\}\), 500', '', routes_code, flags=re.DOTALL)
routes_code = re.sub(r'@dashboard_bp\.route\("/api/proxy/feodo"\).*?def proxy_feodo\(\):.*?return jsonify\(\{.*?\}\), 500', '', routes_code, flags=re.DOTALL)

with open(dashboard_routes_path, "w", encoding="utf-8") as f:
    f.write(routes_code)
