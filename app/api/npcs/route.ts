import { NextResponse } from 'next/server';
import { connectDB } from '../../lib/db';
import User from '../../models/User';
import Npc from '../../models/Npc';

export async function GET() {
  try {
    await connectDB();
    const npcs = await Npc.find({});
    return NextResponse.json({ npcs }, { status: 200 });
  } catch (error: any) {
    console.error('Fetch NPCs API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching NPCs' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const { requesterEmail, npcs } = await request.json();

    if (!requesterEmail) {
      return NextResponse.json({ error: 'requesterEmail is required' }, { status: 400 });
    }

    // Verify requester is an admin (only admins can host and push NPC coordinates)
    const requester = await User.findOne({ email: requesterEmail.toLowerCase().trim() });
    if (!requester || requester.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required to update NPCs' }, { status: 403 });
    }

    if (!npcs || !Array.isArray(npcs)) {
      return NextResponse.json({ error: 'An array of npcs is required' }, { status: 400 });
    }

    // Bulk upsert NPCs using bulkWrite
    const bulkOps = npcs.map((npc: any) => ({
      updateOne: {
        filter: { npcId: npc.npcId },
        update: {
          $set: {
            name: npc.name,
            x: Number(npc.x),
            z: Number(npc.z),
            targetX: Number(npc.targetX),
            targetZ: Number(npc.targetZ),
            state: npc.state,
            clothingColor: Number(npc.clothingColor)
          }
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      await Npc.bulkWrite(bulkOps);
    }

    // Optional: clean up any NPCs from database that are no longer present in the payload list
    const currentNpcIds = npcs.map((npc: any) => npc.npcId);
    await Npc.deleteMany({ npcId: { $notin: currentNpcIds } });

    return NextResponse.json({ message: 'NPCs synchronized successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Synchronize NPCs API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while syncing NPCs' },
      { status: 500 }
    );
  }
}
export async function DELETE(request: Request) {
  try {
    await connectDB();
    const { requesterEmail } = await request.json();
    if (!requesterEmail) {
      return NextResponse.json({ error: 'requesterEmail is required' }, { status: 400 });
    }
    const requester = await User.findOne({ email: requesterEmail.toLowerCase().trim() });
    if (!requester || requester.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await Npc.deleteMany({});
    return NextResponse.json({ message: 'All NPCs cleared successfully' }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to clear NPCs' }, { status: 500 });
  }
}
