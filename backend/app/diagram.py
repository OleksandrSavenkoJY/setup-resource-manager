import base64
from types import SimpleNamespace
import math
import re
import random
import time
from collections import deque
from xml.sax.saxutils import escape, quoteattr

BOX_W, BOX_H = 170, 112
ICON_PX = 48
OUTLET_KEY = "__outlet__"
POWER_COLOR = "#dc2626"
RADIO_COLOR = "#2563eb"
RADIO_RE = re.compile(r"wi-?fi|wlan|\bble\b|bluetooth|matter|thread|zigbee|z-?wave|lora|nfc|cellular|\blte\b|\b5g\b|radio|\brf\b|uwb|802\.15", re.I)


def _is_radio(c):
    return bool(RADIO_RE.search(f"{c.from_port or ''} {c.to_port or ''}"))
CHAMBER_RE = re.compile(r"^chamber\s*\d+$", re.I)
GAP_X, GAP_Y = 150, 110
MARGIN = 56
PARALLEL_STEP = 30
LABEL_H = 18
CHAR_W = 7.2
PAD = 6


S = 'fill="none" stroke="#1e3a8a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
# 40x40 line icons keyed by kind
ICONS = {
    "pc": f'<g {S}><rect x="3" y="4" width="22" height="16" rx="2" fill="#fff"/><path d="M14 20v5M8 25h12"/>'
          f'<rect x="28" y="6" width="9" height="26" rx="1.5" fill="#fff"/><path d="M31 11h3M31 15h3"/><path d="M4 34h22"/></g>',
    "laptop": f'<g {S}><rect x="8" y="6" width="24" height="17" rx="2" fill="#fff"/><path d="M3 29h34l-3 4H6z" fill="#fff"/></g>',
    "monitor": f'<g {S}><rect x="4" y="6" width="32" height="21" rx="2" fill="#fff"/><path d="M20 27v6M13 33h14"/></g>',
    "ups": f'<g {S}><rect x="4" y="9" width="32" height="22" rx="3" fill="#fff"/><path d="M22 13l-7 8h6l-3 7 8-9h-6z" fill="#1e3a8a"/></g>',
    "chip": f'<g {S}><rect x="10" y="10" width="20" height="20" rx="2" fill="#fff"/><rect x="16" y="16" width="8" height="8"/>'
            '<path d="M15 10V4M20 10V4M25 10V4M15 30v6M20 30v6M25 30v6M10 15H4M10 20H4M10 25H4M30 15h6M30 20h6M30 25h6"/></g>',
    "board": f'<g {S}><rect x="3" y="7" width="34" height="26" rx="2" fill="#fff"/><rect x="14" y="13" width="12" height="12" rx="1"/>'
             '<path d="M14 17H8v-4M26 21h6v5M20 13V9M20 25v4M8 29h6"/><circle cx="8" cy="12" r="1.2"/><circle cx="32" cy="28" r="1.2"/></g>',
    "switch": f'<g {S}><rect x="3" y="12" width="34" height="16" rx="2" fill="#fff"/><path d="M9 20h2M15 20h2M21 20h2M27 20h2"/><path d="M9 28v4M15 28v4M21 28v4M27 28v4"/></g>',
    "router": f'<g {S}><rect x="4" y="19" width="32" height="12" rx="2" fill="#fff"/><path d="M10 19L7 7M30 19l3-12M10 25h2"/><circle cx="26" cy="25" r="1.3"/><circle cx="31" cy="25" r="1.3"/></g>',
    "camera": f'<g {S}><rect x="4" y="11" width="25" height="18" rx="2" fill="#fff"/><circle cx="16.5" cy="20" r="5"/><path d="M29 17l8-4v14l-8-4z" fill="#fff"/></g>',
    "printer": f'<g {S}><path d="M11 14V5h18v9"/><rect x="4" y="14" width="32" height="14" rx="2" fill="#fff"/><rect x="11" y="23" width="18" height="11" fill="#fff"/></g>',
    "attenuator": f'<g {S}><path d="M2 20h8l2-7 4 14 4-14 4 14 2-7h12"/><rect x="6" y="8" width="28" height="24" rx="3" fill="none" stroke-dasharray="3 3"/>'
                  '<path d="M12 35L28 5" stroke="#dc2626"/></g>',
    "cloud": f'<g {S}><path d="M11 30a7 7 0 0 1 0-14 9 9 0 0 1 17-2 7.5 7.5 0 0 1 1 16z" fill="#dbeafe"/></g>',
    "antenna": f'<g {S}><path d="M20 19v15M14 34h12M17 34l3-15 3 15"/><circle cx="20" cy="15" r="2.5" fill="#1e3a8a"/>'
               '<path d="M13 9a10 10 0 0 0 0 12M27 9a10 10 0 0 1 0 12M9 5a16 16 0 0 0 0 20M31 5a16 16 0 0 1 0 20"/></g>',
    "pc_windows": f'<g {S}><rect x="3" y="4" width="22" height="16" rx="2" fill="#f59e0b"/><path d="M14 20v5M8 25h12"/>'
                  '<g fill="#fff" stroke="none"><rect x="7" y="7" width="7" height="5"/><rect x="15" y="7" width="7" height="5"/>'
                  '<rect x="7" y="13" width="7" height="5"/><rect x="15" y="13" width="7" height="5"/></g>'
                  '<rect x="28" y="6" width="9" height="26" rx="1.5" fill="#fff"/><path d="M31 11h3M31 15h3M4 34h22"/></g>',
    "pc_linux": f'<g {S}><rect x="3" y="4" width="22" height="16" rx="2" fill="#f59e0b"/><path d="M14 20v5M8 25h12"/>'
                '<g fill="#fff" stroke="none"><ellipse cx="14" cy="13" rx="4" ry="5.5"/><circle cx="14" cy="7.5" r="2.4"/></g>'
                '<rect x="28" y="6" width="9" height="26" rx="1.5" fill="#fff"/><path d="M31 11h3M31 15h3M4 34h22"/></g>',
    "outlet": f'<g {S}><rect x="6" y="6" width="28" height="28" rx="6" fill="#fff"/><path d="M15 14v6M25 14v6"/>'
              '<path d="M16 27h8"/></g>',
    "raspberry": f'<g {S}><rect x="3" y="8" width="34" height="24" rx="2" fill="#fff"/><circle cx="20" cy="16" r="3.5" fill="#be123c"/><circle cx="16.5" cy="21" r="2.5" fill="#be123c"/><circle cx="23.5" cy="21" r="2.5" fill="#be123c"/><rect x="26" y="11" width="8" height="6"/><rect x="26" y="20" width="8" height="8"/><path d="M6 12h4M6 16h4"/></g>',
    "usb_relay": f'<g {S}><rect x="4" y="11" width="26" height="18" rx="2" fill="#fff"/><rect x="30" y="16" width="7" height="8" rx="1"/><rect x="9" y="15" width="8" height="10" rx="1"/><path d="M20 17l3 3-3 3M24 20h2"/></g>',
    "ppk2": f'<g {S}><rect x="4" y="9" width="32" height="22" rx="3" fill="#fff"/><path d="M8 24l5-5 4 3 5-8 4 6 6-3" stroke="#0891b2"/><circle cx="9" cy="14" r="1.3"/><circle cx="14" cy="14" r="1.3"/></g>',
    "power_strip": f'<g {S}><rect x="3" y="13" width="34" height="14" rx="3" fill="#fff"/><path d="M9 17v3M13 17v3M17 17v3M21 17v3M25 17v3M29 17v3"/><path d="M9 23h2M17 23h2M25 23h2"/><path d="M37 20h3"/></g>',
    "phone": f'<g {S}><rect x="11" y="3" width="18" height="34" rx="3" fill="#fff"/><path d="M17 7h6"/><circle cx="20" cy="32" r="1.5"/></g>',
    "generic": f'<g {S}><path d="M20 4l15 8v16l-15 8-15-8V12z" fill="#fff"/><path d="M5 12l15 8 15-8M20 20v16"/></g>',
}
# First match wins; patterns are matched against the lower-cased device type.
ICON_RULES = [
    (r"raspberr|\brpi\b|^pi\d|orange pi", "raspberry"),
    (r"relay", "usb_relay"),
    (r"ppk|nordic|power profiler", "ppk2"),
    (r"power strip|powerstrip|extension|surge", "power_strip"),
    (r"phone|android|iphone|smartphone|mobile", "phone"),
    (r"outlet|socket", "outlet"),
    (r"internet|cloud|^wan$|^mng$", "cloud"),
    (r"attenuat|^att\d|\batt\b", "attenuator"),
    (r"antenn|^ant\d", "antenna"),
    (r"windows|^win\d*$", "pc_windows"),
    (r"linux|ubuntu|debian", "pc_linux"),
    (r"^ek-|\bevk|-evk|\bboard\b|\bevk\b|\bfpb\b|devkit|dev kit|pcb", "board"),
    (r"chip|\bsoc\b|\bmcu\b|\bic\b|module|\bcpu\b", "chip"),
    (r"laptop|notebook", "laptop"),
    (r"monitor|display|screen|\btv\b", "monitor"),
    (r"\bups\b|battery|power supply|\bpsu\b", "ups"),
    (r"^pc$|\bpc\b|computer|desktop|workstation|server", "pc"),
    (r"switch", "switch"),
    (r"router|gateway|access point|\bap\b", "router"),
    (r"camera|webcam", "camera"),
    (r"printer", "printer"),
]


ICON_LABELS = {
    "pc": "Computer", "laptop": "Laptop", "monitor": "Monitor", "ups": "UPS", "chip": "Chip",
    "board": "Board", "switch": "Switch", "router": "Router", "camera": "Camera",
    "printer": "Printer", "attenuator": "Attenuator", "cloud": "Internet", "antenna": "Antenna",
    "outlet": "Wall outlet", "pc_windows": "PC (Windows)", "pc_linux": "PC (Linux)", "raspberry": "Raspberry Pi", "usb_relay": "USB relay", "ppk2": "Nordic PPK2",
    "power_strip": "Power strip", "phone": "Mobile phone", "generic": "Generic",
}


def icon_catalog() -> list[dict]:
    return [
        {"key": k, "label": ICON_LABELS[k], "svg": f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">{v}</svg>'}
        for k, v in ICONS.items()
    ]


def icon_kind(device_type: str, overrides: dict | None = None) -> str:
    if device_type == OUTLET_KEY:
        return "outlet"
    t = (device_type or "").strip().lower()
    chosen = (overrides or {}).get(device_type)
    if chosen in ICONS:
        return chosen
    for pattern, kind in ICON_RULES:
        if re.search(pattern, t):
            return kind
    return "generic"


def _icon_svg(kind, x, y, size=ICON_PX):
    return f'<g transform="translate({x},{y}) scale({size / 40})">{ICONS[kind]}</g>'


def _icon_datauri(kind):
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">'
        + ICONS[kind]
        + "</svg>"
    )
    # draw.io style strings use ';' as a separator, so the data URI carries no ';base64' marker.
    return "data:image/svg+xml," + base64.b64encode(svg.encode()).decode()


