from sqlalchemy.orm import Session
from . import models, schemas


def create_setup(db: Session, setup_in: schemas.SetupCreate):
    setup = models.Setup(
        name=setup_in.name,
        description=setup_in.description,
        chamber=setup_in.chamber,
        outlets_used=setup_in.outlets_used,
    )
    db.add(setup)
    db.flush()

    for device_in in setup_in.devices:
        db.add(models.Device(setup_id=setup.id, **device_in.model_dump()))

    for connection_in in setup_in.connections:
        db.add(models.Connection(setup_id=setup.id, **connection_in.model_dump()))

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
            db.add(models.Device(setup_id=setup_id, **device_in.model_dump()))

    if connections is not None:
        db.query(models.Connection).filter(models.Connection.setup_id == setup_id).delete()
        for connection_in in connections:
            db.add(models.Connection(setup_id=setup_id, **connection_in.model_dump()))

    db.commit()
    db.refresh(setup)
    return setup
