"""
Real-time Alerting Module for Shadow Hunter.
Handles Email (SMTP) and Webhook notifications triggered by findings,
severity threshold filtering, deduplication, SSRF protection, and alert persistence.
"""

import html
import json
import logging
import os
import re
import smtplib
import socket
import urllib.parse
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

SEVERITY_RANKS = {
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 3,
    "CRITICAL": 4,
}


def _is_private_ip(ip_str: str) -> bool:
    """Check if IP address is private/local/reserved."""
    try:
        import ipaddress
        ip = ipaddress.ip_address(ip_str)
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast
    except ValueError:
        return False


def validate_webhook_url(url: str) -> Tuple[bool, Optional[str]]:
    """Validate webhook URL and prevent SSRF attacks."""
    url = (url or "").strip()
    if not url:
        return False, "Webhook URL cannot be empty."
    
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False, f"Invalid scheme '{parsed.scheme}'. Only http and https allowed."

    hostname = parsed.hostname
    if not hostname:
        return False, "Invalid URL hostname."

    if hostname.lower() in ("localhost", "127.0.0.1", "::1") or hostname.lower().endswith(".localhost"):
        return False, "Localhost target URLs are restricted."

    try:
        # Resolve IP to verify non-private destination
        ip_list = socket.gethostbyname_ex(hostname)[2]
        for ip in ip_list:
            if _is_private_ip(ip):
                return False, f"Webhook destination {hostname} resolves to private IP {ip}."
    except Exception as e:
        logger.debug(f"Hostname resolution check failed for {hostname}: {e}")

    return True, None


