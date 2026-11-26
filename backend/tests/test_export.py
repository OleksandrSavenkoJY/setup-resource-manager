import io
import zipfile

from conftest import make_setup


def _names(r):
    return zipfile.ZipFile(io.BytesIO(r.content)).namelist()


def test_single_item_is_not_zipped(admin):
    s = make_setup(admin)
    r = admin.get(f"/export?ids={s['id']}&items=png")
    assert r.status_code == 200 and r.headers["content-type"] == "image/png"
    assert r.content.startswith(b"\x89PNG")
    r = admin.get(f"/export?ids={s['id']}&items=data&scope=setups")
    assert r.status_code == 200 and r.headers["content-disposition"].endswith('.xlsx"')


def test_several_items_and_setups_are_zipped(admin):
    a, b = make_setup(admin, name="A"), make_setup(admin, name="B")
    r = admin.get("/export?items=data,png,drawio&scope=setups")
    names = _names(r)
    assert "setups-setups.xlsx" in names
    assert f"{a['id']}_A/schema.png" in names and f"{b['id']}_B/schema.drawio" in names
    only_one = _names(admin.get(f"/export?ids={a['id']}&items=png,drawio"))
    assert sorted(only_one) == [f"{a['id']}_A_schema.drawio", f"{a['id']}_A_schema.png"]


def test_drawio_is_admin_only_and_errors(admin, guest):
    s = make_setup(admin)
    assert guest.get(f"/export?ids={s['id']}&items=drawio").status_code == 403
    assert guest.get(f"/export?ids={s['id']}&items=png").status_code == 200
    assert admin.get("/export?items=nope").status_code == 422
    assert admin.get("/export?ids=999&items=png").status_code == 404
    assert admin.get(f"/export?ids={s['id']}&items=photo").status_code == 404  # no photo uploaded
