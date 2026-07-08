'use server';

import { getDb } from '../mongodb';
import { revalidatePath } from 'next/cache';
import { getPaymentSettings, getGeneralSettings } from '../data.actions';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { handleError, getQueryById, mapDoc } from './utils';
import { ServerPaymentGatewaySettings } from '../server-types';
import { sign } from 'crypto';

/**
 * Creates Stripe Checkout Session URL.
 */
async function createStripeSession(
    pack: any,
    paySettings: ServerPaymentGatewaySettings,
    currency: string,
    successUrlBase: string,
    cancelUrl: string,
    userEmail?: string
): Promise<string> {
    if (!paySettings.stripeSecretKey) throw new Error('Stripe Secret Key not configured');
    const stripe = new Stripe(paySettings.stripeSecretKey.trim(), { apiVersion: '2023-10-16' });
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
            price_data: {
                currency: currency,
                product_data: {
                    name: pack.name,
                    description: pack.description || `Purchase ${pack.amount || pack.durationDays + ' Days VIP'}`
                },
                unit_amount: Math.round(pack.price * 100)
            },
            quantity: 1
        }],
        mode: 'payment',
        success_url: `${successUrlBase}&session_id={CHECKOUT_SESSION_ID}&gateway=stripe`,
        cancel_url: cancelUrl,
        customer_email: userEmail
    });
    if (!session.url) throw new Error('Failed to generate Stripe checkout URL.');
    return session.url;
}

/**
 * Creates PayPal Order and returns its approval URL.
 */
