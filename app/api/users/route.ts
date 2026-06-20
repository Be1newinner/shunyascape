import { NextResponse } from 'next/server';
import { connectDB } from '../../lib/db';
import User from '../../models/User';
import Settings from '../../models/Settings';
import { getAuthenticatedUser } from '../../lib/auth';

export async function GET() {
  try {
    await connectDB();

    const authResult = await getAuthenticatedUser();
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user: authenticatedUser, newAccessToken } = authResult;

    // Fetch all users, omitting their hashed passwords
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });

    // Fetch or initialize global settings
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = new Settings({ key: 'global' });
      await settings.save();
    } else if (settings.isPlaying) {
      const lastUpdatedTime = settings.lastUpdated ? new Date(settings.lastUpdated).getTime() : Date.now();
      const elapsedSeconds = (Date.now() - lastUpdatedTime) / 1000;
      const elapsedHours = elapsedSeconds * settings.timeSpeed * 0.1;
      settings.timeOfDay = (settings.timeOfDay + elapsedHours) % 24;
      settings.lastUpdated = new Date();
      await settings.save();
    }

    const response = NextResponse.json({ users, settings }, { status: 200 });

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
    console.error('Fetch Users API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching users and settings' },
      { status: 500 }
    );
  }
}
