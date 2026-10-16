from sqlalchemy.orm import Session
from . import models, schemas
from .schemas import POWER_OUTLET


def _sync_outlets(setup):
    """Outlets used follows the devices plugged straight into a wall outlet, once any power info is given."""
    if any(d.power_from for d in setup.devices):
        setup.outlets_used = sum(1 for d in setup.devices if d.power_from == POWER_OUTLET)


def create_setup(db: Session, setup_in: schemas.SetupCreate):
    setup = models.Setup(
        name=setup_in.name,
        description=setup_in.description,
        chamber=setup_in.chamber,
        outlets_used=setup_in.outlets_used,
        chamber_count=setup_in.chamber_count if setup_in.chamber else 0,
    )
    db.add(setup)
    db.flush()

    for device_in in setup_in.devices:
        db.add(models.Device(setup_id=setup.id, **device_in.model_dump()))

    for connection_in in setup_in.connections:
        db.add(models.Connection(setup_id=setup.id, **connection_in.model_dump()))

    db.flush()
    db.refresh(setup)
    _sync_outlets(setup)
    db.flush()
    db.refresh(setup)
    _sync_outlets(setup)
    db.commit()
    db.refresh(setup)
    return setup


def get_setups(db: Session):
    return db.query(models.Setup).order_by(models.Setup.id.desc()).all()


def get_setup(db: Session, setup_id: int):
    return db.query(models.Setup).filter(models.Setup.id == setup_id).first()


def delete_setup(db: Session, setup_id: int):
    setup = get_setup(db, setup_id)
    if not setup:
        return None
    db.delete(setup)
    db.commit()
    return setup


def update_setup(db: Session, setup_id: int, setup_in: schemas.SetupUpdate):
    setup = get_setup(db, setup_id)
    if not setup:
        return None

    data = setup_in.model_dump(exclude_unset=True)

    devices = data.pop("devices", None)
    connections = data.pop("connections", None)

    for key, value in data.items():
        setattr(setup, key, value)

    if devices is not None:
        db.query(models.Device).filter(models.Device.setup_id == setup_id).delete()
        for device_in in devices:
            db.add(models.Device(setup_id=setup_id, **device_in))

    if connections is not None:
        db.query(models.Connection).filter(models.Connection.setup_id == setup_id).delete()
        for connection_in in connections:
            db.add(models.Connection(setup_id=setup_id, **connection_in))

    db.commit()
    db.refresh(setup)
    return setup
