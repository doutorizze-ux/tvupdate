import 'server-only';
import { PluginsSettings, PaymentGatewaySettings } from './types';

export interface ServerPluginsSettings extends PluginsSettings {
    recaptchaSecretKey?: string;
    cloudflareSecretKey?: string;
    hcaptchaSecretKey?: string;
    groqApiKey?: string;
    openaiApiKey?: string;
    geminiApiKey?: string;
    oneSignalApiKey?: string;
}

export interface ServerPaymentGatewaySettings extends PaymentGatewaySettings {
    stripeSecretKey?: string;
    paypalSecret?: string;
    razorpayKeySecret?: string;
    googlePlayServiceAccountEmail?: string;
    googlePlayServiceAccountPrivateKey?: string;
}
