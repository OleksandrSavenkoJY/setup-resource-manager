import io
import os

from fastapi import FastAPI, Depends, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session, selectinload
from .database import Base, SessionLocal, engine, get_db
from . import models, schemas, crud, auth, aps
from .auth import get_current_user, require_admin
from .prompt import generate_prompt
from .netdiagram import build_network_svg
from .diagram import ICON_LABELS, LAYOUT_VERSION, _prepare, build_drawio, build_svg, icon_catalog, icon_kind
from . import export as exporter

Base.metadata.create_all(bind=engine)

# create_all does not add columns to existing tables.
with engine.begin() as _conn:
    _cols = {c["name"] for c in inspect(_conn).get_columns("setups")}
    if "chamber_count" not in _cols:
        _conn.execute(text("ALTER TABLE setups ADD COLUMN chamber_count INTEGER NOT NULL DEFAULT 0"))
        _conn.execute(text("UPDATE setups SET chamber_count = 1 WHERE chamber"))
    if "criticality" not in _cols:
        _conn.execute(text("ALTER TABLE setups ADD COLUMN criticality INTEGER NOT NULL DEFAULT 3"))

with engine.begin() as _conn:
    if "icon" not in {c["name"] for c in inspect(_conn).get_columns("device_types")}:
        _conn.execute(text("ALTER TABLE device_types ADD COLUMN icon VARCHAR(30) NOT NULL DEFAULT ''"))
    _setup_cols = {c["name"] for c in inspect(_conn).get_columns("setups")}
    for _col in ("map_x", "map_y"):
        if _col not in _setup_cols:
            _conn.execute(text(f"ALTER TABLE setups ADD COLUMN {_col} DOUBLE PRECISION"))
    if "radio_mode" not in {c["name"] for c in inspect(_conn).get_columns("connections")}:
        _conn.execute(text("ALTER TABLE connections ADD COLUMN radio_mode VARCHAR(10) NOT NULL DEFAULT ''"))
    if "powers" not in {c["name"] for c in inspect(_conn).get_columns("connections")}:
        _conn.execute(text("ALTER TABLE connections ADD COLUMN powers VARCHAR(4) NOT NULL DEFAULT ''"))
    if "power_from" not in {c["name"] for c in inspect(_conn).get_columns("devices")}:
        _conn.execute(text("ALTER TABLE devices ADD COLUMN power_from VARCHAR(255) NOT NULL DEFAULT ''"))

    if "pfa_ip" not in {c["name"] for c in inspect(_conn).get_columns("devices")}:
        _conn.execute(text("ALTER TABLE devices ADD COLUMN pfa_ip VARCHAR(64) NOT NULL DEFAULT ''"))

# The removed "power only" cable option must not break reading setups that used it.
with engine.begin() as _conn:
    _conn.execute(text("UPDATE connections SET powers = 'from' WHERE powers = 'pfrom'"))
    _conn.execute(text("UPDATE connections SET powers = 'to' WHERE powers = 'pto'"))

if engine.dialect.name == "postgresql":
    with engine.begin() as _conn:
        _conn.execute(text("ALTER TABLE access_points ALTER COLUMN automation TYPE VARCHAR(20)"))

DEFAULT_DEVICE_TYPES = ["PC", "Laptop", "Monitor", "UPS", "Board", "Chip", "Raspberry Pi", "Relay", "Antenna", "Attenuator", "3rd party AP"]

DEFAULT_INTERFACES = ["Ethernet", "USB", "HDMI", "DisplayPort", "Power", "UART", "SPI", "I2C", "Serial", "CAN", "GPIO", "Wi-Fi", "BLE", "Bluetooth", "Matter", "Thread", "Zigbee", "Other"]

