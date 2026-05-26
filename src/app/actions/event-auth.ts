"use server"
import { jwtVerify, JWTPayload, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { get_event_complete } from './events';
import { db } from '@/server/db';

interface EventAuthPayload extends JWTPayload {
    email: string;
    eventId: string;
    eventName: string;
}

interface EventLoginResponse {
    success: boolean;
    event?: any;
    admin?: any;
    error?: string;
    status: number;
}

interface EventAuthData {
    email: string;
    eventId: string;
    eventName: string;
    isAuthenticated: boolean;
}

export async function getJwtSecretKey() {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT Secret key is not set');
    return new TextEncoder().encode(secret);
}

// Now includes eventName in the signed payload
export async function createEventToken(email: string, eventId: string, eventName: string) {
    const token = await new SignJWT({ email, eventId, eventName })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${86400 * 7}s`)
        .sign(await getJwtSecretKey());

    return token;
}

export async function setEventToken(email: string, eventId: string, eventName: string) {
    // Pass eventName through so it's included in the JWT
    const token = await createEventToken(email, eventId, eventName);
    if (!token) return;

    cookies().set({
        name: 'event_token',
        value: token,
        path: '/',
        maxAge: 86400 * 7,
        httpOnly: true,
        sameSite: 'strict',
    });
    return token;
}

export async function verifyEventJwtToken(token: string): Promise<EventAuthPayload | null> {
    try {
        const { payload } = await jwtVerify(token, await getJwtSecretKey());
        return payload as EventAuthPayload;
    } catch {
        return null;
    }
}

export async function getEventJwtData(): Promise<EventAuthData | null> {
    const cookieStore = cookies();
    const token = cookieStore.get('event_token');

    if (!token) return null;

    try {
        const payload = await verifyEventJwtToken(token.value);
        if (!payload) return null;

        return {
            email: payload.email,
            eventId: payload.eventId,
            eventName: payload.eventName, // now correctly present in the token
            isAuthenticated: true,
        };
    } catch {
        return null;
    }
}

export async function logoutEvent() {
    const cookieStore = cookies();
    const token = cookieStore.get('event_token');

    if (token) {
        try {
            cookieStore.delete('event_token');
            return true;
        } catch (_) {}
    }
    return false;
}

export async function loginToEvent(email: string, verificationCode: string): Promise<EventLoginResponse> {
    try {
        if (!email || !verificationCode) {
            return { success: false, error: "Email and verification code are required", status: 400 };
        }

        const trimmedEmail = email.trim().toLowerCase();
        const trimmedCode = verificationCode.trim();

        const eventData = await db.event.findUnique({
            where: { code: trimmedCode },
            include: { admin: true },
        });

        if (!eventData) {
            return { success: false, error: "Invalid verification code", status: 401 };
        }

        if (!eventData.admin || eventData.admin.email.toLowerCase() !== trimmedEmail) {
            return { success: false, error: "Invalid email for this event", status: 401 };
        }

        const token = await setEventToken(trimmedEmail, eventData.id, eventData.name);
        if (!token) {
            return { success: false, error: "Failed to create session", status: 500 };
        }

        return { success: true, event: eventData, admin: eventData.admin, status: 200 };

    } catch (error) {
        console.error('Unexpected error in loginToEvent:', error);
        return { success: false, error: "An unexpected error occurred", status: 500 };
    }
}

export async function loginToEventByName(
    email: string,
    eventName: string,
    verificationCode: string
): Promise<EventLoginResponse> {
    try {
        if (!email || !eventName || !verificationCode) {
            return {
                success: false,
                error: "Email, event name, and verification code are required",
                status: 400,
            };
        }

        const trimmedEmail = email.trim().toLowerCase();
        const trimmedEventName = eventName.trim();
        const trimmedCode = verificationCode.trim();

        const eventData = await db.event.findFirst({
            where: {
                name: trimmedEventName,
                code: trimmedCode,
            },
            include: { admin: true },
        });

        if (!eventData) {
            return { success: false, error: "Invalid event name or verification code", status: 401 };
        }

        if (!eventData.admin || eventData.admin.email.toLowerCase() !== trimmedEmail) {
            return { success: false, error: "Invalid email for this event", status: 401 };
        }

        const token = await setEventToken(trimmedEmail, eventData.id, eventData.name);
        if (!token) {
            return { success: false, error: "Failed to create session", status: 500 };
        }

        return { success: true, event: eventData, admin: eventData.admin, status: 200 };

    } catch (error) {
        console.error('Unexpected error in loginToEventByName:', error);
        return { success: false, error: "An unexpected error occurred", status: 500 };
    }
}

// Uses eventId (from JWT) instead of eventName to avoid ambiguity
export async function getCurrentEventData() {
    const authData = await getEventJwtData();
    if (!authData) return null;

    const eventResponse = await get_event_complete(authData.eventId);
    if (eventResponse.status !== 200 || !eventResponse.event) return null;

    return { ...authData, event: eventResponse.event };
}

export async function requireEventAuth(eventId?: string) {
    const authData = await getEventJwtData();

    if (!authData) {
        return { isAuthenticated: false, error: "Not authenticated", status: 401 };
    }

    // Compare by eventId rather than eventName for reliable authorization
    if (eventId && authData.eventId !== eventId) {
        return { isAuthenticated: false, error: "Not authorized for this event", status: 403 };
    }

    return { isAuthenticated: true, authData, status: 200 };
}

export async function hasEventAdminAccess(eventId: string): Promise<boolean> {
    const authData = await getEventJwtData();
    if (!authData) return false;
    return authData.eventId === eventId;
}