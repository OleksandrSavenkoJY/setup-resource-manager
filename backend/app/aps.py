import io
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session, selectinload

from . import models
from .auth import get_current_user, require_admin
from .database import get_db

router = APIRouter(tags=["access-points"])

AUTOMATION = ("", "yes", "no", "in_progress")


class APIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    model: str = Field("", max_length=255)
    wifi_standard: str = Field("", max_length=50)
    ip: str = Field("", max_length=64)
    username: str = Field("", max_length=255)
    password: str = Field("", max_length=255)
    automation: str = ""
    setup_id: Optional[int] = None
    location: str = Field("", max_length=255)
    notes: Optional[str] = None

    @field_validator("name", "model", "wifi_standard", "ip", "username", "location", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("automation")
    @classmethod
    def _automation(cls, v):
        if v not in AUTOMATION:
            raise ValueError("automation must be '', 'yes', 'no' or 'in_progress'")
        return v


class SetupLink(BaseModel):
    ids: List[int] = []


def _read(ap: models.AccessPoint, admin: bool) -> dict:
    return {
        "id": ap.id,
        "name": ap.name,
        "model": ap.model,
        "wifi_standard": ap.wifi_standard,
        "ip": ap.ip,
        "username": ap.username if admin else None,
        "password": ap.password if admin else None,
        "automation": ap.automation,
        "setup_id": ap.setup_id,
        "setup_name": ap.setup.name if ap.setup else None,
        "location": ap.location,
        "notes": ap.notes,
        "has_photo": ap.photo is not None,
        "updated_at": ap.updated_at.isoformat() if ap.updated_at else None,
    }


def _query(db: Session):
    return db.query(models.AccessPoint).options(
        selectinload(models.AccessPoint.setup), selectinload(models.AccessPoint.photo)
    )


def _check_setup(db: Session, setup_id: Optional[int]):
    if setup_id is not None and not db.get(models.Setup, setup_id):
        raise HTTPException(status_code=422, detail="Setup not found")


@router.get("/access-points")
def list_access_points(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    rows = _query(db).order_by(models.AccessPoint.id).all()
    return [_read(a, user.role == "admin") for a in rows]


@router.post("/access-points", dependencies=[Depends(require_admin)])
def create_access_point(body: APIn, db: Session = Depends(get_db)):
    _check_setup(db, body.setup_id)
    ap = models.AccessPoint(**body.model_dump())
    db.add(ap)
    db.commit()
    return _read(_query(db).filter(models.AccessPoint.id == ap.id).one(), True)


@router.get("/access-points/{ap_id}")
def get_access_point(ap_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    ap = _query(db).filter(models.AccessPoint.id == ap_id).first()
    if not ap:
        raise HTTPException(status_code=404, detail="Access point not found")
    return _read(ap, user.role == "admin")


@router.put("/access-points/{ap_id}", dependencies=[Depends(require_admin)])
def update_access_point(ap_id: int, body: APIn, db: Session = Depends(get_db)):
    ap = db.get(models.AccessPoint, ap_id)
    if not ap:
        raise HTTPException(status_code=404, detail="Access point not found")
    _check_setup(db, body.setup_id)
    for k, v in body.model_dump().items():
        setattr(ap, k, v)
    db.commit()
    return _read(_query(db).filter(models.AccessPoint.id == ap_id).one(), True)


@router.delete("/access-points/{ap_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_access_point(ap_id: int, db: Session = Depends(get_db)):
    ap = db.get(models.AccessPoint, ap_id)
    if ap:
        db.delete(ap)
        db.commit()
    return Response(status_code=204)


@router.put("/setups/{setup_id}/access-points", dependencies=[Depends(require_admin)])
def set_setup_access_points(setup_id: int, body: SetupLink, db: Session = Depends(get_db)):
    """Make exactly these access points belong to the setup (others that were in it are released)."""
    if not db.get(models.Setup, setup_id):
        raise HTTPException(status_code=404, detail="Setup not found")
    ids = set(body.ids)
    found = {a.id for a in db.query(models.AccessPoint.id).filter(models.AccessPoint.id.in_(ids))} if ids else set()
    if found != ids:
        raise HTTPException(status_code=422, detail="Unknown access point")
    for ap in db.query(models.AccessPoint).filter(models.AccessPoint.setup_id == setup_id).all():
        if ap.id not in ids:
            ap.setup_id = None
    for ap in db.query(models.AccessPoint).filter(models.AccessPoint.id.in_(ids)).all() if ids else []:
        ap.setup_id = setup_id
        ap.location = ""
    db.commit()
    return {"ok": True}


@router.get("/access-points/{ap_id}/photo", dependencies=[Depends(get_current_user)])
def get_ap_photo(ap_id: int, db: Session = Depends(get_db)):
    photo = db.get(models.AccessPointPhoto, ap_id)
    if not photo:
        raise HTTPException(status_code=404, detail="No photo")
    return Response(
        content=photo.data,
        media_type=photo.content_type,
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-cache"},
    )


def _store_photo(db: Session, ap_id: int, raw: bytes):
    from .main import _normalize_photo

    data, content_type = _normalize_photo(raw)
    photo = db.get(models.AccessPointPhoto, ap_id) or models.AccessPointPhoto(ap_id=ap_id)
    photo.data, photo.content_type = data, content_type
    db.add(photo)


@router.put("/access-points/{ap_id}/photo", dependencies=[Depends(require_admin)])
async def put_ap_photo(ap_id: int, request: Request, db: Session = Depends(get_db)):
    from .main import MAX_PHOTO_BYTES, _read_upload

    if not db.get(models.AccessPoint, ap_id):
        raise HTTPException(status_code=404, detail="Access point not found")
    raw = await _read_upload(request, MAX_PHOTO_BYTES, "Photo")
    _store_photo(db, ap_id, raw)
    db.commit()
    return {"ok": True}


@router.delete("/access-points/{ap_id}/photo", status_code=204, dependencies=[Depends(require_admin)])
def delete_ap_photo(ap_id: int, db: Session = Depends(get_db)):
    photo = db.get(models.AccessPointPhoto, ap_id)
    if photo:
        db.delete(photo)
        db.commit()
    return Response(status_code=204)


def _clean(v) -> str:
    s = "" if v is None else str(v).strip()
    return "" if s in ("-", "?") else s


def import_workbook(db: Session, raw: bytes) -> dict:
    """Import the team's APs.xlsx: columns Name, Model, WIFI Standard, IP, Username, Password,
    Automation Support, Photos (embedded pictures), Setup, Notes. Existing APs (same name + IP) are updated."""
    import openpyxl

    try:
        wb = openpyxl.load_workbook(io.BytesIO(raw))
    except Exception:
        raise HTTPException(status_code=422, detail="File is not a valid .xlsx workbook")
    ws = wb.active
    header = {}
    for row in ws.iter_rows(min_row=1, max_row=3):
        for cell in row:
            if isinstance(cell.value, str) and cell.value.strip().lower() == "name":
                header = {str(c.value).strip().lower(): c.column - 1 for c in row if c.value}
                header_row = cell.row
                break
        if header:
            break
    if not header:
        raise HTTPException(status_code=422, detail="Header row with a 'Name' column not found")

    def col(r, name):
        i = header.get(name)
        return r[i] if i is not None and i < len(r) else None

    photos: dict[int, bytes] = {}
    for img in getattr(ws, "_images", []):
        try:
            photos.setdefault(img.anchor._from.row + 1, img._data())
        except Exception:
            continue

    setups = {s.name.strip().lower(): s.id for s in db.query(models.Setup).all()}
    created = updated = 0
    for xl_row, r in enumerate(ws.iter_rows(min_row=header_row + 1, values_only=True), start=header_row + 1):
        name = _clean(col(r, "name"))
        if not name:
            continue
        ip = _clean(col(r, "ip"))
        note = _clean(col(r, "notes"))
        if note.lower() in ("verified", "not working", "no ping"):
            note = ""
        std = _clean(col(r, "wifi standard"))
        std = re.sub(r"(?i)^wifi\s*(\d)", r"WIFI \1", std)
        auto = {"yes": "yes", "no": "no", "in progress": "in_progress", "in_progress": "in_progress"}.get(_clean(col(r, "automation support")).lower(), "")
        place = _clean(col(r, "setup"))
        data = {
            "name": name[:255],
            "model": _clean(col(r, "model"))[:255],
            "wifi_standard": std[:50],
            "ip": ip[:64],
            "username": _clean(col(r, "username"))[:255],
            "password": _clean(col(r, "password"))[:255],
            "automation": auto,
        }
        ap = db.query(models.AccessPoint).filter_by(name=data["name"], ip=data["ip"]).first() if ip else None
        if ap:
            updated += 1
        else:
            ap = models.AccessPoint()
            db.add(ap)
            created += 1
            data["notes"] = note or None
            if place.lower() in setups:
                data["setup_id"] = setups[place.lower()]
            else:
                data["location"] = place[:255]
        for k, v in data.items():
            setattr(ap, k, v)
        db.flush()
        if xl_row in photos and db.get(models.AccessPointPhoto, ap.id) is None:
            try:
                _store_photo(db, ap.id, photos[xl_row])
            except HTTPException:
                pass
    db.commit()
    return {"created": created, "updated": updated}


@router.get("/access-points-export")
def export_access_points(
    passwords: bool = False,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    from openpyxl import Workbook
    from openpyxl.styles import Font

    with_creds = passwords and user.role == "admin"
    wb = Workbook()
    ws = wb.active
    ws.title = "Access points"
    head = ["Photo", "Name", "Model", "WIFI Standard", "IP"] + (["Username", "Password"] if with_creds else []) + ["Automation Support", "Setup", "Notes"]
    ws.append(head)
    for c in ws[1]:
        c.font = Font(bold=True)
    auto = {"yes": "Yes", "no": "No", "in_progress": "In progress"}
    from openpyxl.drawing.image import Image as XlImage
    from openpyxl.styles import Alignment
    from PIL import Image

    for a in _query(db).order_by(models.AccessPoint.id).all():
        ws.append(
            ["", a.name, a.model, a.wifi_standard, a.ip]
            + ([a.username or "", a.password or ""] if with_creds else [])
            + [auto.get(a.automation, "?"), a.setup.name if a.setup else a.location, a.notes or ""]
        )
        row = ws.max_row
        ws.row_dimensions[row].height = 56
        if a.photo:
            try:
                im = Image.open(io.BytesIO(a.photo.data)).convert("RGBA")
                im.thumbnail((72, 72))
                bg = Image.new("RGB", im.size, "white")
                bg.paste(im, mask=im.split()[3])
                out = io.BytesIO()
                bg.save(out, "PNG")
                out.seek(0)
                ws.add_image(XlImage(out), f"A{row}")
            except Exception:
                pass
        for c in ws[row]:
            c.alignment = Alignment(vertical="center", wrap_text=True)
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = (
            12 if col[0].column == 1 else min(40, max(len(str(c.value or "")) for c in col) + 2)
        )
    buf = io.BytesIO()
    wb.save(buf)
    name = "access-points-with-passwords.xlsx" if with_creds else "access-points.xlsx"
    return Response(
        buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.post("/access-points-import", dependencies=[Depends(require_admin)])
async def import_access_points(request: Request, db: Session = Depends(get_db)):
    from .main import _read_upload

    raw = await _read_upload(request, 30 * 1024 * 1024, "Workbook")
    return import_workbook(db, raw)
