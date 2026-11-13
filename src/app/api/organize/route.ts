import { NextRequest, NextResponse } from "next/server";
import { getEntriesByOrbit, getAllOrbits, createOrbit, updateEntryStatus, updateOrbit } from "@/lib/db";
import { detectSubOrbits, keywordCluster } from "@/lib/ai/classifier";

export async function POST(request: NextRequest) {
  try {
    const { orbitId } = await request.json();
    if (!orbitId) return NextResponse.json({ error: "Missing orbitId" }, { status: 400 });

    const entries = await getEntriesByOrbit(orbitId);
    if (entries.length < 6) return NextResponse.json({ error: "Need 6+ entries" }, { status: 400 });

    const allOrbits = await getAllOrbits();
    const hasChildren = allOrbits.some(o => o.parentOrbitId === orbitId);
    if (hasChildren) return NextResponse.json({ error: "Already organized" }, { status: 400 });

    const orbit = allOrbits.find(o => o.id === orbitId);
    if (!orbit) return NextResponse.json({ error: "Orbit not found" }, { status: 404 });

    let groups = await detectSubOrbits(orbit.name, entries.map(e => ({ id: e.id, content: e.content })));
    if (!groups || groups.length === 0) {
      groups = keywordCluster(entries.map(e => ({ id: e.id, content: e.content })));
    }
    if (!groups || groups.length < 2) return NextResponse.json({ error: "No clear sub-groups found" }, { status: 200 });

    const created = [];
    for (const group of groups.filter(g => g.entryIds.length >= 2)) {
      const subOrbit = await createOrbit(group.name, true, orbitId);
      await updateOrbit(subOrbit.id, { color: group.color });
      for (const entryId of group.entryIds) {
        await updateEntryStatus(entryId, "classified", subOrbit.id);
      }
      created.push({ name: group.name, count: group.entryIds.length });
    }

    return NextResponse.json({ success: true, groups: created });
  } catch (e) {
    return NextResponse.json({ error: "Organization failed" }, { status: 500 });
  }
}
