'use server';

import { verifyAdminToken } from '@/lib/auth';

export async function testSmsAction(phone: string, message: string, authToken: string) {
    // SECURITY: Verify admin authentication before allowing SMS sending
    const auth = await verifyAdminToken(authToken);
    if (!auth.authenticated) {
        return {
            success: false,
            error: 'Unauthorized: ' + (auth.error || 'Admin access required')
        };
    }

    try {
        console.log('Testing SMS to:', phone, '| by user:', auth.user?.email);

        // Moolre SMS API only requires X-API-VASKEY for authentication
        const smsVasKey = process.env.MOOLRE_SMS_API_KEY;

        if (!smsVasKey) {
            return {
                success: false,
                error: 'Missing MOOLRE_SMS_API_KEY environment variable'
            };
        }

        // Validate phone input
        if (!phone || typeof phone !== 'string') {
            return { success: false, error: 'Invalid phone number' };
        }

        // Validate message input
        if (!message || typeof message !== 'string' || message.length > 1000) {
            return { success: false, error: 'Invalid or too long message' };
        }

        // Format phone number for Ghana
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = '233' + cleaned.slice(1);
        }
        if (!cleaned.startsWith('233') && cleaned.length === 9) {
            cleaned = '233' + cleaned;
        }
        const recipient = '+' + cleaned;

        // Make API call per Moolre documentation
        const response = await fetch('https://api.moolre.com/open/sms/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-VASKEY': smsVasKey
            },
            body: JSON.stringify({
                type: 1,
                senderid: process.env.MOOLRE_SMS_SENDER_ID || 'DD Zone',
                messages: [
                    {
                        recipient: recipient,
                        message: message
                    }
                ]
            })
        });

        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            result = { rawResponse: responseText };
        }

        return {
            success: result?.status === 1,
            result,
            formattedPhone: recipient,
            httpStatus: response.status
        };
    } catch (error: any) {
        // SECURITY: Don't expose stack traces
        console.error('[Test SMS] Error:', error.message, error.stack);
        return {
            success: false,
            error: error.message || 'SMS sending failed'
        };
    }
}
