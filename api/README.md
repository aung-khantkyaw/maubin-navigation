# Maubin Navigation API Server

Backend API for the Maubin Navigation application - a geospatial routing and navigation system.

## Quick Start

### Development
```bash
# Windows
dev.bat

# Linux/Mac
chmod +x dev.sh
./dev.sh
```

### Production (Linux/Mac/Render Only)
```bash
# Linux/Mac
chmod +x start.sh
./start.sh

# On Render - automatic via render.yaml
```

**⚠️ Note:** Gunicorn requires a Unix-based system. For Windows production:
- Deploy to Render.com (recommended)
- Use WSL (Windows Subsystem for Linux)
- Use Docker with Linux container

## Environment Setup

Create a `.env` file with:
```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-here
ORIGIN=http://localhost:5173
FLASK_ENV=development
PORT=4000
```

## Commands

| Command | Environment | Description |
|---------|-------------|-------------|
| `dev.bat` / `dev.sh` | Development | Start with hot reload |
| `start.sh` | Production (Linux/Mac) | Start with Gunicorn |
| `python app.py` | Development | Run directly |
| `gunicorn -c gunicorn.conf.py app:app` | Production | Run Gunicorn manually |

**Note:** `start.bat` on Windows will show a warning - use `dev.bat` for local development or deploy to Linux.

## Project Structure

```
server/
├── app.py                    # Main application
├── gunicorn.conf.py         # Production server configuration
├── requirements.txt         # Python dependencies
├── .env                     # Environment variables (create this)
├── dev.bat / dev.sh        # Development startup scripts
├── start.bat / start.sh    # Production startup scripts
├── uploads/                 # Uploaded images
└── migrations/              # Database migrations
```

## Tech Stack

- **Framework**: Flask 3.0+
- **WSGI Server**: Gunicorn (production)
- **Database**: PostgreSQL with PostGIS
- **Authentication**: JWT (Flask-JWT-Extended)
- **CORS**: Flask-CORS
- **Geospatial**: GeoPy, PostGIS

## API Documentation

See [PRODUCTION_DEPLOYMENT.md](../PRODUCTION_DEPLOYMENT.md) for full deployment guide.

## Development

1. Install dependencies: `pip install -r requirements.txt`
2. Set up database (see migrations/)
3. Configure `.env` file
4. Run: `python app.py`

## Production Deployment

See [PRODUCTION_DEPLOYMENT.md](../PRODUCTION_DEPLOYMENT.md) for complete production deployment instructions.
