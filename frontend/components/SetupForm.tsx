"use client";

import { useState } from "react";
import { useEffect } from "react";
import OptionManager, { IconDef } from "@/components/OptionManager";
import { createDeviceType, createInterface, deleteDeviceType, deleteInterface, fetchInterfaces, createSetup, fetchDeviceTypes, fetchDeviceIcons, setDeviceTypeIcon, updateSetup } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useRouter } from "next/navigation";

type DeviceEntry = {
  type: string;
  name: string;
  location: string;
  power_from: string;
  notes: string;
};

const OUTLET = "__outlet__";

type ConnectionEntry = {
  from_device: string;
  from_port: string;
  to_device: string;
  to_port: string;
  cable_type: string;
  notes: string;
};

type Props = {
  mode: "create" | "edit";
  setupId?: number;
  initialData?: any;
};

const DEFAULT_TYPES = ["PC", "Laptop", "Monitor", "UPS", "Board", "Board 2", "Chip", "Chip 2", "Chip 3"];
const DESKTOP = "Desktop";


function emptyConnection(): ConnectionEntry {
  return { from_device: "", from_port: "", to_device: "", to_port: "", cable_type: "", notes: "" };
}

function emptyDevice(): DeviceEntry {
  return {
    type: DEFAULT_TYPES[0],
    name: "",
    location: DESKTOP,
    power_from: "",
    notes: "",
  };
}

