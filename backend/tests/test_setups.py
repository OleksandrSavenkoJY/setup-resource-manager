from conftest import make_setup


def test_create_read_update_setup(admin):
    s = make_setup(admin, criticality=4, chamber=True, chamber_count=2)
    assert s["criticality"] == 4 and s["chamber_count"] == 2
    assert [d["name"] for d in s["devices"]] == ["pc", "mon"]
    assert s["devices"][0]["net_interfaces"][0]["ip"] == "10.0.0.5"

    r = admin.put(f"/setups/{s['id']}", json={"name": "Renamed", "connections": []})
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Renamed" and body["connections"] == [] and len(body["devices"]) == 2


def test_validation(admin):
    assert admin.post("/setups", json={"name": "x", "criticality": 1}).status_code == 422
    assert admin.post("/setups", json={"name": "x", "criticality": 5}).status_code == 422
    bad_ip = {"type": "PC", "name": "p", "net_interfaces": [{"name": "e", "ip": "999.1.1.1"}]}
    assert admin.post("/setups", json={"name": "x", "devices": [bad_ip]}).status_code == 422
    bad_power = {"type": "PC", "name": "p", "power_from": "ghost"}
    assert admin.post("/setups", json={"name": "x", "devices": [bad_power]}).status_code == 422


def test_mac_is_normalised(admin):
    dev = {"type": "PC", "name": "p", "net_interfaces": [{"name": "e", "mac": "aa-bb-cc-dd-ee-ff"}]}
    s = admin.post("/setups", json={"name": "x", "devices": [dev]}).json()
    assert s["devices"][0]["net_interfaces"][0]["mac"] == "AA:BB:CC:DD:EE:FF"


def test_outlets_follow_power_sources(admin):
    devices = [
        {"type": "PC", "name": "a", "power_from": "__outlet__"},
        {"type": "Monitor", "name": "b", "power_from": "a"},
    ]
    s = admin.post("/setups", json={"name": "x", "devices": devices}).json()
    assert s["outlets_used"] == 1


def test_clone_copies_devices_and_tags(admin):
    s = make_setup(admin, tags=["rf"])
    copy = admin.post(f"/setups/{s['id']}/clone").json()
    assert copy["name"].endswith("(copy)") and copy["tags"] == ["rf"]
    assert len(copy["devices"]) == 2 and len(copy["connections"]) == 1


def test_unknown_setup_is_404(admin):
    assert admin.get("/setups/999").status_code == 404
    assert admin.put("/setups/999", json={"name": "x"}).status_code == 404
    assert admin.delete("/setups/999").status_code == 404
