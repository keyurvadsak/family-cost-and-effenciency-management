import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Load environmental variables from .env (check backend/.env first)
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

# Retrieve DATABASE_URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# Render / Supabase / Heroku postgresql driver normalization
# Handle postgres://, postgresql://, and postgresql+psycopg:// gracefully
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql+psycopg://"):
    try:
        import psycopg  # noqa: F401
    except ImportError:
        DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

is_render = os.getenv("RENDER", "").lower() in ("true", "1")
connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}
elif not is_render:
    connect_args = {"connect_timeout": 3}

try:
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
    if not is_render and "sqlite" not in DATABASE_URL:
        # Quick non-blocking probe for local dev
        with engine.connect() as probe:
            pass
except Exception as e:
    if not is_render:
        print(f"Warning: Primary database connection failed ({e}). Falling back to local SQLite finance.db for development.")
        DATABASE_URL = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'finance.db')}"
        connect_args = {"check_same_thread": False}
        engine = create_engine(DATABASE_URL, connect_args=connect_args)
    else:
        raise e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency for retrieving DB session in FastAPI path operations
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
