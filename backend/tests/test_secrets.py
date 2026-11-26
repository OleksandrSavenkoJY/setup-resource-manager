from sqlalchemy import text

from app import secrets_box
from app.database import engine


def test_ap_password_is_encrypted_at_rest_and_admin_only(admin, guest):
    ap = admin.post("/access-points", json={"name": "ap", "username": "root", "password": "s3cret"}).json()
    assert admin.get(f"/access-points/{ap['id']}").json()["password"] == "s3cret"
    assert guest.get(f"/access-points/{ap['id']}").json()["password"] is None
    assert guest.get(f"/access-points/{ap['id']}").json()["username"] is None
    with engine.connect() as conn:
        raw = conn.execute(text("select password from access_points")).scalar()
    assert raw.startswith("enc1:") and "s3cret" not in raw


def test_legacy_plaintext_is_still_readable():
    assert secrets_box.decrypt("plain") == "plain"
    assert secrets_box.decrypt(secrets_box.encrypt("x")) == "x"
    assert secrets_box.decrypt("enc1:not-a-valid-token") == ""