async function createPayPalOrder(
    pack: any,
    paySettings: ServerPaymentGatewaySettings,
    currency: string,
    successUrlBase: string,
    cancelUrl: string
): Promise<string> {
    if (!paySettings.paypalClientId || !paySettings.paypalSecret) throw new Error('PayPal credentials not configured');
    const isSandbox = paySettings.paypalClientId.trim().startsWith('sb-') || paySettings.paypalClientId.trim().includes('sandbox');
    const paypalEndpoint = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
    const auth = Buffer.from(`${paySettings.paypalClientId.trim()}:${paySettings.paypalSecret.trim()}`).toString('base64');
    
    const tokenRes = await fetch(`${paypalEndpoint}/v1/oauth2/token`, {
        method: 'POST',
        body: 'grant_type=client_credentials',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error_description || 'PayPal Auth Failed');
    
    const orderRes = await fetch(`${paypalEndpoint}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: currency.toUpperCase(),
                    value: pack.price.toFixed(2)
                },
                description: `${pack.type === 'membership' ? 'Membership' : 'Coins'}: ${pack.name}`
            }],
            application_context: {
                return_url: `${successUrlBase}&gateway=paypal`,
                cancel_url: cancelUrl,
                user_action: 'PAY_NOW'
            }
        })
    });
    const order = await orderRes.json();
    if (!orderRes.ok) throw new Error(order.message || 'PayPal Order Failed');
    
    const approvalUrl = order.links.find((l: any) => l.rel === 'approve')?.href;
    if (!approvalUrl) throw new Error('PayPal Approval URL not found');
    return approvalUrl;
}

/**
 * Creates Razorpay payment link.
 */
async function createRazorpayLink(
    pack: any,
    paySettings: ServerPaymentGatewaySettings,
    currency: string,
    successUrlBase: string,
    userDisplayName?: string,
    userEmail?: string
): Promise<string> {
    if (!paySettings.razorpayKeyId || !paySettings.razorpayKeySecret) throw new Error('Razorpay credentials not configured');
    const razorpay = new Razorpay({
        key_id: paySettings.razorpayKeyId.trim(),
        key_secret: paySettings.razorpayKeySecret.trim()
    });
    const paymentLink = await razorpay.paymentLink.create({
        amount: Math.round(pack.price * 100),
        currency: currency.toUpperCase(),
        accept_partial: false,
        description: `${pack.type === 'membership' ? 'VIP' : 'Coins'}: ${pack.name}`,
        customer: {
            name: userDisplayName || 'Customer',
            email: userEmail || '',
            contact: ''
        },
        notify: { email: true, sms: false },
        reminder_enable: true,
        callback_url: `${successUrlBase}&gateway=razorpay`,
        callback_method: 'get'
    });
    return paymentLink.short_url;
}

/**
 * Initiates checkout sessions for coin packages or VIP plans.
 */
export async function createCheckoutSessionAction(userId: string, packId: string, gateway: string) {
    const db = await getDb();
    const packRaw = await db.collection('coin-packs').findOne(getQueryById(packId));
    const paySettings = await getPaymentSettings() as ServerPaymentGatewaySettings | null;
    const generalSettings = await getGeneralSettings();
    const monSettings = await db.collection('settings').findOne({ _id: 'monetization' as any });
    if (!packRaw || !paySettings) return { success: false, error: 'Invalid pack or settings' };
    
    const pack = mapDoc(packRaw);
    const baseUrl = (generalSettings?.siteUrl || 'http://localhost:9002').replace(/\/$/, '');
    const successUrlBase = `${baseUrl}/wallet?status=success&pack_id=${packId}`;
    const cancelUrl = `${baseUrl}/wallet?status=cancel`;
    const currency = monSettings?.currency?.toLowerCase() || 'usd';

    try {
        const user = await db.collection('users').findOne({ _id: userId as any });
        if (gateway === 'stripe') {
            const url = await createStripeSession(pack, paySettings, currency, successUrlBase, cancelUrl, user?.email);
            return { success: true, url };
        }
        if (gateway === 'paypal') {
            const url = await createPayPalOrder(pack, paySettings, currency, successUrlBase, cancelUrl);
            return { success: true, url };
        }
        if (gateway === 'razorpay') {
            const url = await createRazorpayLink(pack, paySettings, currency, successUrlBase, user?.displayName, user?.email);
            return { success: true, url };
        }
        return { success: false, error: 'Unsupported gateway' };
    } catch (e: any) { 
        return handleError('createCheckoutSessionAction', e, 'Payment provider error.'); 
    }
}

/**
 * Verifies purchase transaction against Stripe API.
 */
async function verifyStripePayment(sessionId: string, packPrice: number, paySettings: ServerPaymentGatewaySettings): Promise<boolean> {
    if (!paySettings.stripeSecretKey) return false;
    const stripe = new Stripe(paySettings.stripeSecretKey.trim(), { apiVersion: '2023-10-16' });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
        const amountPaid = (session.amount_total || 0) / 100;
        return Math.abs(amountPaid - packPrice) < 0.01;
    }
    return false;
}

/**
 * Verifies purchase transaction against PayPal API, capturing it if approved.
 */
async function verifyPayPalPayment(sessionId: string, paySettings: ServerPaymentGatewaySettings): Promise<boolean> {
    if (!paySettings.paypalClientId || !paySettings.paypalSecret) return false;
    const isSandbox = paySettings.paypalClientId.trim().startsWith('sb-') || paySettings.paypalClientId.trim().includes('sandbox');
    const paypalEndpoint = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
    const auth = Buffer.from(`${paySettings.paypalClientId.trim()}:${paySettings.paypalSecret.trim()}`).toString('base64');
    
    const tokenRes = await fetch(`${paypalEndpoint}/v1/oauth2/token`, {
        method: 'POST',
        body: 'grant_type=client_credentials',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) return false;

    // Retrieve order status from PayPal
    const orderRes = await fetch(`${paypalEndpoint}/v2/checkout/orders/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok) return false;

    if (orderData.status === 'APPROVED') {
        // Capture order if it is approved by payer
        const captureRes = await fetch(`${paypalEndpoint}/v2/checkout/orders/${sessionId}/capture`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
            }
        });
        const captureData = await captureRes.json();
        return captureRes.ok && captureData.status === 'COMPLETED';
    } else if (orderData.status === 'COMPLETED') {
        return true;
    }
    return false;
}

/**
 * Verifies purchase transaction against Razorpay API.
 */
async function verifyRazorpayPayment(sessionId: string, packPrice: number, paySettings: ServerPaymentGatewaySettings): Promise<boolean> {
    if (!paySettings.razorpayKeyId || !paySettings.razorpayKeySecret) return false;
    const razorpay = new Razorpay({
        key_id: paySettings.razorpayKeyId.trim(),
        key_secret: paySettings.razorpayKeySecret.trim()
    });
    const payment = await razorpay.payments.fetch(sessionId);
    if (payment.status === 'captured') {
        const amountPaid = Number(payment.amount) / 100;
        return Math.abs(amountPaid - packPrice) < 0.01;
    }
    return false;
}

/**
 * Generates temporary JWT assertion for Google Play Developer API OAuth2 authentication.
 */
