'use server';

import { getPluginsSettings } from '../data.actions';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { handleError } from './utils';
import { ServerPluginsSettings } from '../server-types';

function getReadableApiError(error: any, fallback: string) {
    const status = error?.status || error?.response?.status;
    const code = error?.code || error?.error?.code;
    const message =
        error?.error?.message ||
        error?.message ||
        error?.response?.data?.error?.message ||
        fallback;

    return [status ? `HTTP ${status}` : '', code ? `code=${code}` : '', message]
        .filter(Boolean)
        .join(' - ');
}

export async function callAi(prompt: string, jsonMode: boolean = false) {
    const settings = await getPluginsSettings() as ServerPluginsSettings | null;
    const provider = settings?.aiProvider || 'groq';

    if (provider === 'groq') {
        const apiKey = settings?.groqApiKey?.trim();
        if (!apiKey) throw new Error('Groq API Key not configured.');
        const groq = new Groq({ apiKey });
        const res = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
        });
        const content = res.choices[0].message.content || '';
        if (jsonMode) return content.replace(/```json/g, '').replace(/```/g, '').trim();
        return content;
    }

    if (provider === 'openai') {
        const apiKey = settings?.openaiApiKey?.trim();
        if (!apiKey) throw new Error('OpenAI API Key not configured.');
        const openai = new OpenAI({ apiKey });
        const res = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'gpt-4o-mini',
            response_format: jsonMode ? { type: 'json_object' } : undefined,
            temperature: 0.1,
        });
        const content = res.choices[0].message.content || '';
        if (jsonMode) return content.replace(/```json/g, '').replace(/```/g, '').trim();
        return content;
    }

    if (provider === 'gemini') {
        const apiKey = settings?.geminiApiKey?.trim();
        if (!apiKey) throw new Error('Gemini API Key not configured.');
        const gemini = new GoogleGenerativeAI(apiKey);
        const model = gemini.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: jsonMode
                ? { temperature: 0.1, responseMimeType: 'application/json' }
                : { temperature: 0.1 },
        });
        const result = await model.generateContent(prompt);
        const content = result.response.text() || '';
        if (jsonMode) return content.replace(/```json/g, '').replace(/```/g, '').trim();
        return content;
    }

    throw new Error('Unsupported AI Provider.');
}

/**
 * Generates structured Series metadata (titles, descriptions, tags, genres) from seed texts.
 */
export async function generateFullSeriesMetadataAction(seedText: string) {
    try {
        const systemPrompt = `You are a professional film producer. Generate drama series metadata based on the description provided.
        Result MUST be a JSON object with: title, description, genres[], tags[], seoTitle, metaDescription, metaKeywords[], slug.
        Input story: "${seedText}"`;
        
        const content = await callAi(systemPrompt, true);
        if (!content) throw new Error('AI returned no content.');
        return { success: true, data: JSON.parse(content) };
    } catch (e: any) {
        return handleError('generateFullSeriesMetadataAction', e, 'AI Generation failed.');
    }
}

/**
 * Verifies the validity of the Groq API key.
 */
export async function testGroqKeyAction(apiKey: string) { try { const groq = new Groq({ apiKey }); await groq.chat.completions.create({ messages: [{ role: 'user', content: 'test' }], model: 'llama-3.3-70b-versatile', max_tokens: 1 }); return { success: true, message: 'Groq API Key is valid!' }; } catch (e: any) { return handleError('testGroqKeyAction', e, 'Groq API Key verification failed.'); } }

/**
 * Verifies the validity of the OpenAI API key.
 */
export async function testOpenAiKeyAction(apiKey: string) {
    try {
        const openai = new OpenAI({ apiKey });
        await openai.chat.completions.create({
            messages: [{ role: 'user', content: 'test' }],
            model: 'gpt-4o-mini',
            max_tokens: 1,
        });
        return { success: true, message: 'OpenAI API Key is valid!' };
    } catch (e: any) {
        return {
            success: false,
            error: getReadableApiError(e, 'OpenAI API Key verification failed.'),
        };
    }
}

/**
 * Verifies the Gemini key against the configured production model.
 */
export async function testGeminiKeyAction(apiKey: string) {
    try {
        const gemini = new GoogleGenerativeAI(apiKey);
        const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
        await model.generateContent('Reply with OK.');
        return { success: true, message: 'Gemini API Key is valid!' };
    } catch (e: any) {
        return {
            success: false,
            error: getReadableApiError(e, 'Gemini API Key verification failed.'),
        };
    }
}
