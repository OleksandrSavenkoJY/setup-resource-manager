from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, LargeBinary, String, Text, func
from sqlalchemy.orm import relationship
from .database import Base


class Setup(Base):
    __tablename__ = "setups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    chamber = Column(Boolean, default=False, nullable=False)
    outlets_used = Column(Integer, default=0, nullable=False)
    chamber_count = Column(Integer, default=0, nullable=False, server_default="0")
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
    # "" = unspecified, "__outlet__" = wall outlet, otherwise the name of another device in the setup.
    power_from = Column(String(255), nullable=False, default="", server_default="")

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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)  # "admin" | "guest"
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User")


class SetupDiagram(Base):
    __tablename__ = "setup_diagrams"

    setup_id = Column(Integer, ForeignKey("setups.id", ondelete="CASCADE"), primary_key=True)
    svg = Column(Text, nullable=False)
    drawio_xml = Column(Text, nullable=False)
    generated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class SetupPhoto(Base):
    __tablename__ = "setup_photos"

    setup_id = Column(Integer, ForeignKey("setups.id", ondelete="CASCADE"), primary_key=True)
    content_type = Column(String(50), nullable=False)
    data = Column(LargeBinary, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class DeviceType(Base):
    __tablename__ = "device_types"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    icon = Column(String(30), nullable=False, default="", server_default="")


class InterfaceType(Base):
    __tablename__ = "interface_types"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
