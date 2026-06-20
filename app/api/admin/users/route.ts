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
    const { user: requester, newAccessToken } = authResult;

    if (requester.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { action, targetUserId, ...data } = await request.json();

    if (!action || !targetUserId) {
      return NextResponse.json(
        { error: 'Missing required parameters (action, targetUserId)' },
        { status: 400 }
      );
    }

    // Find target user
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    let response: NextResponse;

    if (action === 'teleport') {
      const { x, z } = data;
      if (x === undefined || z === undefined) {
        return NextResponse.json(
          { error: 'Coordinates (x, z) are required for teleport action' },
          { status: 400 }
        );
      }

      // Track last positions
      targetUser.lastX = targetUser.x;
      targetUser.lastZ = targetUser.z;
      targetUser.x = Number(x);
      targetUser.z = Number(z);

      await targetUser.save();

      response = NextResponse.json({
        message: `Teleported ${targetUser.name} successfully`,
        user: targetUser,
      });
    } else if (action === 'changeRole') {
      const { role } = data;
      if (!role || !['user', 'admin'].includes(role)) {
        return NextResponse.json(
          { error: 'Invalid or missing role parameter' },
          { status: 400 }
        );
      }

      // Prevent self-demotion to ensure at least one admin remains
      if (targetUser._id.toString() === requester._id.toString() && role !== 'admin') {
        return NextResponse.json(
          { error: 'Cannot demote yourself. Another admin must perform this action.' },
          { status: 400 }
        );
      }

      targetUser.role = role;
      await targetUser.save();

      response = NextResponse.json({
        message: `Updated role for ${targetUser.name} to ${role}`,
        user: targetUser,
      });
    } else if (action === 'delete') {
      // Prevent self-deletion
      if (targetUser._id.toString() === requester._id.toString()) {
        return NextResponse.json(
          { error: 'Cannot delete your own admin account.' },
          { status: 400 }
        );
      }

      await User.findByIdAndDelete(targetUserId);

      response = NextResponse.json({
        message: `Deleted user ${targetUser.name} successfully`,
        deletedUserId: targetUserId,
      });
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
    }

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
    console.error('Admin API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while performing admin action' },
      { status: 550 }
    );
  }
}
