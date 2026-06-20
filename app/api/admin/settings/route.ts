import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/db';
import User from '../../../models/User';
import Settings from '../../../models/Settings';
import { getAuthenticatedUser } from '../../../lib/auth';

export async function POST(request: Request) {
  try {
    await connectDB();

    const authResult = await getAuthenticatedUser();
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const { user: requester, newAccessToken } = authResult;

    if (requester.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { timeOfDay, timeSpeed, isPlaying } = await request.json();

    // Update or create global settings document
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = new Settings({ key: 'global' });
    } else if (settings.isPlaying) {
      const lastUpdatedTime = settings.lastUpdated ? new Date(settings.lastUpdated).getTime() : Date.now();
      const elapsedSeconds = (Date.now() - lastUpdatedTime) / 1000;
      const elapsedHours = elapsedSeconds * settings.timeSpeed * 0.1;
      settings.timeOfDay = (settings.timeOfDay + elapsedHours) % 24;
    }

    if (timeOfDay !== undefined) settings.timeOfDay = Number(timeOfDay);
    if (timeSpeed !== undefined) settings.timeSpeed = Number(timeSpeed);
    if (isPlaying !== undefined) settings.isPlaying = Boolean(isPlaying);

    settings.lastUpdated = new Date();

    await settings.save();

    const response = NextResponse.json({
      message: 'Global simulation settings updated successfully',
      settings
    });

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
    console.error('Settings Update API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while updating settings' },
      { status: 500 }
    );
  }
}
