
/**
 * Sends a chat conversation to OpenAI's GPT-4o-mini, including context about the user's financial state.
 */
export async function askFinancialAssistant(
    messages: { role: 'user' | 'assistant'; content: string }[],
    financialContext: {
        budget: any;
        wallets: any[];
        transactions: any[];
        currency?: string;
    },
    signal?: AbortSignal
): Promise<string> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('Missing EXPO_PUBLIC_OPENAI_API_KEY in .env');
    }

    const currency = financialContext.currency || 'USD';

    // Format wallets with resolved display names and real balances
    const walletsInfo = financialContext.wallets.map(w =>
        `- ${w.displayName || w.name}: ${currency} ${w.currentBalance ?? w.initialBalance}`
    ).join('\n');

    // Budget info
    const budgetLines = [];
    budgetLines.push(`Daily Spending Limit: ${financialContext.budget.dailyLimit ? `${currency} ${financialContext.budget.dailyLimit}` : 'Not set'}`);
    budgetLines.push(`Monthly Budget: ${financialContext.budget.monthlyLimit ? `${currency} ${financialContext.budget.monthlyLimit}` : 'Not set'}`);

    // Category-level limits
    const categoryLimits = financialContext.budget.categoryLimits || {};
    const catLimitEntries = Object.entries(categoryLimits).filter(([, v]) => (v as number) > 0);
    if (catLimitEntries.length > 0) {
        budgetLines.push('Category Limits:');
        for (const [name, limit] of catLimitEntries) {
            budgetLines.push(`  - ${name}: ${currency} ${limit}`);
        }
    }
    const budgetInfo = budgetLines.join('\n');

    // Format transactions with resolved category & wallet names
    const recentTx = financialContext.transactions.map(tx => {
        const dateStr = tx.date ? tx.date.split('T')[0] : 'Unknown date';
        const sign = tx.type === 'expense' ? '-' : '+';
        const cat = tx.categoryName || 'Uncategorized';
        const wal = tx.walletName || 'Unknown wallet';
        return `[${dateStr}] ${sign}${currency} ${tx.amount} "${tx.title}" | Category: ${cat} | Wallet: ${wal}`;
    }).join('\n');

    const systemPrompt = `You are a helpful, expert personal finance AI assistant built into the 'Tracker' app.
Your role is to help the user understand their financial situation.
Do NOT use markdown to format responses. Provide your answer in plain text.
The user's currency is ${currency}. Always use ${currency} when referring to monetary amounts.

IMPORTANT: You must ONLY use the exact data provided below. Do NOT guess, estimate, or invent any numbers, names, or transactions. If the data does not contain enough information to answer, say so honestly.

Here is the current financial context of the user:
---
BUDGET SETTINGS:
${budgetInfo}

WALLETS:
${walletsInfo || 'No wallets configured.'}

RECENT TRANSACTIONS (${financialContext.transactions.length} total):
${recentTx || 'No transactions recorded.'}
---

Rules:
1. Only reference transactions, wallets, and categories that appear in the data above.
2. When calculating totals, use ONLY the transaction amounts listed — do not round or approximate.
3. If the user asks about data you don't have, let them know.
4. Keep your response concise, friendly, and directly helpful.
5. If the user asks about something outside of their finances or the Tracker app, gently steer them back to financial topics.`;

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
