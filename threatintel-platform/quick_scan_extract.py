# ΓöÇΓöÇ Quick Scan ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ


def _iso(dt):
    return dt.isoformat() if dt else None


def _quick_scan_session_dict(sess) -> dict:
    return {
        "id": sess.id,
        "target_value": sess.target_value,
        "target_type": sess.target_type,
        "normalized_variants": json.loads(sess.normalized_variants or "[]"),
        "sources_used": json.loads(sess.sources_used or "[]"),
        "status": sess.status,
        "started_at": _iso(sess.started_at),
        "completed_at": _iso(sess.completed_at),
        "urls_visited": sess.urls_visited,
        "findings_count": sess.findings_count,
        "error_message": sess.error_message,
    }


@dashboard_bp.route("/quick-scan")
@require_login
def quick_scan_page():
    from ..quick_scan_sources import ALL_SOURCES

    sources = [
        {"name": s.name, "label": s.label, "kind": s.kind,
         "transport": s.transport, "enabled": s.enabled}
        for s in ALL_SOURCES
    ]
    return render_template(
        "quick_scan.html",
        username=session.get("username"),
        sources=sources,
    )


@dashboard_bp.route("/api/quick-scan/start", methods=["POST"])
@require_login
def api_quick_scan_start():
    import asyncio
    import threading

    from ..quick_scan import (
        VALID_TARGET_TYPES,
        detect_target_type,
        normalize_variants,
        run_quick_scan,
    )
    from ..quick_scan_sources import resolve_sources
    from ..tor_client import create_tor_client

    storage = get_storage()
    user_id = session["user_id"]

    body = request.get_json(silent=True) or {}
    target = (body.get("target") or "").strip()
    if not target:
        return jsonify({"error": "target is required"}), 400

    target_type = body.get("target_type")
    if target_type in (None, "", "auto"):
        target_type = detect_target_type(target)
    elif target_type not in VALID_TARGET_TYPES:
        return jsonify({"error": f"invalid target_type {target_type!r}"}), 400

    variants = normalize_variants(target, target_type)

    requested_sources = body.get("sources")
    sources = resolve_sources(requested_sources)
    if not sources:
        return jsonify({"error": "no enabled sources selected"}), 400
    source_names = [s.name for s in sources]

    # Single active quick scan per user (DB-backed so it holds across workers).
    if storage.has_active_quick_scan(user_id):
        return jsonify({"error": "A quick scan is already running"}), 409

    session_id = storage.create_quick_scan_session(
        user_id=user_id,
        target_value=target,
        target_type=target_type,
        normalized_variants=variants,
        sources_used=source_names,
    )

    def run():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        tor_client = create_tor_client()
        try:
            loop.run_until_complete(run_quick_scan(session_id, storage, tor_client))
        except Exception as exc:  # noqa: BLE001
            logger.exception("Quick scan thread crashed for session %s", session_id)
            try:
                storage.update_quick_scan_session(
                    session_id,
                    status="failed",
                    error_message=f"Scan crashed: {type(exc).__name__}",
                )
            except Exception:
                pass
        finally:
            try:
                loop.run_until_complete(tor_client.close())
            except Exception:
                pass
            loop.close()

    threading.Thread(target=run, daemon=True, name="quick_scan_thread").start()

    return jsonify({"session_id": session_id}), 201


@dashboard_bp.route("/api/quick-scan/status/<int:session_id>")
@require_login
def api_quick_scan_status(session_id):
    storage = get_storage()
    sess = storage.get_quick_scan_session(session_id)
    if sess is None:
        return jsonify({"error": "not found"}), 404
    if sess.user_id != session["user_id"]:
        return jsonify({"error": "forbidden"}), 403
    return jsonify({
        "status": sess.status,
        "started_at": _iso(sess.started_at),
        "completed_at": _iso(sess.completed_at),
        "urls_visited": sess.urls_visited,
        "findings_count": sess.findings_count,
        "error_message": sess.error_message,
    })


@dashboard_bp.route("/api/quick-scan/cancel/<int:session_id>", methods=["POST"])
@require_login
def api_quick_scan_cancel(session_id):
    storage = get_storage()
    sess = storage.get_quick_scan_session(session_id)
    if sess is None:
        return jsonify({"error": "not found"}), 404
    if sess.user_id != session["user_id"]:
        return jsonify({"error": "forbidden"}), 403
    if sess.status not in ("pending", "running"):
        return jsonify({"error": f"cannot cancel a scan in status {sess.status!r}"}), 400
    storage.update_quick_scan_session(
        session_id,
        status="cancelled",
        completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    logger.info("Quick scan %s cancelled by user %s", session_id, session["user_id"])
    return jsonify(_quick_scan_session_dict(storage.get_quick_scan_session(session_id)))


@dashboard_bp.route("/api/quick-scan/sessions")
@require_login
def api_quick_scan_sessions():
    storage = get_storage()
    sessions = storage.list_quick_scan_sessions(session["user_id"], limit=50)
    return jsonify([_quick_scan_session_dict(s) for s in sessions])


@dashboard_bp.route("/api/quick-scan/findings/<int:session_id>")
@require_login
def api_quick_scan_findings(session_id):
    storage = get_storage()
    sess = storage.get_quick_scan_session(session_id)
    if sess is None:
        return jsonify({"error": "not found"}), 404
    if sess.user_id != session["user_id"]:
        return jsonify({"error": "forbidden"}), 403
    high_signal_only = request.args.get("high_signal_only") == "1"
    findings = storage.list_quick_scan_findings(session_id, high_signal_only=high_signal_only)
    return jsonify([
        {
            "id": f.id,
            "source_name": f.source_name,
            "url": f.url,
            "matched_variant": f.matched_variant,
            "context": f.context,
            "high_signal": f.high_signal,
            "found_at": _iso(f.found_at),
        }
        for f in findings
    ])


# ΓöÇΓöÇ Health ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ


@dashboard_bp.route("/api/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat()})
