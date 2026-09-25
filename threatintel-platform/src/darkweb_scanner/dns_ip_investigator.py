"""
DNS / IP Infrastructure Investigation Module.
Handles validation, DNS record lookup (A, AAAA, MX, NS, TXT, CNAME),
Reverse DNS, ASN / Org / ISP lookup, and results normalization.
"""

import ipaddress
import logging
import re
import socket
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any, List

logger = logging.getLogger(__name__)

# Private/Local IP ranges to block for SSRF prevention
PRIVATE_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("fc00::/7"),
]


def is_private_or_restricted_ip(ip_str: str) -> bool:
    try:
        ip_obj = ipaddress.ip_address(ip_str)
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved or ip_obj.is_multicast:
            return True
        for net in PRIVATE_NETWORKS:
            if ip_obj in net:
                return True
        return False
    except ValueError:
        return False


def classify_and_validate_infrastructure_target(target: str) -> Tuple[bool, Optional[str], Optional[str], Optional[str]]:
    """
    Validates and classifies target input.
    Returns (is_valid, error_message, target_type, normalized_target).
    """
    target = (target or "").strip()
    if not target:
        return False, "Target input cannot be empty.", None, None

    lower = target.lower()
    if lower.startswith(("javascript:", "file:", "ftp:", "data:", "blob:")):
        return False, "Unsupported protocol scheme.", None, None

    # Strip scheme if http/https
    clean = re.sub(r"^https?://", "", target, flags=re.IGNORECASE).split("/")[0].split("?")[0].split("#")[0].strip()
    if not clean:
        return False, "Invalid target specification.", None, None

    # Check if IP address
    try:
        ip_obj = ipaddress.ip_address(clean)
        if is_private_or_restricted_ip(str(ip_obj)):
            return False, f"Target IP {clean} is restricted or private.", "ip", str(ip_obj)
        return True, None, "ip", str(ip_obj)
    except ValueError:
        pass

    # Reject localhost explicitly
    if clean.lower() == "localhost" or clean.lower().endswith(".localhost"):
        return False, "Localhost target is restricted.", "domain", clean

    # Validate Domain format
    domain_regex = r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$"
    if not re.match(domain_regex, clean):
        return False, f"Invalid domain or IP address format: '{target}'", None, None

    return True, None, "domain", clean.lower()


def safe_reverse_dns(ip_str: str) -> Optional[str]:
    """Attempt reverse DNS lookup for an IP."""
    try:
        name, _, _ = socket.gethostbyaddr(ip_str)
        return name
    except Exception:
        return None


def fetch_asn_geo_info(ips: List[str]) -> Dict[str, Dict[str, Any]]:
    """Fetch ASN/ISP/Geo info using ip-api.com fallback."""
    try:
        from .dns_crawler import geolocate_ips
        return geolocate_ips(ips)
    except Exception as e:
        logger.warning(f"Error fetching ASN info for IPs {ips}: {e}")
        return {}


def query_domain_dns_records(domain: str) -> Tuple[Dict[str, List[str]], Optional[str]]:
    """Query DNS records (A, AAAA, MX, NS, TXT, CNAME)."""
    records = {
        "A": [],
        "AAAA": [],
        "MX": [],
        "NS": [],
        "TXT": [],
    }
    cname_val = None

    try:
        import dns.resolver
        import dns.exception

        resolver = dns.resolver.Resolver()
        resolver.timeout = 4
        resolver.lifetime = 4

        # CNAME check
        try:
            answers = resolver.resolve(domain, "CNAME")
            for rdata in answers:
                cname_val = str(rdata.target).rstrip(".")
                break
        except Exception:
            cname_val = None

        record_types = ["A", "AAAA", "MX", "NS", "TXT"]
        for rtype in record_types:
            try:
                answers = resolver.resolve(domain, rtype)
                vals = []
                for rdata in answers:
                    if rtype == "MX":
                        val = str(rdata.exchange).rstrip(".")
                    else:
                        val = str(rdata.to_text()).strip('"')
                        if val.endswith(".") and rtype in ("NS", "CNAME"):
                            val = val[:-1]
                    if val and val not in vals:
                        vals.append(val)
                records[rtype] = vals
            except Exception:
                records[rtype] = []
    except ImportError:
        # Fallback using standard socket if dnspython is missing
        try:
            addr_info = socket.getaddrinfo(domain, None)
            for item in addr_info:
                ip = item[4][0]
                if ":" in ip:
                    if ip not in records["AAAA"]:
                        records["AAAA"].append(ip)
                else:
                    if ip not in records["A"]:
                        records["A"].append(ip)
        except Exception:
            pass

    return records, cname_val


