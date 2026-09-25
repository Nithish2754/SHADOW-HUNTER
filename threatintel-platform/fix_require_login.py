import os

routes_path = "src/darkweb_scanner/dashboard/dashboard_routes.py"
with open(routes_path, "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace("@login_required\ndef update_hit", "@require_login\ndef update_hit")

with open(routes_path, "w", encoding="utf-8") as f:
    f.write(code)
