import { Category } from '@/constants/categories';
import { Wallet } from '@/utils/types';

export interface ParsedTransaction {
    id: string; // temp id for UI keying
    amount: number;
    type: 'income' | 'expense';
    categoryId: string | null;
    categoryName: string | null;
    categoryIcon: string | null;
    categoryColor: string | null;
    walletId: string | null;
    description: string;
    date: Date;
}

/**
 * Parses a base64 encoded image (receipt/bill) into a structured JSON array of transactions
 * using OpenAI's GPT-4o model.
 */
export async function parseImagesToTransactions(
    base64Images: string[],
    categories: Category[],
    wallets: Wallet[] = []
): Promise<ParsedTransaction[]> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('Missing EXPO_PUBLIC_OPENAI_API_KEY in .env');
    }

    const categoriesPrompt = categories.map(c => `{id: "${c.id}", name: "${c.name}", type: "${c.type}"}`).join(', ');
    const walletsPrompt = wallets.map(w => `{id: "${w.id}", name: "${w.name}"}`).join(', ');
    const currentDate = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are an expert financial parsing assistant. The user will provide an image of a receipt, bill, or invoice.
Your job is to extract the transaction details and return ONLY a valid JSON array of objects representing the items or the total transaction. 
Do not include any explanation or markdown formatting like \`\`\`json. 

Assume the current date is ${currentDate}. If a transaction date is present on the receipt, extract it and resolve it to a standard YYYY-MM-DD format. Otherwise, use the current date.

Available Categories: [${categoriesPrompt}]
Available Wallets: [${walletsPrompt}]

For each transaction, return an object exact matching this interface:
{
    "amount": number (positive),
    "type": "income" | "expense",
    "categoryId": string | null (match to the closest available category id based on intent, or null if absolutely no match),
    "walletId": string | null (match to the closest available wallet id based on intent, or null if absolutely no match),
    "description": string (short clean description of the transaction in English, e.g. "Groceries at Walmart" or specific item),
    "date": string (YYYY-MM-DD format)
}

If it's a single receipt, you can either summarize it as one transaction (e.g. "Walmart Groceries" for the total amount) or break it down if appropriate. Usually returning the total as one expense transaction is preferred unless there are clearly distinct categories.`;

    try {
        const imageContents = base64Images.map(base64Image => ({
            type: "image_url",
            image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
            }
        }));

        const payload = {
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Extract the transactions from these receipt images."
                        },
                        ...imageContents
                    ]
                }
            ],
            max_tokens: 1500,
            temperature: 0.1,
        };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        let content = data.choices[0].message.content.trim();

        if (content.startsWith('\`\`\`json')) {
            content = content.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        } else if (content.startsWith('\`\`\`')) {
            content = content.replace(/\`\`\`/g, '').trim();
        }

        const parsedResults = JSON.parse(content);

        return parsedResults.map((result: any, index: number) => {
            const matchedCategory = categories.find(c => c.id === result.categoryId) || null;

            return {
                id: `picture_${Date.now()}_${index}`,
                amount: Number(result.amount) || 0,
                type: result.type === 'income' ? 'income' : 'expense',
                categoryId: result.categoryId || null,
                categoryName: matchedCategory?.name || null,
                categoryIcon: matchedCategory ? (matchedCategory.icon as string) : null,
                categoryColor: matchedCategory?.color || null,
                walletId: result.walletId || null,
                description: result.description || 'Scanned Receipt',
                date: result.date ? new Date(result.date) : new Date(),
            };
        });

    } catch (error) {
        console.error('Image Parsing failed:', error);
        throw error;
    }
}
