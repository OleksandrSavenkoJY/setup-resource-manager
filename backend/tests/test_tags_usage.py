from conftest import make_setup


def test_tags_are_cleaned(admin):
    s = make_setup(admin, tags=["  RF  ", "rf", "lab  1", ""])
    assert s["tags"] == ["RF", "lab 1"]
    s = admin.put(f"/setups/{s['id']}", json={"tags": ["wifi"]}).json()
    assert s["tags"] == ["wifi"]
    # Not sending tags keeps them.
    assert admin.put(f"/setups/{s['id']}", json={"name": "n"}).json()["tags"] == ["wifi"]


def test_tag_limits(admin):
    assert admin.post("/setups", json={"name": "x", "tags": ["a,b"]}).status_code == 422
    assert admin.post("/setups", json={"name": "x", "tags": ["x" * 31]}).status_code == 422
    assert admin.post("/setups", json={"name": "x", "tags": [f"t{i}" for i in range(21)]}).status_code == 422


def test_usage_reserve_and_release(admin, guest):
    s = make_setup(admin)
    assert s["used_by"] == ""
    r = admin.put(f"/setups/{s['id']}/usage", json={"used_by": "Olena", "used_until": "2030-01-31", "usage_note": "WiFi 7 run"})
    assert r.status_code == 200
    assert (r.json()["used_by"], r.json()["used_until"]) == ("Olena", "2030-01-31")
    assert guest.get(f"/setups/{s['id']}").json()["used_by"] == "Olena"
    assert guest.put(f"/setups/{s['id']}/usage", json={"used_by": "me"}).status_code == 403

    r = admin.put(f"/setups/{s['id']}/usage", json={"used_by": "", "used_until": "2030-01-31", "usage_note": "x"})
    assert r.json()["used_by"] == "" and r.json()["used_until"] == "" and r.json()["usage_note"] == ""


def test_usage_date_is_validated(admin):
    s = make_setup(admin)
    assert admin.put(f"/setups/{s['id']}/usage", json={"used_by": "a", "used_until": "31.01.2030"}).status_code == 422


def test_bulk_actions(admin, guest):
    a, b = make_setup(admin, name="a", tags=["x"]), make_setup(admin, name="b")
    ids = [a["id"], b["id"], 99999]
    r = admin.post("/setups/bulk", json={"ids": ids, "action": "add_tag", "tag": "RF"}).json()
    assert r["done"] == 2 and r["missing"] == [99999]
    assert admin.get(f"/setups/{a['id']}").json()["tags"] == ["x", "RF"]
    admin.post("/setups/bulk", json={"ids": ids, "action": "remove_tag", "tag": "rf"})
    assert admin.get(f"/setups/{a['id']}").json()["tags"] == ["x"]

    admin.post("/setups/bulk", json={"ids": ids, "action": "reserve", "used_by": "Olena", "used_until": "2030-01-01"})
    assert admin.get(f"/setups/{b['id']}").json()["used_by"] == "Olena"
    assert admin.post("/setups/bulk", json={"ids": ids, "action": "reserve"}).status_code == 422
    admin.post("/setups/bulk", json={"ids": ids, "action": "release"})
    assert admin.get(f"/setups/{b['id']}").json()["used_by"] == ""

    assert guest.post("/setups/bulk", json={"ids": ids, "action": "delete"}).status_code == 403
    r = admin.post("/setups/bulk", json={"ids": [a["id"], b["id"]], "action": "delete"}).json()
    assert len(r["trash_ids"]) == 2 and admin.get("/setups").json() == []
    assert len(admin.get("/trash").json()) == 2
