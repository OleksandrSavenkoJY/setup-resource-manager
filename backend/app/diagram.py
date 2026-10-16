import base64
from types import SimpleNamespace
import math
import re
import random
from collections import deque
from xml.sax.saxutils import escape, quoteattr

BOX_W, BOX_H = 170, 104
ICON_PX = 48
OUTLET_KEY = "__outlet__"
POWER_COLOR = "#dc2626"
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
    "generic": f'<g {S}><path d="M20 4l15 8v16l-15 8-15-8V12z" fill="#fff"/><path d="M5 12l15 8 15-8M20 20v16"/></g>',
}
# First match wins; patterns are matched against the lower-cased device type.
ICON_RULES = [
    (r"outlet|socket", "outlet"),
    (r"internet|cloud|^wan$|^mng$", "cloud"),
    (r"antenn|^ant\d", "antenna"),
    (r"windows|^win\d*$", "pc_windows"),
    (r"linux|ubuntu|debian", "pc_linux"),
    (r"^ra\d|\bboard\b|\bevk\b|\bfpb\b|devkit|dev kit|pcb", "board"),
    (r"^rrq|^rtk|^rza|^rx\d|^rl78|^r7|chip|\bsoc\b|\bmcu\b|\bic\b|module|\bcpu\b", "chip"),
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
    "printer": "Printer", "cloud": "Internet", "antenna": "Antenna",
    "outlet": "Wall outlet", "pc_windows": "PC (Windows)", "pc_linux": "PC (Linux)", "generic": "Generic",
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


def _route(connections, pos, width, height):
    """Compute routed edges: waypoints, border-clipped path, and a free label spot."""
    groups: dict[tuple, list] = {}
    for c in connections:
        if c.from_device != c.to_device:
            groups.setdefault(tuple(sorted((c.from_device, c.to_device))), []).append(c)

    obstacles = {n: _rect(pos, n, 4) for n in pos}
    edges = []
    for (a, b), conns in groups.items():
        ca = (pos[a][0] + BOX_W / 2, pos[a][1] + BOX_H / 2)
        cb = (pos[b][0] + BOX_W / 2, pos[b][1] + BOX_H / 2)
        dx, dy = cb[0] - ca[0], cb[1] - ca[1]
        length = math.hypot(dx, dy) or 1
        nx, ny = -dy / length, dx / length  # canonical normal, shared by the whole group
        others = [r for n, r in obstacles.items() if n not in (a, b)]

        for k, c in enumerate(conns):
            off = (k - (len(conns) - 1) / 2) * PARALLEL_STEP
            p1 = (ca[0] + nx * off, ca[1] + ny * off)
            p2 = (cb[0] + nx * off, cb[1] + ny * off)
            pts = [p1, p2]
            if any(_seg_hits_rect(p1, p2, r) for r in others):
                mid = ((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2)
                for step in range(1, 7):
                    for sign in (1, -1):
                        d = sign * step * (GAP_Y / 2)
                        wp = (mid[0] + nx * d, mid[1] + ny * d)
                        if not any(
                            _seg_hits_rect(p1, wp, r) or _seg_hits_rect(wp, p2, r) for r in others
                        ) and not any(
                            r[0] <= wp[0] <= r[2] and r[1] <= wp[1] <= r[3] for r in others
                        ) and 10 <= wp[0] <= width - 10 and 10 <= wp[1] <= height - 10:
                            pts = [p1, wp, p2]
                            break
                    else:
                        continue
                    break
            clipped = list(pts)
            clipped[0] = _clip_from_inside(pts[0], pts[1], _rect(pos, a))
            clipped[-1] = _clip_from_inside(pts[-1], pts[-2], _rect(pos, b))
            edge = {"c": c, "src": a, "dst": b, "full": pts, "path": clipped}
            if c.from_device == b:  # keep every edge oriented from -> to
                edge.update(src=b, dst=a, full=pts[::-1], path=clipped[::-1])
            edges.append(edge)
    return edges


def _place_labels(edges, pos, width, height):
    """Put each label beside its link: above a horizontal link, to the left of a vertical one."""
    node_rects = [_rect(pos, n, 2) for n in pos]
    placed: list[tuple] = []
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
                    cost = (
                        sum(_overlap(rect, r) for r in node_rects + placed)
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
        rects = [_rect(pos, m) for m in members]
        fr = (min(r[0] for r in rects) - 22, min(r[1] for r in rects) - 36,
              max(r[2] for r in rects) + 22, max(r[3] for r in rects) + 22)
        if any(n not in members and _overlap(fr, _rect(pos, n)) for n in pos):
            continue
        frames.append((label, fr))
    return frames


def _prepare(setup):
    nodes = _nodes(setup)
    chambers = _chambers(setup, nodes)
    all_conns = list(setup.connections) + _power_links(setup)
    pos, width, height = _layout(list(nodes), all_conns, list(chambers.values()))
    edges = _route(all_conns, pos, width, height)
    _place_labels(edges, pos, width, height)
    frames = _frames(chambers, pos)
    return nodes, pos, width, height, edges, frames


def build_svg(setup) -> str:
    overrides = getattr(setup, "icon_overrides", None)
    nodes, pos, width, height, edges, frames = _prepare(setup)
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" font-family="Arial, sans-serif" font-size="12">',
        f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
        '<defs><marker id="ae" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">'
        '<path d="M0,0L10,5L0,10z" fill="#374151"/></marker>'
        '<marker id="as" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">'
        '<path d="M10,0L0,5L10,10z" fill="#374151"/></marker>'
        f'<marker id="ap" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">'
        f'<path d="M0,0L10,5L0,10z" fill="{POWER_COLOR}"/></marker></defs>',
    ]
    for label, (x0, y0, x1, y1) in frames:
        out.append(
            f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{x1 - x0:.1f}" height="{y1 - y0:.1f}" rx="26" fill="#f8fafc" stroke="#374151" stroke-width="2"/>'
        )
        out.append(f'<text x="{x1 - 16:.1f}" y="{y0 + 22:.1f}" text-anchor="end" font-size="13" fill="#111">{escape(label.replace("Chamber", "Chamber ").replace("  ", " "))}</text>')
    for e in edges:
        d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in e["path"])
        if getattr(e["c"], "power", False):
            out.append(f'<path d="{d}" fill="none" stroke="{POWER_COLOR}" stroke-width="1.8" stroke-dasharray="7 5" marker-end="url(#ap)"/>')
        else:
            out.append(f'<path d="{d}" fill="none" stroke="#374151" stroke-width="1.8" marker-start="url(#as)" marker-end="url(#ae)"/>')
    for name, (title, sub, dtype) in nodes.items():
        x, y = pos[name]
        out.append(_icon_svg(icon_kind(dtype, overrides), x + (BOX_W - ICON_PX) / 2, y + 2))
        tx = x + BOX_W / 2
        max_chars = int((BOX_W - 8) / CHAR_W)
        shown = title if len(title) <= max_chars else title[: max_chars - 1] + "\u2026"
        shown_sub = sub if len(sub) <= max_chars else sub[: max_chars - 1] + "\u2026"
        out.append(
            f'<text x="{tx}" y="{y + 70}" text-anchor="middle" font-size="13" font-weight="bold" fill="#111">{escape(shown)}</text>'
        )
        if sub:
            out.append(f'<text x="{tx}" y="{y + 88}" text-anchor="middle" fill="#374151">{escape(shown_sub)}</text>')
    for e in edges:
        lb = e["label"]
        if lb:
            pos_attrs = f'x="{lb["x"]:.1f}" y="{lb["y"] + 4:.1f}" text-anchor="middle"'
            text = escape(lb["text"])
            # Separate white halo underneath keeps labels readable over lines in any renderer.
            out.append(f'<text {pos_attrs} fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round">{text}</text>')
            label_fill = POWER_COLOR if getattr(e["c"], "power", False) else "#111"
            out.append(f'<text {pos_attrs} fill="{label_fill}">{text}</text>')
    out.append("</svg>")
    return "".join(out)


def _edge_style(e) -> str:
    if getattr(e["c"], "power", False):
        return f"startArrow=none;endArrow=classic;dashed=1;html=1;strokeWidth=2;strokeColor={POWER_COLOR};fontColor={POWER_COLOR};labelBackgroundColor=#ffffff;"
    return "startArrow=classic;endArrow=classic;html=1;strokeWidth=2;labelBackgroundColor=#ffffff;"


def build_drawio(setup) -> str:
    overrides = getattr(setup, "icon_overrides", None)
    nodes, pos, _, _, edges, frames = _prepare(setup)
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
        value = escape(title) + (f"<br>{escape(sub)}" if sub else "")
        cells.append(
            f'<mxCell id="{ids[name]}" value={quoteattr(value)} '
            f'style="shape=image;html=1;image={_icon_datauri(icon_kind(dtype, overrides))};'
            'verticalLabelPosition=bottom;verticalAlign=top;labelBackgroundColor=#ffffff;" vertex="1" parent="1">'
            f'<mxGeometry x="{x + (BOX_W - ICON_PX) / 2}" y="{y + 2}" width="{ICON_PX}" height="{ICON_PX}" as="geometry"/></mxCell>'
        )
    for i, e in enumerate(edges):
        lb = e["label"]
        mid = e["full"][1:-1]
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
