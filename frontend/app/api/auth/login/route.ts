import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { connectDB } from '../../../lib/db';
import User from '../../../models/User';
import { verifyPassword, signToken } from '../../../lib/auth';

export async function POST(request: Request) {
  try {
    await connectDB();

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Find user
    const user = await User.findOne({ email: emailLower });
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate strict single session details
    const sessionId = crypto.randomUUID();
    const accessToken = signToken(
      { userId: user._id, email: user.email, role: user.role, sessionId },
      '1d'
    );
    const refreshToken = signToken(
      { userId: user._id, email: user.email, role: user.role, sessionId },
      '30d'
    );

    // Save active session in DB
    user.currentRefreshToken = refreshToken;
    user.currentSessionId = sessionId;
    await user.save();

    const response = NextResponse.json(
      {
        message: 'Login successful',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          x: user.x,
          z: user.z,
          clothingColor: user.clothingColor,
        },
      },
      { status: 200 }
    );

    // Set HTTP-only cookies directly on response
    response.cookies.set('accessToken', accessToken, {
      maxAge: 24 * 60 * 60, // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    response.cookies.set('refreshToken', refreshToken, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error during login' },
      { status: 500 }
    );
  }
}
