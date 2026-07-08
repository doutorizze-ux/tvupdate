import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { join } from 'path';
import { stat } from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filePath = path.join('/');
  
  if (!filePath || filePath.includes('..')) {
    return new NextResponse('Invalid path', { status: 400 });
  }

  if (filePath.startsWith('videos/') || filePath.startsWith('/videos/')) {
    return new NextResponse('Access Denied: Direct file access is forbidden', { status: 403 });
  }

  const fullPath = join(process.cwd(), 'public', 'uploads', filePath);

  try {
    const stats = await stat(fullPath);
    const stream = fs.createReadStream(fullPath);
    
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    let contentType = 'application/octet-stream';
    const mimeTypes: { [key: string]: string } = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'ts': 'video/mp2t',
    };
    if (extension in mimeTypes) {
        contentType = mimeTypes[extension];
    }
    
    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stats.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return new NextResponse('File not found', { status: 404 });
    }
    if (process.env.NODE_ENV !== 'production') {
      console.error(`Error serving file ${filePath}:`, error);
    }
    return new NextResponse('Internal server error', { status: 500 });
  }
}
