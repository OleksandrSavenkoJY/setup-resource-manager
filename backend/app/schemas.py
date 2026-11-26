import ipaddress
import re
from pydantic import model_validator, BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime


_MAC_RE = re.compile(r"^[0-9A-Fa-f]{12}$")


class NetInterface(BaseModel):
    name: str = Field("", max_length=100)
    type: str = Field("", max_length=50)
    ip: str = Field("", max_length=64)
    mac: str = Field("", max_length=32)

    @field_validator("name", "type")
    @classmethod
    def _strip(cls, v):
        return v.strip()

    @field_validator("ip")
    @classmethod
    def _valid_ip(cls, v):
        v = v.strip()
        if v:
            try:
                ipaddress.ip_interface(v)
            except ValueError:
                raise ValueError(f"Invalid IP address '{v}'")
        return v

    @field_validator("mac")
    @classmethod
    def _valid_mac(cls, v):
        raw = re.sub(r"[\s:.\-]", "", v)
        if not raw:
            return ""
        if not _MAC_RE.match(raw):
            raise ValueError(f"Invalid MAC address '{v}'")
        raw = raw.upper()
        return ":".join(raw[i:i + 2] for i in range(0, 12, 2))

    class Config:
        from_attributes = True


class DeviceBase(BaseModel):
    type: str
    name: str
    quantity: int = 1
    location: Optional[str] = None
    notes: Optional[str] = None
    power_from: str = Field("", max_length=255)
    pfa_ip: str = Field("", max_length=64)
    net_interfaces: List[NetInterface] = []


class DeviceCreate(DeviceBase):
    pass


class DeviceRead(DeviceBase):
    id: int

    class Config:
        from_attributes = True


class ConnectionBase(BaseModel):
    from_device: str
    from_port: Optional[str] = None
    to_device: str
    to_port: Optional[str] = None
    cable_type: Optional[str] = None
    notes: Optional[str] = None
    powers: str = ""
    radio_mode: str = ""

    @field_validator("radio_mode", mode="before")
    @classmethod
    def _radio_mode(cls, v):
        v = v or ""
        if v not in ("", "ota", "conducted", "hybrid"):
            raise ValueError("radio_mode must be empty, 'ota', 'conducted' or 'hybrid'")
        return v

    @field_validator("powers", mode="before")
    @classmethod
    def _powers(cls, v):
        v = v or ""
        if v not in ("", "from", "to"):
            raise ValueError("powers must be empty, 'from' or 'to'")
        return v


class ConnectionCreate(ConnectionBase):
    pass


class ConnectionRead(ConnectionBase):
    id: int

    class Config:
        from_attributes = True


MAX_TAGS = 20


def _clean_tags(v):
    if v is None:
        return v
    seen, out = set(), []
    for t in v:
        t = " ".join(str(t).split())
        if not t:
            continue
        if len(t) > 30:
            raise ValueError("A tag can have at most 30 characters")
        if "," in t:
            raise ValueError("A tag cannot contain a comma")
        if t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    if len(out) > MAX_TAGS:
        raise ValueError(f"At most {MAX_TAGS} tags per setup")
    return out


class SetupBase(BaseModel):
    name: str
    description: Optional[str] = None
    chamber: bool = False
    outlets_used: int = 0
    chamber_count: int = Field(0, ge=0, le=50)
    criticality: int = Field(3, ge=2, le=4)
    tags: List[str] = []

    @field_validator("tags", mode="before")
    @classmethod
    def _tags(cls, v):
        return _clean_tags(v or [])


POWER_OUTLET = "__outlet__"


def _check_power(devices):
    names = {d.name for d in devices}
    for d in devices:
        src = d.power_from
        if src and src != POWER_OUTLET and (src not in names or src == d.name):
            raise ValueError(f"Device '{d.name}' is powered from unknown device '{src}'")
    return devices


class UsageUpdate(BaseModel):
    """Empty used_by releases the setup (the other fields are then cleared too)."""
    used_by: str = Field("", max_length=100)
    used_until: str = ""
    usage_note: str = Field("", max_length=255)

    @model_validator(mode="after")
    def _normalize(self):
        self.used_by = self.used_by.strip()
        self.usage_note = self.usage_note.strip()
        self.used_until = self.used_until.strip()
        if not self.used_by:
            self.used_until = self.usage_note = ""
        if self.used_until:
            try:
                datetime.strptime(self.used_until, "%Y-%m-%d")
            except ValueError:
                raise ValueError("used_until must be a date in YYYY-MM-DD format")
        return self


class LocationUpdate(BaseModel):
    x: Optional[float] = Field(None, ge=0, le=1)
    y: Optional[float] = Field(None, ge=0, le=1)

    @model_validator(mode="after")
    def _both_or_none(self):
        if (self.x is None) != (self.y is None):
            raise ValueError("x and y must be set together")
        return self


class SetupCreate(SetupBase):
    devices: List[DeviceCreate] = []
    connections: List[ConnectionCreate] = []

    @field_validator("devices")
    @classmethod
    def _power_sources_exist(cls, v):
        return _check_power(v)


class SetupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    chamber: Optional[bool] = None
    outlets_used: Optional[int] = None
    chamber_count: Optional[int] = Field(None, ge=0, le=50)
    criticality: Optional[int] = Field(None, ge=2, le=4)
    tags: Optional[List[str]] = None
    devices: Optional[List[DeviceCreate]] = None
    connections: Optional[List[ConnectionCreate]] = None

    @field_validator("tags", mode="before")
    @classmethod
    def _tags(cls, v):
        return _clean_tags(v)

    @field_validator("devices")
    @classmethod
    def _power_sources_exist(cls, v):
        return _check_power(v) if v is not None else v


class AccessPointBrief(BaseModel):
    id: int
    name: str
    model: str = ""
    ip: str = ""

    model_config = {"from_attributes": True}


class SetupRead(SetupBase):
    id: int
    map_x: Optional[float] = None
    map_y: Optional[float] = None
    used_by: str = ""
    used_until: str = ""
    usage_note: str = ""
    created_at: datetime
    updated_at: datetime
    devices: List[DeviceRead] = []
    connections: List[ConnectionRead] = []
    access_points: List[AccessPointBrief] = []

    @model_validator(mode="after")
    def _auto_outlets(self):
        if any(d.power_from for d in self.devices):
            self.outlets_used = sum(1 for d in self.devices if d.power_from == POWER_OUTLET)
        return self

    class Config:
        from_attributes = True


class DeviceTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class DeviceTypeUpdate(BaseModel):
    icon: Optional[str] = Field(None, max_length=30)
    name: Optional[str] = Field(None, max_length=100)


class DeviceTypeRead(BaseModel):
    id: int
    name: str
    icon: str = ""
    auto_icon: str = "generic"

    class Config:
        from_attributes = True


class InterfaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class InterfaceRead(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