class Alerter:
    """Alert Manager handling configuration, delivery, deduplication, and persistence."""

    def __init__(self, storage=None):
        self.storage = storage

    def get_storage(self):
        if self.storage:
            return self.storage
        try:
            from .storage import Storage
            return Storage()
        except Exception:
            return None

    def get_config(self) -> Dict[str, Any]:
        storage = self.get_storage()
        if storage:
            cfg = storage.get_alert_config()
        else:
            cfg = {
                "email_enabled": bool(os.getenv("ALERT_EMAIL")),
                "email_recipient": os.getenv("ALERT_EMAIL", ""),
                "webhook_enabled": bool(os.getenv("WEBHOOK_URL")),
                "webhook_url": os.getenv("WEBHOOK_URL", ""),
                "min_severity": os.getenv("ALERT_MIN_SEVERITY", "HIGH"),
            }
        return cfg

    def get_smtp_config(self) -> Dict[str, Any]:
        return {
            "host": os.getenv("SMTP_HOST", ""),
            "port": int(os.getenv("SMTP_PORT", "587")),
            "username": os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER", ""),
            "password": os.getenv("SMTP_PASSWORD", ""),
        }

    def is_severity_allowed(self, finding_severity: str, min_severity: str) -> bool:
        find_rank = SEVERITY_RANKS.get((finding_severity or "LOW").upper(), 1)
        thresh_rank = SEVERITY_RANKS.get((min_severity or "HIGH").upper(), 3)
        return find_rank >= thresh_rank

    def send_email_notification(self, recipient: str, subject: str, body_text: str, body_html: str) -> Tuple[bool, Optional[str]]:
        smtp_cfg = self.get_smtp_config()
        if not smtp_cfg["host"] or not smtp_cfg["username"]:
            return False, "SMTP server not configured (SMTP_HOST or SMTP_USERNAME missing)."

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_cfg["username"]
            msg["To"] = recipient

            msg.attach(MIMEText(body_text, "plain"))
            msg.attach(MIMEText(body_html, "html"))

            with smtplib.SMTP(smtp_cfg["host"], smtp_cfg["port"], timeout=10) as server:
                server.starttls()
                server.login(smtp_cfg["username"], smtp_cfg["password"])
                server.send_message(msg)

            return True, None
        except Exception as e:
            err_msg = f"Unable to send email alert. Check SMTP configuration: {e}"
            logger.error(err_msg)
            return False, err_msg

    def send_webhook_notification(self, webhook_url: str, payload: dict) -> Tuple[bool, Optional[str]]:
        valid, err = validate_webhook_url(webhook_url)
        if not valid:
            return False, err

        try:
            from darkweb_scanner.dashboard.http_client import safe_fetch, SafeFetchError
            body_bytes = json.dumps(payload).encode("utf-8")
            res = safe_fetch(
                webhook_url,
                method="POST",
                headers={"Content-Type": "application/json"},
                data=body_bytes,
                timeout=10,
            )
            if res.get("status", 500) < 400:
                return True, None
            else:
                return False, f"Webhook HTTP status {res.get('status')}"
        except Exception as e:
            err_msg = f"Webhook alert failed: {e}"
            logger.error(err_msg)
            return False, err_msg

    def send_test_alert(self) -> Dict[str, Any]:
        """Send a test notification to configured channels."""
        cfg = self.get_config()
        results = {}
        now_str = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M")
        storage = self.get_storage()

        # Email Test Alert
        if cfg.get("email_enabled") and cfg.get("email_recipient"):
            recipient = cfg["email_recipient"]
            subject = "[Shadow Hunter] TEST ALERT — Real-Time Alerting System"
            text_body = (
                "SHADOW HUNTER TEST ALERT\n"
                "Illuminating Threats Before They Surface\n\n"
                "This is a test alert from Shadow Hunter to verify real-time alert notifications.\n"
                f"Timestamp: {now_str}\n\n"
                "If you received this message, your email alert channel is properly configured."
            )
            html_body = f"""
            <html><body style="font-family:sans-serif; color:#1e293b; padding:20px;">
                <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:24px;">
                    <h2 style="color:#3b82f6; margin-top:0;">SHADOW HUNTER TEST ALERT</h2>
                    <p style="color:#64748b; font-size:0.9rem;">Illuminating Threats Before They Surface</p>
                    <hr style="border:none; border-top:1px solid #e2e8f0; margin:16px 0;">
                    <p>This is a test notification from Shadow Hunter to verify your email alerting configuration.</p>
                    <p style="font-size:0.85rem; color:#64748b;">Triggered: {now_str}</p>
                </div>
            </body></html>
            """
            alert_id = None
            if storage:
                alert_id = storage.create_alert_record(None, "EMAIL", "TEST", recipient, "PENDING")

            success, err = self.send_email_notification(recipient, subject, text_body, html_body)
            if storage and alert_id:
                status = "SENT" if success else "FAILED"
                storage.update_alert_record(alert_id, status, sent_at=datetime.now(timezone.utc).replace(tzinfo=None) if success else None, error_message=err)
            results["email"] = {"success": success, "error": err, "recipient": recipient}
        else:
            results["email"] = {"success": False, "error": "Email alerts not enabled or recipient missing."}

        # Webhook Test Alert
        if cfg.get("webhook_enabled") and cfg.get("webhook_url"):
            webhook_url = cfg["webhook_url"]
            payload = {
                "event": "shadow_hunter_test_alert",
                "message": "SHADOW HUNTER TEST ALERT",
                "status": "TEST",
                "triggered_at": datetime.now(timezone.utc).isoformat(),
            }
            alert_id = None
            if storage:
                alert_id = storage.create_alert_record(None, "WEBHOOK", "TEST", webhook_url, "PENDING")

            success, err = self.send_webhook_notification(webhook_url, payload)
            if storage and alert_id:
                status = "SENT" if success else "FAILED"
                storage.update_alert_record(alert_id, status, sent_at=datetime.now(timezone.utc).replace(tzinfo=None) if success else None, error_message=err)
            results["webhook"] = {"success": success, "error": err, "webhook_url": webhook_url}
        else:
            results["webhook"] = {"success": False, "error": "Webhook alerts not enabled or URL missing."}

        return results

    def dispatch_finding_alert(self, hit_or_id) -> Dict[str, Any]:
        """
        Process a finding, evaluate severity threshold against config,
        check deduplication, and dispatch email/webhook alerts.
        """
        storage = self.get_storage()
        if not storage:
            return {"status": "error", "message": "Storage unavailable"}

        # Resolve finding record
        if isinstance(hit_or_id, int):
            hit = storage.get_hit_by_id(hit_or_id)
        else:
            hit = hit_or_id

        if not hit:
            return {"status": "error", "message": "Finding not found"}

        finding_id = getattr(hit, "id", None)
        severity = getattr(hit, "severity", "LOW") or "LOW"
        keyword = getattr(hit, "keyword", "Unknown")
        url = getattr(hit, "url", "")
        page_title = getattr(hit, "page_title", "") or "Dark Web Page"
        context = getattr(hit, "context", "") or ""
        found_at = getattr(hit, "found_at", None)
        found_at_str = found_at.strftime("%d %b %Y %H:%M") if found_at else datetime.now(timezone.utc).strftime("%d %b %Y %H:%M")
        iso_found_at = found_at.isoformat() if found_at else datetime.now(timezone.utc).isoformat()

        # Extract domain/source from URL
        source_name = "example.onion"
        if ".onion" in url:
            m = re.search(r"([a-zA-Z2-7]{16,56}\.onion)", url)
            if m:
                source_name = m.group(1)
        elif url:
            parsed = urllib.parse.urlparse(url)
            if parsed.hostname:
                source_name = parsed.hostname

        cfg = self.get_config()
        min_severity = cfg.get("min_severity", "HIGH")

        # Threshold check
        if not self.is_severity_allowed(severity, min_severity):
            logger.info(f"Alert skipped for finding {finding_id}: severity {severity} below threshold {min_severity}")
            return {"status": "skipped", "reason": f"Severity {severity} below threshold {min_severity}"}

        dispatched = {}

        # ── 1. EMAIL ALERT ──
        if cfg.get("email_enabled") and cfg.get("email_recipient"):
            recipient = cfg["email_recipient"]
            # Deduplication Check
            if storage.has_finding_alert(finding_id, "EMAIL"):
                logger.info(f"Duplicate email alert suppressed for finding {finding_id}")
                dispatched["email"] = {"status": "duplicate_suppressed"}
            else:
                alert_id = storage.create_alert_record(finding_id, "EMAIL", severity, recipient, "PENDING")
                subject = f"[Shadow Hunter] {severity.upper()} Threat Finding Detected"
                text_body = (
                    "SHADOW HUNTER\n"
                    "Illuminating Threats Before They Surface\n\n"
                    "Threat Finding Detected\n\n"
                    f"Severity:\n{severity.upper()}\n\n"
                    f"Matched Keyword:\n{keyword}\n\n"
                    f"Source:\n{source_name}\n\n"
                    f"Page:\n{page_title}\n\n"
                    f"Detected:\n{found_at_str}\n\n"
                    f"Context:\n\"{context[:300]}\"\n\n"
                    "Status:\nNEW\n\n"
                    "Open Shadow Hunter to investigate this finding."
                )
                html_body = f"""
                <html><body style="font-family:sans-serif; color:#1e293b; padding:20px;">
                    <div style="max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:24px;">
                        <h2 style="color:#dc2626; margin-top:0;">SHADOW HUNTER</h2>
                        <p style="color:#64748b; font-size:0.875rem;">Illuminating Threats Before They Surface</p>
                        <h3 style="margin-top:20px; color:#1e293b;">Threat Finding Detected</h3>
                        <table style="width:100%; border-collapse:collapse; margin-top:16px; font-size:0.9rem;">
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px 0; color:#64748b; width:30%;">Severity</td><td style="padding:8px 0; font-weight:700; color:{'#dc2626' if severity.upper() in ('HIGH','CRITICAL') else '#d97706'};">{severity.upper()}</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px 0; color:#64748b;">Matched Keyword</td><td style="padding:8px 0; font-weight:600;">{html.escape(keyword)}</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px 0; color:#64748b;">Source</td><td style="padding:8px 0;">{html.escape(source_name)}</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px 0; color:#64748b;">Page</td><td style="padding:8px 0;">{html.escape(page_title)}</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px 0; color:#64748b;">Detected</td><td style="padding:8px 0;">{found_at_str}</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px 0; color:#64748b;">Context</td><td style="padding:8px 0; font-family:monospace; background:#f8fafc;">{html.escape(context[:400])}</td></tr>
                            <tr><td style="padding:8px 0; color:#64748b;">Status</td><td style="padding:8px 0; font-weight:600;">NEW</td></tr>
                        </table>
                        <p style="margin-top:20px; font-size:0.875rem; color:#64748b;">Open Shadow Hunter to investigate this finding.</p>
                    </div>
                </body></html>
                """
                success, err = self.send_email_notification(recipient, subject, text_body, html_body)
                status = "SENT" if success else "FAILED"
                storage.update_alert_record(alert_id, status, sent_at=datetime.now(timezone.utc).replace(tzinfo=None) if success else None, error_message=err)
                if success:
                    storage.mark_alerted(finding_id)
                dispatched["email"] = {"status": status, "error": err}

        # ── 2. WEBHOOK ALERT ──
        if cfg.get("webhook_enabled") and cfg.get("webhook_url"):
            webhook_url = cfg["webhook_url"]
            # Deduplication Check
            if storage.has_finding_alert(finding_id, "WEBHOOK"):
                logger.info(f"Duplicate webhook alert suppressed for finding {finding_id}")
                dispatched["webhook"] = {"status": "duplicate_suppressed"}
            else:
                alert_id = storage.create_alert_record(finding_id, "WEBHOOK", severity, webhook_url, "PENDING")
                payload = {
                    "event": "shadow_hunter_finding",
                    "finding_id": finding_id,
                    "severity": severity.upper(),
                    "keyword": keyword,
                    "source": source_name,
                    "url": url,
                    "title": page_title,
                    "snippet": context[:300],
                    "detected_at": iso_found_at,
                    "status": "NEW",
                }
                success, err = self.send_webhook_notification(webhook_url, payload)
                status = "SENT" if success else "FAILED"
                storage.update_alert_record(alert_id, status, sent_at=datetime.now(timezone.utc).replace(tzinfo=None) if success else None, error_message=err)
                if success:
                    storage.mark_alerted(finding_id)
                dispatched["webhook"] = {"status": status, "error": err}

        return {"status": "completed", "finding_id": finding_id, "dispatched": dispatched}

    def retry_alert(self, alert_id: int) -> Dict[str, Any]:
        """Retry a failed alert record."""
        storage = self.get_storage()
        if not storage:
            return {"success": False, "error": "Storage unavailable"}

        with storage.get_session() as session:
            from .storage import AlertRecord, KeywordHitRecord
            rec = session.get(AlertRecord, alert_id)
            if not rec:
                return {"success": False, "error": "Alert record not found"}
            
            finding_id = rec.finding_id
            channel = rec.channel
            recipient = rec.recipient

            if finding_id:
                hit = session.get(KeywordHitRecord, finding_id)
            else:
                hit = None

        if channel == "EMAIL":
            if hit:
                # Re-dispatch finding email
                res = self.dispatch_finding_alert(hit.id)
                return {"success": True, "res": res}
            else:
                # Retry test email
                test_res = self.send_test_alert()
                return {"success": True, "res": test_res}
        elif channel == "WEBHOOK":
            if hit:
                res = self.dispatch_finding_alert(hit.id)
                return {"success": True, "res": res}
            else:
                test_res = self.send_test_alert()
                return {"success": True, "res": test_res}

        return {"success": False, "error": f"Unknown channel {channel}"}