async function getGoogleAccessToken(email: string, privateKey: string): Promise<string> {
    const cleanKey = privateKey.replace(/\\n/g, '\n');
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
        iss: email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    })).toString('base64url');

    const signatureInput = `${header}.${payload}`;
    const signature = sign('RSA-SHA256', Buffer.from(signatureInput), cleanKey).toString('base64url');
    const assertion = `${signatureInput}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error_description || 'Google Play OAuth Failed');
    }
    return data.access_token;
}

/**
 * Verifies purchase transaction against Google Play Developer API.
 */
async function verifyGooglePlayPayment(sessionId: string, productId: string, paySettings: ServerPaymentGatewaySettings): Promise<boolean> {
    const packageName = paySettings.googlePlayPackageName;
    const email = paySettings.googlePlayServiceAccountEmail;
    const privateKey = paySettings.googlePlayServiceAccountPrivateKey;

    if (!packageName || !email || !privateKey) {
        throw new Error('Google Play Developer API credentials are not configured in Admin panel.');
    }

    const token = await getGoogleAccessToken(email, privateKey);
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${sessionId}`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error?.message || 'Google Play Developer API purchase retrieval failed.');
    }

    // purchaseState === 0 means success/completed
    return data.purchaseState === 0;
}

/**
 * Verifies purchase transactions for Stripe, PayPal, Razorpay, or Google Play IAP.
 * Credits user profiles with coins/VIP duration and logs transactions.
 */
export async function verifyAndExecutePurchaseAction(userId: string, packId: string, gateway: string, sessionId: string) {
    const db = await getDb();
    const paySettings = await getPaymentSettings() as ServerPaymentGatewaySettings | null;
    const packRaw = await db.collection('coin-packs').findOne(getQueryById(packId));
    if (!packRaw || !paySettings) return { success: false, error: 'Invalid pack or settings' };
    const pack = mapDoc(packRaw);
    
    try {
        const existingPurchase = await db.collection('purchases').findOne({ sessionId });
        if (existingPurchase) return { success: true, message: 'Transaction already processed.' };
        
        let isVerified = false;
        
        if (gateway === 'stripe') {
            isVerified = await verifyStripePayment(sessionId, pack.price, paySettings);
        } else if (gateway === 'paypal') {
            isVerified = await verifyPayPalPayment(sessionId, paySettings);
        } else if (gateway === 'razorpay') {
            isVerified = await verifyRazorpayPayment(sessionId, pack.price, paySettings);
        } else if (gateway === 'gplay') {
            const googleProductId = pack.googleProductId || pack.id;
            isVerified = await verifyGooglePlayPayment(sessionId, googleProductId, paySettings);
        }

        if (!isVerified) return { success: false, error: 'Payment verification failed.' };
        
        const userProfile = await db.collection('users').findOne({ _id: userId as any });
        if (!userProfile) return { success: false, error: 'User profile not found' };
        
        const updateData: any = {}; 
        let description = '';
        
        if (pack.type === 'membership') {
            const expiryDate = new Date(); 
            const currentExpiry = userProfile.vipExpiry ? new Date(userProfile.vipExpiry) : new Date();
            const startDate = currentExpiry > new Date() ? currentExpiry : new Date();
            expiryDate.setTime(startDate.getTime() + (pack.durationDays * 24 * 60 * 60 * 1000));
            updateData.isVip = true; 
            updateData.vipExpiry = expiryDate; 
            description = `Purchased Membership: ${pack.name}`;
        } else { 
            updateData.$inc = { coins: pack.amount }; 
            description = `Purchased Coins: ${pack.name}`; 
        }
        
        if (updateData.$inc) {
            await db.collection('users').updateOne({ _id: userId as any }, updateData);
        } else {
            await db.collection('users').updateOne({ _id: userId as any }, { $set: updateData });
        }
        
        await db.collection('coin-transactions').insertOne({ 
            userId, 
            type: 'purchase', 
            amount: pack.type === 'membership' ? 0 : pack.amount, 
            description, 
            createdAt: new Date() 
        });
        
        await db.collection('purchases').insertOne({ 
            userId, 
            userEmail: userProfile.email, 
            userName: userProfile.displayName, 
            packId, 
            packName: pack.name, 
            amount: pack.amount, 
            price: pack.price, 
            gateway, 
            sessionId, 
            createdAt: new Date() 
        });
        
        revalidatePath('/', 'layout'); 
        return { success: true };
    } catch (e: any) { 
        return handleError('verifyAndExecutePurchaseAction', e, e.message || 'Purchase verification failed.'); 
    }
}
