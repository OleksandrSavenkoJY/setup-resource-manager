def generate_prompt(setup):
    device_lines = []
    for d in setup.devices:
        device_lines.append(
            f"- {d.type}: {d.name}, quantity={d.quantity}, location={d.location or 'N/A'}, notes={d.notes or 'N/A'}"
        )

    connection_lines = []
    for c in setup.connections:
        connection_lines.append(
            f"- {c.from_device}:{c.from_port or 'N/A'} -> {c.to_device}:{c.to_port or 'N/A'} "
            f"(cable={c.cable_type or 'N/A'}, notes={c.notes or 'N/A'})"
        )

    return f"""Create a clean technical diagram for the following setup.

Setup name: {setup.name}
Description: {setup.description or 'N/A'}
Chamber: {"Yes" if setup.chamber else "No"}
Outlets used: {setup.outlets_used}

Devices:
{chr(10).join(device_lines) if device_lines else "- No devices provided"}

Connections:
{chr(10).join(connection_lines) if connection_lines else "- No connections provided"}

The diagram should be clear, labeled, and easy to understand.
"""
