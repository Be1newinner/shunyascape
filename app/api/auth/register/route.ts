import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/db';
import User from '../../../models/User';
import { hashPassword } from '../../../lib/auth';

export async function POST(request: Request) {
  try {
    await connectDB();

    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Assign 'admin' role if it is the first user
    const totalUsers = await User.countDocuments({});
    const role = totalUsers === 0 ? 'admin' : 'user';

    const hashedPassword = hashPassword(password);

    // Initial position is center of the 20x20 grid (which has indices 0-19, so center is around x=10, z=10, or world unit 0,0)
    // Let's spawn them at world coordinates (0, 0)
    const newUser = new User({
      name: name.trim(),
      email: emailLower,
      password: hashedPassword,
      role,
      x: 0,
      z: 0,
      lastX: 0,
      lastZ: 0,
    });

    await newUser.save();

    return NextResponse.json(
      {
        message: 'User registered successfully',
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          x: newUser.x,
          z: newUser.z,
          clothingColor: newUser.clothingColor,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}
