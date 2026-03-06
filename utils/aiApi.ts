
/**
 * Sends a chat conversation to OpenAI's GPT-4o-mini, including context about the user's financial state.
 */
export async function askFinancialAssistant(
    messages: { role: 'user' | 'assistant'; content: string }[],
    financialContext: {
        budget: any;
        wallets: any[];
        transactions: any[];
    },
    signal?: AbortSignal
): Promise<string> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('Missing EXPO_PUBLIC_OPENAI_API_KEY in .env');
    }

    // Format the financial context
    const walletsInfo = financialContext.wallets.map(w => `${w.name}: $${w.initialBalance}`).join(', ');
    const budgetInfo = `Daily Limit: $${financialContext.budget.dailyLimit}, Monthly Limit: $${financialContext.budget.monthlyLimit}`;

    // Summarize recent transactions
    const recentTx = financialContext.transactions.map(tx =>
        `[${tx.date.split('T')[0]}] ${tx.type === 'expense' ? '-' : '+'}$${tx.amount} for "${tx.title}" (Category ID: ${tx.categoryId || 'N/A'}, Wallet ID: ${tx.walletId || 'N/A'})`
    ).join('\n');

    const systemPrompt = `You are a helpful, expert personal finance AI assistant built into the 'Tracker' app.
Your role is to help the user understand their financial situation.
Do NOT use markdown to format responses. Provide your answer in plain text.

Here is the current financial context of the user:
---
BUDGET SETTINGS:
${budgetInfo}

WALLETS:
${walletsInfo || 'No wallets configured.'}

TRANSACTIONS:
${recentTx || 'No recent transactions.'}
---

Answer the user's question accurately based ONLY on this context. 
Keep your response concise, friendly, and directly helpful.
If the user asks about something outside of their finances or the Tracker app, gently steer them back to financial topics.`;

    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
    ];

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: apiMessages,
                temperature: 0.3,
            }),
            signal,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (error) {
        console.error('AI Assistant error:', error);
        throw error;
    }
}
