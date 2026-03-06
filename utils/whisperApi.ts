import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';

const OPENAI_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

/**
 * Transcribe an audio file using OpenAI Whisper API.
 * Sends the recorded file as multipart/form-data to /v1/audio/transcriptions.
 */
export async function transcribeAudio(audioUri: string): Promise<string> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('Missing EXPO_PUBLIC_OPENAI_API_KEY in .env');
    }

    try {
        const response = await uploadAsync(OPENAI_API_URL, audioUri, {
            httpMethod: 'POST',
            uploadType: FileSystemUploadType.MULTIPART,
            fieldName: 'file',
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
            parameters: {
                model: 'whisper-1',
                response_format: 'json',
            },
        });

        if (response.status !== 200) {
            console.error('Whisper API error:', response.body);
            throw new Error(`Whisper API returned status ${response.status}`);
        }

        const result = JSON.parse(response.body);
        return result.text || '';
    } catch (error) {
        console.error('Transcription failed:', error);
        throw error;
    }
}

/**
 * Parses a natural language sentence into a structured JSON array of transactions
 * using OpenAI's GPT-4o-mini model.
 */
export async function parseTextToTransactions(
    text: string,
    categories: any[],
    wallets: any[]
): Promise<any[]> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('Missing EXPO_PUBLIC_OPENAI_API_KEY in .env');
    }

    const categoriesPrompt = categories.map(c => `{id: "${c.id}", name: "${c.name}", type: "${c.type}"}`).join(', ');
    const walletsPrompt = wallets.map(w => `{id: "${w.id}", name: "${w.name}"}`).join(', ');
    const currentDate = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are a financial parsing assistant. The user will provide a sentence describing one or more financial transactions in any language. 
Your job is to extract the transactions and return ONLY a valid JSON array of objects. 
Do not include any explanation or markdown formatting formatting like \`\`\`json. 

Assume the current date is ${currentDate}. If a transaction date is mentioned (e.g., "yesterday", "last week", or a specific date), extract it and resolve it to a standard YYYY-MM-DD format. Otherwise, use the current date.

Available Categories: [${categoriesPrompt}]
Available Wallets: [${walletsPrompt}]

For each transaction, return an object exact matching this interface:
{
    "amount": number (positive),
    "type": "income" | "expense",
    "categoryId": string | null (match to the closest available category id based on intent, or null if absolutely no match),
    "walletId": string | null (match to the closest available wallet id based on intent, or null if absolutely no match),
    "description": string (short clean description of the transaction in English, e.g. "Groceries at Walmart"),
    "date": string (YYYY-MM-DD format)
}`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text }
                ],
                temperature: 0.1, // Low temperature for consistent JSON output
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        let content = data.choices[0].message.content.trim();

        // Safety: strip markdown code blocks if the model included them despite instructions
        if (content.startsWith('\`\`\`json')) {
            content = content.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        } else if (content.startsWith('\`\`\`')) {
            content = content.replace(/\`\`\`/g, '').trim();
        }

        return JSON.parse(content);
    } catch (error) {
        console.error('GPT Parsing failed:', error);
        throw error;
    }
}
