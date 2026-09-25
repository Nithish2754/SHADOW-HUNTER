import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from src.darkweb_scanner.dashboard.app import app
from src.darkweb_scanner.storage import Storage

if __name__ == "__main__":
    # Ensure database is initialized
    print("Initializing database...")
    storage = Storage()
    print("Starting Shadow Hunter...")
    port = int(os.getenv("PORT", "5000"))
    # Run Flask app
    app.run(host="127.0.0.1", port=port, debug=True)
