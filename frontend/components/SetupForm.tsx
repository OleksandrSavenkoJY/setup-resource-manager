"use client";

import { useState } from "react";
import { useEffect } from "react";
import OptionManager, { IconDef } from "@/components/OptionManager";
import { createDeviceType, createInterface, deleteDeviceType, deleteInterface, fetchInterfaces, createSetup, fetchDeviceTypes, fetchDeviceIcons, setDeviceTypeIcon, renameDeviceType, updateSetup, fetchAccessPoints, setSetupAccessPoints, type AccessPoint } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { CRITICALITY } from "@/components/Criticality";
import { useRouter } from "next/navigation";

type NetEntry = { name: string; type: string; ip: string; mac: string };

const RADIO_RE = /wi-?fi|wlan|\bble\b|bluetooth|matter|thread|zigbee|z-?wave|lora|nfc|cellular|\blte\b|\b5g\b|radio|\brf\b|uwb|802\.15/i;
const isRadio = (name: string) => RADIO_RE.test(name);

const NET_TYPES = ["Ethernet", "Wi-Fi", "Bluetooth", "Cellular", "Other"];
const IP_RE = /^[0-9a-fA-F:.]+(\/\d{1,3})?$/;
const MAC_RE = /^([0-9a-fA-F]{2}[:\-. ]?){5}[0-9a-fA-F]{2}$|^[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}$/;

let uidCounter = 0;
const newUid = () => `d${++uidCounter}`;

type DeviceEntry = {
  uid: string;
  net_interfaces: NetEntry[];
  type: string;
  name: string;
  location: string;
  // OUTLET, "" or the uid of the source device (names can still be empty or change while editing).
  power_from: string;
  pfa_ip: string;
  notes: string;
};

