#!/usr/bin/env python3
"""
Supabase Database Keep-Alive & Health Check Script
=================================================
Automated activity monitoring system designed to verify connectivity,
measure latency, and perform lightweight read-only queries against Supabase
PostgreSQL databases to prevent inactivity-related pausing on free tiers.

Features:
- Pure read-only operation (SELECT 1). Zero risk of data mutation.
- Automatic credential resolution (DATABASE_URL, backend/.env, individual PG envs).
- Strict credential masking to prevent password leakage in logs and CI summaries.
- Configurable connection timeouts and graceful error handling.
- Exit code 0 for healthy, 1 for errors (CI/CD friendly).
"""

import sys
import os
import time
import argparse
import json
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse, urlunparse

# Optional dotenv support for local environments
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

# Configure logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("supabase_keepalive")


def mask_database_url(url: str) -> str:
    """
    Safely masks user passwords in database connection strings.
    Example:
            """
    if not url:
        return "<empty>"
    try:
        parsed = urlparse(url)
        if parsed.password:
            netloc = f"{parsed.username}:***@{parsed.hostname}"
            if parsed.port:
                netloc += f":{parsed.port}"
            return urlunparse((
                parsed.scheme,
                netloc,
                parsed.path,
                parsed.params,
                parsed.query,
                parsed.fragment
            ))
        return url
    except Exception:
        # Fallback regex-style replacement if parsing fails
        import re
        return re.sub(r":([^@/]+)@", ":***@", url)


def resolve_database_url() -> tuple[str, str]:
    """
    Resolves the database URL from environment variables or .env files.
    Returns:
        tuple[url, source_description]
    """
    # 1. Check existing environment variable
    env_keys = ["DATABASE_URL", "SUPABASE_DATABASE_URL", "SUPABASE_DB_URL"]
    for key in env_keys:
        val = os.getenv(key)
        if val and val.strip():
            return val.strip(), f"environment variable ({key})"

    # 2. Try loading from .env files if dotenv is available
    if load_dotenv:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)
        candidates = [
            os.path.join(project_root, "backend", ".env"),
            os.path.join(project_root, ".env"),
            os.path.join(os.getcwd(), "backend", ".env"),
            os.path.join(os.getcwd(), ".env"),
        ]
        for path in candidates:
            if os.path.exists(path):
                load_dotenv(path)
                for key in env_keys:
                    val = os.getenv(key)
                    if val and val.strip():
                        return val.strip(), f".env file ({os.path.basename(path)})"

    # 3. Check individual PG variables
    pg_user = os.getenv("SUPABASE_DB_USER") or os.getenv("PGUSER") or os.getenv("user")
    pg_pass = os.getenv("SUPABASE_DB_PASSWORD") or os.getenv("PGPASSWORD")
    pg_host = os.getenv("SUPABASE_DB_HOST") or os.getenv("PGHOST") or os.getenv("host")
    pg_port = os.getenv("SUPABASE_DB_PORT") or os.getenv("PGPORT") or os.getenv("port", "5432")
    pg_name = os.getenv("SUPABASE_DB_NAME") or os.getenv("PGDATABASE") or os.getenv("database", "postgres")

    if pg_user and pg_pass and pg_host:
        constructed = f"postgresql://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_name}"
        return constructed, "individual connection variables"

    return "", "not found"