with SessionLocal() as _db:
    auth.ensure_guest(_db)
    # Defaults are seeded only into empty tables so admin deletions persist across restarts.
    if not _db.query(models.InterfaceType).first():
        _used = {p for c in _db.query(models.Connection).all() for p in (c.from_port, c.to_port) if p}
        for _name in DEFAULT_INTERFACES + sorted(_used - set(DEFAULT_INTERFACES)):
            _db.add(models.InterfaceType(name=_name))
    # Existing databases only know Wi-Fi as a radio interface: add the other common ones once.
    _names = {i.name.lower() for i in _db.query(models.InterfaceType).all()}
    if "wi-fi" in _names and not _names & {"ble", "bluetooth", "matter", "thread", "zigbee"}:
        for _name in ("BLE", "Bluetooth", "Matter", "Thread", "Zigbee"):
            _db.add(models.InterfaceType(name=_name))
    if not _db.query(models.DeviceType).first():
        for _name in DEFAULT_DEVICE_TYPES:
            _db.add(models.DeviceType(name=_name))
    _db.flush()
    if not any(__import__("re").match(r"^3[\s-]*rd[\s-]*party[\s-]*(ap|access point|router)s?$", t.name.strip(), __import__("re").I) for t in _db.query(models.DeviceType).all()):
        _db.add(models.DeviceType(name="3rd party AP"))
    # Legacy lowercase types from the old hard-coded list map to the new ones.
    for _old, _new in {"computer": "PC", "laptop": "Laptop", "monitor": "Monitor", "ups": "UPS"}.items():
        _db.query(models.Device).filter(models.Device.type == _old).update({"type": _new})
    _db.commit()

app = FastAPI(title="Setup Resource Manager API")

# The browser only talks to the frontend /api proxy; keep direct CORS narrow.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(aps.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/setups", response_model=schemas.SetupRead, dependencies=[Depends(require_admin)])
def create_setup(setup_in: schemas.SetupCreate, db: Session = Depends(get_db)):
    return crud.create_setup(db, setup_in)


@app.get("/setups", response_model=list[schemas.SetupRead], dependencies=[Depends(get_current_user)])
def list_setups(db: Session = Depends(get_db)):
    return (
        db.query(models.Setup)
        .options(selectinload(models.Setup.devices), selectinload(models.Setup.connections), selectinload(models.Setup.access_points))
        .order_by(models.Setup.id.desc())
        .all()
    )


@app.get("/setups/{setup_id}", response_model=schemas.SetupRead, dependencies=[Depends(get_current_user)])
def get_setup(setup_id: int, db: Session = Depends(get_db)):
    setup = (
        db.query(models.Setup)
        .options(selectinload(models.Setup.devices), selectinload(models.Setup.connections), selectinload(models.Setup.access_points))
        .filter(models.Setup.id == setup_id)
        .first()
    )
    if not setup:
        raise HTTPException(status_code=404, detail="Setup not found")
    return setup


@app.put("/setups/{setup_id}", response_model=schemas.SetupRead, dependencies=[Depends(require_admin)])
def update_setup(setup_id: int, setup_in: schemas.SetupUpdate, db: Session = Depends(get_db)):
    setup = crud.update_setup(db, setup_id, setup_in)
    if not setup:
        raise HTTPException(status_code=404, detail="Setup not found")
    return get_setup(setup_id, db)


@app.delete("/setups/{setup_id}", dependencies=[Depends(require_admin)])
def delete_setup(setup_id: int, db: Session = Depends(get_db)):
    setup = crud.delete_setup(db, setup_id)
    if not setup:
        raise HTTPException(status_code=404, detail="Setup not found")
    return {"deleted": True, "id": setup_id}


