from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from .database import Base, engine, get_db
from . import models, schemas, crud
from .prompt import generate_prompt

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Setup Resource Manager API")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/setups", response_model=schemas.SetupRead)
def create_setup(setup_in: schemas.SetupCreate, db: Session = Depends(get_db)):
    return crud.create_setup(db, setup_in)


@app.get("/setups", response_model=list[schemas.SetupRead])
def list_setups(db: Session = Depends(get_db)):
    return (
        db.query(models.Setup)
        .options(selectinload(models.Setup.devices), selectinload(models.Setup.connections))
        .order_by(models.Setup.id.desc())
        .all()
    )


@app.get("/setups/{setup_id}", response_model=schemas.SetupRead)
def get_setup(setup_id: int, db: Session = Depends(get_db)):
    setup = (
        db.query(models.Setup)
        .options(selectinload(models.Setup.devices), selectinload(models.Setup.connections))
        .filter(models.Setup.id == setup_id)
        .first()
    )
    if not setup:
        raise HTTPException(status_code=404, detail="Setup not found")
    return setup


@app.put("/setups/{setup_id}", response_model=schemas.SetupRead)
def update_setup(setup_id: int, setup_in: schemas.SetupUpdate, db: Session = Depends(get_db)):
    setup = crud.update_setup(db, setup_id, setup_in)
    if not setup:
        raise HTTPException(status_code=404, detail="Setup not found")
    return get_setup(setup_id, db)


@app.delete("/setups/{setup_id}")
def delete_setup(setup_id: int, db: Session = Depends(get_db)):
    setup = crud.delete_setup(db, setup_id)
    if not setup:
        raise HTTPException(status_code=404, detail="Setup not found")
    return {"deleted": True, "id": setup_id}


@app.get("/setups/{setup_id}/prompt")
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