def _nodes(setup):
    nodes: dict[str, tuple[str, str, str]] = {}
    for d in setup.devices:
        label = " · ".join(x for x in (d.type, d.location) if x)
        nodes.setdefault(d.name, (d.name, label, d.type or ""))
    for c in setup.connections:
        for name in (c.from_device, c.to_device):
            nodes.setdefault(name, (name, "", ""))
    if any(getattr(d, "power_from", "") == OUTLET_KEY for d in setup.devices):
        nodes[OUTLET_KEY] = ("Wall outlet", "mains", OUTLET_KEY)
    return nodes


def _power_links(setup):
    """Power feeds as pseudo connections: source -> powered device."""
    names = {d.name for d in setup.devices}
    links = []
    for d in setup.devices:
        src = getattr(d, "power_from", "") or ""
        if src and (src == OUTLET_KEY or src in names) and src != d.name:
            links.append(SimpleNamespace(
                from_device=src, from_port="", to_device=d.name, to_port="",
                cable_type="", notes="", power=True,
            ))
    return links


def _all_links(setup):
    """Data connections (a cable that also powers is oriented source -> powered device) plus power feeds."""
    data, fed = [], set()
    for c in setup.connections:
        mode = getattr(c, "powers", "") or ""
        if mode == "to":
            c = SimpleNamespace(from_device=c.to_device, from_port=c.to_port, to_device=c.from_device,
                                to_port=c.from_port, cable_type=c.cable_type, notes=c.notes, powers="from")
        if mode:
            c = SimpleNamespace(from_device=c.from_device, from_port=c.from_port, to_device=c.to_device,
                                to_port=c.to_port, cable_type=c.cable_type, notes=c.notes, combo=True)
            fed.add((c.from_device, c.to_device))
        data.append(c)
    feeds = []
    for p in _power_links(setup):
        if (p.from_device, p.to_device) in fed:
            continue
        # A power feed that runs between two devices already joined by a data cable shares that cable's lane.
        twin = next((i for i, c in enumerate(data)
                     if not getattr(c, "combo", False) and not _is_radio(c)
                     and {c.from_device, c.to_device} == {p.from_device, p.to_device}), None)
        if twin is None:
            feeds.append(p)
            continue
        c = data[twin]
        data[twin] = SimpleNamespace(
            from_device=p.from_device, from_port=c.from_port if c.from_device == p.from_device else c.to_port,
            to_device=p.to_device, to_port=c.to_port if c.to_device == p.to_device else c.from_port,
            cable_type=c.cable_type, notes=c.notes, combo=True)
        fed.add((p.from_device, p.to_device))
    return data + feeds


def _components(names, connections):
    adj: dict[str, set[str]] = {n: set() for n in names}
    for c in connections:
        if c.from_device != c.to_device:
            adj[c.from_device].add(c.to_device)
            adj[c.to_device].add(c.from_device)
    seen, comps = set(), []
    for start in sorted(names, key=lambda n: (-len(adj[n]), n)):
        if start in seen:
            continue
        seen.add(start)
        comp, queue = [], deque([start])
        while queue:
            n = queue.popleft()
            comp.append(n)
            for m in sorted(adj[n]):
                if m not in seen:
                    seen.add(m)
                    queue.append(m)
        comps.append(comp)
    return adj, comps


def _boxes_clear(centers, name, c, gap):
    x, y = c
    for other, (ox, oy) in centers.items():
        if other != name and abs(x - ox) < BOX_W + gap and abs(y - oy) < BOX_H + gap:
            return False
    return True


def _pick_hubs(comp, deg):
    """Hubs are chosen by data links only; power feeds never make a device central."""
    hubs = [n for n in comp if deg[n] >= 3]
    if not hubs:
        hubs = [max(comp, key=lambda n: (deg[n], n))]
    return sorted(hubs, key=lambda n: (-deg[n], n))


def _assign_clusters(comp, adj, hubs):
    """Every non-hub device joins the cluster of a neighbouring hub (nearest hub for deeper ones)."""
    owner = {h: h for h in hubs}
    size = {h: 1 for h in hubs}
    first = [n for n in comp if n not in owner and any(m in owner for m in adj[n])]
    for n in sorted(first, key=lambda n: (sum(m in owner for m in adj[n]), n)):
        h = min((m for m in adj[n] if m in hubs), key=lambda m: (size[m], m))
        owner[n] = h
        size[h] += 1
    queue = deque(sorted(owner))
    while queue:
        n = queue.popleft()
        for m in sorted(adj[n]):
            if m not in owner:
                owner[m] = owner[n]
                queue.append(m)
    clusters: dict[str, list[str]] = {h: [] for h in hubs}
    for n, h in owner.items():
        clusters[h].append(n)
    return clusters


def _layout_cluster(hub, members, adj, order1=None, rot=0.0):
    """Hub in the middle, its direct neighbours on a ring, deeper devices on outer rings."""
    mset = set(members)
    local = {n: adj[n] & mset for n in members}
    levels = [[hub]]
    placed = {hub}
    while True:
        nxt = sorted({m for n in levels[-1] for m in local[n] if m not in placed})
        if not nxt:
            break
        placed.update(nxt)
        levels.append(nxt)
    if len(levels) > 1 and order1:
        levels[1] = [n for n in order1 if n in levels[1]] + [n for n in levels[1] if n not in order1]

    centers = {hub: (0.0, 0.0)}
    angles = {hub: 0.0}
    rx, ry = 0.0, 0.0
    for depth, ring in enumerate(levels[1:], start=1):
        def desired(n):
            xs = [angles[m] for m in local[n] if m in angles]
            if not xs:
                return 0.0
            return math.atan2(sum(math.sin(a) for a in xs), sum(math.cos(a) for a in xs))

        ring = sorted(ring, key=desired) if depth > 1 else ring
        n = len(ring)
        start = desired(ring[0]) if depth > 1 else ((0.0 if n <= 2 else -math.pi / 2) + rot)
        step = 2 * math.pi / n if n > 2 else math.pi
        rx = max(rx + BOX_W + GAP_X * 0.9, 340.0)
        ry = max(ry + BOX_H + GAP_Y * 1.1, 200.0)
        while True:
            trial = {m: (rx * math.cos(start + k * step), ry * math.sin(start + k * step)) for k, m in enumerate(ring)}
            all_c = {**centers, **trial}
            if all(_boxes_clear(all_c, m, trial[m], 40) for m in ring):
                break
            rx *= 1.08
            ry *= 1.08
        for k, m in enumerate(ring):
            centers[m] = trial[m]
            angles[m] = start + k * step
    return centers