export default function SetupForm({ mode, setupId, initialData }: Props) {
  const router = useRouter();
  const [name, setName] = useState<string>(initialData?.name ?? "");
  const [description, setDescription] = useState<string>(initialData?.description ?? "");
  const [chamber, setChamber] = useState<boolean>(initialData?.chamber ?? false);
  const [outletsUsed, setOutletsUsed] = useState<number>(initialData?.outlets_used ?? 0);
  const [chamberCount, setChamberCount] = useState<number>(
    initialData?.chamber_count ?? (initialData?.chamber ? 1 : 0)
  );
  const [typeOptions, setTypeOptions] = useState<string[]>(DEFAULT_TYPES);
  const [typeList, setTypeList] = useState<{ id: number; name: string; icon?: string; auto_icon?: string }[]>([]);
  const [iconList, setIconList] = useState<IconDef[]>([]);
  const [interfaceList, setInterfaceList] = useState<{ id: number; name: string }[]>([]);
  const me = useCurrentUser();
  const [devices, setDevices] = useState<DeviceEntry[]>(
    initialData?.devices?.length
      ? initialData.devices.map((d: any) => ({
          type: d.type ?? DEFAULT_TYPES[0],
          name: d.name ?? "",
          location: d.location ?? DESKTOP,
          power_from: d.power_from ?? "",
          notes: d.notes ?? "",
        }))
      : [emptyDevice()]
  );
  const [connections, setConnections] = useState<ConnectionEntry[]>(
    (initialData?.connections ?? []).map((c: any) => ({
      from_device: c.from_device ?? "",
      from_port: c.from_port ?? "",
      to_device: c.to_device ?? "",
      to_port: c.to_port ?? "",
      cable_type: c.cable_type ?? "",
      notes: c.notes ?? "",
    }))
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDeviceTypes()
      .then((list: { id: number; name: string }[]) => {
        setTypeList(list);
        setTypeOptions(list.map((t) => t.name));
      })
      .catch(console.error);
    fetchDeviceIcons().then(setIconList).catch(console.error);
    fetchInterfaces().then(setInterfaceList).catch(console.error);
  }, []);

  const chambersOn = chamber && chamberCount > 0;
  const locationOptions = [DESKTOP, ...(chambersOn ? Array.from({ length: chamberCount }, (_, i) => `Chamber${i + 1}`) : [])];

  async function handleAddType(name: string) {
    try {
      const created = await createDeviceType(name);
      setTypeOptions((cur) => (cur.includes(created.name) ? cur : [...cur, created.name]));
      setTypeList((cur) => (cur.some((t) => t.id === created.id) ? cur : [...cur, created]));
      setSubmitError(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to add device type");
    }
  }

  async function handleAddInterface(name: string) {
    try {
      const created = await createInterface(name);
      setInterfaceList((cur) => (cur.some((t) => t.id === created.id) ? cur : [...cur, created]));
      setSubmitError(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to add interface");
    }
  }

  async function handleDeleteInterface(t: { id: number; name: string }) {
    if (connections.some((c) => c.from_port === t.name || c.to_port === t.name)) {
      setSubmitError(`Interface '${t.name}' is used by a connection in this form. Change that connection first.`);
      return;
    }
    if (!window.confirm(`Delete interface '${t.name}'?`)) return;
    try {
      await deleteInterface(t.id);
      setInterfaceList((cur) => cur.filter((x) => x.id !== t.id));
      setSubmitError(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to delete interface");
    }
  }

  async function handleTypeIcon(t: { id: number; name: string }, icon: string) {
    try {
      const updated = await setDeviceTypeIcon(t.id, icon);
      setTypeList((cur) => cur.map((x) => (x.id === t.id ? updated : x)));
      setSubmitError(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to change icon");
    }
  }

  async function handleDeleteType(t: { id: number; name: string }) {
    if (devices.some((d) => d.type === t.name)) {
      setSubmitError(`Type '${t.name}' is used by a device in this form. Change that device first.`);
      return;
    }
    if (!window.confirm(`Delete device type '${t.name}'?`)) return;
    try {
      await deleteDeviceType(t.id);
      setTypeList((cur) => cur.filter((x) => x.id !== t.id));
      setTypeOptions((cur) => cur.filter((x) => x !== t.name));
      setSubmitError(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to delete type");
    }
  }

  function markTouched(field: string) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  // Connection endpoints must match a device name exactly, as sent in the payload.
  const deviceNames = Array.from(
    new Set(devices.map((d) => d.name).filter((n) => n.trim()))
  );

  function validate() {
    return {
      connections: connections.every(
        (c) =>
          deviceNames.includes(c.from_device) &&
          deviceNames.includes(c.to_device) &&
          c.from_device !== c.to_device &&
          c.from_port.trim().length > 0 &&
          c.to_port.trim().length > 0
      ),
      name: name.trim().length > 0,
      description: description.trim().length > 0,
      outletsUsed: Number.isFinite(outletsUsed) && outletsUsed >= 0,
      chamberCount: !chamber || (Number.isInteger(chamberCount) && chamberCount >= 1 && chamberCount <= 50),
      devices: devices.length > 0,
      deviceNames: devices.every((device) => device.name.trim().length > 0),
    };
  }

  const isValid = validate();
  const canSubmit =
    isValid.name &&
    isValid.description &&
    isValid.outletsUsed &&
    isValid.devices &&
    isValid.deviceNames &&
    isValid.chamberCount &&
    isValid.connections;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setSubmitError(null);

    if (!canSubmit || isSubmitting) return;

    const payload = {
      name,
      description,
      chamber,
      outlets_used: outletsUsed,
      chamber_count: chamber ? chamberCount : 0,
      devices: devices.map((d) => ({
        ...d,
        quantity: 1,
        location: locationOptions.includes(d.location) ? d.location : DESKTOP,
        power_from: d.power_from === OUTLET || devices.some((o) => o !== d && o.name === d.power_from) ? d.power_from : "",
      })),
      connections: connections.map((c) => ({
        from_device: c.from_device,
        from_port: c.from_port.trim() || null,
        to_device: c.to_device,
        to_port: c.to_port.trim() || null,
        cable_type: c.cable_type.trim() || null,
        notes: c.notes.trim() || null,
      })),
    };

    try {
      setIsSubmitting(true);
      if (mode === "create") {
        const created = await createSetup(payload);
        window.localStorage.setItem("setup_resource_manager_new_setup", String(created.id));
        router.push("/");
        router.refresh();
      } else if (setupId) {
        await updateSetup(setupId, payload);
        router.push(`/setups/${setupId}`);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save setup");
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateDevice(listSetter: React.Dispatch<React.SetStateAction<DeviceEntry[]>>, index: number, key: keyof DeviceEntry, value: string | number) {
    listSetter((current) => {
      const oldName = current[index]?.name;
      return current.map((device, i) => {
        if (i === index) return { ...device, [key]: value };
        // Keep power sources pointing at a renamed device.
        if (key === "name" && oldName && device.power_from === oldName) return { ...device, power_from: String(value) };
        return device;
      });
    });
    if (key === "name") {
      const oldName = devices[index]?.name;
      if (oldName) {
        setConnections((cur) => cur.map((c) => ({
          ...c,
          from_device: c.from_device === oldName ? String(value) : c.from_device,
          to_device: c.to_device === oldName ? String(value) : c.to_device,
        })));
      }
    }
  }

  function addDevice(listSetter: React.Dispatch<React.SetStateAction<DeviceEntry[]>>) {
    listSetter((current) => [...current, emptyDevice()]);
  }

  function removeDevice(listSetter: React.Dispatch<React.SetStateAction<DeviceEntry[]>>, index: number) {
    const removed = devices[index]?.name;
    listSetter((current) => current.filter((_, i) => i !== index).map((d) => (removed && d.power_from === removed ? { ...d, power_from: "" } : d)));
  }

  function updateConnection(index: number, key: keyof ConnectionEntry, value: string) {
    setConnections((current) => current.map((c, i) => (i === index ? { ...c, [key]: value } : c)));
  }

  function addConnection() {
    setConnections((current) => [...current, emptyConnection()]);
  }

  function removeConnection(index: number) {
    setConnections((current) => current.filter((_, i) => i !== index));
  }

  const showError = (field: string) => submitAttempted || touched[field];

  return (
    <form className="card" onSubmit={handleSubmit}>
      <label>
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => markTouched("name")}
          className={showError("name") && !isValid.name ? "field-error" : ""}
        />
      </label>

      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => markTouched("description")}
          rows={4}
          style={{ resize: "vertical", minWidth: "100%", width: "100%" }}
          className={showError("description") && !isValid.description ? "field-error" : ""}
        />
      </label>

      <div
        style={{
          margin: "16px 0",
          padding: 16,
          border: "1px solid var(--border, #d4d4d8)",
          borderRadius: 8,
          background: "var(--surface-alt)",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: 18, fontWeight: 600 }}>
          <input
            type="checkbox"
            style={{ width: 22, height: 22, margin: 0 }}
            checked={chamber}
            onChange={(e) => {
              setChamber(e.target.checked);
              if (e.target.checked && chamberCount < 1) setChamberCount(1);
            }}
          />
          Setup uses chambers
        </label>

      {chamber && (
        <div style={{ marginTop: 12 }}>
          Number of chambers
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <button type="button" className="secondary" aria-label="Fewer chambers" disabled={chamberCount <= 1} onClick={() => setChamberCount((n) => Math.max(1, n - 1))}>−</button>
            <input
              type="number"
              min={1}
              max={50}
              value={chamberCount || ""}
              onChange={(e) => setChamberCount(Math.min(50, Math.max(0, Math.floor(Number(e.target.value)))))}
              onBlur={() => setChamberCount((n) => Math.max(1, n))}
              style={{ width: 80, textAlign: "center" }}
              className={submitAttempted && !isValid.chamberCount ? "field-error" : ""}
            />
            <button type="button" className="secondary" aria-label="More chambers" disabled={chamberCount >= 50} onClick={() => setChamberCount((n) => Math.min(50, n + 1))}>+</button>
            <span style={{ opacity: 0.7 }}>{Array.from({ length: Math.min(chamberCount, 50) }, (_, k) => `Chamber${k + 1}`).slice(0, 4).join(", ")}{chamberCount > 4 ? ", …" : ""}</span>
          </div>
        </div>
      )}
      </div>

      {me?.role === "admin" && (
        <OptionManager
          label="device types"
          placeholder="New device type"
          items={typeList}
          onAdd={handleAddType}
          onDelete={handleDeleteType}
          icons={iconList}
          autoIcon={(t) => (t as { auto_icon?: string }).auto_icon ?? "generic"}
          onIconChange={handleTypeIcon}
        />
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Devices</h3>
          <button type="button" onClick={() => addDevice(setDevices)}>Add device</button>
        </div>

        <div style={{ marginTop: 12 }}>
          {devices.map((device, index) => (
            <div key={index} className="card" style={{ background: "var(--surface-alt)" }}>
              <label>
                Device type
                <select
                  value={device.type}
                  onChange={(e) => updateDevice(setDevices, index, "type", e.target.value)}
                >
                  {(typeOptions.includes(device.type) ? typeOptions : [...typeOptions, device.type]).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Device name
                <input value={device.name} onChange={(e) => updateDevice(setDevices, index, "name", e.target.value)} className={showError(`device-name-${index}`) && !device.name.trim() ? "field-error" : ""} />
              </label>
              {chambersOn && (
              <label>
                Location
                <select
                  value={locationOptions.includes(device.location) ? device.location : DESKTOP}
                  onChange={(e) => updateDevice(setDevices, index, "location", e.target.value)}
                >
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>{loc === DESKTOP ? "On desktop (no chamber)" : loc}</option>
                  ))}
                </select>
              </label>
              )}
              <label>
                Powered from
                <select
                  value={device.power_from}
                  onChange={(e) => updateDevice(setDevices, index, "power_from", e.target.value)}
                >
                  <option value="">Not specified</option>
                  <option value={OUTLET}>Wall outlet</option>
                  {devices.map((o, oi) => (oi !== index && o.name.trim() ? (
                    <option key={oi} value={o.name}>{o.name}{o.type ? ` (${o.type})` : ""}</option>
                  ) : null))}
                </select>
              </label>
              <label>
                Notes
                <textarea value={device.notes} onChange={(e) => updateDevice(setDevices, index, "notes", e.target.value)} />
              </label>
              <button type="button" className="secondary" onClick={() => removeDevice(setDevices, index)}>Remove device</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Connections</h3>
          <button type="button" onClick={addConnection}>Add connection</button>
        </div>

        {me?.role === "admin" && (
          <OptionManager
            label="interfaces"
            placeholder="New interface"
            items={interfaceList}
            onAdd={handleAddInterface}
            onDelete={handleDeleteInterface}
          />
        )}

        <div style={{ marginTop: 12 }}>
          {connections.map((c, index) => {
            const rows: { label: string; deviceKey: "from_device" | "to_device"; portKey: "from_port" | "to_port" }[] = [
              { label: "From", deviceKey: "from_device", portKey: "from_port" },
              { label: "To", deviceKey: "to_device", portKey: "to_port" },
            ];
            return (
              <div key={index} className="card" style={{ background: "var(--surface-alt)" }}>
                {rows.map((row) => {
                  const deviceInvalid = showError(`conn-${index}`) && !deviceNames.includes(c[row.deviceKey]);
                  const portInvalid = showError(`conn-${index}`) && !c[row.portKey].trim();
                  return (
                    <div key={row.label} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <b style={{ width: 44, paddingTop: 14 }}>{row.label}</b>
                      <select
                        value={c[row.deviceKey]}
                        onChange={(e) => updateConnection(index, row.deviceKey, e.target.value)}
                        onBlur={() => markTouched(`conn-${index}`)}
                        className={deviceInvalid ? "field-error" : ""}
                        aria-label={`${row.label} device`}
                      >
                        <option value="">Select device</option>
                        {deviceNames.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <select
                        value={c[row.portKey]}
                        onChange={(e) => updateConnection(index, row.portKey, e.target.value)}
                        onBlur={() => markTouched(`conn-${index}`)}
                        className={portInvalid ? "field-error" : ""}
                        aria-label={`${row.label} interface`}
                      >
                        <option value="">Select interface</option>
                        {(c[row.portKey] && !interfaceList.some((x) => x.name === c[row.portKey])
                          ? [...interfaceList.map((x) => x.name), c[row.portKey]]
                          : interfaceList.map((x) => x.name)
                        ).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {c.from_device && c.from_device === c.to_device ? (
                  <p style={{ color: "#dc2626", marginTop: 0 }}>From and To must be different devices.</p>
                ) : null}
                <button type="button" className="secondary" onClick={() => removeConnection(index)}>Remove connection</button>
              </div>
            );
          })}
          {connections.length === 0 ? <p>No connections yet.</p> : null}
        </div>
      </div>

      {submitError ? <div className="field-error" style={{ padding: 12, marginBottom: 12 }}>{submitError}</div> : null}
      {!canSubmit && submitAttempted ? <div className="field-error" style={{ padding: 12, marginBottom: 12 }}>Please fill in the required fields. Every connection needs two different devices from the list and an interface on each side.</div> : null}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : mode === "create" ? "Create" : "Save"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={isSubmitting}
          onClick={() => router.push(mode === "edit" && setupId ? `/setups/${setupId}` : "/")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
