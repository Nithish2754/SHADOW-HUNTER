"""
OSINT Quick Scan Provider Integrations — VirusTotal + AbuseIPDB async lookup.
"""

import asyncio
import base64
import ipaddress
import logging
import os
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

import aiohttp

logger = logging.getLogger(__name__)

HASH_MD5_RE = re.compile(r"^[a-fA-F0-9]{32}$")
HASH_SHA1_RE = re.compile(r"^[a-fA-F0-9]{40}$")
HASH_SHA256_RE = re.compile(r"^[a-fA-F0-9]{64}$")

DOMAIN_RE = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
)


def classify_and_validate_indicator(raw_indicator: str, requested_type: str = "auto") -> tuple[bool, str, str, str]:
    """
    Returns: (is_valid, error_message, detected_type, normalized_indicator)
    Target types: 'ip', 'domain', 'url', 'hash'
    """
    val = (raw_indicator or "").strip()
    if not val:
        return False, "Indicator input cannot be empty.", "", ""

    req_type = (requested_type or "auto").lower()

    detected_type = None
    norm_val = val

    # 1. IP Check
    try:
        ip_obj = ipaddress.ip_address(val)
        detected_type = "ip"
        norm_val = str(ip_obj)
    except ValueError:
        pass

    # 2. Hash Check
    if not detected_type:
        if HASH_MD5_RE.match(val) or HASH_SHA1_RE.match(val) or HASH_SHA256_RE.match(val):
            detected_type = "hash"
            norm_val = val.lower()

    # 3. URL Check
    if not detected_type:
        if val.startswith("http://") or val.startswith("https://"):
            parsed = urlparse(val)
            if parsed.netloc:
                detected_type = "url"
                norm_val = val

    # 4. Domain Check
    if not detected_type:
        clean_domain = val.lower().replace("http://", "").replace("https://", "").split("/")[0].split(":")[0]
        if DOMAIN_RE.match(clean_domain):
            detected_type = "domain"
            norm_val = clean_domain

    if req_type != "auto":
        if req_type == "ip":
            try:
                ip_obj = ipaddress.ip_address(val)
                return True, "", "ip", str(ip_obj)
            except ValueError:
                return False, f"'{val}' is not a valid IPv4 or IPv6 address.", "ip", val

        elif req_type == "domain":
            clean_dom = val.lower().replace("http://", "").replace("https://", "").split("/")[0].split(":")[0]
            if DOMAIN_RE.match(clean_dom):
                return True, "", "domain", clean_dom
            return False, f"'{val}' is not a valid domain name.", "domain", val

        elif req_type == "url":
            if val.startswith("http://") or val.startswith("https://"):
                parsed = urlparse(val)
                if parsed.netloc:
                    return True, "", "url", val
            return False, f"'{val}' is not a valid URL. Must start with http:// or https://.", "url", val

        elif req_type == "hash":
            if HASH_MD5_RE.match(val) or HASH_SHA1_RE.match(val) or HASH_SHA256_RE.match(val):
                return True, "", "hash", val.lower()
            return False, f"'{val}' is not a valid MD5, SHA-1, or SHA-256 hash.", "hash", val

    if not detected_type:
        return False, f"Unable to automatically determine indicator type for '{val}'. Please select the type manually.", "", val

    return True, "", detected_type, norm_val


async def query_virustotal(indicator: str, indicator_type: str, session: aiohttp.ClientSession) -> dict:
    api_key = os.getenv("VIRUSTOTAL_API_KEY", "").strip()
    if not api_key:
        return {
            "provider": "VirusTotal",
            "status": "not_configured",
            "error": "Add VIRUSTOTAL_API_KEY in your environment to enable this provider."
        }

    headers = {"x-apikey": api_key, "Accept": "application/json"}
    base_url = "https://www.virustotal.com/api/v3"

    if indicator_type == "ip":
        endpoint = f"{base_url}/ip_addresses/{indicator}"
    elif indicator_type == "domain":
        endpoint = f"{base_url}/domains/{indicator}"
    elif indicator_type == "url":
        url_id = base64.urlsafe_b64encode(indicator.encode()).decode().rstrip("=")
        endpoint = f"{base_url}/urls/{url_id}"
    elif indicator_type == "hash":
        endpoint = f"{base_url}/files/{indicator}"
    else:
        return {"provider": "VirusTotal", "status": "error", "error": f"Unsupported indicator type: {indicator_type}"}

    try:
        async with session.get(endpoint, headers=headers, timeout=15) as resp:
            if resp.status == 401:
                return {"provider": "VirusTotal", "status": "error", "error": "Invalid VirusTotal API key"}
            if resp.status == 404:
                return {"provider": "VirusTotal", "status": "not_found", "error": "Indicator not found in VirusTotal database"}
            if resp.status == 429:
                return {"provider": "VirusTotal", "status": "error", "error": "VirusTotal rate limit exceeded. Please try again later."}
            if resp.status != 200:
                return {"provider": "VirusTotal", "status": "error", "error": f"VirusTotal returned HTTP {resp.status}"}

            data = await resp.json()
            attrs = data.get("data", {}).get("attributes", {})
            stats = attrs.get("last_analysis_stats", {})

            last_analysis = attrs.get("last_analysis_date")
            last_analysis_str = None
            if last_analysis:
                try:
                    last_analysis_str = datetime.fromtimestamp(last_analysis, tz=timezone.utc).isoformat()
                except Exception:
                    pass

            malicious = stats.get("malicious", 0)
            suspicious = stats.get("suspicious", 0)
            harmless = stats.get("harmless", 0)
            undetected = stats.get("undetected", 0)
            total = malicious + suspicious + harmless + undetected

            cats = attrs.get("categories", {})
            categories = list(cats.values()) if isinstance(cats, dict) else (attrs.get("tags") or [])

            return {
                "provider": "VirusTotal",
                "status": "available",
                "reputation": attrs.get("reputation", 0),
                "malicious": malicious,
                "suspicious": suspicious,
                "harmless": harmless,
                "undetected": undetected,
                "total_engines": total,
                "detection_ratio": f"{malicious}/{total}" if total > 0 else "0/0",
                "last_analysis": last_analysis_str,
                "categories": categories[:5],
                "country": attrs.get("country"),
                "as_owner": attrs.get("as_owner"),
                "asn": attrs.get("asn"),
                "registrar": attrs.get("registrar"),
            }
    except asyncio.TimeoutError:
        return {"provider": "VirusTotal", "status": "error", "error": "Unable to retrieve results. Reason: Request timeout"}
    except Exception as e:
        return {"provider": "VirusTotal", "status": "error", "error": f"Unable to retrieve results. Reason: {str(e)}"}


