import { Category } from '@/constants/categories';
import { Wallet } from '@/utils/types';
import { parseTextToTransactions } from './whisperApi';

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
 * Parses semantic text into structured financial transactions using OpenAI GPT-4o-mini.
 */
export async function parseMultipleTransactions(
    text: string,
    categories: Category[],
    wallets: Wallet[] = [],
): Promise<ParsedTransaction[]> {
    const cleaned = text.trim();
    if (!cleaned) return [];

    try {
        // Send the transcription, available categories, and wallets to GPT
        const parsedResults = await parseTextToTransactions(cleaned, categories, wallets);

        return parsedResults.map((result: any, index: number) => {
            // Re-map the matched category ID back to the full Category object for UI details
            const matchedCategory = categories.find(c => c.id === result.categoryId) || null;

            return {
                id: `voice_${Date.now()}_${index}`,
                amount: Number(result.amount) || 0,
                type: result.type === 'income' ? 'income' : 'expense',
                categoryId: result.categoryId || null,
                categoryName: matchedCategory?.name || null,
                categoryIcon: matchedCategory ? (matchedCategory.icon as string) : null,
                categoryColor: matchedCategory?.color || null,
                walletId: result.walletId || null,
                description: result.description || cleaned,
                date: result.date ? new Date(result.date) : new Date(),
            };
        });
    } catch (error) {
        console.error("Failed to parse transactions with GPT:", error);
        return [];
    }
}
