import os
import sys
import tempfile
from pathlib import Path

# Must be set before the app is imported: it connects to the database at import time.
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_tmp) / 'test.db'}"
os.environ["APP_SECRET_KEY"] = "test-secret-key"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from app import auth, models
from app.database import Base, SessionLocal, engine
from app.main import app

KEEP = {"device_types", "interfaces"}  # seeded once at startup
ADMIN_PASSWORD = "Adm1n-pass-long!"


@pytest.fixture(autouse=True)
def clean_db():
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            if table.name not in KEEP:
                conn.execute(table.delete())
    with SessionLocal() as db:
        auth.ensure_guest(db)
    auth._failures.clear()
    yield


@pytest.fixture
def guest():
    """Anonymous client: the backend treats it as the read-only guest."""
    return TestClient(app)


@pytest.fixture
def admin():
    client = TestClient(app)
    assert client.post("/auth/setup-admin", json={"password": ADMIN_PASSWORD}).status_code == 200
    return client


def make_setup(client, name="Lab 1", **extra):
    body = {
        "name": name,
        "devices": [
            {"type": "PC", "name": "pc", "net_interfaces": [{"name": "eth0", "type": "Ethernet", "ip": "10.0.0.5"}]},
            {"type": "Monitor", "name": "mon"},
        ],
        "connections": [{"from_device": "pc", "to_device": "mon", "cable_type": "HDMI"}],
        **extra,
    }
    r = client.post("/setups", json=body)
    assert r.status_code == 200, r.text
    return r.json()
