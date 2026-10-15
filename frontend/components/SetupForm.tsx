"use client";

import { useState } from "react";
import { createSetup, updateSetup } from "@/lib/api";
import { useRouter } from "next/navigation";

type Props = {
  mode: "create" | "edit";
  setupId?: number;
  initialData?: any;
};

export default function SetupForm({ mode, setupId, initialData }: Props) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [chamber, setChamber] = useState(initialData?.chamber || false);
  const [outletsUsed, setOutletsUsed] = useState(initialData?.outlets_used || 0);
  const [devicesText, setDevicesText] = useState(
    initialData?.devices?.map((d: any) => `${d.type},${d.name},${d.quantity},${d.location || ""},${d.notes || ""}`).join("\n") || ""
  );
  const [connectionsText, setConnectionsText] = useState(
    initialData?.connections?.map((c: any) => `${c.from_device},${c.from_port || ""},${c.to_device},${c.to_port || ""},${c.cable_type || ""},${c.notes || ""}`).join("\n") || ""
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const devices = devicesText
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [type, name, quantity, location, notes] = line.split(",");
        return {
          type: type?.trim(),
          name: name?.trim(),
          quantity: Number(quantity || 1),
          location: location?.trim() || null,
          notes: notes?.trim() || null,
        };
      });

    const connections = connectionsText
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [from_device, from_port, to_device, to_port, cable_type, notes] = line.split(",");
        return {
          from_device: from_device?.trim(),
          from_port: from_port?.trim() || null,
          to_device: to_device?.trim(),
          to_port: to_port?.trim() || null,
          cable_type: cable_type?.trim() || null,
          notes: notes?.trim() || null,
        };
      });

    const payload = {
      name,
      description,
      chamber,
      outlets_used: outletsUsed,
      devices,
      connections,
    };

    if (mode === "create") {
      const created = await createSetup(payload);
      router.push(`/setups/${created.id}`);
    } else if (setupId) {
      await updateSetup(setupId, payload);
      router.push(`/setups/${setupId}`);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <label>
        Chamber
        <input
          type="checkbox"
          checked={chamber}
          onChange={(e) => setChamber(e.target.checked)}
        />
      </label>

      <label>
        Outlets used
        <input
          type="number"
          value={outletsUsed}
          onChange={(e) => setOutletsUsed(Number(e.target.value))}
        />
      </label>

      <label>
        Devices: one per line, CSV format
        <textarea
          rows={6}
          value={devicesText}
          onChange={(e) => setDevicesText(e.target.value)}
          placeholder="pc,PC-1,1,desk,Alice workstation"
        />
      </label>

      <label>
        Connections: one per line, CSV format
        <textarea
          rows={6}
          value={connectionsText}
          onChange={(e) => setConnectionsText(e.target.value)}
          placeholder="PC-1,LAN1,Switch-1,Port1,Cat6,uplink"
        />
      </label>

      <button type="submit">
        {mode === "create" ? "Create" : "Save"}
      </button>
    </form>
  );
}
