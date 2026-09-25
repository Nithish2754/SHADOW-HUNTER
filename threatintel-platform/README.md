# Shadow Hunter

### “Illuminating Threats Before They Surface”
**Team:** ANVIO TECH

Shadow Hunter is a self-hosted threat intelligence and dark-web monitoring platform designed to detect sensitive information leaks, credential exposures, and dark-web mentions before they become a major breach. 

## 1. Project Overview
Shadow Hunter acts as an automated analyst, crawling Tor hidden services, paste sites, and threat actor infrastructure to identify early warnings of compromised assets.

## 2. Problem Statement
Organizations often find out about a breach only after data is actively exploited or published on public platforms. Monitoring the deep and dark web manually is inefficient, dangerous, and slow. Shadow Hunter automates this by continuously scanning for specific keywords (e.g., employee emails, proprietary project names, leaked databases) and immediately alerting analysts.

## 3. Features
- **Dark Web Monitoring**: Custom Tor-based web crawler that indexes `.onion` domains.
- **Keyword Alerting**: Continuously match discovered content against a predefined list of sensitive keywords.
- **Threat Intelligence**: Aggregation of IOCs and threat actor tracking.
- **OSINT Quick Scan**: Enriches IP, Domain, and URL indicators with data from VirusTotal, AbuseIPDB, Shodan, and ThreatFox.
- **DNS / IP Investigation**: Automated infrastructure footprinting and reconnaissance.
- **Ransomware Intelligence**: Tracking of active ransomware leak sites.
- **Daily Reports**: Automated PDF generation for executive threat intelligence summaries.
- **Email & Webhook Alerts**: Real-time notifications for critical severity findings.

## 4. Architecture
Shadow Hunter is built on a simple, self-hosted Python stack. 
The application accesses the Tor network via a local Tor proxy and stores findings in a local SQLite database, visualized through a modern, cybersecurity-focused dashboard.

## 5. Technology Stack
- **Frontend**: HTML, CSS, JavaScript (Vanilla), Jinja2 Templates
- **Backend**: Python 3.11+, Flask, aiohttp, SQLAlchemy
- **Database**: SQLite (Default) / PostgreSQL (Optional)
- **Networking**: Tor SOCKS5 Proxy

## 6. Installation
**Note: Docker is NOT required to run this project.**

```bash
# 1. Clone the repository
git clone https://github.com/osintph/threatintel-platform.git
cd threatintel-platform

# 2. Create a virtual environment
python -m venv venv

# 3. Activate the virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt
```

## 7. Tor Setup
Shadow Hunter requires a running Tor service for dark-web crawling.
Install Tor on your machine and ensure it exposes a SOCKS5 proxy (default `127.0.0.1:9050`).
- **Windows**: Install the Tor Expert Bundle or Tor Browser.
- **Linux**: `sudo apt install tor`
- **Mac**: `brew install tor`

Ensure Tor is running in the background. If Tor is offline, the crawler will not function, but the dashboard will remain available.

## 8. Environment Variables
Copy `.env.example` to `.env` and fill in the required values.
```bash
cp .env.example .env
```
Key variables:
- `SECRET_KEY`: Random string for Flask sessions
- `DATABASE_URL`: `sqlite:///shadow_hunter.db`
- API Keys for VirusTotal, Shodan, AbuseIPDB, ThreatFox (Optional)

## 9. Database Setup
The SQLite database will automatically initialize when you start the application for the first time.

## 10. Running Locally
Start the Shadow Hunter platform:
```bash
python run.py
```
The dashboard will be available at `http://127.0.0.1:5000`.

## 11. Demo Mode
If you are presenting Shadow Hunter at a hackathon or demo and do not have active dark-web findings, you can enable demo mode:
```env
DEMO_MODE=true
```
This safely provides controlled sample threat-intelligence data to demonstrate the dashboard features.

## 12. API Integrations
Shadow Hunter integrates with several OSINT APIs to enrich findings. These are configured in `.env`.
- **VirusTotal**: IP/Domain reputation
- **AbuseIPDB**: IP abuse reports
- **Shodan**: Open ports and services
- **ThreatFox**: Known IOCs

## 13. Security Considerations
- **SSRF Protection**: Internal requests are blocked.
- **Input Validation**: All URLs and domains are strictly validated before scanning.
- **HTML Sanitization**: Scraped content is sanitized to prevent XSS.

## 14. Screenshots
*(Add screenshots of the dashboard here)*

## 15. Project Structure
- `config/`: Keywords and seed configurations
- `src/darkweb_scanner/`: Core python modules for crawling, scanning, and intelligence gathering
- `src/darkweb_scanner/dashboard/`: Flask application, routes, and UI templates
- `run.py`: Application entry point
- `requirements.txt`: Python dependencies
