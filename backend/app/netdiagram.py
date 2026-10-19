import ipaddress
from xml.sax.saxutils import escape

from .diagram import ICONS, icon_kind, _icon_svg

CHAR_W = 7.0
ROW_H = 22
HEAD_H = 52
CARD_W_MIN = 230
PAD = 18
GAP = 18
PANEL_HEAD = 38


def _subnet(ip: str) -> str:
    """Group key: the explicit prefix if given, otherwise /24 for IPv4 and /64 for IPv6."""
    iface = ipaddress.ip_interface(ip)
    if "/" in ip:
        return str(iface.network)
    prefix = 24 if iface.version == 4 else 64
    return str(ipaddress.ip_network(f"{iface.ip}/{prefix}", strict=False))


def _sort_key(net: str):
    n = ipaddress.ip_network(net)
    return (n.version, int(n.network_address), n.prefixlen)


def _groups(setup):
    """subnet -> list of (device, [interfaces]); interfaces without IP go to the 'No IP' bucket."""
    groups: dict[str, dict[int, tuple]] = {}
    for d in setup.devices:
        for n in d.net_interfaces:
            key = _subnet(n.ip) if n.ip else "No IP address"
            groups.setdefault(key, {}).setdefault(d.id, (d, []))[1].append(n)
    ordered = sorted((k for k in groups if k != "No IP address"), key=_sort_key)
    if "No IP address" in groups:
        ordered.append("No IP address")
    return [(k, list(groups[k].values())) for k in ordered]


def has_network(setup) -> bool:
    return any(d.net_interfaces for d in setup.devices)


def build_network_svg(setup) -> str:
    groups = _groups(setup)
    if not groups:
        return ""

    def row_text(n):
        return "  ".join(x for x in (n.name or n.type or "if", n.ip, n.mac) if x)

    panels, width = [], 0
    for key, members in groups:
        card_w = CARD_W_MIN
        for d, nets in members:
            card_w = max(card_w, int(max([len(d.name) * 8] + [len(row_text(n)) * CHAR_W for n in nets]) + 2 * PAD + 44))
        panels.append((key, members, card_w))
        width = max(width, PANEL_HEAD)

    parts, y = [], 20
    max_w = 0
    for key, members, card_w in panels:
        inner_h = sum(HEAD_H + len(nets) * ROW_H + PAD for _, nets in members) + GAP * (len(members) - 1)
        panel_h = PANEL_HEAD + inner_h + PAD
        panel_w = card_w + 2 * PAD
        max_w = max(max_w, panel_w)
        parts.append(
            f'<rect x="20" y="{y}" width="{panel_w}" height="{panel_h}" rx="12" fill="#f1f5f9" stroke="#64748b" stroke-width="1.5" stroke-dasharray="6 4"/>'
            f'<text x="{20 + PAD}" y="{y + 25}" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#334155">{escape(key)}</text>'
            f'<text x="{20 + panel_w - PAD}" y="{y + 25}" text-anchor="end" font-family="Arial,sans-serif" font-size="12" fill="#64748b">{len(members)} device(s)</text>'
        )
        cy = y + PANEL_HEAD
        for d, nets in members:
            card_h = HEAD_H + len(nets) * ROW_H + PAD - 4
            cx = 20 + PAD
            parts.append(
                f'<rect x="{cx}" y="{cy}" width="{card_w}" height="{card_h}" rx="8" fill="#fff" stroke="#1e3a8a" stroke-width="1.5"/>'
                + _icon_svg(icon_kind(d.type, getattr(setup, "icon_overrides", None)), cx + 8, cy + 6, 36)
                + f'<text x="{cx + 52}" y="{cy + 26}" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#111827">{escape(d.name)}</text>'
                f'<text x="{cx + 52}" y="{cy + 43}" font-family="Arial,sans-serif" font-size="11" fill="#6b7280">{escape(d.type)}</text>'
            )
            for i, n in enumerate(nets):
                ry = cy + HEAD_H + i * ROW_H
                parts.append(
                    f'<line x1="{cx}" y1="{ry - 4}" x2="{cx + card_w}" y2="{ry - 4}" stroke="#d1d5db"/>'
                    f'<text x="{cx + PAD}" y="{ry + 11}" font-family="Arial,sans-serif" font-size="12" fill="#111827">'
                    f'<tspan font-weight="700">{escape(n.name or n.type or "if")}</tspan>'
                    + (f' <tspan fill="#1d4ed8">{escape(n.ip)}</tspan>' if n.ip else "")
                    + (f' <tspan fill="#6b7280">{escape(n.mac)}</tspan>' if n.mac else "")
                    + "</text>"
                )
            cy += card_h + GAP
        y += panel_h + 20
    total_w = max_w + 40
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_w}" height="{y}" viewBox="0 0 {total_w} {y}">'
        f'<rect width="100%" height="100%" fill="#ffffff"/>' + "".join(parts) + "</svg>"
    )
