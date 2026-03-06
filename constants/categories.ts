import { Ionicons } from '@expo/vector-icons';

export interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
}

export const DEFAULT_INCOME_CATEGORIES: Category[] = [
    { id: '1', name: 'cat_salary', type: 'income', icon: 'cash-outline', color: '#4CAF50' },
    { id: '2', name: 'cat_freelance', type: 'income', icon: 'laptop-outline', color: '#2196F3' },
    { id: '3', name: 'cat_gift', type: 'income', icon: 'gift-outline', color: '#9C27B0' },
    { id: '4', name: 'cat_investment', type: 'income', icon: 'trending-up-outline', color: '#FF9800' },
    { id: '5', name: 'cat_business', type: 'income', icon: 'briefcase-outline', color: '#795548' },
    { id: '6', name: 'cat_bonus', type: 'income', icon: 'star-outline', color: '#FBC02D' },
    { id: '7', name: 'cat_other', type: 'income', icon: 'ellipsis-horizontal-outline', color: '#607D8B' },
];

export const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
    { id: '10', name: 'cat_food', type: 'expense', icon: 'restaurant-outline', color: '#FF5252' },
    { id: '11', name: 'cat_transport', type: 'expense', icon: 'bus-outline', color: '#FFC107' },
    { id: '12', name: 'cat_shopping', type: 'expense', icon: 'cart-outline', color: '#E91E63' },
    { id: '13', name: 'cat_utilities', type: 'expense', icon: 'flash-outline', color: '#FB8C00' },
    { id: '14', name: 'cat_housing', type: 'expense', icon: 'home-outline', color: '#3F51B5' },
    { id: '15', name: 'cat_health', type: 'expense', icon: 'medkit-outline', color: '#009688' },
    { id: '16', name: 'cat_entertainment', type: 'expense', icon: 'game-controller-outline', color: '#9C27B0' },
    { id: '17', name: 'cat_education', type: 'expense', icon: 'book-outline', color: '#03A9F4' },
    { id: '18', name: 'cat_personal_care', type: 'expense', icon: 'bag-remove-outline', color: '#E040FB' },
    { id: '19', name: 'cat_travel', type: 'expense', icon: 'airplane-outline', color: '#00BCD4' },
    { id: '20', name: 'cat_other', type: 'expense', icon: 'ellipsis-horizontal-outline', color: '#607D8B' },
];

export const INITIAL_CATEGORIES = [...DEFAULT_INCOME_CATEGORIES, ...DEFAULT_EXPENSE_CATEGORIES];

export const getCategoryById = (categories: Category[], id: string) => categories.find(c => c.id === id);
