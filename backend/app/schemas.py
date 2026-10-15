from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class DeviceBase(BaseModel):
    type: str
    name: str
    quantity: int = 1
    location: Optional[str] = None
    notes: Optional[str] = None


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


class ConnectionCreate(ConnectionBase):
    pass


class ConnectionRead(ConnectionBase):
    id: int

    class Config:
        from_attributes = True


class SetupBase(BaseModel):
    name: str
    description: Optional[str] = None
    chamber: bool = False
    outlets_used: int = 0


class SetupCreate(SetupBase):
    devices: List[DeviceCreate] = []
    connections: List[ConnectionCreate] = []


class SetupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    chamber: Optional[bool] = None
    outlets_used: Optional[int] = None
    devices: Optional[List[DeviceCreate]] = None
    connections: Optional[List[ConnectionCreate]] = None


class SetupRead(SetupBase):
    id: int
    created_at: datetime
    updated_at: datetime
    devices: List[DeviceRead] = []
    connections: List[ConnectionRead] = []

    class Config:
        from_attributes = True