def _orient(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _cross(p1, p2, p3, p4):
    d1, d2 = _orient(p3, p4, p1), _orient(p3, p4, p2)
    d3, d4 = _orient(p1, p2, p3), _orient(p1, p2, p4)
    return d1 * d2 < 0 and d3 * d4 < 0


def _group_cost(centers, groups):
    cost = 0.0
    for members in groups:
        ms = [m for m in members if m in centers]
        if len(ms) < 2:
            continue
        x0 = min(centers[m][0] for m in ms) - BOX_W / 2 - 20
        x1 = max(centers[m][0] for m in ms) + BOX_W / 2 + 20
        y0 = min(centers[m][1] for m in ms) - BOX_H / 2 - 20
        y1 = max(centers[m][1] for m in ms) + BOX_H / 2 + 20
        for n, (x, y) in centers.items():
            if n not in members and x0 < x < x1 and y0 < y < y1:
                cost += 400
    return cost


def _layout_cost(centers, edge_pairs, groups=()):
    cost = _group_cost(centers, groups)
    segs = [(a, b, centers[a], centers[b]) for a, b in edge_pairs]
    for i, (a, b, pa, pb) in enumerate(segs):
        cost += 0.01 * math.dist(pa, pb)
        for c, d, pc, pd in segs[i + 1:]:
            if len({a, b, c, d}) == 4 and _cross(pa, pb, pc, pd):
                cost += 1000
        for n, (x, y) in centers.items():
            if n not in (a, b) and _seg_hits_rect(
                pa, pb, (x - BOX_W / 2 - 4, y - BOX_H / 2 - 4, x + BOX_W / 2 + 4, y + BOX_H / 2 + 4)
            ):
                cost += 300
    return cost


def _pack_blocks(blocks, gap):
    """Shelf-pack (local_positions, w, h) blocks; returns positions, width, height."""
    max_row = max(max((b[1] for b in blocks), default=0), 3 * BOX_W + 2 * GAP_X)
    total = sum((b[1] + gap) * (b[2] + gap) for b in blocks)
    max_row = max(max_row, math.sqrt(total) * 1.3)
    pos, x, y, row_h, width = {}, 0.0, 0.0, 0.0, 0.0
    for local, w, h in blocks:
        if x > 0 and x + w > max_row:
            x, y, row_h = 0.0, y + row_h + gap, 0.0
        for n, (lx, ly) in local.items():
            pos[n] = (x + lx, y + ly)
        width = max(width, x + w)
        row_h = max(row_h, h)
        x += w + gap
    return pos, width, y + row_h


def _block(centers):
    x0 = min(x for x, _ in centers.values()) - BOX_W / 2
    y0 = min(y for _, y in centers.values()) - BOX_H / 2
    local = {n: (x - BOX_W / 2 - x0, y - BOX_H / 2 - y0) for n, (x, y) in centers.items()}
    return local, max(x for x, _ in local.values()) + BOX_W, max(y for _, y in local.values()) + BOX_H


def _connected(hub, members, adj):
    mset = set(members)
    seen, stack = {hub}, [hub]
    while stack:
        for m in adj[stack.pop()] & mset:
            if m not in seen:
                seen.add(m)
                stack.append(m)
    return len(seen) == len(mset)


def _move_member(clusters, adj, hubs, rng):
    """Move one non-hub device to the cluster of another neighbouring hub's group."""
    owner = {n: h for h, ms in clusters.items() for n in ms}
    options = []
    for n, h in owner.items():
        if n in hubs:
            continue
        for m in adj[n]:
            if owner[m] != h:
                options.append((n, h, owner[m]))
    if not options:
        return False
    n, old, new = rng.choice(options)
    rest = [x for x in clusters[old] if x != n]
    if not _connected(old, rest, adj) or not _connected(new, clusters[new] + [n], adj):
        return False
    clusters[old] = rest
    clusters[new] = clusters[new] + [n]
    return True


def _circle_layout(comp, edge_pairs, rng, groups=()):
    """Fallback: all devices on one ellipse; the order is searched to avoid crossings."""
    n = len(comp)

    def place(order):
        rx, ry = 340.0, 200.0
        while True:
            cen = {m: (rx * math.cos(2 * math.pi * k / n - math.pi / 2), ry * math.sin(2 * math.pi * k / n - math.pi / 2))
                   for k, m in enumerate(order)}
            if all(_boxes_clear(cen, m, cen[m], 40) for m in order):
                return cen
            rx *= 1.06
            ry *= 1.06

    order = list(comp)
    best = place(order)
    best_cost = _layout_cost(best, edge_pairs, groups)
    for _ in range(min(2500, 150 * n)):
        if best_cost < 1:
            break
        cand = list(order)
        i, j = rng.sample(range(n), 2)
        cand[i], cand[j] = cand[j], cand[i]
        cen = place(cand)
        cost = _layout_cost(cen, edge_pairs, groups)
        if cost < best_cost:
            order, best, best_cost = cand, cen, cost
    x0 = min(x for x, _ in best.values())
    y0 = min(y for _, y in best.values())
    return {m: (x - x0 + BOX_W / 2, y - y0 + BOX_H / 2) for m, (x, y) in best.items()}, best_cost


def _layout_component(comp, adj, edge_pairs, groups=(), deg=None):
    """Each hub is the centre of its own cluster; hubs are peers. Arrangement is searched for no crossings."""
    hubs = _pick_hubs(comp, deg or {n: len(adj[n]) for n in comp})
    chamber_of = {m: i for i, g in enumerate(groups) for m in g}
    clusters = _assign_clusters(comp, adj, hubs)
    state = {
        "order": list(hubs),
        "clusters": {h: list(m) for h, m in clusters.items()},
        "perm": {h: sorted(adj[h] & set(clusters[h]), key=lambda n: (chamber_of.get(n, -1), n)) for h in hubs},
        "rot": {h: 0 for h in hubs},
    }

    def build(st):
        blocks = []
        for h in st["order"]:
            cen = _layout_cluster(h, st["clusters"][h], adj, st["perm"][h], st["rot"][h] * math.pi / 4)
            blocks.append((h, _block(cen)))
        pos, w, hgt = _pack_blocks([b for _, b in blocks], GAP_X)
        centers = {n: (x + BOX_W / 2, y + BOX_H / 2) for n, (x, y) in pos.items()}
        return centers, pos, w, hgt

    def clone(st):
        return {"order": list(st["order"]), "clusters": {h: list(m) for h, m in st["clusters"].items()}, "perm": {h: list(p) for h, p in st["perm"].items()}, "rot": dict(st["rot"])}

    best = state
    best_centers, best_pos, best_w, best_h = build(best)
    best_cost = _layout_cost(best_centers, edge_pairs, groups)
    rng = random.Random(7)
    if len(comp) > 2 and best_cost >= 1:
        for _ in range(min(2500, 200 * len(comp))):
            cand = clone(best)
            move = rng.random()
            h = rng.choice(hubs)
            if move < 0.4 and len(cand["perm"][h]) > 1:
                a, b = rng.sample(range(len(cand["perm"][h])), 2)
                cand["perm"][h][a], cand["perm"][h][b] = cand["perm"][h][b], cand["perm"][h][a]
            elif move < 0.6:
                cand["rot"][h] = rng.randrange(8)
            elif move < 0.75 and len(hubs) > 1:
                if not _move_member(cand["clusters"], adj, hubs, rng):
                    continue
            elif len(hubs) > 1:
                a, b = rng.sample(range(len(hubs)), 2)
                cand["order"][a], cand["order"][b] = cand["order"][b], cand["order"][a]
            else:
                continue
            centers, pos, w, hgt = build(cand)
            cost = _layout_cost(centers, edge_pairs, groups) + 0.0005 * w * hgt / 1000
            if cost < best_cost:
                best, best_cost, best_pos, best_w, best_h = cand, cost, pos, w, hgt
                if best_cost < 1:
                    break
    result = {n: (x + BOX_W / 2, y + BOX_H / 2) for n, (x, y) in best_pos.items()}
    if best_cost >= 300 and len(comp) > 3:
        alt, alt_cost = _circle_layout(comp, edge_pairs, rng, groups)
        if alt_cost < best_cost:
            return alt
    return result


def _layout(names, connections, groups=()):
    adj, comps = _components(names, connections)
    deg: dict[str, set] = {n: set() for n in names}
    for c in connections:
        if not getattr(c, "power", False) and c.from_device != c.to_device:
            deg[c.from_device].add(c.to_device)
            deg[c.to_device].add(c.from_device)
    deg = {n: len(v) for n, v in deg.items()}
    pairs = sorted({tuple(sorted((c.from_device, c.to_device))) for c in connections if c.from_device != c.to_device})
    blocks = []
    for comp in comps:
        cset = set(comp)
        blocks.append(_block(_layout_component(comp, adj, [p for p in pairs if p[0] in cset], groups, deg)))
    pos, w, h = _pack_blocks(blocks, GAP_X)
    pos = {n: (x + MARGIN, y + MARGIN) for n, (x, y) in pos.items()}
    return pos, w + MARGIN * 2, h + MARGIN * 2


def _rect(pos, name, grow=0):
    x, y = pos[name]
    return (x - grow, y - grow, x + BOX_W + grow, y + BOX_H + grow)


def _seg_hits_rect(p, q, r):
    """Liang-Barsky segment vs. rectangle intersection."""
    x0, y0, x1, y1 = r
    dx, dy = q[0] - p[0], q[1] - p[1]
    t0, t1 = 0.0, 1.0
    for pp, qq in ((-dx, p[0] - x0), (dx, x1 - p[0]), (-dy, p[1] - y0), (dy, y1 - p[1])):
        if pp == 0:
            if qq < 0:
                return False
        else:
            t = qq / pp
            if pp < 0:
                if t > t1:
                    return False
                t0 = max(t0, t)
            else:
                if t < t0:
                    return False
                t1 = min(t1, t)
    return t0 <= t1


def _clip_from_inside(inside, toward, r):
    """Point where the segment inside->toward leaves rectangle r."""
    x0, y0, x1, y1 = r
    dx, dy = toward[0] - inside[0], toward[1] - inside[1]
    ts = []
    if dx > 0:
        ts.append((x1 - inside[0]) / dx)
    elif dx < 0:
        ts.append((x0 - inside[0]) / dx)
    if dy > 0:
        ts.append((y1 - inside[1]) / dy)
    elif dy < 0:
        ts.append((y0 - inside[1]) / dy)
    t = min((t for t in ts if t >= 0), default=0)
    return (inside[0] + dx * t, inside[1] + dy * t)


def _edge_label(c):
    if getattr(c, "power", False):
        return "Power"
    if getattr(c, "combo", False):
        return " ".join(x for x in (f"{c.from_port or ''} \u2192 {c.to_port or ''}".strip(), f"({c.cable_type})" if c.cable_type else "") if x) + " + power"
    mode = {"conducted": "conducted", "hybrid": "hybrid"}.get(getattr(c, "radio_mode", "") or "")
    if mode:
        base = c.from_port if c.from_port == c.to_port else f"{c.from_port or ''} \u2192 {c.to_port or ''}"
        return " ".join(x for x in (base, f"({mode})", f"({c.cable_type})" if c.cable_type else "") if x)
    if c.from_port and c.from_port == c.to_port:
        ports = c.from_port
    else:
        ports = f"{c.from_port or ''} \u2192 {c.to_port or ''}" if (c.from_port or c.to_port) else ""
    return " ".join(p for p in (ports, f"({c.cable_type})" if c.cable_type else "") if p)


def _overlap(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    return w * h if w > 0 and h > 0 else 0


def _polyline_point(pts, t):
    """Point and unit normal at fraction t of the polyline's total length."""
    lengths = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    target = sum(lengths) * t
    for i, ln in enumerate(lengths):
        if target <= ln or i == len(lengths) - 1:
            f = target / ln if ln else 0
            a, b = pts[i], pts[i + 1]
            x, y = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
            d = ln or 1
            return (x, y), (-(b[1] - a[1]) / d, (b[0] - a[0]) / d)
        target -= ln
    return pts[0], (0, 1)


GRID = 20
TOP_SLACK = 10


def _simplify(pts):
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = out[-1], pts[i], pts[i + 1]
        if (abs(a[0] - b[0]) < 1e-6 and abs(b[0] - c[0]) < 1e-6) or (abs(a[1] - b[1]) < 1e-6 and abs(b[1] - c[1]) < 1e-6):
            continue
        out.append(b)
    out.append(pts[-1])
    return out


def _route(connections, pos, width, height, chambers=None):
    """Orthogonal routing on a grid: no lines through foreign boxes or chambers, few bends,
    and a rip-up/re-route loop that removes crossings and overlaps between links."""
    import heapq

    cols, rows = int(width // GRID) + 1, int(height // GRID) + 1
    frames = dict(_frames(chambers, pos)) if chambers else {}
    member_of = {m: k for k, v in (chambers or {}).items() for m in v}

    def cells_in(r):
        i0, i1 = max(0, int(math.floor(r[0] / GRID - 0.5)) + 1), min(cols - 1, int(math.ceil(r[2] / GRID - 0.5)) - 1)
        j0, j1 = max(0, int(math.floor(r[1] / GRID - 0.5)) + 1), min(rows - 1, int(math.ceil(r[3] / GRID - 0.5)) - 1)
        return {(i, j) for i in range(i0, i1 + 1) for j in range(j0, j1 + 1)
                if r[0] <= i * GRID + GRID / 2 <= r[2] and r[1] <= j * GRID + GRID / 2 <= r[3]}

    node_block = {n: cells_in(_grow(_rect(pos, n), 8)) for n in pos}
    own_block = {n: cells_in(_rect(pos, n)) for n in pos}
    frame_block = {k: cells_in(_grow(fr, 6)) for k, fr in frames.items()}

    def ring(n, wide=False):
        """Ports on the left, right and top of the icon; the bottom (under the caption) is for the outlet feed only."""
        x0, y0, x1, y1 = _rect(pos, n)
        ix0 = x0 + (BOX_W - ICON_PX) / 2
        ix1, iy0 = ix0 + ICON_PX, y0 + 2
        iy1 = iy0 + ICON_PX
        out = []
        for i in range(cols):
            cx = i * GRID + GRID / 2
            for j in range(rows):
                cy = j * GRID + GRID / 2
                if (x0 <= cx <= x1 if wide else ix0 - TOP_SLACK <= cx <= ix1 + TOP_SLACK) and y0 - GRID <= cy < y0:
                    out.append(((i, j), 3, (cx, iy0)))
                elif iy0 <= cy <= iy1 and x1 < cx <= x1 + GRID:
                    out.append(((i, j), 0, (ix1, cy)))
                elif iy0 <= cy <= iy1 and x0 - GRID <= cx < x0:
                    out.append(((i, j), 2, (ix0, cy)))
                elif ix0 <= cx <= ix1 and y1 < cy <= y1 + GRID:
                    out.append(((i, j), 1, (cx, y1)))
        return out

    # Cells on a chamber border: a link may cross there but must not run along it.
    hband: set = set()
    vband: set = set()
    for fr in frames.values():
        x0, y0, x1, y1 = fr
        for i in range(cols):
            cx = i * GRID + GRID / 2
            for j in range(rows):
                cy = j * GRID + GRID / 2
                if x0 - 11 <= cx <= x1 + 11 and (abs(cy - y0) <= 11 or abs(cy - y1) <= 11):
                    hband.add((i, j))
                if y0 - 11 <= cy <= y1 + 11 and (abs(cx - x0) <= 11 or abs(cx - x1) <= 11):
                    vband.add((i, j))

    # Ports hug the icon so every line visibly starts at it; only a device with more links than such ports
    # falls back to ports along the whole top edge.
    degree: dict = {}
    for c in connections:
        if c.from_device != c.to_device:
            for n in (c.from_device, c.to_device):
                degree[n] = degree.get(n, 0) + 1
    rings = {}
    for n in pos:
        rings[n] = ring(n)
        if degree.get(n, 0) > sum(1 for _c, d, _p in rings[n] if d != 1):
            rings[n] = ring(n, wide=True)
    DIRS = [(1, 0), (0, 1), (-1, 0), (0, -1)]
    groups: list = []
    for c in connections:
        if c.from_device != c.to_device and c.from_device in pos and c.to_device in pos:
            groups.append(c)
    # Short links first; a stable order keeps results reproducible.
    def dist(c):
        pa, pb = pos[c.from_device], pos[c.to_device]
        return abs(pa[0] - pb[0]) + abs(pa[1] - pb[1])

    order = sorted(range(len(groups)), key=lambda i: dist(groups[i]))
    occ: dict = {}
    routes: dict = {}
    penalty: dict = {}
    hist: dict = {}  # cells that keep ending up in conflicts get dearer, so links learn to avoid them

    def route_one(idx, strict=True, bend=10):
        c = groups[idx]
        a, b = c.from_device, c.to_device
        blocked = set(own_block[a]) | set(own_block[b])
        for n in pos:
            if n not in (a, b):
                blocked |= node_block[n]
        for k, cells in frame_block.items():
            if k != member_of.get(a) and k != member_of.get(b):
                blocked |= cells
        # The feed from the wall outlet enters the powered device from below and leaves the outlet upwards,
        # so it never shares a lane with the device's other power link.
        feed = OUTLET_KEY in (a, b)

        def usable(n, d):
            if not feed:
                return d != 1
            if strict:
                return d in (3, 0, 2) if n == OUTLET_KEY else d == 1
            return d != 1 or n != OUTLET_KEY
        starts = [(cell, d, pt) for cell, d, pt in rings[a] if cell not in blocked and usable(a, d)]
        goals = {cell: (d, pt) for cell, d, pt in rings[b] if cell not in blocked and usable(b, d)}
        if not starts or not goals:
            return None
        gx = [cell for cell in goals]
        tx = sum(g[0] for g in gx) / len(gx)
        ty = sum(g[1] for g in gx) / len(gx)
        ends_here = {a, b}

        def step_cost(cell, mdir):
            pen = 0.0
            if (mdir in (0, 2) and cell in hband) or (mdir in (1, 3) and cell in vband):
                pen += 80
            pen += hist.get(cell, 0)
            for other, orient in occ.get(cell, ()):
                if orient == "b" or orient != ("h" if mdir in (0, 2) else "v"):
                    pen += 160
                else:
                    pen += 90
            return pen

        heap, best = [], {}
        for cell, d, _ in starts:
            st = (cell, d)
            cost0 = step_cost(cell, d) + (12 if a == OUTLET_KEY and d != 3 else 0)
            best[st] = cost0
            heapq.heappush(heap, (cost0 + abs(cell[0] - tx) + abs(cell[1] - ty), cost0, cell, d, None))
        came: dict = {}
        found = None
        while heap:
            _, g, cell, d, prev = heapq.heappop(heap)
            st = (cell, d)
            if best.get(st, 1e18) < g - 1e-9 or st in came:
                continue
            came[st] = prev
            if cell in goals:
                found = st
                break
            for nd, (dx, dy) in enumerate(DIRS):
                if (nd + 2) % 4 == d:
                    continue
                ni, nj = cell[0] + dx, cell[1] + dy
                if not (0 <= ni < cols and 0 <= nj < rows) or (ni, nj) in blocked:
                    continue
                ng = g + 1 + (bend if nd != d else 0) + step_cost((ni, nj), nd)
                nst = ((ni, nj), nd)
                if ng < best.get(nst, 1e18):
                    best[nst] = ng
                    heapq.heappush(heap, (ng + abs(ni - tx) + abs(nj - ty), ng, (ni, nj), nd, st))
        if not found:
            return None
        seq, st = [], found
        while st is not None:
            seq.append(st)
            st = came[st]
        seq.reverse()
        cellpts = [(cx * GRID + GRID / 2, cy * GRID + GRID / 2) for (cx, cy), _ in seq]
        sd = next(pt for cell, d, pt in rings[a] if cell == seq[0][0])
        ed = goals[seq[-1][0]][1]
        pts = [sd] + cellpts + [ed]
        # Border points must be reached straight: align them to the first/last cell centre.
        p0, p1 = cellpts[0], cellpts[-1]
        pts[0] = (p0[0], sd[1]) if abs(sd[0] - p0[0]) > 1e-6 and abs(sd[1] - p0[1]) > 1e-6 else sd
        pts[-1] = (p1[0], ed[1]) if abs(ed[0] - p1[0]) > 1e-6 and abs(ed[1] - p1[1]) > 1e-6 else ed
        pts = _simplify(pts)
        cells_used = [(cell, "h" if i + 1 < len(seq) and seq[i + 1][1] in (0, 2) else "v") for i, (cell, _) in enumerate(seq)]
        for i, (cell, d) in enumerate(seq):
            prev_d = seq[i - 1][1] if i else d
            orient = "b" if (i and prev_d != d) else ("h" if d in (0, 2) else "v")
            cells_used[i] = (cell, orient)
        total = 0.0
        for cell, orient in cells_used:
            total += step_cost(cell, 0 if orient == "h" else 1) if orient != "b" else step_cost(cell, 0)
        return pts, cells_used, total

    def drop(idx):
        for cell, orient in routes.get(idx, ([], []))[1]:
            lst = occ.get(cell)
            if lst:
                lst[:] = [x for x in lst if x[0] != idx]

    def put(idx, res):
        routes[idx] = (res[0], res[1])
        penalty[idx] = res[2]
        for cell, orient in res[1]:
            occ.setdefault(cell, []).append((idx, orient))

    def conflict(idx, cells):
        """Cells this route shares with other links: 0 for a clean route, shared-device overlaps count less."""
        tot = 0.0
        for cell, orient in cells:
            tot += sum(1 for other, _o in occ.get(cell, ()) if other != idx)
        return tot

    def bend_count(pts):
        return sum(1 for a, b, c in zip(pts, pts[1:], pts[2:]) if (abs(a[0] - b[0]) < 1e-6) != (abs(b[0] - c[0]) < 1e-6))

    fallback: set = set()
    for idx in order:
        res = route_one(idx) or route_one(idx, False)
        if res is None:
            fallback.add(idx)
            continue
        put(idx, res)
    rng = random.Random(3)
    t_route = time.monotonic()
    for _ in range(60):
        bad = [i for i in routes if penalty.get(i, 0) > 0]
        if not bad or time.monotonic() - t_route > ROUTE_BUDGET_S:
            break
        for i in bad:
            for cell, orient in routes[i][1]:
                if any(o != i for o, _ in occ.get(cell, ())):
                    hist[cell] = hist.get(cell, 0) + 30
        rng.shuffle(bad)
        for idx in bad:
            drop(idx)
            res = route_one(idx) or route_one(idx, False)
            if res is None:
                put(idx, (routes[idx][0], [], 0))
                continue
            put(idx, res)
        for idx in list(routes):
            penalty[idx] = conflict(idx, routes[idx][1])

    # Polish: re-lay every bendy link with a heavier bend cost and keep the result only if it is cleaner.
    for idx in order:
        if idx not in routes or bend_count(routes[idx][0]) <= 1:
            continue
        old = routes[idx]
        drop(idx)
        old_conf = conflict(idx, old[1])
        res = route_one(idx, bend=22)
        if res and conflict(idx, res[1]) <= old_conf and bend_count(res[0]) < bend_count(old[0]):
            put(idx, res)
        else:
            put(idx, (old[0], old[1], old_conf))

    edges = []
    for idx, c in enumerate(groups):
        a, b = c.from_device, c.to_device
        if idx in routes and routes[idx][0]:
            pts = routes[idx][0]
        else:
            ca = (pos[a][0] + BOX_W / 2, pos[a][1] + BOX_H / 2)
            cb = (pos[b][0] + BOX_W / 2, pos[b][1] + BOX_H / 2)
            pts = [_clip_from_inside(ca, cb, _rect(pos, a)), _clip_from_inside(cb, ca, _rect(pos, b))]
        edges.append({"c": c, "src": a, "dst": b, "full": pts, "path": pts})
    return edges


def _rounded_path(pts, r=14):
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for i in range(1, len(pts) - 1):
        p, q, n = pts[i - 1], pts[i], pts[i + 1]
        l1, l2 = math.dist(p, q) or 1, math.dist(q, n) or 1
        rr = min(r, l1 / 2, l2 / 2)
        a = (q[0] - (q[0] - p[0]) / l1 * rr, q[1] - (q[1] - p[1]) / l1 * rr)
        b = (q[0] + (n[0] - q[0]) / l2 * rr, q[1] + (n[1] - q[1]) / l2 * rr)
        d += f" L{a[0]:.1f},{a[1]:.1f} Q{q[0]:.1f},{q[1]:.1f} {b[0]:.1f},{b[1]:.1f}"
    return d + f" L{pts[-1][0]:.1f},{pts[-1][1]:.1f}"


def _offset_path(pts, off):
    """Parallel copy of an orthogonal polyline, shifted `off` px to the left of its direction."""
    def unit(p, q):
        l = math.dist(p, q) or 1
        return ((q[0] - p[0]) / l, (q[1] - p[1]) / l)
    out = []
    for i, q in enumerate(pts):
        a = unit(pts[i - 1], q) if i > 0 else None
        b = unit(q, pts[i + 1]) if i < len(pts) - 1 else None
        nx = sum(-u[1] for u in (a, b) if u)
        ny = sum(u[0] for u in (a, b) if u)
        if a and b and abs(a[0] * b[0] + a[1] * b[1]) < 0.5:
            out.append((q[0] + nx * off, q[1] + ny * off))
        else:
            u = a or b
            out.append((q[0] - u[1] * off, q[1] + u[0] * off))
    return out


def _place_labels(edges, pos, width, height, frames=()):
    """Put each label beside its link: above a horizontal link, to the left of a vertical one."""
    node_rects = [_rect(pos, n, 2) for n in pos]
    placed: list[tuple] = []
    borders = []
    for _, (x0, y0, x1, y1) in frames:
        borders += [((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))]
    for e in sorted(edges, key=lambda e: -len(_edge_label(e["c"]))):
        text = _edge_label(e["c"])
        e["label"] = None
        if not text:
            continue
        w = len(text) * CHAR_W + PAD * 2
        best = None
        for t in (0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8):
            (px, py), (nx, ny) = _polyline_point(e["path"], t)
            horizontal = abs(ny) >= abs(nx)
            preferred = (-1 if ny > 0 else 1) if horizontal else (-1 if nx > 0 else 1)
            for side in (preferred, -preferred):
                for dist in range(4, 80, 3):
                    # dist is the gap to the link; the label centre sits half its extent further out.
                    reach = dist + abs(nx) * w / 2 + abs(ny) * LABEL_H / 2
                    x, y = px + nx * side * reach, py + ny * side * reach
                    rect = (x - w / 2, y - LABEL_H / 2, x + w / 2, y + LABEL_H / 2)
                    grown = (rect[0] - 3, rect[1] - 3, rect[2] + 3, rect[3] + 3)
                    if any(_seg_hits_rect(e["path"][k], e["path"][k + 1], grown) for k in range(len(e["path"]) - 1)):
                        continue
                    outside = (rect[2] - rect[0]) * LABEL_H - _overlap(rect, (0, 0, width, height))
                    crossings = sum(
                        1
                        for o in edges
                        if o is not e
                        for k in range(len(o["path"]) - 1)
                        if _seg_hits_rect(o["path"][k], o["path"][k + 1], rect)
                    )
                    on_border = sum(1 for a, b in borders if _seg_hits_rect(a, b, grown))
                    cost = (
                        on_border * 600
                        + sum(_overlap(rect, r) for r in node_rects + placed)
                        + outside * 10
                        + crossings * 400
                        + dist * 2
                        + (30 if side != preferred else 0)
                        + abs(t - 0.5) * 20
                    )
                    if best is None or cost < best[0]:
                        best = (cost, x, y, rect, t, side * reach)
                    break
        if best is None:
            (px, py), _ = _polyline_point(e["path"], 0.5)
            best = (0, px, py - 14, (px - w / 2, py - 23, px + w / 2, py - 5), 0.5, -14)
        _, x, y, rect, t, perp = best
        placed.append(rect)
        e["label"] = {"x": x, "y": y, "text": text, "perp": perp, "t": _fraction(e, x, y, t)}


def _fraction(e, x, y, fallback):
    pts = e["full"]
    total = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)) or 1
    best, acc, best_t = None, 0.0, fallback
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        ln = math.dist(a, b) or 1
        f = max(0, min(1, ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / ln**2))
        px, py = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
        d = math.hypot(x - px, y - py)
        if best is None or d < best:
            best, best_t = d, (acc + ln * f) / total
        acc += ln
    return best_t


def _chambers(setup, nodes):
    groups: dict[str, set[str]] = {}
    for d in setup.devices:
        loc = (d.location or "").strip()
        if CHAMBER_RE.match(loc) and d.name in nodes:
            groups.setdefault(loc, set()).add(d.name)
    return dict(sorted(groups.items()))


def _frames(chambers, pos):
    """Chamber frames; a chamber is skipped when another device would end up inside its frame."""
    frames = []
    for label, members in chambers.items():
        members = {m for m in members if m in pos}
        if not members:
            continue
        rects = [_rect(pos, m) for m in members]
        fr = (min(r[0] for r in rects) - 22, min(r[1] for r in rects) - 36,
              max(r[2] for r in rects) + 22, max(r[3] for r in rects) + 22)
        if any(n not in members and _overlap(fr, _rect(pos, n)) for n in pos):
            continue
        frames.append((label, fr))
    return frames


def _inline_chains(setup, nodes, all_conns, chambers=None):
    """Chains of attenuators (each with exactly two data links) sit on the cable they interrupt."""
    overrides = getattr(setup, "icon_overrides", None)
    cand = {n for n, (_, _, t) in nodes.items() if n != OUTLET_KEY and icon_kind(t, overrides) == "attenuator"}
    nbrs = {}
    for n in cand:
        links = [c for c in all_conns if n in (c.from_device, c.to_device) and not getattr(c, "power", False)]
        if any(c.from_device == c.to_device for c in links) or len(links) < 2:
            continue
        ends = [c.to_device if c.from_device == n else c.from_device for c in links]
        if len(ends) > 2:
            # Extra links are control links (e.g. USB to a PC): the signal path is the pair in different chambers.
            where = {m: k for k, v in (chambers or {}).items() for m in v}
            pairs = [(x, y) for i, x in enumerate(ends) for y in ends[i + 1:]
                     if x != y and where.get(x) and where.get(y) and where[x] != where[y]]
            if len(pairs) != 1:
                continue
            ends = list(pairs[0])
        if ends[0] != ends[1]:
            nbrs[n] = ends
    chains, seen = [], set()
    for n in sorted(nbrs):
        if n in seen:
            continue
        # Walk to one end of the run of attenuators, then collect it in order.
        first, prev = n, None
        while True:
            nxt = [x for x in nbrs[first] if x != prev and x in nbrs]
            if not nxt or nxt[0] == n:
                break
            prev, first = first, nxt[0]
        run, prev, cur = [], None, first
        while cur in nbrs and cur not in seen:
            seen.add(cur)
            run.append(cur)
            nxt = [x for x in nbrs[cur] if x != prev]
            prev, cur = cur, (nxt[0] if nxt else None)
            if cur is None:
                break
        if len(run) == 1:
            a, b = nbrs[run[0]]
        else:
            a = next(x for x in nbrs[run[0]] if x not in run)
            b = next(x for x in nbrs[run[-1]] if x not in run)
        if a == b or a in nbrs or b in nbrs:
            continue
        chains.append({"atts": run, "a": a, "b": b})
    return chains


def _center(pos, n):
    return pos[n][0] + BOX_W / 2, pos[n][1] + BOX_H / 2


def _find_chain_spot(chain, pos, frames, others):
    """Centres for the attenuators of a chain along the A-B line, in the middle of the longest clear stretch."""
    a, b, k = chain["a"], chain["b"], len(chain["atts"])
    ax, ay = _center(pos, a)
    bx, by = _center(pos, b)
    length = math.hypot(bx - ax, by - ay) or 1.0
    ux, uy = (bx - ax) / length, (by - ay) / length
    step = min(BOX_W / max(abs(ux), 1e-6), BOX_H / max(abs(uy), 1e-6)) + 30 if k > 1 else 0
    obstacles = [_grow(fr, 20) for _, fr in frames] + [_rect(pos, a, 50), _rect(pos, b, 50)] + [_rect(pos, n, 6) for n in others]
    samples = max(40, int(length / 6))
    run_best, run_start, feasible = (0, None), None, []
    for i in range(samples + 1):
        s0 = length * i / samples
        ok = True
        for j in range(k):
            cx, cy = ax + ux * (s0 + j * step), ay + uy * (s0 + j * step)
            if (s0 + j * step) > length:
                ok = False
                break
            r = (cx - BOX_W / 2, cy - BOX_H / 2, cx + BOX_W / 2, cy + BOX_H / 2)
            if any(_overlap(r, o) for o in obstacles):
                ok = False
                break
        feasible.append(ok)
    for i, ok in enumerate(feasible + [False]):
        if ok and run_start is None:
            run_start = i
        elif not ok and run_start is not None:
            if i - run_start > run_best[0]:
                run_best = (i - run_start, (run_start + i - 1) / 2)
            run_start = None
    if run_best[1] is None:
        return None
    s0 = length * run_best[1] / samples
    return [(ax + ux * (s0 + j * step), ay + uy * (s0 + j * step)) for j in range(k)]


def _settle_chains(chains, pos, base_groups):
    """Place every chain's attenuators on its cable (no spot found: spread them from the midpoint)."""
    members = {x for ch in chains for x in ch["atts"]}
    base = {n: p for n, p in pos.items() if n not in members}
    frames = _frames(base_groups, base)
    for ch in chains:
        spots = _find_chain_spot(ch, pos, frames, [n for n in base if n not in (ch["a"], ch["b"])])
        if spots is None:
            ax, ay = _center(pos, ch["a"])
            bx, by = _center(pos, ch["b"])
            k = len(ch["atts"])
            spots = [(ax + (bx - ax) * (i + 1) / (k + 1), ay + (by - ay) * (i + 1) / (k + 1)) for i in range(k)]
        for name, (cx, cy) in zip(ch["atts"], spots):
            pos[name] = (cx - BOX_W / 2, cy - BOX_H / 2)
    return pos


def _make_room(chains, pos, base_groups):
    """Initial layout: push the far side away until each chain fits between its two neighbours."""
    members = {x for ch in chains for x in ch["atts"]}
    for ch in chains:
        a, b, k = ch["a"], ch["b"], len(ch["atts"])
        for _ in range(10):
            base = {n: p for n, p in pos.items() if n not in members}
            frames = _frames(base_groups, base)
            if _find_chain_spot(ch, pos, frames, [n for n in base if n not in (a, b)]) is not None:
                break
            ax, ay = _center(pos, a)
            bx, by = _center(pos, b)
            length = math.hypot(bx - ax, by - ay) or 1.0
            ux, uy = (bx - ax) / length, (by - ay) / length
            mid = ((ax + bx) / 2) * ux + ((ay + by) / 2) * uy
            for n, (x, y) in list(pos.items()):
                if n not in members and (x + BOX_W / 2) * ux + (y + BOX_H / 2) * uy > mid:
                    pos[n] = (x + ux * 90 * k, y + uy * 90 * k)
    return pos


def _frame_rect(members, pos):
    rects = [_rect(pos, m) for m in members]
    return (min(r[0] for r in rects) - 22, min(r[1] for r in rects) - 36,
            max(r[2] for r in rects) + 22, max(r[3] for r in rects) + 22)


def _grow(r, g):
    return (r[0] - g, r[1] - g, r[2] + g, r[3] + g)


def _repair_frames(groups, pos):
    """Chambers are separate physical boxes: keep their frames apart and free of foreign devices."""
    in_chamber = set().union(*groups.values()) if groups else set()
    labels = [k for k, v in groups.items() if v]
    for _ in range(80):
        moved = False
        # 1. Chamber frames must never touch each other.
        for ai, a in enumerate(labels):
            for b in labels[ai + 1:]:
                fa, fb = _frame_rect(groups[a], pos), _frame_rect(groups[b], pos)
                if not _overlap(_grow(fa, 18), fb):
                    continue
                shifts = [
                    (fa[2] + 18 - fb[0], 0), (fa[0] - 18 - fb[2], 0),
                    (0, fa[3] + 18 - fb[1]), (0, fa[1] - 18 - fb[3]),
                ]
                dx, dy = min(shifts, key=lambda s: abs(s[0]) + abs(s[1]))
                for m in groups[b]:
                    pos[m] = (pos[m][0] + dx, pos[m][1] + dy)
                moved = True
        # 2. Devices that belong to no chamber must stay outside every frame.
        for label in labels:
            fr = _frame_rect(groups[label], pos)
            for n in list(pos):
                if n in in_chamber or not _overlap(fr, _rect(pos, n)):
                    continue
                x, y = pos[n]
                options = [(fr[0] - 8 - BOX_W, y), (fr[2] + 8, y), (x, fr[1] - 8 - BOX_H), (x, fr[3] + 8)]
                options.sort(key=lambda p: abs(p[0] - x) + abs(p[1] - y))
                pos[n] = next(
                    (p for p in options if not any(
                        m != n and _overlap(_grow((p[0], p[1], p[0] + BOX_W, p[1] + BOX_H), 10), _rect(pos, m))
                        for m in pos
                    )),
                    options[0],
                )
                moved = True
        if not moved:
            break
    # Last resort for free devices still overlapping something: search outward for a clear spot.
    frames = [_frame_rect(groups[k], pos) for k in labels]
    for n in [n for n in pos if n not in in_chamber]:
        def bad(p):
            r = (p[0], p[1], p[0] + BOX_W, p[1] + BOX_H)
            return any(_overlap(r, f) for f in frames) or any(
                m != n and _overlap(_grow(r, 8), _rect(pos, m)) for m in pos
            )
        if not bad(pos[n]):
            continue
        x, y = pos[n]
        for ring in range(1, 12):
            step = ring * 60
            cands = [(x + dx * step, y + dy * step) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
            ok = next((p for p in cands if p[0] >= 0 and p[1] >= 0 and not bad(p)), None)
            if ok:
                pos[n] = ok
                break
    return pos


def _count_crossings(edges):
    k = 0
    for i, e in enumerate(edges):
        for f in edges[i + 1:]:
            if any(_cross(a, b, p, q) for a, b in zip(e["path"], e["path"][1:]) for p, q in zip(f["path"], f["path"][1:])):
                k += 1
    return k


def _crossing_pairs(edges):
    out = []
    for i, e in enumerate(edges):
        for j in range(i + 1, len(edges)):
            f = edges[j]
            if any(_cross(a, b, p, q) for a, b in zip(e["path"], e["path"][1:]) for p, q in zip(f["path"], f["path"][1:])):
                out.append((i, j))
    return out


def _count_bends(edges):
    k = 0
    for e in edges:
        p = e["path"]
        k += sum(1 for a, b, c in zip(p, p[1:], p[2:]) if (abs(a[0] - b[0]) < 1e-6) != (abs(b[0] - c[0]) < 1e-6))
    return k


def _refine(pos, edge_pairs, groups, chains, width, height, seed=11):
    """Local search: no crossings, no overlaps, chambers apart, attenuators on their cables between the chambers."""
    in_att = {x for ch in chains for x in ch["atts"]}
    movable = [n for n in pos if n not in in_att]
    if len(movable) < 3:
        return pos
    names = list(pos)
    labels = [k for k, v in groups.items() if v]
    in_chamber = set().union(*groups.values()) if groups else set()

    def settle(p):
        return _settle_chains(chains, dict(p), groups) if chains else dict(p)

    def cost(p, parts=False):
        centers = {n: (x + BOX_W / 2, y + BOX_H / 2) for n, (x, y) in p.items()}
        rects = {n: _rect(p, n) for n in p}
        hard = 0.0
        segs = [(a, b, centers[a], centers[b]) for a, b in edge_pairs]
        for i, (a, b, pa, pb) in enumerate(segs):
            for c, d, pc, pd in segs[i + 1:]:
                if len({a, b, c, d}) == 4 and _cross(pa, pb, pc, pd):
                    hard += 1000
            for n in names:
                if n not in (a, b) and _seg_hits_rect(pa, pb, _grow(rects[n], 4)):
                    hard += 300
        frames = [(k, _frame_rect(groups[k], p)) for k in labels]
        for i, (_, fa) in enumerate(frames):
            for _, fb in frames[i + 1:]:
                if _overlap(_grow(fa, 18), fb):
                    hard += 2000
            for n in names:
                if n not in in_chamber and _overlap(fa, rects[n]):
                    hard += 2000
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                if _overlap(_grow(rects[a], 8), rects[b]):
                    hard += 2000
        length = sum(0.01 * math.dist(pa, pb) for _, _, pa, pb in segs)
        return hard if parts else hard + length

    best = settle(pos)
    best_cost = cost(best)
    if cost(best, True) == 0:
        return best
    iters = min(7000, 500 * len(names))
    start = dict(best)
    for attempt in range(3):
        rng = random.Random(seed + attempt * 101)
        best, best_cost = _anneal(cost, settle, start, best, best_cost, groups, labels, movable, rng, iters, width, height)
        if cost(best, True) == 0:
            break
    return best


def _anneal(cost, settle, start, best, best_cost, groups, labels, names, rng, iters, max_x, max_y):
    cur, cur_cost = dict(start), cost(start)
    for it in range(iters):
        temp = 400.0 * (1 - it / iters) + 1.0
        cand = dict(cur)
        r = rng.random()
        if r < 0.5:
            n = rng.choice(names)
            if rng.random() < 0.7:
                m = rng.choice(names)
                cand[n] = (cand[m][0] + rng.choice((-1, 1)) * rng.uniform(0.9, 2.2) * (BOX_W + 30) * rng.random(),
                           cand[m][1] + rng.choice((-1, 1)) * rng.uniform(0.9, 2.2) * (BOX_H + 30) * rng.random())
            else:
                cand[n] = (rng.uniform(0, max_x), rng.uniform(0, max_y))
        elif r < 0.7:
            a, b = rng.sample(names, 2)
            cand[a], cand[b] = cand[b], cand[a]
        elif labels:
            g = [m for m in groups[rng.choice(labels)] if m in cand]
            dx, dy = rng.randint(-6, 6) * 60, rng.randint(-6, 6) * 60
            for m in g:
                cand[m] = (cand[m][0] + dx, cand[m][1] + dy)
        else:
            continue
        if any(x < 0 or y < 0 for x, y in cand.values()):
            sx = min(0, min(x for x, _ in cand.values()))
            sy = min(0, min(y for _, y in cand.values()))
            cand = {n: (x - sx, y - sy) for n, (x, y) in cand.items()}
        cand = settle(cand)
        c = cost(cand)
        if c <= cur_cost or rng.random() < math.exp(-(c - cur_cost) / temp):
            cur, cur_cost = cand, c
            if c < best_cost:
                best, best_cost = cand, c
                if cost(best, True) == 0:
                    break
    return best, best_cost


def _slot_layout(names, all_conns, chambers, chains, seed=5, lone=()):
    """Chambers side by side, attenuators in the gap between them, everything else below.
    Nodes are assigned to fixed slots; an annealing search over the assignment removes crossings.
    Returns None when the setup does not fit this scheme."""
    if not chambers:
        return None
    order = list(chambers)
    where = {m: i for i, k in enumerate(order) for m in chambers[k]}
    in_att = {x for ch in chains for x in ch["atts"]} | set(lone)
    cw, chh = BOX_W + 60, BOX_H + 70
    units = []  # chain units: (gap index, ordered attenuators)
    if len(order) >= 2:
        units += [(0, [n]) for n in lone]
    for ch in chains:
        ia, ib = where.get(ch["a"]), where.get(ch["b"])
        if ia is None or ib is None or abs(ia - ib) != 1:
            return None
        atts = ch["atts"] if ia < ib else ch["atts"][::-1]
        units.append((min(ia, ib), atts))
    if len(order) < 2:
        in_att -= set(lone)
    members = [[m for m in chambers[k] if m in names and m not in in_att] for k in order]
    outside = [n for n in names if n not in in_att and n not in where]
    # geometry
    cols = [max(1, math.ceil(math.sqrt(len(m) * 1.4))) for m in members]
    rows = [max(1, math.ceil(len(m) / c)) + (1 if len(m) > 2 else 0) for m, c in zip(members, cols)]
    gap_units = {g: [u for u in units if u[0] == g] for g in range(len(order) - 1)}
    gap_w = [max([len(u[1]) for u in gap_units[g]] + [0]) * cw + 90 for g in range(len(order) - 1)]
    gap_rows = [max(len(gap_units[g]), 1, max(rows) if lone else 1) for g in range(len(order) - 1)]
    x0, ox = [], 40.0
    for i in range(len(order)):
        x0.append(ox)
        ox += cols[i] * cw + (gap_w[i] if i < len(order) - 1 else 0)
    total_w = ox
    top_rows = max(rows + gap_rows)
    slots_c = [[(x0[i] + (j % cols[i]) * cw + (cw - BOX_W) / 2, 40 + (j // cols[i]) * chh + 20)
                for j in range(cols[i] * rows[i])] for i in range(len(order))]
    out_cols = max(1, int(total_w // cw))
    # The wall outlet always goes to the bottom row, under the devices it feeds.
    has_outlet = OUTLET_KEY in outside
    outside = [n for n in outside if n != OUTLET_KEY]
    out_rows = max(1, math.ceil(len(outside) / out_cols) + 1)
    base_y = 40 + top_rows * chh + 70
    all_o = [(40 + (j % out_cols) * cw, base_y + (j // out_cols) * chh) for j in range(out_cols * out_rows)]
    slots_o = all_o
    fed = sorted({c.to_device if c.from_device == OUTLET_KEY else c.from_device for c in all_conns if OUTLET_KEY in (c.from_device, c.to_device)})
    gap_x = [x0[g] + cols[g] * cw + 45 for g in range(len(order) - 1)]

    groups = [(members[i], slots_c[i]) for i in range(len(order))] + [(outside, slots_o)]
    groups = [(m, sl) for m, sl in groups if m]
    pairs = sorted({tuple(sorted((c.from_device, c.to_device))) for c in all_conns if c.from_device != c.to_device})
    rng = random.Random(seed)

    def build(assign, rowsel):
        pos = {}
        for (mem, sl), a in zip(groups, assign):
            for n, k in zip(mem, a):
                pos[n] = sl[k]
        for (g, atts), r in zip(units, rowsel):
            for j, n in enumerate(atts):
                pos[n] = (gap_x[g] + j * cw + (cw - BOX_W) / 2 - 22, 40 + r * chh + 20)
        if has_outlet:
            xs = [pos[n][0] for n in fed if n in pos] or [total_w / 2 - BOX_W / 2]
            pos[OUTLET_KEY] = (sum(xs) / len(xs), max(y for _, y in pos.values()) + chh)
        return pos

    def cost(pos):
        cen = {n: (x + BOX_W / 2, y + BOX_H / 2) for n, (x, y) in pos.items()}
        hard = 0
        for i, (a, b) in enumerate(pairs):
            for c, d in pairs[i + 1:]:
                if len({a, b, c, d}) == 4 and _cross(cen[a], cen[b], cen[c], cen[d]):
                    hard += 1000
            for n in pos:
                if n not in (a, b) and _seg_hits_rect(cen[a], cen[b], _rect(pos, n, 2)):
                    hard += 300
        return hard + 0.01 * sum(math.dist(cen[a], cen[b]) for a, b in pairs), hard

    best = None
    for attempt in range(6):
        assign = [rng.sample(range(len(sl)), len(mem)) for mem, sl in groups]
        rowsel = [0] * len(units)
        for g in gap_units:
            ids = [i for i, u in enumerate(units) if u[0] == g]
            for r, i in enumerate(ids):
                rowsel[i] = r
        cur = build(assign, rowsel)
        cur_c, cur_h = cost(cur)
        iters = 5000
        for it in range(iters):
            t = 300.0 * (1 - it / iters) + 1
            a2 = [list(a) for a in assign]
            r2 = list(rowsel)
            if units and rng.random() < 0.15:
                i = rng.randrange(len(units))
                g = units[i][0]
                r2[i] = rng.randrange(gap_rows[g])
                if any(j != i and units[j][0] == g and r2[j] == r2[i] for j in range(len(units))):
                    continue
            else:
                gi = rng.randrange(len(groups))
                mem, sl = groups[gi]
                k = rng.randrange(len(mem))
                free = [x for x in range(len(sl)) if x not in a2[gi]]
                if free and rng.random() < 0.5:
                    a2[gi][k] = rng.choice(free)
                elif len(mem) > 1:
                    j = rng.randrange(len(mem))
                    a2[gi][k], a2[gi][j] = a2[gi][j], a2[gi][k]
                else:
                    continue
            cand = build(a2, r2)
            c, h = cost(cand)
            if c <= cur_c or rng.random() < math.exp(-(c - cur_c) / t):
                assign, rowsel, cur, cur_c, cur_h = a2, r2, cand, c, h
                if best is None or c < best[0]:
                    best = (c, h, cand)
        if best and best[1] == 0 and attempt >= 1:
            break
        if best and best[1] < 1000 and attempt >= 3:
            break
    return best[2] if best and best[1] < 1000 else None


def base_groups_members(groups):
    return {m for v in groups.values() for m in v}


def _prepare(setup):
    """Lay out and route the diagram. Mains feeds from the outlet and power strips are not drawn as lines:
    each powered device gets a small outlet icon next to it, so these feeds never cross other links."""
    return _prepare_once(setup, hide_feeds=True) or _prepare_once(setup)


def _split_note(sub):
    """Subtitle may carry a mains note after a newline: 'kind|Source name'."""
    sub, _, note = sub.partition("\n")
    kind, _, text = note.partition("|")
    return sub, (kind, text) if text else None


def _prepare_once(setup, hide_feeds=False):
    nodes = _nodes(setup)
    chambers = _chambers(setup, nodes)
    all_conns = _all_links(setup)
    overrides = getattr(setup, "icon_overrides", None)
    # Wall outlets and power strips always sit in the bottom row, under whatever they feed.
    in_chamber = {m for v in chambers.values() for m in v}
    bottom = {OUTLET_KEY} | {n for n, (_t, _s, dtype) in nodes.items()
                             if n != OUTLET_KEY and icon_kind(dtype, overrides) in ("outlet", "power_strip")}
    bottom = {n for n in bottom if n in nodes and n not in in_chamber}
    if hide_feeds:
        feeds = [c for c in all_conns if getattr(c, "power", False) and c.from_device in bottom]
        if not feeds:
            return None
        all_conns = [c for c in all_conns if c not in feeds]
        for c in feeds:
            title, sub, dtype = nodes[c.to_device]
            src_title, _s, src_type = nodes[c.from_device]
            if "\n" in sub:
                sub = f"{sub}, {src_title}"
            else:
                sub = f"{sub}\n{icon_kind(src_type, overrides)}|{src_title}"
            nodes[c.to_device] = (title, sub, dtype)
        linked = {x for c in all_conns for x in (c.from_device, c.to_device)}
        for n in list(bottom):
            if n not in linked:
                nodes.pop(n, None)
                bottom.discard(n)
    chains = _inline_chains(setup, nodes, all_conns, chambers)
    # An attenuator with a single link is not on any cable, but it still sits in the gap between the first two chambers.
    chained = {x for ch in chains for x in ch["atts"]}
    in_chambers = {m for v in chambers.values() for m in v}
    lone_atts = [n for n, (_t, _s, dt) in nodes.items() if len(chambers) >= 2 and n != OUTLET_KEY and n not in chained
                 and n not in in_chambers and icon_kind(dt, overrides) == "attenuator"]
    if lone_atts:
        c1, c2 = list(chambers)[:2]
        label = "between " + " and ".join("Ch" + re.sub(r"\D", "", k) if re.search(r"\d", k) else k for k in (c1, c2))
        for n in lone_atts:
            t, sub, dt = nodes[n]
            nodes[n] = (t, label + sub[len(sub.split(chr(10))[0]):], dt)
    in_att = {x for ch in chains for x in ch["atts"]}
    layout_names = [n for n in nodes if n not in in_att]
    layout_conns = [c for c in all_conns if c.from_device not in in_att and c.to_device not in in_att]
    layout_conns += [
        SimpleNamespace(from_device=ch["a"], from_port="", to_device=ch["b"], to_port="", cable_type="", notes="")
        for ch in chains
    ]
    base_groups = {k: set(v) - in_att for k, v in chambers.items()}

    def finish(raw):
        raw = dict(raw)
        low = [n for n in raw if n in bottom]
        others = [p for n, p in raw.items() if n not in bottom]
        if low and others:
            y = max(py for _, py in others) + BOX_H + 70
            def want_x(n):
                nb = {c.to_device if c.from_device == n else c.from_device for c in all_conns if n in (c.from_device, c.to_device)}
                xs = [raw[m][0] for m in nb if m in raw and m not in bottom]
                return sum(xs) / len(xs) if xs else raw[n][0]
            placed_x = None
            for n in sorted(low, key=want_x):
                x = want_x(n)
                if placed_x is not None and x < placed_x + BOX_W + 40:
                    x = placed_x + BOX_W + 40
                placed_x = x
                raw[n] = (x, y)
        minx = min(x for x, _ in raw.values())
        miny = min(y for _, y in raw.values())
        sh = {n: (x - minx + MARGIN, y - miny + MARGIN) for n, (x, y) in raw.items()}
        ww = int(max(x for x, _ in sh.values()) + BOX_W + MARGIN + 40)
        hh = int(max(y for _, y in sh.values()) + BOX_H + MARGIN + 40)
        return sh, ww, hh, _route(all_conns, sh, ww, hh, base_groups)

    result = None
    t0 = time.monotonic()
    for seed in range(3):
        raw = _slot_layout(list(nodes), all_conns, chambers, chains, seed=5 + seed * 17, lone=lone_atts)
        if raw is None:
            break
        sh, ww, hh, es = finish(raw)
        k = (_count_crossings(es), _count_bends(es))
        if result is None or k < result[0]:
            result = (k, sh, ww, hh, es, raw)
        if k[0] == 0 or time.monotonic() - t0 > LAYOUT_BUDGET_S:
            break
    if result is None:
        pos, width, height = _layout(layout_names, layout_conns, list(base_groups.values()))
        _repair_frames(base_groups, pos)
        pos = _make_room(chains, pos, base_groups)
        pos = _settle_chains(chains, pos, base_groups)
        pairs = sorted({tuple(sorted((c.from_device, c.to_device))) for c in all_conns if c.from_device != c.to_device})
        for attempt in range(3):
            refined = _refine(pos, pairs, base_groups, chains, width, height, seed=11 + attempt * 7)
            sh, ww, hh, es = finish(refined)
            k = (_count_crossings(es), _count_bends(es))
            if result is None or k < result[0]:
                result = (k, sh, ww, hh, es, refined)
            if k[0] == 0 or time.monotonic() - t0 > LAYOUT_BUDGET_S:
                break
    # Lines must not cross: while some do, swap devices that sit on crossing lines and keep any swap that helps.
    key, shifted, w, h, edges, raw = result
    group_of = {m: k for k, v in base_groups.items() for m in v}
    movable = [n for n in raw if n not in bottom and n not in in_att]
    rng = random.Random(17)
    stale = 0
    while key[0] > 0 and len(movable) > 1 and time.monotonic() - t0 < SEARCH_BUDGET_S and stale < 40:
        hit = _crossing_pairs(edges)
        ends = {n for i, j in hit for n in (edges[i]["src"], edges[i]["dst"], edges[j]["src"], edges[j]["dst"])}
        pick = [n for n in movable if n in ends] or movable
        u = rng.choice(pick)
        mates = [v for v in movable if v != u and group_of.get(v) == group_of.get(u)]
        if not mates:
            stale += 1
            continue
        v = rng.choice(mates)
        cand = dict(raw)
        cand[u], cand[v] = raw[v], raw[u]
        sh2, ww2, hh2, es2 = finish(cand)
        k2 = (_count_crossings(es2), _count_bends(es2))
        if k2 < key:
            key, shifted, w, h, edges, raw = k2, sh2, ww2, hh2, es2, cand
            stale = 0
        else:
            stale += 1
    pos, width, height = shifted, max(w, 1), max(h, 1)
    manual = {n: p for n, p in (getattr(setup, "manual_positions", None) or {}).items() if n in pos}
    if manual:
        # Hand-placed devices keep their spot; lines are routed again around them.
        pos = {**pos, **manual}
        width = max(width, int(max(x for x, _ in pos.values()) + BOX_W + MARGIN + 40))
        height = max(height, int(max(y for _, y in pos.values()) + BOX_H + MARGIN + 40))
        edges = _route(all_conns, pos, width, height, base_groups)
    frames = _frames(base_groups, {n: p for n, p in pos.items() if n not in in_att})
    where = {m: re.sub(r"(?i)chamber\s*", "Ch", k) for k, v in base_groups.items() for m in v}
    for ch in chains:
        if where.get(ch["a"]) and where.get(ch["b"]) and where[ch["a"]] != where[ch["b"]]:
            for att in ch["atts"]:
                title, _sub, dtype = nodes[att]
                nodes[att] = (title, f"between {where[ch['a']]} and {where[ch['b']]}", dtype)
    _place_labels(edges, pos, width, height, frames)
    return nodes, pos, width, height, edges, frames


LAYOUT_VERSION = 25
ROUTE_BUDGET_S = 6  # per routing pass
SEARCH_BUDGET_S = 30  # total time allowed for the crossing-removal search
LAYOUT_BUDGET_S = 10  # stop trying extra layouts after this many seconds


def build_svg(setup, prepared=None) -> str:
    overrides = getattr(setup, "icon_overrides", None)
    nodes, pos, width, height, edges, frames = prepared or _prepare(setup)
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" font-family="Arial, sans-serif" font-size="12" data-layout="{LAYOUT_VERSION}">',
        f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
        '<defs><marker id="ae" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">'
        '<path d="M0,0L10,5L0,10z" fill="#374151"/></marker>'
        '<marker id="as" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">'
        '<path d="M10,0L0,5L10,10z" fill="#374151"/></marker>'
        f'<marker id="aer" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0L10,5L0,10z" fill="{RADIO_COLOR}"/></marker>'
        f'<marker id="asr" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M10,0L0,5L10,10z" fill="{RADIO_COLOR}"/></marker>'
        f'<marker id="ap" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">'
        f'<path d="M0,0L10,5L0,10z" fill="{POWER_COLOR}"/></marker></defs>',
    ]
    for label, (x0, y0, x1, y1) in frames:
        out.append(
            f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{x1 - x0:.1f}" height="{y1 - y0:.1f}" rx="26" fill="#f8fafc" stroke="#374151" stroke-width="2"/>'
        )
        out.append(f'<text x="{x1 - 16:.1f}" y="{y0 + 22:.1f}" text-anchor="end" font-size="13" fill="#111">{escape(label.replace("Chamber", "Chamber ").replace("  ", " "))}</text>')
    for e in edges:
        d = _rounded_path(e["path"])
        if getattr(e["c"], "combo", False):
            # Data and power in one cable: two lines side by side, solid dark data and dashed red power.
            d1 = _rounded_path(_offset_path(e["path"], 3.5))
            d2 = _rounded_path(_offset_path(e["path"], -3.5))
            out.append(f'<path d="{d1}" fill="none" stroke="#374151" stroke-width="1.8"/>')
            out.append(f'<path d="{d2}" fill="none" stroke="{POWER_COLOR}" stroke-width="1.8" stroke-dasharray="7 5" marker-end="url(#ap)"/>')
        elif getattr(e["c"], "power", False):
            out.append(f'<path d="{d}" fill="none" stroke="{POWER_COLOR}" stroke-width="1.8" stroke-dasharray="7 5" marker-end="url(#ap)"/>')
        elif _is_radio(e["c"]):
            mode = getattr(e["c"], "radio_mode", "")
            dash = {"conducted": "", "hybrid": ' stroke-dasharray="10 5 1 5"'}.get(mode, ' stroke-dasharray="1 6" stroke-linecap="round"')
            out.append(f'<path d="{d}" fill="none" stroke="{RADIO_COLOR}" stroke-width="2.2"{dash} marker-start="url(#asr)" marker-end="url(#aer)"/>')
        else:
            out.append(f'<path d="{d}" fill="none" stroke="#374151" stroke-width="1.8" marker-start="url(#as)" marker-end="url(#ae)"/>')
    for name, (title, sub, dtype) in nodes.items():
        x, y = pos[name]
        out.append(_icon_svg(icon_kind(dtype, overrides), x + (BOX_W - ICON_PX) / 2, y + 2))
        tx = x + BOX_W / 2
        max_chars = int((BOX_W - 8) / CHAR_W)
        shown = title if len(title) <= max_chars else title[: max_chars - 1] + "\u2026"
        sub, note = _split_note(sub)
        power_note = note[1] if note else ""
        shown_sub = sub if len(sub) <= max_chars else sub[: max_chars - 1] + "\u2026"
        note_chars = max_chars - 4
        shown_note = power_note if len(power_note) <= note_chars else power_note[: note_chars - 1] + "\u2026"
        out.append(
            f'<text x="{tx}" y="{y + 70}" text-anchor="middle" font-size="13" font-weight="bold" fill="#111">{escape(shown)}</text>'
        )
        if sub:
            out.append(f'<text x="{tx}" y="{y + 88}" text-anchor="middle" fill="#374151">{escape(shown_sub)}</text>')
        if note:
            out.append(_icon_svg(note[0], x + BOX_W - 28, y + 88, 24))
            out.append(f'<text x="{tx - 12}" y="{y + 105}" text-anchor="middle" fill="{POWER_COLOR}">{escape(shown_note)}</text>')
    for e in edges:
        lb = e["label"]
        if lb:
            pos_attrs = f'x="{lb["x"]:.1f}" y="{lb["y"] + 4:.1f}" text-anchor="middle"'
            text = escape(lb["text"])
            # Separate white halo underneath keeps labels readable over lines in any renderer.
            out.append(f'<text {pos_attrs} fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round">{text}</text>')
            label_fill = POWER_COLOR if getattr(e["c"], "power", False) else "#111"
            if getattr(e["c"], "combo", False):
                head, tail = lb["text"][: -len(" power")], "\u00a0power"
                out.append(f'<text {pos_attrs} fill="#111">{escape(head)}<tspan fill="{POWER_COLOR}" >{tail}</tspan></text>')
            else:
                out.append(f'<text {pos_attrs} fill="{label_fill}">{text}</text>')
    out.append("</svg>")
    return "".join(out)


def _edge_style(e) -> str:
    if getattr(e["c"], "combo", False):
        return f"startArrow=none;endArrow=classic;dashed=1;html=1;rounded=1;arcSize=40;strokeWidth=2;strokeColor={POWER_COLOR};labelBackgroundColor=#ffffff;"
    if getattr(e["c"], "power", False):
        return f"startArrow=none;endArrow=classic;dashed=1;html=1;rounded=1;arcSize=40;strokeWidth=2;strokeColor={POWER_COLOR};fontColor={POWER_COLOR};labelBackgroundColor=#ffffff;"
    if _is_radio(e["c"]):
        mode = getattr(e["c"], "radio_mode", "")
        dash = {"conducted": "", "hybrid": "dashed=1;dashPattern=10 4 1 4;"}.get(mode, "dashed=1;dashPattern=1 4;")
        return f"startArrow=classic;endArrow=classic;{dash}html=1;rounded=1;arcSize=40;strokeWidth=2;strokeColor={RADIO_COLOR};labelBackgroundColor=#ffffff;"
    return "startArrow=classic;endArrow=classic;html=1;rounded=1;arcSize=40;strokeWidth=2;labelBackgroundColor=#ffffff;"


def build_drawio(setup, prepared=None) -> str:
    overrides = getattr(setup, "icon_overrides", None)
    nodes, pos, _, _, edges, frames = prepared or _prepare(setup)
    ids = {name: f"n{i}" for i, name in enumerate(nodes)}
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    for k, (label, (x0, y0, x1, y1)) in enumerate(frames):
        cells.append(
            f'<mxCell id="c{k}" value={quoteattr(escape(label.replace("Chamber", "Chamber ")))} '
            'style="rounded=1;arcSize=8;html=1;fillColor=#f8fafc;strokeColor=#374151;strokeWidth=2;verticalAlign=top;align=right;spacingRight=12;" vertex="1" parent="1">'
            f'<mxGeometry x="{x0:.1f}" y="{y0:.1f}" width="{x1 - x0:.1f}" height="{y1 - y0:.1f}" as="geometry"/></mxCell>'
        )
    for name, (title, sub, dtype) in nodes.items():
        x, y = pos[name]
        sub, note = _split_note(sub)
        value = escape(title) + (f"<br>{escape(sub)}" if sub else "") + (f"<br>Power: {escape(note[1])}" if note else "")
        cells.append(
            f'<mxCell id="{ids[name]}" value={quoteattr(value)} '
            f'style="shape=image;html=1;image={_icon_datauri(icon_kind(dtype, overrides))};'
            'verticalLabelPosition=bottom;verticalAlign=top;labelBackgroundColor=#ffffff;" vertex="1" parent="1">'
            f'<mxGeometry x="{x + (BOX_W - ICON_PX) / 2}" y="{y + 2}" width="{ICON_PX}" height="{ICON_PX}" as="geometry"/></mxCell>'
        )
    for i, e in enumerate(edges):
        lb = e["label"]
        mid = e["full"]
        points = (
            '<Array as="points">'
            + "".join(f'<mxPoint x="{p[0]:.1f}" y="{p[1]:.1f}"/>' for p in mid)
            + "</Array>"
            if mid
            else ""
        )
        # draw.io places labels by position along the edge (-1..1) and a sideways offset.
        label_x = (lb["t"] * 2 - 1) if lb else 0
        offset = ""
        if lb:
            (qx, qy), _ = _polyline_point(e["full"], lb["t"])
            offset = f'<mxPoint x="{lb["x"] - qx:.1f}" y="{lb["y"] - qy:.1f}" as="offset"/>'
        cells.append(
            f'<mxCell id="e{i}" value={quoteattr(escape(lb["text"]) if lb else "")} '
            f'style="{_edge_style(e)}" '
            f'edge="1" parent="1" source="{ids[e["src"]]}" target="{ids[e["dst"]]}">'
            f'<mxGeometry x="{label_x:.3f}" y="0" relative="1" as="geometry">{points}{offset}</mxGeometry></mxCell>'
        )
    return (
        '<mxfile><diagram name="Setup"><mxGraphModel><root>'
        + "".join(cells)
        + "</root></mxGraphModel></diagram></mxfile>"
    )
