import os

def append_routes():
    routes_path = "src/darkweb_scanner/dashboard/dashboard_routes.py"
    with open(routes_path, "a", encoding="utf-8") as f:
        f.write("""
@dashboard_bp.route("/api/hits/<int:hit_id>", methods=["POST"])
@login_required
def update_hit(hit_id):
    storage = get_storage()
    data = request.json or {}
    with storage.get_session() as session:
        from src.darkweb_scanner.storage import KeywordHitRecord
        record = session.get(KeywordHitRecord, hit_id)
        if not record:
            return jsonify({"error": "not found"}), 404
        if "status" in data:
            record.status = data["status"]
        if "severity" in data:
            record.severity = data["severity"]
        if "notes" in data:
            record.notes = data["notes"]
        session.commit()
        return jsonify({"success": True})
""")

if __name__ == "__main__":
    append_routes()