@app.post("/setups/{setup_id}/clone", response_model=schemas.SetupRead, dependencies=[Depends(require_admin)])
def clone_setup(setup_id: int, db: Session = Depends(get_db)):
    src = (
        db.query(models.Setup)
        .options(selectinload(models.Setup.devices), selectinload(models.Setup.connections))
        .filter(models.Setup.id == setup_id)
        .first()
    )
    if not src:
        raise HTTPException(status_code=404, detail="Setup not found")
    copy = models.Setup(
        name=f"{src.name} (copy)"[:255],
        description=src.description,
        chamber=src.chamber,
        outlets_used=src.outlets_used,
        chamber_count=src.chamber_count,
        criticality=src.criticality,
        devices=[
            models.Device(
                type=d.type, name=d.name, location=d.location, notes=d.notes,
                power_from=d.power_from, pfa_ip=d.pfa_ip,
                net_interfaces=[
                    models.NetInterface(name=n.name, type=n.type, ip=n.ip, mac=n.mac)
                    for n in d.net_interfaces
                ],
            )
            for d in src.devices
        ],
        connections=[
            models.Connection(
                from_device=c.from_device, from_port=c.from_port, to_device=c.to_device,
                to_port=c.to_port, cable_type=c.cable_type, notes=c.notes, powers=c.powers, radio_mode=c.radio_mode,
            )
            for c in src.connections
        ],
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return copy


@app.get("/setups/{setup_id}/prompt", dependencies=[Depends(require_admin)])
def get_prompt(setup_id: int, db: Session = Depends(get_db)):
    setup = (
        db.query(models.Setup)
        .options(selectinload(models.Setup.devices), selectinload(models.Setup.connections))
        .filter(models.Setup.id == setup_id)
        .first()
    )
    if not setup:
        raise HTTPException(status_code=404, detail="Setup not found")
    return {"prompt": generate_prompt(setup)}


MAX_PHOTO_BYTES = 10 * 1024 * 1024
MAX_PHOTO_SIDE = 2400


def _normalize_photo(raw: bytes) -> tuple[bytes, str]:
    """Validate the upload and re-encode it, which drops EXIF/GPS data and any non-image payload."""
    from PIL import Image, ImageOps

    Image.MAX_IMAGE_PIXELS = 40_000_000
    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)
        img.load()
    except Exception:
        raise HTTPException(status_code=422, detail="File is not a supported image (use JPEG, PNG, WebP or GIF)")
    img.thumbnail((MAX_PHOTO_SIDE, MAX_PHOTO_SIDE))
    out = io.BytesIO()
    if img.mode in ("RGBA", "LA", "P"):
        img.convert("RGBA").save(out, "PNG", optimize=True)
        return out.getvalue(), "image/png"
    img.convert("RGB").save(out, "JPEG", quality=88, optimize=True)
    return out.getvalue(), "image/jpeg"


@app.get("/setups/{setup_id}/photo", dependencies=[Depends(get_current_user)])
def get_photo(setup_id: int, db: Session = Depends(get_db)):
    photo = db.get(models.SetupPhoto, setup_id)
    if not photo:
        raise HTTPException(status_code=404, detail="No photo")
    return Response(
        content=photo.data,
        media_type=photo.content_type,
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-cache"},
    )


@app.put("/setups/{setup_id}/photo", dependencies=[Depends(require_admin)])
async def put_photo(setup_id: int, request: Request, db: Session = Depends(get_db)):
    if not db.get(models.Setup, setup_id):
        raise HTTPException(status_code=404, detail="Setup not found")
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photo is larger than 10 MB")
    raw = b""
    async for chunk in request.stream():
        raw += chunk
        if len(raw) > MAX_PHOTO_BYTES:
            raise HTTPException(status_code=413, detail="Photo is larger than 10 MB")
    if not raw:
        raise HTTPException(status_code=422, detail="Empty file")
    data, content_type = _normalize_photo(raw)
    photo = db.get(models.SetupPhoto, setup_id) or models.SetupPhoto(setup_id=setup_id)
    photo.data, photo.content_type = data, content_type
    db.add(photo)
    db.commit()
    return {"ok": True}


@app.delete("/setups/{setup_id}/photo", status_code=204, dependencies=[Depends(require_admin)])
def delete_photo(setup_id: int, db: Session = Depends(get_db)):
    photo = db.get(models.SetupPhoto, setup_id)
    if photo:
        db.delete(photo)
        db.commit()
    return Response(status_code=204)


async def _read_upload(request: Request, limit: int, label: str) -> bytes:
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit:
        raise HTTPException(status_code=413, detail=f"{label} is larger than 10 MB")
    raw = b""
    async for chunk in request.stream():
        raw += chunk
        if len(raw) > limit:
            raise HTTPException(status_code=413, detail=f"{label} is larger than 10 MB")
    if not raw:
        raise HTTPException(status_code=422, detail="Empty file")
    return raw


@app.get("/setups/{setup_id}/network-diagram", dependencies=[Depends(get_current_user)])
def network_diagram(setup_id: int, db: Session = Depends(get_db)):
    setup = _load_setups(db, setup_id)
    return {"svg": build_network_svg(setup)}


@app.get("/office-map", dependencies=[Depends(get_current_user)])
def get_office_map(db: Session = Depends(get_db)):
    office = db.get(models.OfficeMap, 1)
    if not office:
        raise HTTPException(status_code=404, detail="No office map")
    return Response(
        content=office.data,
        media_type=office.content_type,
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-cache"},
    )


