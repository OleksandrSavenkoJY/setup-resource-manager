"""MCP gateway for Setup Resource Manager.

It has no database access and no credentials of its own. Every client sends its
own HTTP Basic credentials; the gateway logs in to the backend as that user, so
the backend's roles apply as is: guest is read-only and never sees AP
credentials, admin can write.
"""
import base64
import hashlib
import os
import time
from typing import Any, Optional

import httpx
from mcp.server.fastmcp import Context, FastMCP

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000").rstrip("/")
SESSION_COOKIE = "session"
SESSION_TTL = 600  # seconds a backend session is reused

mcp = FastMCP(
    "setup-resource-manager",
    instructions=(
        "Lab setups, their devices, connections and access points. "
        "Read tools are available to every user; write tools need an admin login."
    ),
    host=os.getenv("MCP_HOST", "0.0.0.0"),
    port=int(os.getenv("MCP_PORT", "8765")),
    stateless_http=True,
    json_response=True,
)

_http = httpx.Client(base_url=BACKEND_URL, timeout=60)
_sessions: dict[str, tuple[float, str]] = {}  # sha256(user:pass) -> (expires, session token)


def _credentials(ctx: Context) -> tuple[str, str]:
    header = ctx.request_context.request.headers.get("authorization", "")
    scheme, _, value = header.partition(" ")
    if scheme.lower() != "basic" or not value:
        raise ValueError("Missing credentials: send an 'Authorization: Basic base64(user:password)' header")
    try:
        user, _, password = base64.b64decode(value).decode().partition(":")
    except Exception:
        raise ValueError("Malformed Authorization header")
    return user, password


def _login(user: str, password: str) -> str:
    r = _http.post("/auth/login", json={"username": user, "password": password})
    if r.status_code != 200:
        raise ValueError(f"Login failed: {r.json().get('detail', r.status_code)}")
    token = r.cookies.get(SESSION_COOKIE)
    if not token:
        raise ValueError("Login failed: backend returned no session")
    return token


def _token(ctx: Context, fresh: bool = False) -> str:
    user, password = _credentials(ctx)
    key = hashlib.sha256(f"{user}:{password}".encode()).hexdigest()
    cached = _sessions.get(key)
    if fresh or not cached or cached[0] < time.time():
        _sessions[key] = (time.time() + SESSION_TTL, _login(user, password))
    return _sessions[key][1]


def _call(ctx: Context, method: str, path: str, **kw) -> Any:
    for attempt in (0, 1):
        r = _http.request(method, path, cookies={SESSION_COOKIE: _token(ctx, fresh=attempt == 1)}, **kw)
        if r.status_code != 401 or attempt:
            break
    if r.status_code >= 400:
        try:
            detail = r.json().get("detail", r.text)
        except Exception:
            detail = r.text
        raise ValueError(f"Backend error {r.status_code}: {detail}")
    return r.json() if r.content else {"ok": True}


def _brief(s: dict) -> dict:
    return {
        "id": s["id"],
        "name": s["name"],
        "description": s.get("description"),
        "criticality": s.get("criticality"),
        "devices": len(s.get("devices", [])),
        "connections": len(s.get("connections", [])),
    }


@mcp.tool()
def list_setups(ctx: Context) -> list[dict]:
    """List all setups (id, name, description, criticality, device and connection counts)."""
    return [_brief(s) for s in _call(ctx, "GET", "/setups")]


@mcp.tool()
def get_setup(ctx: Context, setup_id: int) -> dict:
    """Full details of a setup: devices (with network interfaces), connections, linked access points."""
    return _call(ctx, "GET", f"/setups/{setup_id}")


@mcp.tool()
def search_devices(ctx: Context, query: str, setup_id: Optional[int] = None) -> list[dict]:
    """Find devices by case-insensitive text in name, type, notes, location, IP or MAC.
    Optionally limit to one setup. Returns the matching devices with their setup."""
    q = query.strip().lower()
    out = []
    for s in _call(ctx, "GET", "/setups"):
        if setup_id is not None and s["id"] != setup_id:
            continue
        for d in s.get("devices", []):
            ifaces = " ".join(
                f"{i.get('name', '')} {i.get('ip', '')} {i.get('mac', '')}" for i in d.get("net_interfaces", [])
            )
            fields = (d["name"], d["type"], d.get("notes"), d.get("location"), d.get("pfa_ip"), ifaces)
            if q in " ".join(str(x or "") for x in fields).lower():
                out.append({"setup_id": s["id"], "setup_name": s["name"], **d})
    return out


@mcp.tool()
def list_access_points(ctx: Context) -> list[dict]:
    """List access points. Username and password are filled in only for admin users."""
    return _call(ctx, "GET", "/access-points")


@mcp.tool()
def get_setup_prompt(ctx: Context, setup_id: int) -> Any:
    """Text description of a setup, ready to paste into an LLM prompt (admin only)."""
    return _call(ctx, "GET", f"/setups/{setup_id}/prompt")


@mcp.tool()
def create_setup(ctx: Context, setup: dict) -> dict:
    """Create a setup (admin). `setup` follows the backend schema: name, description, chamber,
    criticality (1-5), devices [{type, name, quantity, location, notes, power_from, pfa_ip,
    net_interfaces[{name,type,ip,mac}]}], connections [{from_device, from_port, to_device,
    to_port, cable_type, notes, powers, radio_mode}]."""
    return _call(ctx, "POST", "/setups", json=setup)


@mcp.tool()
def update_setup(ctx: Context, setup_id: int, changes: dict) -> dict:
    """Update a setup (admin). Only the keys present in `changes` are modified. If you pass
    `devices` or `connections`, that list replaces the existing one, so send the full list."""
    return _call(ctx, "PUT", f"/setups/{setup_id}", json=changes)


@mcp.tool()
def delete_setup(ctx: Context, setup_id: int, confirm: bool = False) -> dict:
    """Delete a setup permanently (admin). Requires confirm=true."""
    if not confirm:
        raise ValueError("Deletion is permanent; call again with confirm=true")
    return _call(ctx, "DELETE", f"/setups/{setup_id}")


@mcp.tool()
def create_access_point(ctx: Context, access_point: dict) -> dict:
    """Create an access point (admin). Keys: name (required), model, wifi_standard, ip, username,
    password, automation ('', yes, no, in_progress), setup_id, location, notes."""
    return _call(ctx, "POST", "/access-points", json=access_point)


@mcp.tool()
def update_access_point(ctx: Context, ap_id: int, access_point: dict) -> dict:
    """Replace an access point's fields (admin). Send the complete record (same keys as create)."""
    return _call(ctx, "PUT", f"/access-points/{ap_id}", json=access_point)


@mcp.tool()
def delete_access_point(ctx: Context, ap_id: int, confirm: bool = False) -> dict:
    """Delete an access point permanently (admin). Requires confirm=true."""
    if not confirm:
        raise ValueError("Deletion is permanent; call again with confirm=true")
    return _call(ctx, "DELETE", f"/access-points/{ap_id}")


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
