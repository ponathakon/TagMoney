import { Wallet } from '@/utils/types';

export const INITIAL_WALLETS: Wallet[] = [
    {
        id: 'wallet-cash',
        name: 'wallet_cash',
        icon: 'wallet-outline',
        color: '#10B981',
        initialBalance: 0,
        createdAt: new Date().toISOString()
    },
    {
        id: 'wallet-bank',
        name: 'wallet_bank_account',
        icon: 'card-outline',
        color: '#3B82F6',
        initialBalance: 0,
        createdAt: new Date().toISOString()
    },
    {
        id: 'wallet-savings',
        name: 'wallet_savings',
        icon: 'cash-outline',
        color: '#F59E0B',
        initialBalance: 0,
        createdAt: new Date().toISOString()
    },
    {
        id: 'wallet-credit-card',
        name: 'wallet_credit_card',
        icon: 'card-outline',
        color: '#EF4444',
        initialBalance: 0,
        createdAt: new Date().toISOString()
    }
];

// Icon options for wallets
export const WALLET_ICONS = [
    'wallet-outline',
    'card-outline',
    'cash-outline',
    'briefcase-outline',
    'home-outline',
    'car-outline',
    'gift-outline',
    'trending-up-outline',
    'diamond-outline',
    'rocket-outline',
    'heart-outline',
    'leaf-outline'
];

// Color options for wallets
export const WALLET_COLORS = [
    '#6366F1', // Indigo
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#EF4444', // Red
    '#F97316', // Orange
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#14B8A6', // Teal
    '#3B82F6', // Blue
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#64748B', // Slate
];