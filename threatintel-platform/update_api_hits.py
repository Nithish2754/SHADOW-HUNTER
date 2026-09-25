import os

routes_path = "src/darkweb_scanner/dashboard/dashboard_routes.py"
with open(routes_path, "r", encoding="utf-8") as f:
    code = f.read()

old_dict = '''                "id": r.id,
                "url": r.url,
                "keyword": r.keyword,
                "category": r.category,
                "context": r.context,
                "found_at": r.found_at.isoformat() if r.found_at else None,'''

new_dict = '''                "id": r.id,
                "url": r.url,
                "keyword": r.keyword,
                "category": r.category,
                "severity": getattr(r, 'severity', 'LOW'),
                "status": getattr(r, 'status', 'NEW'),
                "page_title": getattr(r, 'page_title', ''),
                "verified_by": getattr(r, 'verified_by', ''),
                "notes": getattr(r, 'notes', ''),
                "context": r.context,
                "found_at": r.found_at.isoformat() if r.found_at else None,'''

if old_dict in code:
    code = code.replace(old_dict, new_dict)
    with open(routes_path, "w", encoding="utf-8") as f:
        f.write(code)
    print("Replaced api_hits dictionary successfully.")
else:
    print("Could not find the target dictionary in api_hits.")
