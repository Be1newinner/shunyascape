import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/db';
import { getAuthenticatedUser } from '../../../lib/auth';

export async function GET() {
  try {
    await connectDB();
    const authResult = await getAuthenticatedUser();
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, newAccessToken } = authResult;

    const response = NextResponse.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        x: user.x,
        z: user.z,
        clothingColor: user.clothingColor,
      }
    }, { status: 200 });

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
    console.error('Session verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
