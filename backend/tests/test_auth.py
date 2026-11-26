from conftest import ADMIN_PASSWORD, make_setup


def test_first_run_admin_setup_only_once(guest):
    assert guest.get("/auth/status").json() == {"admin_configured": False}
    assert guest.post("/auth/setup-admin", json={"password": "short"}).status_code == 422
    assert guest.post("/auth/setup-admin", json={"password": ADMIN_PASSWORD}).status_code == 200
    assert guest.post("/auth/setup-admin", json={"password": ADMIN_PASSWORD}).status_code == 409


def test_admin_password_is_stored_hashed(admin):
    from app import models
    from app.database import SessionLocal

    with SessionLocal() as db:
        user = db.query(models.User).filter(models.User.role == "admin").one()
        assert ADMIN_PASSWORD not in user.password_hash


def test_guest_is_read_only(admin, guest):
    setup = make_setup(admin)
    assert guest.get("/auth/me").json()["role"] == "guest"
    assert guest.get(f"/setups/{setup['id']}").status_code == 200
    assert guest.post("/setups", json={"name": "x"}).status_code == 403
    assert guest.put(f"/setups/{setup['id']}", json={"name": "x"}).status_code == 403
    assert guest.delete(f"/setups/{setup['id']}").status_code == 403
    assert guest.get("/trash").status_code == 403


def test_logout_drops_admin_rights(admin):
    assert admin.get("/auth/me").json()["role"] == "admin"
    admin.post("/auth/logout")
    assert admin.get("/auth/me").json()["role"] == "guest"


def test_login_lockout_after_repeated_failures(admin, guest):
    for _ in range(5):
        assert guest.post("/auth/login", json={"username": "admin", "password": "wrong"}).status_code == 401
    r = guest.post("/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    assert r.status_code == 429
    assert "Retry-After" in r.headers
