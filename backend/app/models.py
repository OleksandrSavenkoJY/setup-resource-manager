from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship
from .database import Base


class Setup(Base):
    __tablename__ = "setups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    chamber = Column(Boolean, default=False, nullable=False)
    outlets_used = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    devices = relationship("Device", back_populates="setup", cascade="all, delete-orphan")
    connections = relationship("Connection", back_populates="setup", cascade="all, delete-orphan")


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    setup_id = Column(Integer, ForeignKey("setups.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    location = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    setup = relationship("Setup", back_populates="devices")


class Connection(Base):
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, index=True)
    setup_id = Column(Integer, ForeignKey("setups.id", ondelete="CASCADE"), nullable=False)
    from_device = Column(String(255), nullable=False)
    from_port = Column(String(100), nullable=True)
    to_device = Column(String(255), nullable=False)
    to_port = Column(String(100), nullable=True)
    cable_type = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    setup = relationship("Setup", back_populates="connections")
