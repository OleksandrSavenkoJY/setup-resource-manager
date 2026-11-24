from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text, func
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
    # 1 (low) .. 5 (critical): how much the work depends on this setup running without failures
    criticality = Column(Integer, default=3, nullable=False, server_default="3")
    map_x = Column(Float, nullable=True)
    map_y = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    devices = relationship("Device", back_populates="setup", cascade="all, delete-orphan")
    connections = relationship("Connection", back_populates="setup", cascade="all, delete-orphan")
    access_points = relationship("AccessPoint", back_populates="setup")


class AccessPoint(Base):
    __tablename__ = "access_points"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    model = Column(String(255), nullable=False, default="", server_default="")
    wifi_standard = Column(String(50), nullable=False, default="", server_default="")
    ip = Column(String(64), nullable=False, default="", server_default="")
    # Admin-only; stored as plain text because they have to be shown back to the team.
    username = Column(String(255), nullable=False, default="", server_default="")
    password = Column(String(255), nullable=False, default="", server_default="")
    automation = Column(String(20), nullable=False, default="", server_default="")  # "", "yes", "no", "in_progress"
    status = Column(String(20), nullable=False, default="", server_default="")  # "", "verified", "not_working"
    setup_id = Column(Integer, ForeignKey("setups.id", ondelete="SET NULL"), nullable=True, index=True)
    location = Column(String(255), nullable=False, default="", server_default="")  # free text when not in a setup
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    setup = relationship("Setup", back_populates="access_points")
    photo = relationship("AccessPointPhoto", uselist=False, cascade="all, delete-orphan")


class AccessPointPhoto(Base):
    __tablename__ = "access_point_photos"

    ap_id = Column(Integer, ForeignKey("access_points.id", ondelete="CASCADE"), primary_key=True)
    content_type = Column(String(50), nullable=False)
    data = Column(LargeBinary, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


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
    # IP of one of the device's interfaces that serves the PFA automation page.
    pfa_ip = Column(String(64), nullable=False, default="", server_default="")

    setup = relationship("Setup", back_populates="devices")
    net_interfaces = relationship(
        "NetInterface", cascade="all, delete-orphan", order_by="NetInterface.id"
    )


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
    # "" = data only, "from" = From device powers To, "to" = To device powers From
    powers = Column(String(4), nullable=False, default="", server_default="")
    # radio links only: "ota" (over the air), "conducted" (cabled antenna ports) or "hybrid" (cable to a remote antenna)
    radio_mode = Column(String(10), nullable=False, default="", server_default="")

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


class NetInterface(Base):
    __tablename__ = "net_interfaces"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False, default="")
    type = Column(String(50), nullable=False, default="", server_default="")
    ip = Column(String(64), nullable=False, default="", server_default="")
    mac = Column(String(17), nullable=False, default="", server_default="")


class OfficeMap(Base):
    __tablename__ = "office_map"

    id = Column(Integer, primary_key=True)
    content_type = Column(String(50), nullable=False)
    data = Column(LargeBinary, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


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
