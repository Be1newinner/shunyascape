import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/db';
import User from '../../../models/User';
import Settings from '../../../models/Settings';

export async function POST(request: Request) {
  try {
    await connectDB();

    const { requesterEmail, timeOfDay, timeSpeed, isPlaying } = await request.json();

    if (!requesterEmail) {
      return NextResponse.json(
        { error: 'requesterEmail is required' },
        { status: 400 }
      );
    }

    // Verify requester is an admin
    const requester = await User.findOne({ email: requesterEmail.toLowerCase().trim() });
    if (!requester || requester.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Update or create global settings document
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = new Settings({ key: 'global' });
    } else if (settings.isPlaying) {
      const lastUpdatedTime = settings.lastUpdated ? new Date(settings.lastUpdated).getTime() : Date.now();
      const elapsedSeconds = (Date.now() - lastUpdatedTime) / 1000;
      const elapsedHours = elapsedSeconds * settings.timeSpeed;
      settings.timeOfDay = (settings.timeOfDay + elapsedHours) % 24;
    }

    if (timeOfDay !== undefined) settings.timeOfDay = Number(timeOfDay);
    if (timeSpeed !== undefined) settings.timeSpeed = Number(timeSpeed);
    if (isPlaying !== undefined) settings.isPlaying = Boolean(isPlaying);

    settings.lastUpdated = new Date();

    await settings.save();

    return NextResponse.json({
      message: 'Global simulation settings updated successfully',
      settings
    });
  } catch (error: any) {
    console.error('Settings Update API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while updating settings' },
      { status: 500 }
    );
  }
}
