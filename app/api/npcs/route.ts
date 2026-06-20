import { NextResponse } from 'next/server';
import { connectDB } from '../../lib/db';
import User from '../../models/User';
import Npc from '../../models/Npc';
import { getAuthenticatedUser } from '../../lib/auth';

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

    const authResult = await getAuthenticatedUser();
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user: requester, newAccessToken } = authResult;

    if (requester.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required to update NPCs' }, { status: 403 });
    }

    const { npcs } = await request.json();

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
    await Npc.deleteMany({ npcId: { $nin: currentNpcIds } });

    const response = NextResponse.json({ message: 'NPCs synchronized successfully' }, { status: 200 });

    if (newAccessToken) {
      response.cookies.set('accessToken', newAccessToken, {
        maxAge: 24 * 60 * 60,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    return response;
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
    const authResult = await getAuthenticatedUser();
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user: requester, newAccessToken } = authResult;

    if (requester.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await Npc.deleteMany({});
    const response = NextResponse.json({ message: 'All NPCs cleared successfully' }, { status: 200 });

    if (newAccessToken) {
      response.cookies.set('accessToken', newAccessToken, {
        maxAge: 24 * 60 * 60,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    return response;
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to clear NPCs' }, { status: 500 });
  }
}
