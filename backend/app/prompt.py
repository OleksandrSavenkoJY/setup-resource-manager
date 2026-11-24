def _power(d):
    src = getattr(d, "power_from", "") or ""
    return "wall outlet" if src == "__outlet__" else (src or "N/A")


def generate_prompt(setup):
    device_lines = []
    for d in setup.devices:
        device_lines.append(
            f"- {d.type}: {d.name}, location={d.location or 'N/A'}, "
            f"powered_from={_power(d)}, notes={d.notes or 'N/A'}"
        )

    connection_lines = []
    for c in setup.connections:
        connection_lines.append(
            f"- {c.from_device}:{c.from_port or 'N/A'} -> {c.to_device}:{c.to_port or 'N/A'} "
            f"(cable={c.cable_type or 'N/A'}, notes={c.notes or 'N/A'}"
            + (f", this cable also powers: {c.to_device if c.powers == 'from' else c.from_device}" if c.powers else "")
            + (f", radio mode: {c.radio_mode}" if getattr(c, "radio_mode", "") else "")
            + ")"
        )

    return f"""Create a clean technical diagram for the following setup.

Setup name: {setup.name}
Description: {setup.description or 'N/A'}
Chamber: {"Yes" if setup.chamber else "No"}
Chambers: {setup.chamber_count}
Criticality (1 low - 5 critical): {setup.criticality}
Outlets used: {setup.outlets_used}

Devices:
{chr(10).join(device_lines) if device_lines else "- No devices provided"}

Connections:
{chr(10).join(connection_lines) if connection_lines else "- No connections provided"}

Diagram style rules (follow them strictly):
1. Output a draw.io (diagrams.net) file in uncompressed .drawio XML.
2. Every device is an icon only, with no box around it. The label sits directly under the icon:
   the device name on the first line and "type · location" on the second.
   Pick the icon from the device type: PC = desktop computer (Linux/Windows logo on the screen if the OS is known),
   Laptop = laptop, Monitor = monitor, UPS = battery/power box, Board = development board, Chip = chip or module,
   switch/router/AP = network equipment, Internet/cloud = cloud, antenna = antenna mast. Use a neutral cube for unknown types.
   Do not use manufacturer logos.
3. The main device (the one with the most connections, usually the management PC) gets a larger icon and sits near the centre.
   If several devices are equally central, treat them as peers, each one the centre of the devices attached directly to it.
4. Place related devices close together and in tidy rows or columns on a grid:
   peripherals in a row next to their host, auxiliary devices (relays, buttons, probes) above or below it.
   Leave generous empty space between elements.
5. Chambers (RF-shielded boxes) are rounded rectangles with a "Chamber N" caption in the top-right corner.
   Put every device whose location is that chamber inside it, and nothing else. Devices on the desktop stay outside.
6. Each connection is one line with an arrowhead at both ends. Lines may be straight or have right-angle bends,
   but they must never cross each other, pass through an icon or text, or run on top of another line.
   Use parallel lines with a clear gap for several connections between the same two devices.
7. The connection label (interface type, for example "USB-A → USB-C", plus cable type when given) is placed beside its line,
   close to it but never on it: above a horizontal segment and to the left of a vertical one.
   Labels must not overlap lines, icons, other labels or the chamber frames.
8. Power: draw power feeds as separate red dashed lines with a single arrowhead pointing at the powered device,
   labelled "Power". A device powered from the wall outlet gets a line from one shared "Wall outlet" socket icon;
   a device powered from another device (for example a UPS) gets a line from that device.
   Keep power lines visually distinct from data connections and do not let them affect which device is central.
9. Attenuators sit in the middle of the cable they interrupt, in the gap between the two chambers (never inside a chamber),
   on the straight line between the devices they connect. Caption them "between Ch1 and Ch2".
10. Use only the information above. Do not invent devices, connections or interfaces.
11. Check the result before answering: no overlaps, no crossings, every connection present and labelled.
"""
