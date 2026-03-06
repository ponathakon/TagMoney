export interface Wallet {
    id: string;
    name: string;
    icon: string;
    color: string;
    initialBalance: number;
    createdAt: string;
}

export interface Transaction {
    id: string;
    title: string;
    amount: number;
    date: string; // ISO string
    type: 'income' | 'expense';
    category?: string; // This is actually categoryId
    categoryId?: string;
    walletId?: string; // Wallet association
}
