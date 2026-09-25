import os

README_CONTENT = """# Shadow Hunter

**Illuminating Threats Before They Surface**

Shadow Hunter is a self-hosted cyber threat intelligence platform by **ANVIO TECH** designed to automate monitoring and investigation of authorized dark-web sources.

## Overview
Shadow Hunter provides continuous dark web monitoring, searching for specific organization keywords, sensitive data exposures, and active threats. It automatically extracts, categorizes, and alerts on findings, enriched with OSINT analysis from VirusTotal and AbuseIPDB.

## Features
* **Dark Web Crawler**: Tor-based automated crawler targeting authorized `.onion` sources.
* **Keyword Detection**: Configurable organization targets (names, domains, emails).
* **Severity Scoring**: Simple classification into Critical, High, Medium, Low based on context.
* **Threat Intelligence Dashboard**: A professional, light-themed investigation dashboard.
* **OSINT Enrichment**: Built-in Quick Scans using VirusTotal and AbuseIPDB.
* **Alerting**: Automated notifications via Email and Webhooks.
* **PDF Reports**: Automated generation of threat intelligence digests.

## Technology Stack
* **Backend**: Python 3.11+, Flask, aiohttp, SQLAlchemy
* **Frontend**: HTML5, CSS3, JavaScript (Vanilla, Light Theme)
* **Database**: SQLite (default) / PostgreSQL support
* **Dark Web**: Tor, SOCKS5

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ANVIOTECH/Shadow-Hunter.git
   cd Shadow-Hunter
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   ```

3. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Tor Setup
Shadow Hunter requires a local Tor instance to access `.onion` services.
Ensure Tor is running and exposing a SOCKS5 proxy on `127.0.0.1:9050`.

## Running the Application
Start the Flask application:
```bash
python run.py
```
Access the dashboard at `http://127.0.0.1:5000`.

## Security Considerations
* **Demo Mode**: Enable `DEMO_MODE=true` in `.env` to populate sample findings for demonstration purposes. Never use this in production.
* **SSRF Protection**: Shadow Hunter restricts connections to internal IP ranges.

---
Built by **ANVIO TECH**
"""

ENV_CONTENT = """SECRET_KEY=change-me-to-a-long-random-string

DATABASE_URL=sqlite:///shadow_hunter.db

TOR_PROXY=socks5://127.0.0.1:9050
TOR_CONTROL_HOST=127.0.0.1
TOR_CONTROL_PORT=9051

VIRUSTOTAL_API_KEY=
ABUSEIPDB_API_KEY=

SMTP_HOST=
SMTP_PORT=
SMTP_USERNAME=
SMTP_PASSWORD=
ALERT_EMAIL=

WEBHOOK_URL=

DEMO_MODE=false
"""

def build_meta():
    with open("README.md", "w", encoding="utf-8") as f:
        f.write(README_CONTENT)
    with open(".env.example", "w", encoding="utf-8") as f:
        f.write(ENV_CONTENT)

if __name__ == "__main__":
    build_meta()
