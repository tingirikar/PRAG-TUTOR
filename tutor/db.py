import os
from typing import Optional
from dotenv import load_dotenv
import pymongo
from pymongo.database import Database

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))

load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
load_dotenv(os.path.join(BASE_DIR, ".env"))

MONGODB_URI = os.environ.get("MONGODB_URI", "").strip()

_client: Optional[pymongo.MongoClient] = None
_db: Optional[Database] = None


def get_db() -> Optional[Database]:
    """Returns the connected MongoDB Atlas database directly."""
    global _client, _db
    if _db is not None:
        return _db

    uri = MONGODB_URI or "mongodb://127.0.0.1:27017/lpi_tutor"

    try:
        _client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=5000)
        try:
            _db = _client.get_default_database()
        except Exception:
            _db = _client["test"]
        return _db
    except Exception as e:
        print(f"[Warning] Failed to connect to MongoDB Atlas: {e}")
        return None