def normalize_sqlalchemy_url(raw_url: str) -> str:
    """
    Ensures URL has standard SQLAlchemy postgresql driver prefix.
    """
    url = raw_url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def run_database_health_check(db_url: str, timeout_sec: int = 15) -> dict:
    """
    Connects to PostgreSQL using SQLAlchemy with timeout and executes SELECT 1.
    Returns a dictionary of execution metrics.
    """
    from sqlalchemy import create_engine, text

    norm_url = normalize_sqlalchemy_url(db_url)
    masked_target = mask_database_url(db_url)

    engine_args = {
        "connect_args": {
            "connect_timeout": timeout_sec
        },
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    start_time = time.perf_counter()
    connect_latency_ms = None
    query_latency_ms = None

    try:
        engine = create_engine(norm_url, **engine_args)
        
        t0 = time.perf_counter()
        with engine.connect() as conn:
            connect_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            
            t1 = time.perf_counter()
            result = conn.execute(
                text("SELECT 1 AS alive, current_timestamp AS server_time, version() AS pg_version")
            ).mappings().first()
            query_latency_ms = round((time.perf_counter() - t1) * 1000, 2)

        total_latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        server_time_str = str(result["server_time"]) if result and "server_time" in result else None
        pg_version = str(result["pg_version"]).split()[0:2] if result and "pg_version" in result else []
        version_summary = " ".join(pg_version) if pg_version else "PostgreSQL"

        return {
            "status": "healthy",
            "alive": True,
            "target": masked_target,
            "server_time": server_time_str,
            "pg_version": version_summary,
            "connect_latency_ms": connect_latency_ms,
            "query_latency_ms": query_latency_ms,
            "total_latency_ms": total_latency_ms,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "error": None
        }

    except Exception as exc:
        total_latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        # Clean error message to avoid printing any credentials
        err_msg = str(exc)
        # Mask any occurrences of passwords that might appear in driver error messages
        parsed = urlparse(db_url)
        if parsed.password and parsed.password in err_msg:
            err_msg = err_msg.replace(parsed.password, "***")

        return {
            "status": "unhealthy",
            "alive": False,
            "target": masked_target,
            "server_time": None,
            "pg_version": None,
            "connect_latency_ms": connect_latency_ms,
            "query_latency_ms": None,
            "total_latency_ms": total_latency_ms,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "error": err_msg
        }


def main():
    parser = argparse.ArgumentParser(
        description="Automated Supabase database activity keep-alive and health check."
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=15,
        help="Database connection timeout in seconds (default: 15)"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results strictly in JSON format (useful for CI/CD and automation scripts)"
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress informational stdout output except errors"
    )
    args = parser.parse_args()

    if args.quiet:
        logger.setLevel(logging.ERROR)

    # 1. Resolve connection string
    db_url, source = resolve_database_url()

    if not db_url:
        err_payload = {
            "status": "failed",
            "alive": False,
            "target": None,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "error": (
                "Missing database connection URL. Please set DATABASE_URL or "
                "configure backend/.env with valid Supabase PostgreSQL credentials."
            )
        }
        if args.json:
            print(json.dumps(err_payload, indent=2))
        else:
            logger.error("❌ %s", err_payload["error"])
        sys.exit(1)

    masked_url = mask_database_url(db_url)
    if not args.json and not args.quiet:
        logger.info("Initiating Supabase Keep-Alive Health Check...")
        logger.info("Target: %s (resolved from %s)", masked_url, source)
        logger.info("Timeout: %d seconds", args.timeout)

    # 2. Execute lightweight read-only query
    result = run_database_health_check(db_url, timeout_sec=args.timeout)

    # 3. Output results
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        if result["status"] == "healthy":
            logger.info("✅ Supabase database is REACHABLE and ACTIVE!")
            logger.info("Server Time: %s", result["server_time"])
            logger.info("Engine: %s", result["pg_version"])
            logger.info(
                "Latency: Connect %sms | Query %sms | Total %sms",
                result["connect_latency_ms"],
                result["query_latency_ms"],
                result["total_latency_ms"]
            )
        else:
            logger.error("❌ Supabase database health check FAILED!")
            logger.error("Target: %s", result["target"])
            logger.error("Duration: %sms", result["total_latency_ms"])
            logger.error("Error Detail: %s", result["error"])

    # 4. Exit code
    sys.exit(0 if result["status"] == "healthy" else 1)


if __name__ == "__main__":
    main()
