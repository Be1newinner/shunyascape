import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/db';
import User from '../../../models/User';

export async function POST(request: Request) {
  try {
    await connectDB();

    const { email, x, z } = await request.json();

    if (!email || x === undefined || z === undefined) {
      return NextResponse.json(
        { error: 'Email and coordinates (x, z) are required' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Find the user
    const user = await User.findOne({ email: emailLower });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Save previous position as last position
    user.lastX = user.x;
    user.lastZ = user.z;

    // Update to new position
    user.x = x;
    user.z = z;

    await user.save();

    return NextResponse.json(
      {
        message: 'Position updated successfully',
        x: user.x,
        z: user.z,
        lastX: user.lastX,
        lastZ: user.lastZ,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Position Update API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while updating position' },
      { status: 500 }
    );
  }
}
