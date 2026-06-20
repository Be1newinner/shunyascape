import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '../../../lib/db';
import User from '../../../models/User';
import { hashPassword } from '../../../lib/auth';

export async function POST(request: Request) {
  try {
    await connectDB();

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and new password are required' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Check if user exists
    const user = await User.findOne({ email: emailLower });
    if (!user) {
      return NextResponse.json(
        { error: 'User with this email does not exist' },
        { status: 404 }
      );
    }

    const hashedPassword = hashPassword(password);
    const sessionId = crypto.randomUUID();

    user.password = hashedPassword;
    user.currentSessionId = sessionId; // Invalidate all existing sessions
    user.currentRefreshToken = undefined; // Force re-authentication on refresh

    await user.save();

    return NextResponse.json(
      { message: 'Password reset successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Password Reset API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error during password reset' },
      { status: 500 }
    );
  }
}