@app.put("/office-map", dependencies=[Depends(require_admin)])
async def put_office_map(request: Request, db: Session = Depends(get_db)):
    raw = await _read_upload(request, MAX_PHOTO_BYTES, "Map")
    data, content_type = _normalize_photo(raw)
    office = db.get(models.OfficeMap, 1) or models.OfficeMap(id=1)
    office.data, office.content_type = data, content_type
    db.add(office)
    db.commit()
    return {"ok": True}


@app.delete("/office-map", status_code=204, dependencies=[Depends(require_admin)])
def delete_office_map(db: Session = Depends(get_db)):
    office = db.get(models.OfficeMap, 1)
    if office:
        db.delete(office)
    # Markers are meaningless without their map.
    db.query(models.Setup).update({models.Setup.map_x: None, models.Setup.map_y: None})
    db.commit()
    return Response(status_code=204)


@app.put("/setups/{setup_id}/location", response_model=schemas.SetupRead, dependencies=[Depends(require_admin)])
def put_location(setup_id: int, loc: schemas.LocationUpdate, db: Session = Depends(get_db)):
    setup = db.get(models.Setup, setup_id)
    if not setup:
        raise HTTPException(status_code=404, detail="Setup not found")
    setup.map_x, setup.map_y = loc.x, loc.y
    db.commit()
    db.refresh(setup)
    return setup


def _diagram_payload(diagram: models.SetupDiagram, user: models.User):
    payload = {"svg": diagram.svg, "generated_at": diagram.generated_at.isoformat()}
    if user.role == "admin":
        payload["drawio_xml"] = diagram.drawio_xml
    return payload


def _regenerate(db: Session, setup_id: int):
    setup = (
        db.query(models.Setup)
        .options(selectinload(models.Setup.devices), selectinload(models.Setup.connections))
        .filter(models.Setup.id == setup_id)
        .first()
    )
    if not setup:
        raise HTTPException(status_code=404, detail="Setup not found")
    _attach_icons(db, setup)
    diagram = db.get(models.SetupDiagram, setup_id) or models.SetupDiagram(setup_id=setup_id)
    prepared = _prepare(setup)
    diagram.svg = build_svg(setup, prepared)
    diagram.drawio_xml = build_drawio(setup, prepared)
    db.add(diagram)
    db.commit()
    db.refresh(diagram)
    return diagram


@app.get("/setups/{setup_id}/diagram")
def get_diagram(
    setup_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    diagram = db.get(models.SetupDiagram, setup_id)
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not generated yet")
    if f'data-layout="{LAYOUT_VERSION}"' not in diagram.svg[:600]:
        diagram = _regenerate(db, setup_id)  # stored by an older layout version
    return _diagram_payload(diagram, user)


@app.post("/setups/{setup_id}/diagram")
def generate_diagram(
    setup_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_admin),
):
    return _diagram_payload(_regenerate(db, setup_id), user)


XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _download(content: bytes, media_type: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _attach_icons(db: Session, setups):
    overrides = {t.name: t.icon for t in db.query(models.DeviceType).all() if t.icon}
    for s in setups if isinstance(setups, list) else [setups]:
        s.icon_overrides = overrides
    return setups


def _load_setups(db: Session, setup_id: int | None = None):
    return _attach_icons(db, _load_setups_raw(db, setup_id))


def _load_setups_raw(db: Session, setup_id: int | None = None):
    query = db.query(models.Setup).options(
        selectinload(models.Setup.devices), selectinload(models.Setup.connections)
    )
    if setup_id is not None:
        setup = query.filter(models.Setup.id == setup_id).first()
        if not setup:
            raise HTTPException(status_code=404, detail="Setup not found")
        return setup
    return query.order_by(models.Setup.id).all()


@app.get("/export/setups", dependencies=[Depends(get_current_user)])
def export_all(
    format: str = Query("xlsx", pattern="^(xlsx|png)$"),
    scope: str = Query("full", pattern="^(setups|connections|full)$"),
    db: Session = Depends(get_db),
):
    setups = _load_setups(db)
    if format == "png":
        return _download(exporter.build_png_zip(setups), "application/zip", "setup-schemas.zip")
    return _download(exporter.build_xlsx(setups, scope), XLSX_MIME, f"setups-{scope}.xlsx")


@app.get("/export/setups/{setup_id}", dependencies=[Depends(get_current_user)])
def export_one(
    setup_id: int,
    format: str = Query("xlsx", pattern="^(xlsx|png)$"),
    db: Session = Depends(get_db),
):
    setup = _load_setups(db, setup_id)
    name = exporter.safe_name(setup.name)
    if format == "png":
        png = exporter.svg_to_png(build_svg(setup))
        return _download(png, "image/png", f"{setup.id}_{name}.png")
    return _download(exporter.build_single_xlsx(setup), XLSX_MIME, f"{setup.id}_{name}.xlsx")


def _type_payload(t: models.DeviceType) -> dict:
    return {"id": t.id, "name": t.name, "icon": t.icon or "", "auto_icon": icon_kind(t.name)}


@app.get("/device-types", response_model=list[schemas.DeviceTypeRead], dependencies=[Depends(get_current_user)])
def list_device_types(db: Session = Depends(get_db)):
    return [_type_payload(t) for t in db.query(models.DeviceType).order_by(models.DeviceType.id).all()]


@app.get("/device-icons", dependencies=[Depends(get_current_user)])
def list_device_icons():
    return icon_catalog()


@app.patch("/device-types/{type_id}", response_model=schemas.DeviceTypeRead, dependencies=[Depends(require_admin)])
def update_device_type(type_id: int, body: schemas.DeviceTypeUpdate, db: Session = Depends(get_db)):
    item = db.get(models.DeviceType, type_id)
    if not item:
        raise HTTPException(status_code=404, detail="Device type not found")
    if body.icon and body.icon not in ICON_LABELS:
        raise HTTPException(status_code=422, detail="Unknown icon")
    if body.name is not None:
        new = body.name.strip()
        if not new:
            raise HTTPException(status_code=422, detail="Name is required")
        clash = db.query(models.DeviceType).filter(func.lower(models.DeviceType.name) == new.lower(), models.DeviceType.id != type_id).first()
        if clash:
            raise HTTPException(status_code=409, detail=f"Type '{clash.name}' already exists")
        if new != item.name:
            db.query(models.Device).filter(models.Device.type == item.name).update({"type": new}, synchronize_session=False)
            item.name = new
    if body.icon is not None:
        item.icon = body.icon
    db.commit()
    db.refresh(item)
    return _type_payload(item)


@app.post("/device-types", response_model=schemas.DeviceTypeRead, dependencies=[Depends(require_admin)])
def create_device_type(type_in: schemas.DeviceTypeCreate, db: Session = Depends(get_db)):
    name = type_in.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name is required")
    existing = db.query(models.DeviceType).filter(func.lower(models.DeviceType.name) == name.lower()).first()
    if existing:
        return _type_payload(existing)
    item = models.DeviceType(name=name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _type_payload(item)


@app.delete("/device-types/{type_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_device_type(type_id: int, db: Session = Depends(get_db)):
    item = db.get(models.DeviceType, type_id)
    if not item:
        raise HTTPException(status_code=404, detail="Device type not found")
    used = db.query(models.Device).filter(models.Device.type == item.name).count()
    if used:
        raise HTTPException(status_code=409, detail=f"Type '{item.name}' is used by {used} device(s)")
    db.delete(item)
    db.commit()
    return Response(status_code=204)


@app.get("/interfaces", response_model=list[schemas.InterfaceRead], dependencies=[Depends(get_current_user)])
def list_interfaces(db: Session = Depends(get_db)):
    return db.query(models.InterfaceType).order_by(models.InterfaceType.id).all()


@app.post("/interfaces", response_model=schemas.InterfaceRead, dependencies=[Depends(require_admin)])
def create_interface(in_: schemas.InterfaceCreate, db: Session = Depends(get_db)):
    name = in_.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name is required")
    existing = db.query(models.InterfaceType).filter(func.lower(models.InterfaceType.name) == name.lower()).first()
    if existing:
        return existing
    item = models.InterfaceType(name=name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.delete("/interfaces/{interface_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_interface(interface_id: int, db: Session = Depends(get_db)):
    item = db.get(models.InterfaceType, interface_id)
    if not item:
        raise HTTPException(status_code=404, detail="Interface not found")
    used = db.query(models.Connection).filter(
        (models.Connection.from_port == item.name) | (models.Connection.to_port == item.name)
    ).count()
    if used:
        raise HTTPException(status_code=409, detail=f"Interface '{item.name}' is used by {used} connection(s)")
    db.delete(item)
    db.commit()
    return Response(status_code=204)
