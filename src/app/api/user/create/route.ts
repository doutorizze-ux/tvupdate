import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const usersCollection = db.collection('users');
    const body = await request.json();
    const { uid, email, displayName, photoURL, coins } = body;

    if (!uid || !email) {
      return NextResponse.json({ error: 'Missing uid or email' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ _id: uid });
    if (existingUser) {
      return NextResponse.json({ message: 'User profile already exists.' }, { status: 200 });
    }

    const settings = await db.collection('settings').findOne({ _id: 'general' });
    const signupBonus = settings?.signupBonus ?? 100;

    const newPublicId = Math.floor(10000000 + Math.random() * 90000000).toString();

    const newUserProfile = {
      _id: uid, 
      displayName: displayName || email.split('@')[0],
      email,
      photoURL: photoURL || '',
      coins: coins === undefined ? Number(signupBonus) : Number(coins), 
      isVip: false,
      disabled: false,
      createdAt: new Date(),
      publicId: newPublicId,
    };

    await usersCollection.insertOne(newUserProfile);

    return NextResponse.json(newUserProfile, { status: 201 });

  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('API User Create Error:', error);
    }
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to create user profile', details: errorMessage }, { status: 500 });
  }
}
