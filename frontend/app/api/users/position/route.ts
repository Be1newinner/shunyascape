import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/db';
import User from '../../../models/User';
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
    const { user, newAccessToken } = authResult;

    const { x, z } = await request.json();

    if (x === undefined || z === undefined) {
      return NextResponse.json(
        { error: 'Coordinates (x, z) are required' },
        { status: 400 }
      );
    }

    // Save previous position as last position
    user.lastX = user.x;
    user.lastZ = user.z;

    // Update to new position
    user.x = x;
    user.z = z;

    await user.save();

    const response = NextResponse.json(
      {
        message: 'Position updated successfully',
        x: user.x,
        z: user.z,
        lastX: user.lastX,
        lastZ: user.lastZ,
      },
      { status: 200 }
    );

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
    console.error('Position Update API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while updating position' },
      { status: 500 }
    );
  }
}
