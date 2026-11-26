from conftest import make_setup


def test_manual_positions_survive_regeneration(admin, guest):
    s = make_setup(admin)
    sid = s["id"]
    d = admin.post(f"/setups/{sid}/diagram", json={}).json()
    nodes = d["layout"]["nodes"]
    assert set(nodes) == {"pc", "mon"} and d["manual"] == []
    assert guest.get(f"/setups/{sid}/diagram").json()["layout"]["nodes"] == nodes

    r = admin.put(f"/setups/{sid}/diagram/layout", json={"positions": {"mon": [700, 400]}})
    assert r.status_code == 200
    d = r.json()
    assert d["layout"]["nodes"]["mon"] == [700.0, 400.0] and d["manual"] == ["mon"]
    assert d["layout"]["width"] >= 700 + d["layout"]["box_w"]

    # A plain "Regenerate" keeps hand-placed devices.
    assert admin.post(f"/setups/{sid}/diagram", json={}).json()["layout"]["nodes"]["mon"] == [700.0, 400.0]

    d = admin.delete(f"/setups/{sid}/diagram/layout").json()
    assert d["manual"] == [] and d["layout"]["nodes"]["mon"] != [700.0, 400.0]


def test_layout_validation_and_permissions(admin, guest):
    sid = make_setup(admin)["id"]
    admin.post(f"/setups/{sid}/diagram", json={})
    url = f"/setups/{sid}/diagram/layout"
    assert guest.put(url, json={"positions": {"pc": [1, 1]}}).status_code == 403
    assert guest.delete(url).status_code == 403
    assert admin.put(url, json={"positions": {"nope": [1, 1]}}).status_code == 422
    assert admin.put(url, json={"positions": {"pc": [-5, 1]}}).status_code == 422
    assert admin.put(url, json={"positions": {"pc": [1]}}).status_code == 422