def investigate_domain_target(domain: str) -> Dict[str, Any]:
    """Run infrastructure investigation for a domain target."""
    now_str = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M")
    records, cname = query_domain_dns_records(domain)

    # Collect resolved IPs
    resolved_ips_raw = list(dict.fromkeys(records["A"] + records["AAAA"]))
    
    # Reverse DNS & Geo info for each resolved IP
    geo_data = fetch_asn_geo_info(resolved_ips_raw)
    resolved_ips_details = []

    for ip in resolved_ips_raw:
        if is_private_or_restricted_ip(ip):
            continue
        rdns = safe_reverse_dns(ip)
        g = geo_data.get(ip, {})
        resolved_ips_details.append({
            "ip": ip,
            "ip_version": "IPv6" if ":" in ip else "IPv4",
            "reverse_dns": rdns,
            "asn": g.get("as", "N/A"),
            "org": g.get("org", g.get("isp", "N/A")),
            "isp": g.get("isp", "N/A"),
            "country": g.get("country", "N/A"),
        })

    total_records_count = sum(len(v) for v in records.values()) + (1 if cname else 0)

    # Visual Relationship Tree
    infra_tree = []
    if records["A"]:
        infra_tree.append({"label": "A Records", "values": records["A"]})
    if records["AAAA"]:
        infra_tree.append({"label": "AAAA Records", "values": records["AAAA"]})
    if records["MX"]:
        infra_tree.append({"label": "MX Records", "values": records["MX"]})
    if records["NS"]:
        infra_tree.append({"label": "Name Servers", "values": records["NS"]})
    if cname:
        infra_tree.append({"label": "CNAME Target", "values": [cname]})
    if records["TXT"]:
        infra_tree.append({"label": "TXT Records", "values": records["TXT"]})

    return {
        "valid": True,
        "target": domain,
        "target_type": "Domain",
        "created_at": now_str,
        "summary": {
            "target": domain,
            "target_type": "Domain",
            "resolved_ips_count": len(resolved_ips_details),
            "dns_records_count": total_records_count,
            "investigation_time": now_str,
        },
        "records": {
            "A": records["A"],
            "AAAA": records["AAAA"],
            "MX": records["MX"],
            "NS": records["NS"],
            "TXT": records["TXT"],
            "CNAME": cname,
        },
        "resolved_ips": resolved_ips_details,
        "infrastructure_tree": infra_tree,
    }


def investigate_ip_target(ip_str: str) -> Dict[str, Any]:
    """Run infrastructure investigation for an IP target."""
    now_str = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M")
    ip_version = "IPv6" if ":" in ip_str else "IPv4"
    rdns = safe_reverse_dns(ip_str)
    geo = fetch_asn_geo_info([ip_str]).get(ip_str, {})

    resolved_ip_obj = {
        "ip": ip_str,
        "ip_version": ip_version,
        "reverse_dns": rdns,
        "asn": geo.get("as", "N/A"),
        "org": geo.get("org", geo.get("isp", "N/A")),
        "isp": geo.get("isp", "N/A"),
        "country": geo.get("country", "N/A"),
        "domain": geo.get("domain"),
    }

    ip_intelligence = {
        "ip": ip_str,
        "reverse_dns": rdns,
        "organization": geo.get("org", geo.get("isp", "N/A")),
        "asn": geo.get("as", "N/A"),
        "country": geo.get("country", "N/A"),
        "isp": geo.get("isp", "N/A"),
    }

    infra_tree = [
        {"label": "Target IP", "values": [ip_str]},
    ]
    if rdns:
        infra_tree.append({"label": "Reverse DNS Hostname", "values": [rdns]})
    if geo.get("as"):
        infra_tree.append({"label": "Autonomous System", "values": [geo.get("as")]})
    if geo.get("org"):
        infra_tree.append({"label": "Organization", "values": [geo.get("org")]})

    return {
        "valid": True,
        "target": ip_str,
        "target_type": f"IP Address ({ip_version})",
        "created_at": now_str,
        "summary": {
            "target": ip_str,
            "target_type": f"IP Address ({ip_version})",
            "resolved_ips_count": 1,
            "dns_records_count": 1 if rdns else 0,
            "investigation_time": now_str,
        },
        "ip_intelligence": ip_intelligence,
        "records": {
            "A": [ip_str] if ip_version == "IPv4" else [],
            "AAAA": [ip_str] if ip_version == "IPv6" else [],
            "MX": [],
            "NS": [],
            "TXT": [],
            "CNAME": None,
        },
        "resolved_ips": [resolved_ip_obj],
        "infrastructure_tree": infra_tree,
    }


def run_infrastructure_investigation(target: str) -> Dict[str, Any]:
    """
    Main orchestrator for DNS / IP investigation.
    Validates target and routes to domain or IP investigation engine.
    """
    is_valid, err_msg, target_type, norm_target = classify_and_validate_infrastructure_target(target)
    if not is_valid:
        return {"valid": False, "error": err_msg}

    try:
        if target_type == "ip":
            return investigate_ip_target(norm_target)
        else:
            return investigate_domain_target(norm_target)
    except Exception as exc:
        logger.exception(f"Infrastructure investigation failed for {target}")
        return {"valid": False, "error": f"Investigation failed: {exc}"}
