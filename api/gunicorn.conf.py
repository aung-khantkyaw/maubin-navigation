# Gunicorn configuration file for production deployment
import multiprocessing
import os

# Server socket
bind = f"0.0.0.0:{os.environ.get('PORT', '4000')}"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = 'sync'
worker_connections = 1000
timeout = 120
keepalive = 5

# Restart workers after this many requests to prevent memory leaks
max_requests = 1000
max_requests_jitter = 50

# Logging
accesslog = '-'  # Log to stdout
errorlog = '-'   # Log to stderr
loglevel = 'info'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = 'maubin_navigation_api'

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL (if needed - uncomment and configure)
# keyfile = '/path/to/keyfile'
# certfile = '/path/to/certfile'

# Development vs Production
reload = os.environ.get('FLASK_ENV') == 'development'
preload_app = True

def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info("Starting Maubin Navigation API server...")

def on_reload(server):
    """Called to recycle workers during a reload via SIGHUP."""
    server.log.info("Reloading worker processes...")

def when_ready(server):
    """Called just after the server is started."""
    server.log.info(f"Server is ready. Listening on: {bind}")

def on_exit(server):
    """Called just before exiting."""
    server.log.info("Shutting down Maubin Navigation API server...")
