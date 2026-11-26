import io
import re
import zipfile

from openpyxl import Workbook
from openpyxl.drawing.image import Image as XlImage
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from .diagram import build_svg

SCOPES = ("setups", "connections", "full")
HEADER_FILL = PatternFill("solid", fgColor="DCE6F5")


def svg_to_png(svg: str, scale: float = 2.0) -> bytes:
    import cairosvg

    return cairosvg.svg2png(bytestring=svg.encode("utf-8"), scale=scale)


def safe_name(name: str) -> str:
    return re.sub(r"[^\w.\- ]+", "_", name, flags=re.UNICODE).strip() or "setup"


def _sheet_title(name: str, used: set[str]) -> str:
    base = re.sub(r"[\[\]:*?/\\]", "_", name)[:25] or "Setup"
    title, n = base, 2
    while title.lower() in used:
        title = f"{base[:22]}_{n}"
        n += 1
    used.add(title.lower())
    return title


def _write_table(ws, headers, rows):
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = HEADER_FILL
    for row in rows:
        ws.append(row)
    for i, header in enumerate(headers, start=1):
        width = max([len(str(header))] + [len(str(r[i - 1] or "")) for r in rows]) + 2
        ws.column_dimensions[get_column_letter(i)].width = min(max(width, 10), 60)
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(vertical="top", wrap_text=True)
    ws.freeze_panes = "A2"


def _power_label(d):
    src = getattr(d, "power_from", "") or ""
    return "Wall outlet" if src == "__outlet__" else src


def _device_row(s, d):
    return [s.id, s.name, d.type, d.name, d.location, _power_label(d), d.notes]


def _conn_power(c):
    src = {"from": (c.from_device, c.to_device), "to": (c.to_device, c.from_device)}.get(getattr(c, "powers", "") or "")
    return f"{src[0]} powers {src[1]}" if src else ""


def _conn_row(s, c):
    return [s.id, s.name, c.from_device, c.from_port, c.to_device, c.to_port, c.cable_type, _conn_power(c), c.radio_mode or "", c.notes]


NET_HEADERS = ["Setup ID", "Setup", "Device", "Interface", "Type", "IP", "MAC"]


def _net_rows(s):
    return [[s.id, s.name, d.name, n.name, n.type, n.ip, n.mac] for d in s.devices for n in d.net_interfaces]


DEVICE_HEADERS = ["Setup ID", "Setup", "Type", "Device", "Location", "Powered from", "Notes"]
CONN_HEADERS = ["Setup ID", "Setup", "From device", "From interface", "To device", "To interface", "Cable", "Power", "Radio mode", "Notes"]


def _add_schema_image(ws, setup, anchor="A1"):
    png = svg_to_png(build_svg(setup), scale=1.0)
    img = XlImage(io.BytesIO(png))
    ws.add_image(img, anchor)


def build_xlsx(setups, scope: str) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Setups"
    _write_table(
        ws,
        ["ID", "Name", "Description", "Chamber", "Chambers", "Criticality (2-4)", "Outlets used", "Devices", "Connections", "Created", "Updated"],
        [
            [
                s.id, s.name, s.description, "Yes" if s.chamber else "No", s.chamber_count, s.criticality, s.outlets_used,
                len(s.devices), len(s.connections),
                s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else None,
                s.updated_at.strftime("%Y-%m-%d %H:%M") if s.updated_at else None,
            ]
            for s in setups
        ],
    )

    _write_table(wb.create_sheet("Devices"), DEVICE_HEADERS, [_device_row(s, d) for s in setups for d in s.devices])

    if scope in ("connections", "full"):
        _write_table(wb.create_sheet("Network"), NET_HEADERS, [r for s in setups for r in _net_rows(s)])
        _write_table(
            wb.create_sheet("Connections"), CONN_HEADERS,
            [_conn_row(s, c) for s in setups for c in s.connections],
        )

    if scope == "full":
        used = {"setups", "devices", "connections", "network"}
        for s in setups:
            sheet = wb.create_sheet(_sheet_title(f"Schema {s.id} {s.name}", used))
            sheet["A1"] = f"{s.name} (ID {s.id})"
            sheet["A1"].font = Font(bold=True, size=14)
            _add_schema_image(sheet, s, "A3")

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def build_single_xlsx(setup) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Setup"
    ws.column_dimensions["A"].width = 18
    ws.column_dimensions["B"].width = 60
    info = [
        ("ID", setup.id),
        ("Name", setup.name),
        ("Description", setup.description),
        ("Chamber", "Yes" if setup.chamber else "No"),
        ("Chambers", setup.chamber_count),
        ("Criticality (2-4)", setup.criticality),
        ("Outlets used", setup.outlets_used),
        ("Created", setup.created_at.strftime("%Y-%m-%d %H:%M") if setup.created_at else None),
        ("Updated", setup.updated_at.strftime("%Y-%m-%d %H:%M") if setup.updated_at else None),
    ]
    for key, value in info:
        ws.append([key, value])
        ws.cell(row=ws.max_row, column=1).font = Font(bold=True)
        ws.cell(row=ws.max_row, column=2).alignment = Alignment(wrap_text=True, vertical="top")

    _write_table(wb.create_sheet("Devices"), DEVICE_HEADERS[2:], [_device_row(setup, d)[2:] for d in setup.devices])
    _write_table(wb.create_sheet("Network"), NET_HEADERS[2:], [r[2:] for r in _net_rows(setup)])
    _write_table(
        wb.create_sheet("Connections"), CONN_HEADERS[2:],
        [_conn_row(setup, c)[2:] for c in setup.connections],
    )
    _add_schema_image(wb.create_sheet("Schema"), setup)

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def build_png_zip(setups) -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for s in setups:
            zf.writestr(f"{s.id}_{safe_name(s.name)}.png", svg_to_png(build_svg(s)))
    return out.getvalue()
