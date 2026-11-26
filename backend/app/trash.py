"""Trash for deleted setups.

Deleting a setup stores a JSON snapshot (devices, connections, photo, linked access points)
and then really deletes it, so no other query has to filter out deleted rows.
Restoring recreates the setup under a new id. Entries are purged after TRASH_DAYS.
"""
import json
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session, selectinload

from . import crud, models, schemas
from .auth import require_admin
from .database import get_db

router = APIRouter(prefix="/trash", tags=["trash"], dependencies=[Depends(require_admin)])

TRASH_DAYS = int(os.getenv("TRASH_DAYS", "30"))


def _purge_expired(db: Session) -> None:
    cutoff = datetime.utcnow() - timedelta(days=TRASH_DAYS)
    db.query(models.DeletedSetup).filter(models.DeletedSetup.deleted_at < cutoff).delete()
    db.commit()


def move_to_trash(db: Session, setup_id: int, user: models.User):
    setup = (
        db.query(models.Setup)
        .options(selectinload(models.Setup.devices), selectinload(models.Setup.connections),
                 selectinload(models.Setup.access_points))
        .filter(models.Setup.id == setup_id)
        .first()
    )
    if not setup:
        return None
    payload = schemas.SetupRead.model_validate(setup).model_dump(mode="json")
    photo = db.get(models.SetupPhoto, setup_id)
    entry = models.DeletedSetup(
        original_id=setup.id,
        name=setup.name,
        payload=json.dumps(payload),
        photo=photo.data if photo else None,
        photo_type=photo.content_type if photo else None,
        ap_ids=[a.id for a in setup.access_points],
        deleted_by=user.username,
    )
    db.add(entry)
    db.delete(setup)
    if photo:
        db.delete(photo)
    db.commit()
    return entry


def _summary(e: models.DeletedSetup) -> dict:
    payload = json.loads(e.payload)
    return {
        "id": e.id,
        "original_id": e.original_id,
        "name": e.name,
        "devices": len(payload.get("devices", [])),
        "connections": len(payload.get("connections", [])),
        "has_photo": e.photo is not None,
        "deleted_by": e.deleted_by,
        "deleted_at": e.deleted_at.isoformat() if e.deleted_at else None,
        "expires_at": (e.deleted_at + timedelta(days=TRASH_DAYS)).isoformat() if e.deleted_at else None,
    }


@router.get("")
def list_trash(db: Session = Depends(get_db)):
    _purge_expired(db)
    rows = db.query(models.DeletedSetup).order_by(models.DeletedSetup.deleted_at.desc(), models.DeletedSetup.id.desc()).all()
    return [_summary(e) for e in rows]


@router.post("/{trash_id}/restore", response_model=schemas.SetupRead)
def restore(trash_id: int, db: Session = Depends(get_db)):
    entry = db.get(models.DeletedSetup, trash_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Not in the trash")
    payload = json.loads(entry.payload)
    setup = crud.create_setup(db, schemas.SetupCreate.model_validate(payload))

    for field in ("map_x", "map_y", "used_by", "used_until", "usage_note"):
        if payload.get(field) is not None:
            setattr(setup, field, payload[field])
    if entry.ap_ids:
        db.query(models.AccessPoint).filter(
            models.AccessPoint.id.in_(entry.ap_ids), models.AccessPoint.setup_id.is_(None)
        ).update({"setup_id": setup.id}, synchronize_session=False)
    if entry.photo:
        db.add(models.SetupPhoto(setup_id=setup.id, data=entry.photo, content_type=entry.photo_type))
    db.delete(entry)
    db.commit()
    return (
        db.query(models.Setup)
        .options(selectinload(models.Setup.devices), selectinload(models.Setup.connections),
                 selectinload(models.Setup.access_points))
        .filter(models.Setup.id == setup.id)
        .one()
    )


@router.delete("/{trash_id}", status_code=204)
def purge(trash_id: int, db: Session = Depends(get_db)):
    entry = db.get(models.DeletedSetup, trash_id)
    if entry:
        db.delete(entry)
        db.commit()
    return Response(status_code=204)


@router.delete("", status_code=204)
def empty_trash(db: Session = Depends(get_db)):
    db.query(models.DeletedSetup).delete()
    db.commit()
    return Response(status_code=204)
