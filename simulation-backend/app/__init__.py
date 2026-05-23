"""
MiroFish Backend - Flask Application Factory
"""

import os
import re
import hmac
import warnings

# Suppress multiprocessing resource_tracker warnings (from third-party libs like transformers)
# Must be set before all other imports
warnings.filterwarnings("ignore", message=".*resource_tracker.*")

from flask import Flask, request, jsonify
from flask_cors import CORS

from .config import Config
from .utils.logger import setup_logger, get_logger

# Identifiers are server-generated tokens; reject anything that could escape a
# filesystem path (e.g. "../") since several handlers join these into paths.
_ID_RE = re.compile(r'^[A-Za-z0-9_-]{1,128}$')
_ID_FIELDS = ('simulation_id', 'project_id', 'report_id', 'graph_id', 'task_id')
_PLATFORMS = {'reddit', 'twitter'}


def create_app(config_class=Config):
    """Flask application factory function"""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Set JSON encoding: ensure CJK characters display directly (not as \uXXXX format)
    # Flask >= 2.3 uses app.json.ensure_ascii, older versions use JSON_AS_ASCII config
    if hasattr(app, 'json') and hasattr(app.json, 'ensure_ascii'):
        app.json.ensure_ascii = False

    # Set up logging
    logger = setup_logger('mirofish')

    # Only print startup info in the reloader subprocess (avoid double printing in debug mode)
    is_reloader_process = os.environ.get('WERKZEUG_RUN_MAIN') == 'true'
    debug_mode = app.config.get('DEBUG', False)
    should_log_startup = not debug_mode or is_reloader_process

    if should_log_startup:
        logger.info("=" * 50)
        logger.info("MiroFish Backend starting...")
        logger.info("=" * 50)

    # Enable CORS — restricted to an explicit allowlist (empty by default).
    # The Next.js proxy calls this server-to-server (no browser Origin), so this
    # stays closed unless SIMULATION_ALLOWED_ORIGINS is deliberately set.
    CORS(app, resources={r"/api/*": {"origins": Config.ALLOWED_ORIGINS or []}})

    # Security gate: authenticate the caller and reject path-traversal input.
    # Registered first so it runs before any handler. /health and CORS preflight
    # are exempt so uptime probes and browsers still work.
    @app.before_request
    def _security_guard():
        if request.method == 'OPTIONS' or request.path == '/health':
            return None

        # 1) Caller must present the shared secret (set on the trusted proxy).
        expected = Config.API_SECRET
        if expected:
            provided = request.headers.get('X-Simulation-Secret', '')
            if not hmac.compare_digest(provided, expected):
                return jsonify({"success": False, "error": "Unauthorized"}), 401
        elif not Config.DEBUG:
            # Fail closed: never serve /api/* unauthenticated in a real deploy.
            return jsonify({
                "success": False,
                "error": "Server auth not configured (set SIMULATION_API_SECRET)",
            }), 503

        # 2) Validate identifier + platform params from path, query, and JSON body.
        candidates = {}
        if request.view_args:
            candidates.update(request.view_args)
        candidates.update(request.args.to_dict())
        body = request.get_json(silent=True)
        if isinstance(body, dict):
            candidates.update(body)

        for field in _ID_FIELDS:
            val = candidates.get(field)
            if val is not None and not _ID_RE.match(str(val)):
                return jsonify({"success": False, "error": f"Invalid {field}"}), 400

        platform = candidates.get('platform')
        if platform is not None and str(platform) not in _PLATFORMS:
            return jsonify({"success": False, "error": "Invalid platform"}), 400

        return None

    # Register simulation process cleanup (if OASIS is available)
    try:
        from .services.simulation_runner import SimulationRunner
        if SimulationRunner is not None:
            SimulationRunner.register_cleanup()
            if should_log_startup:
                logger.info("Registered simulation process cleanup")
    except ImportError:
        if should_log_startup:
            logger.warning("OASIS not available — simulation runner disabled (requires Python <3.12)")

    # Request logging middleware
    @app.before_request
    def log_request():
        logger = get_logger('mirofish.request')
        logger.debug(f"Request: {request.method} {request.path}")
        if request.content_type and 'json' in request.content_type:
            logger.debug(f"Request body: {request.get_json(silent=True)}")

    @app.after_request
    def log_response(response):
        logger = get_logger('mirofish.request')
        logger.debug(f"Response: {response.status_code}")
        return response

    # Register blueprints
    from .api import graph_bp, simulation_bp, report_bp, substack_bp
    app.register_blueprint(graph_bp, url_prefix='/api/graph')
    app.register_blueprint(simulation_bp, url_prefix='/api/simulation')
    app.register_blueprint(report_bp, url_prefix='/api/report')
    app.register_blueprint(substack_bp, url_prefix='/api/substack')

    # Health check
    @app.route('/health')
    def health():
        return {'status': 'ok', 'service': 'MiroFish Backend'}

    if should_log_startup:
        logger.info("MiroFish Backend startup complete")

    return app
