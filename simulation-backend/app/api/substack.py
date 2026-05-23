"""
Substack-to-PDF conversion endpoint.
Wraps substack2pdf logic: fetches a Substack article, converts to PDF, returns the file.
"""

import os
import re
import tempfile

import requests
from bs4 import BeautifulSoup
from flask import request, jsonify, send_file

from . import substack_bp


def fetch_substack_content(url):
    """Fetch and clean a Substack article into styled HTML."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/91.0.4472.124 Safari/537.36"
        )
    }
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # Extract title
    title_tag = soup.find("h1", class_="post-title")
    if not title_tag:
        title_tag = soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else "Substack Article"

    # Extract subtitle
    subtitle_tag = soup.find("h3", class_="subtitle")
    subtitle = subtitle_tag.get_text(strip=True) if subtitle_tag else ""

    # Extract body
    body = soup.find("div", class_="body")
    if not body:
        body = soup.find("div", class_="post-content")
    if not body:
        body = soup.find("article")

    body_html = str(body) if body else "<p>Could not extract article content.</p>"

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: Georgia, 'Times New Roman', serif; margin: 40px; line-height: 1.7; color: #1a1b24; }}
  h1 {{ font-size: 28px; margin-bottom: 8px; }}
  h3.subtitle {{ font-size: 16px; color: #666; margin-bottom: 24px; font-weight: normal; }}
  img {{ max-width: 100%; height: auto; }}
  a {{ color: #5168FF; }}
  blockquote {{ border-left: 3px solid #5168FF; padding-left: 16px; margin-left: 0; color: #444; }}
</style>
</head>
<body>
  <h1>{title}</h1>
  {"<h3 class='subtitle'>" + subtitle + "</h3>" if subtitle else ""}
  {body_html}
</body>
</html>"""

    # Clean the title for filename
    safe_title = re.sub(r'[^\w\s-]', '', title)[:60].strip().replace(' ', '-')
    return html, safe_title or "substack-article"


@substack_bp.route('/convert', methods=['POST'])
def convert_substack():
    """Convert a Substack URL to PDF and return the file."""
    data = request.get_json(silent=True)
    if not data or not data.get('url'):
        return jsonify({"error": "Missing 'url' field"}), 400

    url = data['url'].strip()

    # Basic URL validation
    if not url.startswith('http'):
        return jsonify({"error": "Invalid URL — must start with http:// or https://"}), 400

    try:
        html_content, safe_title = fetch_substack_content(url)
    except requests.RequestException as e:
        return jsonify({"error": f"Failed to fetch article: {str(e)}"}), 502

    # Try pdfkit (wkhtmltopdf) first, fall back to weasyprint, then plain HTML save
    pdf_path = None
    tmp_dir = tempfile.mkdtemp()
    filename = f"{safe_title}.pdf"
    output_path = os.path.join(tmp_dir, filename)

    try:
        import pdfkit
        pdfkit.from_string(html_content, output_path, options={
            'encoding': 'UTF-8',
            'quiet': '',
            'no-outline': '',
        })
        pdf_path = output_path
    except Exception:
        try:
            from weasyprint import HTML
            HTML(string=html_content).write_pdf(output_path)
            pdf_path = output_path
        except Exception:
            # Fallback: save as HTML file (still useful for the pipeline)
            filename = f"{safe_title}.txt"
            output_path = os.path.join(tmp_dir, filename)
            # Extract plain text from the HTML
            soup = BeautifulSoup(html_content, "html.parser")
            text = soup.get_text(separator="\n\n", strip=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(text)
            pdf_path = output_path

    if not pdf_path or not os.path.exists(pdf_path):
        return jsonify({"error": "Conversion failed — no output generated"}), 500

    return send_file(
        pdf_path,
        as_attachment=True,
        download_name=filename,
        mimetype='application/pdf' if filename.endswith('.pdf') else 'text/plain',
    )
