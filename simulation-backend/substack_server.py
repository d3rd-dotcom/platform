"""
Lightweight standalone server for the Substack converter endpoint.
Run this when you only need the converter without the full MiroFish backend.
"""

import os
import re
import tempfile

import requests
from bs4 import BeautifulSoup
from flask import Flask, Blueprint, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

substack_bp = Blueprint('substack', __name__)


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

    title_tag = soup.find("h1", class_="post-title") or soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else "Substack Article"

    subtitle_tag = soup.find("h3", class_="subtitle")
    subtitle = subtitle_tag.get_text(strip=True) if subtitle_tag else ""

    body = soup.find("div", class_="body") or soup.find("div", class_="post-content") or soup.find("article")
    body_html = str(body) if body else "<p>Could not extract article content.</p>"

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
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
</body></html>"""

    safe_title = re.sub(r'[^\w\s-]', '', title)[:60].strip().replace(' ', '-')
    return html, safe_title or "substack-article"


@substack_bp.route('/convert', methods=['POST'])
def convert_substack():
    data = request.get_json(silent=True)
    if not data or not data.get('url'):
        return jsonify({"error": "Missing 'url' field"}), 400

    url = data['url'].strip()
    if not url.startswith('http'):
        return jsonify({"error": "Invalid URL"}), 400

    try:
        html_content, safe_title = fetch_substack_content(url)
    except requests.RequestException as e:
        return jsonify({"error": f"Failed to fetch article: {str(e)}"}), 502

    tmp_dir = tempfile.mkdtemp()

    # Try pdfkit → weasyprint → fallback to plain text
    try:
        import pdfkit
        filename = f"{safe_title}.pdf"
        output_path = os.path.join(tmp_dir, filename)
        pdfkit.from_string(html_content, output_path, options={'encoding': 'UTF-8', 'quiet': ''})
        return send_file(output_path, as_attachment=True, download_name=filename, mimetype='application/pdf')
    except Exception:
        pass

    try:
        from weasyprint import HTML
        filename = f"{safe_title}.pdf"
        output_path = os.path.join(tmp_dir, filename)
        HTML(string=html_content).write_pdf(output_path)
        return send_file(output_path, as_attachment=True, download_name=filename, mimetype='application/pdf')
    except Exception:
        pass

    # Fallback: extract plain text
    filename = f"{safe_title}.txt"
    output_path = os.path.join(tmp_dir, filename)
    soup = BeautifulSoup(html_content, "html.parser")
    text = soup.get_text(separator="\n\n", strip=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(text)
    return send_file(output_path, as_attachment=True, download_name=filename, mimetype='text/plain')


app.register_blueprint(substack_bp, url_prefix='/api/substack')


@app.route('/health')
def health():
    return {'status': 'ok', 'service': 'MWA Substack Converter'}


if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 5001))
    print(f"Substack converter running on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