async def query_abuseipdb(ip: str, session: aiohttp.ClientSession) -> dict:
    api_key = os.getenv("ABUSEIPDB_API_KEY", "").strip()
    if not api_key:
        return {
            "provider": "AbuseIPDB",
            "status": "not_configured",
            "error": "Add ABUSEIPDB_API_KEY in your environment to enable this provider."
        }

    headers = {"Key": api_key, "Accept": "application/json"}
    endpoint = "https://api.abuseipdb.com/api/v2/check"
    params = {"ipAddress": ip, "maxAgeInDays": "90", "verbose": "true"}

    try:
        async with session.get(endpoint, headers=headers, params=params, timeout=15) as resp:
            if resp.status == 401:
                return {"provider": "AbuseIPDB", "status": "error", "error": "Invalid AbuseIPDB API key"}
            if resp.status == 429:
                return {"provider": "AbuseIPDB", "status": "error", "error": "AbuseIPDB rate limit exceeded. Please try again later."}
            if resp.status != 200:
                return {"provider": "AbuseIPDB", "status": "error", "error": f"AbuseIPDB returned HTTP {resp.status}"}

            data = await resp.json()
            d = data.get("data", {})
            return {
                "provider": "AbuseIPDB",
                "status": "available",
                "abuse_confidence_score": d.get("abuseConfidenceScore", 0),
                "total_reports": d.get("totalReports", 0),
                "country_name": d.get("countryName"),
                "country_code": d.get("countryCode"),
                "isp": d.get("isp"),
                "domain": d.get("domain"),
                "last_reported_at": d.get("lastReportedAt"),
                "is_tor": d.get("isTor", False),
            }
    except asyncio.TimeoutError:
        return {"provider": "AbuseIPDB", "status": "error", "error": "Unable to retrieve results. Reason: Request timeout"}
    except Exception as e:
        return {"provider": "AbuseIPDB", "status": "error", "error": f"Unable to retrieve results. Reason: {str(e)}"}


async def run_osint_investigation(indicator: str, indicator_type: str = "auto") -> dict:
    is_valid, err_msg, ind_type, norm_ind = classify_and_validate_indicator(indicator, indicator_type)
    if not is_valid:
        return {"valid": False, "error": err_msg}

    async with aiohttp.ClientSession() as session:
        vt_task = asyncio.create_task(query_virustotal(norm_ind, ind_type, session))
        
        if ind_type == "ip":
            abuse_task = asyncio.create_task(query_abuseipdb(norm_ind, session))
            vt_res, abuse_res = await asyncio.gather(vt_task, abuse_task)
        else:
            vt_res = await vt_task
            abuse_res = None

    sources_checked = 1 if abuse_res is None else 2
    
    malicious = 0
    suspicious = 0
    reports = 0

    if vt_res.get("status") == "available":
        malicious += vt_res.get("malicious", 0)
        suspicious += vt_res.get("suspicious", 0)

    if abuse_res and abuse_res.get("status") == "available":
        reports += abuse_res.get("total_reports", 0)

    results = [vt_res]
    if abuse_res is not None:
        results.append(abuse_res)

    for r in results:
        r["indicator"] = norm_ind
        r["indicator_type"] = ind_type

    return {
        "valid": True,
        "indicator": norm_ind,
        "indicator_type": ind_type,
        "sources_checked": sources_checked,
        "summary": {
            "sources_checked": sources_checked,
            "malicious_count": malicious,
            "suspicious_count": suspicious,
            "reports_count": reports,
        },
        "results": results,
        "providers": {r["provider"].lower(): r for r in results},
    }

