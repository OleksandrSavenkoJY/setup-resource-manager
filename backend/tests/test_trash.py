import io

from PIL import Image

from conftest import make_setup


def _png():
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), "red").save(buf, "PNG")
    return buf.getvalue()


def test_delete_goes_to_trash_and_restores_everything(admin):
    s = make_setup(admin, tags=["rf"])
    sid = s["id"]
    assert admin.put(f"/setups/{sid}/photo", content=_png()).status_code == 200
    admin.put(f"/setups/{sid}/usage", json={"used_by": "Olena"})
    ap = admin.post("/access-points", json={"name": "ap1", "setup_id": sid}).json()

    deleted = admin.delete(f"/setups/{sid}").json()
    assert deleted["deleted"] is True
    assert admin.get(f"/setups/{sid}").status_code == 404
    assert admin.get("/setups").json() == []

    trash = admin.get("/trash").json()
    assert len(trash) == 1
    assert trash[0]["name"] == "Lab 1" and trash[0]["devices"] == 2 and trash[0]["has_photo"] is True

    restored = admin.post(f"/trash/{deleted['trash_id']}/restore").json()
    assert restored["name"] == "Lab 1" and restored["tags"] == ["rf"] and restored["used_by"] == "Olena"
    assert len(restored["devices"]) == 2 and len(restored["connections"]) == 1
    assert restored["devices"][0]["net_interfaces"][0]["ip"] == "10.0.0.5"
    assert admin.get(f"/setups/{restored['id']}/photo").status_code == 200
    assert admin.get(f"/access-points/{ap['id']}").json()["setup_id"] == restored["id"]
    assert admin.get("/trash").json() == []


def test_purge_one_and_empty_trash(admin):
    ids = [admin.delete(f"/setups/{make_setup(admin, name=f'S{i}')['id']}").json()["trash_id"] for i in range(3)]
    assert admin.delete(f"/trash/{ids[0]}").status_code == 204
    assert len(admin.get("/trash").json()) == 2
    assert admin.delete("/trash").status_code == 204
    assert admin.get("/trash").json() == []
    assert admin.post(f"/trash/{ids[1]}/restore").status_code == 404


def test_expired_entries_are_purged(admin):
    from datetime import datetime, timedelta

    from app import models
    from app.database import SessionLocal

    admin.delete(f"/setups/{make_setup(admin)['id']}")
    with SessionLocal() as db:
        db.query(models.DeletedSetup).update({"deleted_at": datetime.utcnow() - timedelta(days=365)})
        db.commit()
    assert admin.get("/trash").json() == []
