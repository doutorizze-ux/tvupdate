import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { join } from 'path';
import { getPluginsSettings } from '@/lib/data.actions';
import { decryptPath } from '@/lib/crypto';
import { getVideoSecret } from '@/lib/video-secret';

function streamFile(path: string, options?: any): ReadableStream {
    const downloadStream = fs.createReadStream(path, options);
    return new ReadableStream({
        start(controller) {
            downloadStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
            downloadStream.on('end', () => controller.close());
            downloadStream.on('error', (error: NodeJS.ErrnoException) => controller.error(error));
        },
        cancel() {
            downloadStream.destroy();
        },
    });
}

function getTimeKeys(period: string, now: number): string[] {
    let current = '';
    let previous = '';
    
    switch(period) {
        case '1h': {
            const h = Math.floor(now / 3600000);
            current = String(h);
            previous = String(h - 1);
            break;
        }
        case '12h': {
            const h = Math.floor(now / 43200000);
            current = String(h);
            previous = String(h - 1);
            break;
        }
        case '24h': {
            const date = new Date(now);
            current = date.toISOString().split('T')[0];
            const prevDate = new Date(now - 24 * 60 * 60 * 1000);
            previous = prevDate.toISOString().split('T')[0];
            break;
        }
        case '1w': {
            const w = Math.floor(now / 604800000);
            current = String(w);
            previous = String(w - 1);
            break;
        }
        case '1mo': {
            const date = new Date(now);
            current = `${date.getFullYear()}-${date.getMonth()}`;
            const prevDate = new Date(date.getFullYear(), date.getMonth() - 1, 1);
            previous = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;
            break;
        }
        default: {
            const date = new Date(now);
            current = date.toISOString().split('T')[0];
            const prevDate = new Date(now - 24 * 60 * 60 * 1000);
            previous = prevDate.toISOString().split('T')[0];
        }
    }
    return [current, previous];
}

/**
 * This API route acts as a secure proxy for uploaded/cloud video files.
 * It decrypts the secure parameter and streams the content.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const encryptedKey = searchParams.get('v');

    if (!encryptedKey) {
        return new NextResponse('Missing parameter', { status: 400 });
    }

    let secret = '';
    try {
        secret = await getVideoSecret();
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('Could not load video signing secret:', error);
        }
        return new NextResponse('Internal Server Error: video security is unavailable.', { status: 500 });
    }
    let decrypted = '';
    try {
        decrypted = decryptPath(encryptedKey, secret);
    } catch (err) {
        return new NextResponse('Access Denied: Invalid security key', { status: 403 });
    }
    
    const parts = decrypted.split('|');
    if (parts.length !== 2) {
        return new NextResponse('Access Denied: Invalid security payload', { status: 403 });
    }
    
    const [filePath, embeddedTimeKey] = parts;

    // Fetch protection settings from MongoDB
    const pluginsSettings = await getPluginsSettings();
    const isProtectionEnabled = pluginsSettings?.videoProtectionEnabled !== false;

    if (isProtectionEnabled) {
        const period = pluginsSettings?.videoRotationPeriod || '24h';
        const [currentKey, previousKey] = getTimeKeys(period, Date.now());
        
        if (embeddedTimeKey !== currentKey && embeddedTimeKey !== previousKey) {
            return new NextResponse('Access Denied: Security key expired', { status: 403 });
        }
    }

    const isRemote = filePath.startsWith('http://') || filePath.startsWith('https://');
    
    if (isRemote) {
        try {
            const range = request.headers.get('range');
            const headers: Record<string, string> = {};
            if (range) {
                headers['range'] = range;
            }
            
            const response = await fetch(filePath, { headers });
            
            const responseHeaders = new Headers();
            responseHeaders.set('Content-Type', response.headers.get('Content-Type') || 'video/mp4');
            if (response.headers.get('Content-Range')) {
                responseHeaders.set('Content-Range', response.headers.get('Content-Range')!);
            }
            if (response.headers.get('Accept-Ranges')) {
                responseHeaders.set('Accept-Ranges', response.headers.get('Accept-Ranges')!);
            }
            if (response.headers.get('Content-Length')) {
                responseHeaders.set('Content-Length', response.headers.get('Content-Length')!);
            }
            responseHeaders.set('Cache-Control', 'no-store');
            
            return new NextResponse(response.body, {
                status: response.status,
                headers: responseHeaders
            });
        } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('Error streaming cloud video:', error);
            }
            return new NextResponse('Failed to retrieve video stream', { status: 502 });
        }
    } else {
        // Sanitize path (must be within uploads/videos)
        const fileName = filePath.split('/').pop();
        if (!fileName) return new NextResponse('Invalid file', { status: 400 });

        const fullPath = join(process.cwd(), 'public', 'uploads', 'videos', fileName);

        if (!fs.existsSync(fullPath)) {
            return new NextResponse('File not found', { status: 404 });
        }

        // Handle range requests for video seeking
        const stat = fs.statSync(fullPath);
        const fileSize = stat.size;
        const range = request.headers.get('range');

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const fileStream = streamFile(fullPath, { start, end });
            
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize.toString(),
                'Content-Type': 'video/mp4',
                'Cache-Control': 'no-store',
            };

            return new NextResponse(fileStream, { status: 206, headers: head });
        } else {
            const head = {
                'Content-Length': fileSize.toString(),
                'Content-Type': 'video/mp4',
                'Cache-Control': 'no-store',
            };
            const fileStream = streamFile(fullPath);
            return new NextResponse(fileStream, { status: 200, headers: head });
        }
    }
}
