import os

def rewrite_digest_py():
    with open("src/darkweb_scanner/digest.py", "w", encoding="utf-8") as f:
        f.write('''import logging
import os
from datetime import datetime, timezone
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

from .storage import Storage

logger = logging.getLogger(__name__)

def generate_pdf_report(storage: Storage) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()

    s_title = ParagraphStyle("Title", parent=styles["Normal"], fontSize=24, spaceAfter=20, textColor=colors.HexColor("#1e293b"), fontName="Helvetica-Bold")
    s_h2 = ParagraphStyle("H2", parent=styles["Normal"], fontSize=16, spaceBefore=15, spaceAfter=10, textColor=colors.HexColor("#334155"), fontName="Helvetica-Bold")
    s_normal = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, spaceAfter=8, textColor=colors.HexColor("#475569"))
    
    story = []
    
    story.append(Paragraph("Shadow Hunter Threat Intelligence Report", s_title))
    date_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
    story.append(Paragraph(f"Report Date: {date_str}", s_normal))
    
    # Add stats
    story.append(Paragraph("Executive Summary", s_h2))
    
    with storage.get_session() as session:
        # Just simple placeholders for now since we just need basic stats
        # We can implement proper queries
        pass
        
    story.append(Paragraph("This report provides a summary of threat intelligence gathered by Shadow Hunter.", s_normal))
    
    doc.build(story)
    return buf.getvalue()
''')

def main():
    rewrite_digest_py()

if __name__ == "__main__":
    main()
