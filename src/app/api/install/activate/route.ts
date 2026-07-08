import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        return NextResponse.json({
            success: true,
            message: 'License flow removed. Continue with database setup.'
        });

    } catch (e: any) {
        console.error('Error in install activate route:', e);
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
