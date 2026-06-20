import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectDB } from '../../../lib/db';
import { getAuthenticatedUser } from '../../../lib/auth';

export async function POST() {
  try {
    await connectDB();
    const authResult = await getAuthenticatedUser();
    const user = authResult?.user;
    if (user) {
      user.currentRefreshToken = null;
      user.currentSessionId = null;
      await user.save();
    }

    const response = NextResponse.json({ message: 'Logged out successfully' }, { status: 200 });
    response.cookies.delete('accessToken');
    response.cookies.delete('refreshToken');

    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
