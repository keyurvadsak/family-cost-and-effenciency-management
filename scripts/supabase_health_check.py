#!/usr/bin/env python3
"""
Supabase Database Live Keep-Alive & Health Check Script.

Periodically sends a lightweight request to the live deployment and/or Supabase database.
This helps prevent inactivity pausing on free tier instances.

DISCLAIMER:
This can help prevent inactivity, but it is not a guaranteed way to prevent pausing.
Do not rely on this for production availability.

SECURITY:
- No database credentials, usernames, or passwords are hardcoded or exposed publicly.
- Credentials are read securely from environment variables / backend/.env (when available).
- Live health check can run against the public live API without needing any database credentials.
- All logs and outputs mask sensitive details.
"""

import os
import sys
import time
import json
import urllib.request
import urllib.error
import argparse
import datetime
from pathlib import Path
from dotenv import load_dotenv

# Locate environment file safely (if running locally or in container with .env)
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
ENV_PATHS = [
    PROJECT_ROOT / "backend" / ".env",
    PROJECT_ROOT / ".env",
    Path(".env")
]

for p in ENV_PATHS:
    if p.exists():
        load_dotenv(p, override=False)
        break

LOG_FILE = SCRIPT_DIR / "supabase_health.log"


def log_event(message: str):
    """Safely append to local log file."""
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(message + "\n")
    except Exception:
        pass


def get_sanitized_target(db_url: str) -> str:
    """Extract host without exposing passwords or usernames."""
    try:
        if "@" in db_url:
            host_part = db_url.split("@")[-1].split("/")[0]
            return f"postgresql://***:***@{host_part}"
        return "configured database"
    except Exception:
        return "configured database"


def ping_live_url(url: str, as_json: bool = False, timeout: int = 30) -> bool:
    """
    Pings the live backend health endpoint.
    The live backend securely runs a query against Supabase, keeping both alive.
    Zero database credentials are required from the caller!
    """
    timestamp_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    start_time = time.time()

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Supabase-Live-KeepAlive/1.0",
                "Accept": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            data = json.loads(resp.read().decode())

            status = data.get("status", "unknown")
            db_status = data.get("database", "unknown")
            db_latency = data.get("latency_ms", "N/A")

            if resp.status == 200 and status == "ok":
                if as_json:
                    print(json.dumps({
                        "mode": "live_endpoint",
                        "status": "healthy",
                        "alive": True,
                        "url": url,
                        "database_status": db_status,
                        "db_latency_ms": db_latency,
                        "total_latency_ms": elapsed_ms,
                        "timestamp": timestamp_str
                    }))
                else:
                    msg = f"[{timestamp_str}] SUCCESS: Live endpoint pinged ({url}) - DB Status: {db_status} ({db_latency}ms) - Total: {elapsed_ms}ms"
                    print(msg)
                log_event(f"[{timestamp_str}] SUCCESS: Live endpoint pinged ({url}) - DB: {db_status}")
                return True
            else:
                msg = f"[{timestamp_str}] WARNING: Unexpected live response: {data}"
                if as_json:
                    print(json.dumps({"mode": "live_endpoint", "status": "warning", "response": data, "timestamp": timestamp_str}))
                else:
                    print(msg)
                log_event(msg)
                return False

    except Exception as e:
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        msg = f"[{timestamp_str}] ERROR: Failed to reach live health endpoint ({url}): {e} ({elapsed_ms}ms)"
        if as_json:
            print(json.dumps({"mode": "live_endpoint", "status": "error", "error": str(e), "timestamp": timestamp_str}))
        else:
            print(msg, file=sys.stderr)
        log_event(msg)
        return False


def ping_supabase(as_json: bool = False, timeout: int = 15) -> bool:
    """Executes a direct lightweight SELECT 1 query against the database pooler."""
    raw_url = os.getenv("DATABASE_URL")
    timestamp_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if not raw_url:
        msg = f"[{timestamp_str}] NOTE: DATABASE_URL not provided (skipping direct pooler ping)."
        if not as_json:
            print(msg)
        return False

    db_url = raw_url
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    target_info = get_sanitized_target(raw_url)

    try:
        from sqlalchemy import create_engine, text

        engine = create_engine(
            db_url,
            connect_args={"connect_timeout": timeout},
            pool_pre_ping=True
        )

        start_time = time.time()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 AS alive, current_timestamp AS server_time, version() AS pg_version")).first()
        elapsed_ms = round((time.time() - start_time) * 1000, 2)

        alive_val = result[0] if result else 0
        server_time = str(result[1]) if result and len(result) > 1 else ""
        pg_version = str(result[2]).split(",")[0] if result and len(result) > 2 else "PostgreSQL"

        if alive_val == 1:
            if as_json:
                print(json.dumps({
                    "mode": "direct_database",
                    "status": "healthy",
                    "alive": True,
                    "target": target_info,
                    "server_time": server_time,
                    "pg_version": pg_version,
                    "latency_ms": elapsed_ms,
                    "timestamp": timestamp_str
                }))
            else:
                msg = f"[{timestamp_str}] SUCCESS: Direct ping to Supabase ({target_info}) - Latency: {elapsed_ms}ms"
                print(msg)
            log_event(f"[{timestamp_str}] SUCCESS: Direct ping ({target_info}) - Latency: {elapsed_ms}ms")
            return True
        else:
            msg = f"[{timestamp_str}] WARNING: Unexpected query response: {result}"
            if as_json:
                print(json.dumps({"mode": "direct_database", "status": "warning", "response": str(result), "timestamp": timestamp_str}))
            else:
                print(msg)
            log_event(msg)
            return False

    except Exception as e:
        clean_err = f"{type(e).__name__}: {e}"
        if raw_url and raw_url in clean_err:
            clean_err = clean_err.replace(raw_url, "[REDACTED_DATABASE_URL]")
        msg = f"[{timestamp_str}] ERROR: Failed direct connection to Supabase: {clean_err}"

        if as_json:
            print(json.dumps({"mode": "direct_database", "status": "error", "error": clean_err, "timestamp": timestamp_str}))
        else:
            print(msg, file=sys.stderr)
        log_event(msg)
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Supabase Live Keep-Alive & Health Check")
    parser.add_argument(
        "--live-url",
        type=str,
        default=os.getenv("LIVE_HEALTH_URL", "https://family-cost-and-effenciency-management.onrender.com/health"),
        help="URL of the live deployment health endpoint"
    )
    parser.add_argument(
        "--no-live",
        action="store_true",
        help="Skip pinging the live health URL"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output in JSON format"
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=30,
        help="Timeout in seconds"
    )

    args = parser.parse_args()

    live_ok = False
    direct_ok = False

    # 1. Ping Live Deployment (No credentials needed from caller)
    if not args.no_live and args.live_url:
        live_ok = ping_live_url(args.live_url, as_json=args.json, timeout=args.timeout)

    # 2. Ping Direct Database (if DATABASE_URL is available)
    if os.getenv("DATABASE_URL"):
        direct_ok = ping_supabase(as_json=args.json, timeout=min(args.timeout, 15))

    # Succeed if either live endpoint or direct database connection succeeded
    success = live_ok or direct_ok
    sys.exit(0 if success else 1)