const OUTLET = "__outlet__";
// Octet-wise IP order; APs without an IP go last, ties fall back to the name.
function compareApIp(a: { ip?: string; name: string }, b: { ip?: string; name: string }) {
  const key = (ip?: string) => (ip && /^\d+(\.\d+){3}$/.test(ip.trim()) ? ip.trim().split(".").map(Number) : null);
  const x = key(a.ip), y = key(b.ip);
  if (x && y) {
    for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] - y[i];
  } else if (x || y) {
    return x ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

const isApType = (t: string) => /^3[\s-]*rd[\s-]*party[\s-]*(ap|access point|router)s?$/i.test(t.trim());

type ConnectionEntry = {
  uid: string;
  from_device: string;
  from_port: string;
  to_device: string;
  to_port: string;
  cable_type: string;
  notes: string;
  powers: string;
  link: "wired" | "radio";
  radio_mode: string;
};

type Props = {
  mode: "create" | "edit";
  setupId?: number;
  initialData?: any;
};

const DEFAULT_TYPES = ["PC", "Laptop", "Monitor", "UPS", "Board", "Board 2", "Chip", "Chip 2", "Chip 3"];
const DESKTOP = "Desktop";


function emptyConnection(): ConnectionEntry {
  return { uid: newUid(), from_device: "", from_port: "", to_device: "", to_port: "", cable_type: "", notes: "", powers: "", link: "wired", radio_mode: "" };
}

function emptyDevice(): DeviceEntry {
  return {
    uid: newUid(),
    type: DEFAULT_TYPES[0],
    name: "",
    location: DESKTOP,
    power_from: "",
    pfa_ip: "",
    net_interfaces: [],
    notes: "",
  };
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

export default function SetupForm({ mode, setupId, initialData }: Props) {
  const router = useRouter();
  const [name, setName] = useState<string>(initialData?.name ?? "");
  const [description, setDescription] = useState<string>(initialData?.description ?? "");
  const [chamber, setChamber] = useState<boolean>(initialData?.chamber ?? false);
  const [allAps, setAllAps] = useState<AccessPoint[]>([]);
  const [criticality, setCriticality] = useState<number>(initialData?.criticality ?? 3);
  const [outletsUsed, setOutletsUsed] = useState<number>(initialData?.outlets_used ?? 0);
  const [chamberCount, setChamberCount] = useState<number>(
    initialData?.chamber_count ?? (initialData?.chamber ? 1 : 0)
  );
  const [typeOptions, setTypeOptions] = useState<string[]>(DEFAULT_TYPES);
  const [typeList, setTypeList] = useState<{ id: number; name: string; icon?: string; auto_icon?: string }[]>([]);
  const [iconList, setIconList] = useState<IconDef[]>([]);
  const [interfaceList, setInterfaceList] = useState<{ id: number; name: string }[]>([]);
  const me = useCurrentUser();
  const [devices, setDevices] = useState<DeviceEntry[]>(() => {
    if (!initialData?.devices?.length) return [emptyDevice()];
    const entries: DeviceEntry[] = initialData.devices.map((d: any) => ({
          uid: newUid(),
          type: d.type ?? DEFAULT_TYPES[0],
          name: d.name ?? "",
          location: d.location ?? DESKTOP,
          power_from: d.power_from ?? "",
          pfa_ip: d.pfa_ip ?? "",
          net_interfaces: (d.net_interfaces ?? []).map((n: any) => ({ name: n.name ?? "", type: n.type ?? "", ip: n.ip ?? "", mac: n.mac ?? "" })),
          notes: d.notes ?? "",
        }));
    const byName = new Map(entries.map((e) => [e.name, e.uid]));
    return entries.map((e) => ({ ...e, power_from: e.power_from === OUTLET ? OUTLET : byName.get(e.power_from) ?? "" }));
  });
  // Devices added with "Add device" stay highlighted until the user edits them.
  const [freshUids, setFreshUids] = useState<Set<string>>(new Set());
  const [scrollToUid, setScrollToUid] = useState<string | null>(null);

  useEffect(() => {
    fetchAccessPoints().then(setAllAps).catch(console.error);
  }, []);

  useEffect(() => {
    if (!scrollToUid) return;
    const card = document.getElementById(`device-card-${scrollToUid}`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.querySelector("select")?.focus({ preventScroll: true });
    setScrollToUid(null);
  }, [scrollToUid]);

  const markEdited = (uid: string | undefined) => {
    if (!uid) return;
    setFreshUids((cur) => {
      if (!cur.has(uid)) return cur;
      const next = new Set(cur);
      next.delete(uid);
      return next;
    });
  };

  const [freshConnUids, setFreshConnUids] = useState<Set<string>>(new Set());
  const [scrollToConn, setScrollToConn] = useState<string | null>(null);

  useEffect(() => {
    if (!scrollToConn) return;
    const card = document.getElementById(`conn-card-${scrollToConn}`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.querySelector("select")?.focus({ preventScroll: true });
    setScrollToConn(null);
  }, [scrollToConn]);

  const [connections, setConnections] = useState<ConnectionEntry[]>(
    (initialData?.connections ?? []).map((c: any) => ({
      uid: newUid(),
      from_device: c.from_device ?? "",
      from_port: c.from_port ?? "",
      to_device: c.to_device ?? "",
      to_port: c.to_port ?? "",
      cable_type: c.cable_type ?? "",
      notes: c.notes ?? "",
      powers: c.powers ?? "",
      link: isRadio(c.from_port ?? "") || isRadio(c.to_port ?? "") ? "radio" : "wired",
      radio_mode: c.radio_mode ?? "",
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

  function deviceIconSvg(deviceName: string) {
    return typeIconSvg(devices.find((d) => d.name === deviceName)?.type);
  }

  function typeIconSvg(type?: string) {
    if (!type) return "";
    const t = typeList.find((x) => x.name === type) as { icon?: string; auto_icon?: string } | undefined;
    const key = t?.icon || t?.auto_icon || "generic";
    return iconList.find((i) => i.key === key)?.svg.replace("<svg ", '<svg width="28" height="28" ') ?? "";
  }

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

  async function handleRenameType(t: { id: number; name: string }, name: string) {
    try {
      const updated = await renameDeviceType(t.id, name);
      setTypeList((cur) => cur.map((x) => (x.id === t.id ? updated : x)));
      setTypeOptions((cur) => cur.map((x) => (x === t.name ? updated.name : x)));
      setDevices((cur) => cur.map((d) => (d.type === t.name ? { ...d, type: updated.name } : d)));
      setSubmitError(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message.replace(/^API \d+: /, "") : "Failed to rename type");
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
  ).sort(byText);

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
      deviceNames: devices.every((device) => device.name.trim().length > 0 || !isApType(device.type)),
    };
  }

  const isValid = validate();
  const canSubmit =
    isValid.name &&
    isValid.description &&
    devices.every((d) => d.net_interfaces.every((n) => (!n.ip.trim() || IP_RE.test(n.ip.trim())) && (!n.mac.trim() || MAC_RE.test(n.mac.trim())))) &&
    isValid.outletsUsed &&
    isValid.devices &&
    isValid.deviceNames &&
    isValid.chamberCount &&
    isValid.connections;

  function apIdsFromDevices() {
    const ids = devices.filter((d) => isApType(d.type)).map((d) => findAp(d)?.id);
    return Array.from(new Set(ids.filter((x): x is number => x !== undefined)));
  }

  // Several APs can share a name, so the device's IP decides which one is meant.
  function findAp(d: { name: string; net_interfaces: { ip: string }[] }) {
    const same = allAps.filter((a) => a.name === d.name);
    return same.find((a) => a.ip && d.net_interfaces.some((n) => n.ip.trim() === a.ip)) ?? same[0];
  }

  function pickAp(index: number, apId: string) {
    const ap = allAps.find((a) => String(a.id) === apId);
    const apName = ap?.name ?? "";
    markEdited(devices[index]?.uid);
    setDevices((cur) => cur.map((d, i) => {
      if (i !== index) return d;
      const prev = findAp(d);
      const hasIface = d.net_interfaces.some((n) => n.ip.trim() && n.ip.trim() !== prev?.ip);
      return {
        ...d,
        name: apName,
        net_interfaces: ap?.ip && !hasIface ? [{ name: "", type: "Ethernet", ip: ap.ip, mac: "" }] : d.net_interfaces,
        notes: d.notes || [ap?.model, ap?.wifi_standard].filter(Boolean).join(", "),
      };
    }));
  }

  // Unnamed devices get their type as the name, numbered when that name is already taken.
  function fillNames(list: DeviceEntry[]) {
    const used = new Set(list.map((d) => d.name.trim()).filter(Boolean));
    return list.map((d) => {
      if (d.name.trim() || isApType(d.type)) return d;
      let name = d.type;
      for (let n = 2; used.has(name); n++) name = `${d.type} ${n}`;
      used.add(name);
      return { ...d, name };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setSubmitError(null);

    if (!canSubmit || isSubmitting) return;
    const named = fillNames(devices);
    setDevices(named);

    const cablePowerSource = (devName: string) => {
      for (const c of connections) {
        if (c.powers === "from" && c.to_device === devName) return c.from_device;
        if (c.powers === "to" && c.from_device === devName) return c.to_device;
      }
      return "";
    };

    const payload = {
      name,
      description,
      chamber,
      outlets_used: outletsUsed,
      chamber_count: chamber ? chamberCount : 0,
      criticality,
      devices: named.map(({ uid: _uid, ...d }) => ({
        ...d,
        quantity: 1,
        pfa_ip: d.type.trim().toUpperCase() === "PC" && d.net_interfaces.some((n) => n.ip.trim() === d.pfa_ip) ? d.pfa_ip : "",
        location: locationOptions.includes(d.location) ? d.location : DESKTOP,
        net_interfaces: d.net_interfaces
          .filter((n) => n.name.trim() || n.ip.trim() || n.mac.trim())
          .map((n) => ({ name: n.name.trim(), type: n.type, ip: n.ip.trim(), mac: n.mac.trim() })),
        power_from:
          (d.power_from === OUTLET ? OUTLET : named.find((o) => o.uid === d.power_from && o.name.trim())?.name) ||
          cablePowerSource(d.name) ||
          "",
      })),
      connections: connections.map((c) => ({
        from_device: c.from_device,
        from_port: c.from_port.trim() || null,
        to_device: c.to_device,
        to_port: c.to_port.trim() || null,
        cable_type: c.cable_type.trim() || null,
        notes: c.notes.trim() || null,
        powers: c.from_device && c.to_device ? c.powers : "",
        radio_mode: c.link === "radio" ? c.radio_mode || "ota" : "",
      })),
    };

    try {
      setIsSubmitting(true);
      if (mode === "create") {
        const created = await createSetup(payload);
        if (apIdsFromDevices().length) await setSetupAccessPoints(created.id, apIdsFromDevices());
        window.localStorage.setItem("setup_resource_manager_new_setup", String(created.id));
        router.push("/");
        router.refresh();
      } else if (setupId) {
        await updateSetup(setupId, payload);
        await setSetupAccessPoints(setupId, apIdsFromDevices());
        router.push(`/setups/${setupId}`);
        router.refresh();
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save setup");
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateDevice(listSetter: React.Dispatch<React.SetStateAction<DeviceEntry[]>>, index: number, key: keyof DeviceEntry, value: string | number) {
    markEdited(devices[index]?.uid);
    listSetter((current) => current.map((device, i) => (i === index ? { ...device, [key]: value } : device)));
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
    const device = emptyDevice();
    listSetter((current) => [...current, device]);
    setFreshUids((cur) => new Set(cur).add(device.uid));
    setScrollToUid(device.uid);
  }

  function updateNet(deviceIndex: number, netIndex: number, key: keyof NetEntry, value: string) {
    markEdited(devices[deviceIndex]?.uid);
    setDevices((cur) => cur.map((d, i) => (i !== deviceIndex ? d : {
      ...d,
      net_interfaces: d.net_interfaces.map((n, j) => (j === netIndex ? { ...n, [key]: value } : n)),
    })));
  }

  function addNet(deviceIndex: number) {
    markEdited(devices[deviceIndex]?.uid);
    setDevices((cur) => cur.map((d, i) => (i !== deviceIndex ? d : {
      ...d,
      net_interfaces: [...d.net_interfaces, { name: "", type: "Ethernet", ip: "", mac: "" }],
    })));
  }

  function removeNet(deviceIndex: number, netIndex: number) {
    setDevices((cur) => cur.map((d, i) => (i !== deviceIndex ? d : {
      ...d,
      net_interfaces: d.net_interfaces.filter((_, j) => j !== netIndex),
    })));
  }

  function removeDevice(listSetter: React.Dispatch<React.SetStateAction<DeviceEntry[]>>, index: number) {
    const removed = devices[index]?.uid;
    listSetter((current) => current.filter((_, i) => i !== index).map((d) => (d.power_from === removed ? { ...d, power_from: "" } : d)));
  }

  function updateConnection(index: number, key: keyof ConnectionEntry, value: string) {
    const uid = connections[index]?.uid;
    if (uid) {
      setFreshConnUids((cur) => {
        if (!cur.has(uid)) return cur;
        const next = new Set(cur);
        next.delete(uid);
        return next;
      });
    }
    setConnections((current) => current.map((c, i) => (i === index ? { ...c, [key]: value } : c)));
  }

  function addConnection() {
    const conn = emptyConnection();
    setConnections((current) => [...current, conn]);
    setFreshConnUids((cur) => new Set(cur).add(conn.uid));
    setScrollToConn(conn.uid);
  }

  function setLinkKind(index: number, link: "wired" | "radio") {
    setConnections((cur) => cur.map((c, i) => (i !== index ? c : {
      ...c,
      link,
      from_port: c.from_port && isRadio(c.from_port) !== (link === "radio") ? "" : c.from_port,
      to_port: c.to_port && isRadio(c.to_port) !== (link === "radio") ? "" : c.to_port,
      powers: link === "radio" ? "" : c.powers,
      radio_mode: link === "radio" ? c.radio_mode || "ota" : "",
    })));
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

      <div className="card" style={{ margin: "16px 0" }}>
        <b>Criticality: how important is it that this setup works without failures?</b>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {CRITICALITY.map((c) => (
            <button
              key={c.level}
              type="button"
              onClick={() => setCriticality(c.level)}
              style={{
                background: criticality === c.level ? c.color : "transparent",
                color: criticality === c.level ? "#fff" : c.color,
                border: `2px solid ${c.color}`,
                fontWeight: 700,
              }}
            >
              {c.level} · {c.label}
            </button>
          ))}
        </div>
      </div>

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
          onRename={handleRenameType}
        />
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Devices</h3>
          <button type="button" onClick={() => addDevice(setDevices)}>Add device</button>
        </div>

        <div style={{ marginTop: 12 }}>
          {devices.map((device, index) => (
            <div
              key={device.uid}
              id={`device-card-${device.uid}`}
              className="card"
              style={freshUids.has(device.uid)
                ? { background: "rgba(37, 99, 235, 0.18)", border: "2px solid #2563eb" }
                : { background: "var(--surface-alt)" }}
            >
              <label>
                Device type
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{ width: 36, height: 36, flex: "none", background: "#fff", borderRadius: 6, border: "1px solid var(--border, #d4d4d8)", display: "grid", placeItems: "center" }}
                    dangerouslySetInnerHTML={{ __html: typeIconSvg(device.type) }}
                  />
                  <select
                    style={{ flex: 1 }}
                    value={device.type}
                    onChange={(e) => updateDevice(setDevices, index, "type", e.target.value)}
                  >
                    {(typeOptions.includes(device.type) ? [...typeOptions] : [...typeOptions, device.type]).sort(byText).map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </label>
              {isApType(device.type) ? (
              <label>
                Access point (from registered list)
                <select value={String(findAp(device)?.id ?? (device.name || ""))} onChange={(e) => pickAp(index, e.target.value)} className={showError(`device-name-${index}`) && !device.name.trim() ? "field-error" : ""}>
                  <option value="">Select access point...</option>
                  {[...allAps].sort(compareApIp).map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.ip ? `${a.ip} - ` : ""}{a.name}{a.model ? ` - ${a.model}` : ""}{a.setup_id && a.setup_id !== setupId ? ` [in ${a.setup_name}]` : ""}
                    </option>
                  ))}
                  {device.name && !allAps.some((a) => a.name === device.name) ? <option value={device.name}>{device.name}</option> : null}
                </select>
              </label>
              ) : (
              <label>
                Device name
                <input value={device.name} placeholder={`${device.type} (default)`} onChange={(e) => updateDevice(setDevices, index, "name", e.target.value)} onBlur={() => !device.name.trim() && setDevices((cur) => fillNames(cur))} />
              </label>
              )}
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
                  {devices.map((o, oi) => ({ o, oi, label: o.name.trim() || `Device ${oi + 1} (unnamed)` }))
                    .sort((x, y) => byText(x.label, y.label)).map(({ o, oi, label }) => (oi !== index ? (
                    <option key={o.uid} value={o.uid}>{label}{o.type ? ` (${o.type})` : ""}</option>
                  ) : null))}
                </select>
              </label>
              <div>
                <b>Network interfaces</b>
                {device.net_interfaces.map((n, ni) => {
                  const ipBad = n.ip.trim() !== "" && !IP_RE.test(n.ip.trim());
                  const macBad = n.mac.trim() !== "" && !MAC_RE.test(n.mac.trim());
                  return (
                    <div key={ni} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                      <input style={{ width: 110 }} placeholder="Name (eth0)" value={n.name} onChange={(e) => updateNet(index, ni, "name", e.target.value)} />
                      <select style={{ width: 120 }} value={n.type} onChange={(e) => updateNet(index, ni, "type", e.target.value)}>
                        {(NET_TYPES.includes(n.type) || !n.type ? NET_TYPES : [...NET_TYPES, n.type]).map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input style={{ width: 160 }} placeholder="IP (192.168.1.10)" value={n.ip} className={ipBad ? "field-error" : ""} onChange={(e) => updateNet(index, ni, "ip", e.target.value)} />
                      <input style={{ width: 170 }} placeholder="MAC (AA:BB:CC:DD:EE:FF)" value={n.mac} className={macBad ? "field-error" : ""} onChange={(e) => updateNet(index, ni, "mac", e.target.value)} />
                      <button type="button" className="secondary" onClick={() => removeNet(index, ni)}>Remove</button>
                    </div>
                  );
                })}
                <div style={{ marginTop: 6 }}>
                  <button type="button" className="secondary" onClick={() => addNet(index)}>+ Add network interface</button>
                </div>
              </div>
              {device.type.trim().toUpperCase() === "PC" && (
              <label>
                PFA address (interface IP of the automation page)
                  <select value={device.pfa_ip} onChange={(e) => updateDevice(setDevices, index, "pfa_ip", e.target.value)}>
                    <option value="">No PFA on this device</option>
                    {device.net_interfaces.filter((n) => n.ip.trim()).map((n, k) => (
                      <option key={k} value={n.ip.trim()}>{n.ip.trim()}{n.name ? ` (${n.name})` : ""}</option>
                    ))}
                    {device.pfa_ip && !device.net_interfaces.some((n) => n.ip.trim() === device.pfa_ip) ? <option value={device.pfa_ip}>{device.pfa_ip}</option> : null}
                  </select>
              </label>
              )}
              <label>
                Notes
                <textarea value={device.notes} onChange={(e) => updateDevice(setDevices, index, "notes", e.target.value)} />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border, #d4d4d8)" }}>
                <button type="button" className="secondary" style={{ background: "#dc2626", color: "#fff", borderColor: "#b91c1c" }} onClick={() => removeDevice(setDevices, index)}>Remove device</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => addDevice(setDevices)}>+ Add device</button>
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
              <div
                key={c.uid}
                id={`conn-card-${c.uid}`}
                className="card"
                style={freshConnUids.has(c.uid)
                  ? { background: "rgba(37, 99, 235, 0.18)", border: "2px solid #2563eb" }
                  : { background: "var(--surface-alt)" }}
              >
                <label>
                  Link type
                  <select value={c.link} onChange={(e) => setLinkKind(index, e.target.value as "wired" | "radio")}>
                    <option value="wired">Wired (Ethernet, USB, wires...)</option>
                    <option value="radio">Radio (Wi-Fi, BLE, Matter...)</option>
                  </select>
                </label>
                {c.link === "radio" ? (
                  <label>
                    Radio mode
                    <select value={c.radio_mode || "ota"} onChange={(e) => updateConnection(index, "radio_mode", e.target.value)}>
                      <option value="ota">Over the air</option>
                      <option value="conducted">Conducted (antenna ports connected by cable)</option>
                      <option value="hybrid">Hybrid (cable to a remote antenna in another chamber)</option>
                    </select>
                  </label>
                ) : null}
                {rows.map((row) => {
                  const deviceInvalid = showError(`conn-${index}`) && !deviceNames.includes(c[row.deviceKey]);
                  const portInvalid = showError(`conn-${index}`) && !c[row.portKey].trim();
                  return (
                    <div key={row.label} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <b style={{ width: 44, paddingTop: 14 }}>{row.label}</b>
                      <span
                        title={devices.find((d) => d.name === c[row.deviceKey])?.type ?? ""}
                        style={{ width: 36, height: 36, flex: "none", marginTop: 4, background: "#fff", borderRadius: 6, border: "1px solid var(--border, #d4d4d8)", display: "grid", placeItems: "center" }}
                        dangerouslySetInnerHTML={{ __html: deviceIconSvg(c[row.deviceKey]) }}
                      />
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
                        ).sort(byText).filter((n) => n === c[row.portKey] || isRadio(n) === (c.link === "radio")).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                <label>
                  Cable (optional)
                  <input
                    value={c.cable_type}
                    placeholder="e.g. USB-C, Cat6, UART 3.3V"
                    onChange={(e) => updateConnection(index, "cable_type", e.target.value)}
                  />
                </label>
                {c.link === "wired" && c.from_device && c.to_device && c.from_device !== c.to_device ? (
                  <label>
                    Power over this cable
                    <select value={c.powers} onChange={(e) => updateConnection(index, "powers", e.target.value)}>
                      <option value="">Data only</option>
                      <option value="from">{c.from_device} powers {c.to_device}</option>
                      <option value="to">{c.to_device} powers {c.from_device}</option>
                    </select>
                  </label>
                ) : null}
                {c.from_device && c.from_device === c.to_device ? (
                  <p style={{ color: "#dc2626", marginTop: 0 }}>From and To must be different devices.</p>
                ) : null}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border, #d4d4d8)" }}>
                <button type="button" className="secondary" style={{ background: "#dc2626", color: "#fff", borderColor: "#b91c1c" }} onClick={() => removeConnection(index)}>Remove connection</button>
              </div>
              </div>
            );
          })}
          {connections.length === 0 ? <p>No connections yet.</p> : null}
        </div>
        {connections.length > 0 ? <button type="button" onClick={addConnection}>+ Add connection</button> : null}
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
