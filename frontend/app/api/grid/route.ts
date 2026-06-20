import { NextResponse } from 'next/server';
import { connectDB } from '../../lib/db';
import User from '../../models/User';
import GridCell from '../../models/GridCell';
import { getAuthenticatedUser } from '../../lib/auth';

export async function GET() {
  try {
    await connectDB();

    let cellsCount = await GridCell.countDocuments();
    if (cellsCount === 0) {
      const center = 10;
      const initialCells = [];

      // Predefined tree spots
      const treeSpots = new Set<string>();
      const defaultTrees = [
        { x: 3, z: 3 }, { x: 5, z: 12 }, { x: 15, z: 4 }, { x: 16, z: 15 },
        { x: 2, z: 16 }, { x: 4, z: 8 }, { x: 14, z: 14 }, { x: 6, z: 2 },
        { x: 17, z: 8 }, { x: 8, z: 16 }, { x: 12, z: 3 }, { x: 13, z: 9 },
        { x: 7, z: 15 }, { x: 3, z: 11 }, { x: 11, z: 17 }
      ];
      defaultTrees.forEach(t => treeSpots.add(`${t.x}_${t.z}`));

      for (let x = 0; x < 20; x++) {
        for (let z = 0; z < 20; z++) {
          let type = 'empty';
          let constructionProgress = 0;
          let targetType = 'empty';

          // Starting connecting road
          if (x === center && z >= 4 && z <= 15) {
            type = 'road';
            constructionProgress = 100;
            targetType = 'road';
          }
          // Starting houses
          else if ((x === center - 1 && z === 6) || (x === center + 1 && z === 10) || (x === center - 1 && z === 14)) {
            type = 'house';
            constructionProgress = 100;
            targetType = 'house';
          }
          // Starting trees
          else if (treeSpots.has(`${x}_${z}`)) {
            type = 'tree';
            constructionProgress = 100;
            targetType = 'tree';
          }

          initialCells.push({
            x,
            z,
            type,
            targetType,
            constructionProgress,
            height: 0
          });
        }
      }

      await GridCell.insertMany(initialCells);
    }

    const cells = await GridCell.find({});
    return NextResponse.json({ cells }, { status: 200 });
  } catch (error: any) {
    console.error('Fetch Grid Cells Route Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching grid cells' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const authResult = await getAuthenticatedUser();
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user: requester, newAccessToken } = authResult;

    if (requester.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required to build/modify city grid' }, { status: 403 });
    }

    const { x, z, type, targetType, constructionProgress, height } = await request.json();

    if (x === undefined || z === undefined) {
      return NextResponse.json({ error: 'Coordinates x and z are required' }, { status: 400 });
    }

    // Upsert the cell at coordinate x, z
    const cell = await GridCell.findOneAndUpdate(
      { x: Number(x), z: Number(z) },
      {
        type: type !== undefined ? type : 'empty',
        targetType: targetType !== undefined ? targetType : 'empty',
        constructionProgress: constructionProgress !== undefined ? Number(constructionProgress) : 0,
        height: height !== undefined ? Number(height) : 0
      },
      { new: true, upsert: true }
    );

    const response = NextResponse.json({ message: 'Grid cell updated successfully', cell }, { status: 200 });

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
    console.error('Update Grid Cell API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while updating grid cell' },
      { status: 500 }
    );
  }
}
