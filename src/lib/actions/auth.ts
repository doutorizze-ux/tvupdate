'use server';

import { z } from 'zod';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomBytes } from 'crypto';
import { hashPassword, verifyPassword, encryptPath, decryptPath } from '../crypto';
import { getDb } from '../mongodb';
import { handleError, getQueryById, handleProfileError } from './utils';
import { getDemoModeMutationError } from '../demo-mode';
import { getVideoSecret } from '../video-secret';

/**
 * Handles Administrator authentication login.
 * Verifies the password and transparently upgrades legacy SHA-256 hashes.
 */
export async function login(prevState: any, formData: FormData) {
  const loginSchema = z.object({ username: z.string(), password: z.string() });
  const validatedFields = loginSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) return { error: 'Invalid fields!' };

  const { username, password } = validatedFields.data;

  try {
    const db = await getDb();
    const adminData = await db.collection('settings').findOne({ _id: 'admin' as any });
    
    if (adminData && typeof adminData.passwordHash === 'string' && typeof adminData.passwordSalt === 'string') {
      const verification = verifyPassword(password, adminData.passwordSalt, adminData.passwordHash);
      if (username === adminData.username && verification.valid) {
        if (verification.needsRehash) {
          const passwordSalt = randomBytes(16).toString('hex');
          await db.collection('settings').updateOne(
            { _id: 'admin' as any },
            { $set: { passwordHash: hashPassword(password, passwordSalt), passwordSalt, passwordAlgorithm: 'pbkdf2-sha512' } }
          );
        }
        const secret = await getVideoSecret();
        const payload = JSON.stringify({ auth: true, user: username, createdAt: Date.now() });
        const token = encryptPath(payload, secret);
        const cookieStore = await cookies();
        cookieStore.set('auth', token, { 
            httpOnly: true, 
            path: '/', 
            sameSite: 'lax', 
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });
        redirect('/admin');
      }
    }
    return { error: 'Invalid username or password.' };
  } catch (error: any) {
    if (error.message && error.message.includes('NEXT_REDIRECT')) {
        throw error;
    }
    console.error('Login error:', error);
    return { error: 'Login failed. Please try again later.' };
  }
}

/**
 * Logs out the Administrator by clearing the auth cookie.
 */
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('auth');
  redirect('/admin/login');
}

/**
 * Updates the admin profile details (username, email, or password).
 * Salts and hashes new password if updated.
 */
export async function updateAdminProfile(prevState: any, formData: FormData) {
    const demoError = getDemoModeMutationError();
    if (demoError) return demoError;
    const db = await getDb();
    
    // Explicitly sanitize and typecast inputs
    const displayName = typeof formData.get('displayName') === 'string' ? (formData.get('displayName') as string).trim() : '';
    const email = typeof formData.get('email') === 'string' ? (formData.get('email') as string).trim() : '';
    const username = typeof formData.get('username') === 'string' ? (formData.get('username') as string).trim() : '';
    const currentPassword = typeof formData.get('currentPassword') === 'string' ? formData.get('currentPassword') as string : '';
    const newPassword = typeof formData.get('newPassword') === 'string' ? formData.get('newPassword') as string : '';

    if (!displayName || !email || !username) {
        return { error: 'Required fields display name, email, or username are missing.' };
    }

    try {
        const admin = await db.collection('settings').findOne({ _id: 'admin' as any });
        if (!admin) return { error: 'Admin record not found' };

        const verification = verifyPassword(currentPassword, admin.passwordSalt, admin.passwordHash);
        if (!verification.valid) return { error: 'Current password incorrect' };

        const updateData: any = { displayName, email, username };
        if (newPassword || verification.needsRehash) {
            const salt = randomBytes(16).toString('hex');
            const hash = hashPassword(newPassword || currentPassword, salt);
            updateData.passwordHash = hash;
            updateData.passwordSalt = salt;
            updateData.passwordAlgorithm = 'pbkdf2-sha512';
        }

        await db.collection('settings').updateOne({ _id: 'admin' as any }, { $set: updateData });
        return { success: true, message: 'Profile updated successfully' };
    } catch (e: any) {
        return handleProfileError('updateAdminProfile', e, 'Failed to update admin profile.');
    }
}

/**
 * Installs and sets up the primary admin credentials.
 */
export async function installSetupAdminAction(data: { username: string, email: string, password: string }) {
    try {
        const db = await getDb();
        const salt = randomBytes(16).toString('hex');
        const hash = hashPassword(data.password, salt);
        const adminProfile = {
            username: data.username.trim() || 'admin',
            displayName: 'Administrator',
            email: data.email.trim(),
            passwordHash: hash,
            passwordSalt: salt,
            passwordAlgorithm: 'pbkdf2-sha512'
        };
        await db.collection('settings').updateOne({ _id: 'admin' as any }, { $set: adminProfile }, { upsert: true });
        return { success: true };
    } catch (e: any) {
        return handleError('installSetupAdminAction', e, 'Admin profile setup failed.');
    }
}

/**
 * Cryptographically verifies if the current session is a valid, unexpired administrator session.
 */
export async function verifyAdminSession(): Promise<boolean> {
    try {
        const cookieStore = await cookies();
        const authCookie = cookieStore.get('auth');
        if (!authCookie || !authCookie.value) return false;

        const secret = await getVideoSecret();
        const decrypted = decryptPath(authCookie.value, secret);
        const data = JSON.parse(decrypted);

        if (data && data.auth === true) {
            const age = Date.now() - (data.createdAt || 0);
            const maxAge = 1000 * 60 * 60 * 24 * 7; // 7 days
            if (age < maxAge && age >= 0) return true;
        }
        return false;
    } catch {
        return false;
    }
}
