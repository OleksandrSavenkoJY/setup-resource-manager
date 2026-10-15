"use client";

import { useState } from "react";
import { createSetup, updateSetup } from "@/lib/api";
import { useRouter } from "next/navigation";

type DeviceEntry = {
  type: string;
  name: string;
  quantity: number;
  location: string;
  notes: string;
};

type Props = {
  mode: "create" | "edit";
  setupId?: number;
  initialData?: any;
};

const DEVICE_TYPES = [
  "computer",
  "laptop",
  "monitor",
  "switch",
  "router",
  "camera",
  "printer",
  "ups",
  "other",
];

function emptyDevice(): DeviceEntry {
  return {
    type: DEVICE_TYPES[0],
    name: "",
    quantity: 1,
    location: "",
    notes: "",
  };
}

export default function SetupForm({ mode, setupId, initialData }: Props) {
  const router = useRouter();
  const [name, setName] = useState<string>(initialData?.name ?? "");
  const [description, setDescription] = useState<string>(initialData?.description ?? "");
  const [chamber, setChamber] = useState<boolean>(initialData?.chamber ?? false);
  const [outletsUsed, setOutletsUsed] = useState<number>(initialData?.outlets_used ?? 0);
  const [hasChamberDevices, setHasChamberDevices] = useState<boolean>(Boolean(initialData?.chamber_devices?.length));
  const [devices, setDevices] = useState<DeviceEntry[]>(
    initialData?.devices?.length
      ? initialData.devices.map((d: any) => ({
          type: d.type ?? DEVICE_TYPES[0],
          name: d.name ?? "",
          quantity: d.quantity ?? 1,
          location: d.location ?? "",
          notes: d.notes ?? "",
        }))
      : [emptyDevice()]
  );
  const [chamberDevices, setChamberDevices] = useState<DeviceEntry[]>(
    initialData?.chamber_devices?.length
      ? initialData.chamber_devices.map((d: any) => ({
          type: d.type ?? DEVICE_TYPES[0],
          name: d.name ?? "",
          quantity: d.quantity ?? 1,
          location: d.location ?? "",
          notes: d.notes ?? "",
        }))
      : []
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  function markTouched(field: string) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function validate() {
    return {
      name: name.trim().length > 0,
      description: description.trim().length > 0,
      outletsUsed: Number.isFinite(outletsUsed) && outletsUsed >= 0,
      chamberDevices: !chamber || !hasChamberDevices || chamberDevices.length > 0,
      devices: devices.length > 0,
      deviceNames: devices.every((device) => device.name.trim().length > 0),
      chamberDeviceNames: chamberDevices.every((device) => device.name.trim().length > 0),
    };
  }

  const isValid = validate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);

    if (!isValid.name || !isValid.description || !isValid.devices || !isValid.deviceNames || !isValid.chamberDevices || !isValid.chamberDeviceNames) {
      return;
    }

    const payload = {
      name,
      description,
      chamber,
      outlets_used: outletsUsed,
      devices: chamber ? [...devices, ...chamberDevices] : devices,
      chamber_devices: chamber ? chamberDevices : [],
      connections: [],
    };

    if (mode === "create") {
      const created = await createSetup(payload);
      router.push(`/`);
      router.refresh();
      window.localStorage.setItem("setup_resource_manager_new_setup", String(created.id));
    } else if (setupId) {
      await updateSetup(setupId, payload);
      router.push(`/setups/${setupId}`);
    }
  }

  function updateDevice(listSetter: React.Dispatch<React.SetStateAction<DeviceEntry[]>>, index: number, key: keyof DeviceEntry, value: string | number) {
    listSetter((current) => current.map((device, i) => (i === index ? { ...device, [key]: value } : device)));
  }

  function addDevice(listSetter: React.Dispatch<React.SetStateAction<DeviceEntry[]>>) {
    listSetter((current) => [...current, emptyDevice()]);
  }

  function removeDevice(listSetter: React.Dispatch<React.SetStateAction<DeviceEntry[]>>, index: number) {
    listSetter((current) => current.filter((_, i) => i !== index));
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

      <label>
        Chamber
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input type="radio" name="chamber" checked={chamber} onChange={() => setChamber(true)} />
            Chamber setup
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input type="radio" name="chamber" checked={!chamber} onChange={() => setChamber(false)} />
            Not chamber setup
          </label>
        </div>
      </label>

      {chamber && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0 }}>Chamber devices</h3>
            {!hasChamberDevices ? (
              <button type="button" onClick={() => setHasChamberDevices(true)}>Add chamber</button>
            ) : (
              <button type="button" className="secondary" onClick={() => setHasChamberDevices(false)}>Remove chamber</button>
            )}
          </div>

          {hasChamberDevices && (
            <div style={{ marginTop: 12 }}>
              {chamberDevices.map((device, index) => (
                <div key={`chamber-${index}`} className="card" style={{ background: "#fafafa" }}>
                  <label>
                    Device type
                    <select value={device.type} onChange={(e) => updateDevice(setChamberDevices, index, "type", e.target.value)}>
                      {DEVICE_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Device name
                    <input value={device.name} onChange={(e) => updateDevice(setChamberDevices, index, "name", e.target.value)} className={showError(`chamber-name-${index}`) && !device.name.trim() ? "field-error" : ""} />
                  </label>
                  <label>
                    Quantity
                    <input type="number" value={device.quantity} onChange={(e) => updateDevice(setChamberDevices, index, "quantity", Number(e.target.value))} />
                  </label>
                  <label>
                    Location
                    <input value={device.location} onChange={(e) => updateDevice(setChamberDevices, index, "location", e.target.value)} />
                  </label>
                  <label>
                    Notes
                    <textarea value={device.notes} onChange={(e) => updateDevice(setChamberDevices, index, "notes", e.target.value)} />
                  </label>
                  <button type="button" className="secondary" onClick={() => removeDevice(setChamberDevices, index)}>Remove device</button>
                </div>
              ))}
              <button type="button" onClick={() => addDevice(setChamberDevices)}>Add device</button>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Devices</h3>
          <button type="button" onClick={() => addDevice(setDevices)}>Add device</button>
        </div>

        <div style={{ marginTop: 12 }}>
          {devices.map((device, index) => (
            <div key={index} className="card" style={{ background: "#fafafa" }}>
              <label>
                Device type
                <select value={device.type} onChange={(e) => updateDevice(setDevices, index, "type", e.target.value)}>
                  {DEVICE_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Device name
                <input value={device.name} onChange={(e) => updateDevice(setDevices, index, "name", e.target.value)} className={showError(`device-name-${index}`) && !device.name.trim() ? "field-error" : ""} />
              </label>
              <label>
                Quantity
                <input type="number" value={device.quantity} onChange={(e) => updateDevice(setDevices, index, "quantity", Number(e.target.value))} />
              </label>
              <label>
                Location
                <input value={device.location} onChange={(e) => updateDevice(setDevices, index, "location", e.target.value)} />
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

      <button type="submit">{mode === "create" ? "Create" : "Save"}</button>
    </form>
  );
}
