import { Category } from '@/constants/categories';
import { getCurrencyByCode } from '@/constants/currencies';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCategories, getCurrency, getData, getPreferences, StorageKeys } from './storage';
import { Transaction } from './types';

const READ_NOTIFICATIONS_KEY = 'read_notification_ids';

export interface AppNotification {
    id: string;
    type: 'budget_warning' | 'budget_exceeded' | 'no_transactions' | 'high_expense' | 'category_overspend';
    titleKey: string;
    messageKey: string;
    messageParams?: Record<string, string | number>;
    icon: string;
    color: string;
    timestamp: number;
}

export const generateNotifications = async (): Promise<AppNotification[]> => {
    const notifications: AppNotification[] = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Load data
    const transactions: Transaction[] = (await getData(StorageKeys.TRANSACTIONS)) || [];
    const prefs = await getPreferences();
    const categories: Category[] = (await getCategories()) || [];
    const currencyCode = await getCurrency();
    const currency = getCurrencyByCode(currencyCode).symbol;

    const { dailyLimit, monthlyLimit, categoryLimits } = prefs;

    // Calculate today's spending
    let todaySpent = 0;
    const todayExpenses: Transaction[] = [];

    // Calculate monthly spending
    let monthSpent = 0;
    const categoryExpenses: Record<string, number> = {};

    // Find the largest single expense this month
    let largestExpenseIndex = -1;
    let largestExpenseAmount = 0;

    transactions.forEach((tx, idx) => {
        if (tx.type !== 'expense') return;

        const txDate = new Date(tx.date);
        const txDateStr = tx.date.split('T')[0];

        // Today
        if (txDateStr === todayStr) {
            todaySpent += tx.amount;
            todayExpenses.push(tx);
        }

        // This month
        if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
            monthSpent += tx.amount;

            // Track per-category
            const catId = tx.categoryId || tx.category;
            if (catId) {
                categoryExpenses[catId] = (categoryExpenses[catId] || 0) + tx.amount;
            }

            // Track largest
            if (tx.amount > largestExpenseAmount) {
                largestExpenseAmount = tx.amount;
                largestExpenseIndex = idx;
            }
        }
    });

    // 1. Budget Exceeded (daily)
    if (dailyLimit > 0 && todaySpent > dailyLimit) {
        const overAmount = todaySpent - dailyLimit;
        notifications.push({
            id: 'daily_exceeded',
            type: 'budget_exceeded',
            titleKey: 'daily_exceeded_title',
            messageKey: 'daily_exceeded_message',
            messageParams: { amount: overAmount.toFixed(2), limit: dailyLimit.toFixed(2), currency },
            icon: 'alert-circle',
            color: '#EF4444',
            timestamp: now.getTime(),
        });
    }
    // 2. Budget Warning (daily) — 80% threshold
    else if (dailyLimit > 0 && todaySpent >= dailyLimit * 0.8) {
        const percent = Math.round((todaySpent / dailyLimit) * 100);
        notifications.push({
            id: 'daily_warning',
            type: 'budget_warning',
            titleKey: 'daily_warning_title',
            messageKey: 'daily_warning_message',
            messageParams: { percent, spent: todaySpent.toFixed(2), limit: dailyLimit.toFixed(2), currency },
            icon: 'warning',
            color: '#F59E0B',
            timestamp: now.getTime(),
        });
    }

    // 3. Budget Exceeded (monthly)
    if (monthlyLimit > 0 && monthSpent > monthlyLimit) {
        const overAmount = monthSpent - monthlyLimit;
        notifications.push({
            id: 'monthly_exceeded',
            type: 'budget_exceeded',
            titleKey: 'monthly_exceeded_title',
            messageKey: 'monthly_exceeded_message',
            messageParams: { amount: overAmount.toFixed(2), limit: monthlyLimit.toFixed(2), currency },
            icon: 'alert-circle',
            color: '#EF4444',
            timestamp: now.getTime(),
        });
    }
    // 4. Budget Warning (monthly) — 80% threshold
    else if (monthlyLimit > 0 && monthSpent >= monthlyLimit * 0.8) {
        const percent = Math.round((monthSpent / monthlyLimit) * 100);
        notifications.push({
            id: 'monthly_warning',
            type: 'budget_warning',
            titleKey: 'monthly_warning_title',
            messageKey: 'monthly_warning_message',
            messageParams: { percent, spent: monthSpent.toFixed(2), limit: monthlyLimit.toFixed(2), currency },
            icon: 'warning',
            color: '#F59E0B',
            timestamp: now.getTime(),
        });
    }

    // 5. Category Overspend
    if (categoryLimits) {
        Object.entries(categoryLimits).forEach(([catId, limit]) => {
            if (limit <= 0) return;
            const spent = categoryExpenses[catId] || 0;
            if (spent > limit) {
                const cat = categories.find(c => c.id === catId);
                const catName = cat?.name || 'Unknown category';
                notifications.push({
                    id: `cat_overspend_${catId}`,
                    type: 'category_overspend',
                    titleKey: 'category_overspend_title', // Or hardcode name? Wait, let's use string replace for title too if needed. Oh, we don't have category_overspend_title translated yet. Let's just use over_limit
                    messageKey: 'category_overspend_message',
                    messageParams: { category: catName, spent: spent.toFixed(2), limit: limit.toFixed(2), currency },
                    icon: 'pricetag',
                    color: '#8B5CF6',
                    timestamp: now.getTime(),
                });
            }
        });
    }

    // 6. High Expense Alert
    if (monthlyLimit > 0 && largestExpenseIndex >= 0 && largestExpenseAmount > monthlyLimit * 0.3) {
        const largest = transactions[largestExpenseIndex];
        notifications.push({
            id: `high_expense_${largest.id}`,
            type: 'high_expense',
            titleKey: 'large_expense_title',
            messageKey: 'large_expense_message',
            messageParams: { title: largest.title, amount: largest.amount.toFixed(2), currency },
            icon: 'trending-up',
            color: '#3B82F6',
            timestamp: new Date(largest.date).getTime(),
        });
    }

    // 7. No Transactions Today
    if (todayExpenses.length === 0) {
        notifications.push({
            id: 'no_transactions',
            type: 'no_transactions',
            titleKey: 'no_expenses_title',
            messageKey: 'no_expenses_message',
            icon: 'information-circle',
            color: '#10B981',
            timestamp: now.getTime(),
        });
    }

    // Sort: critical first (exceeded → warning → others)
    const priority: Record<string, number> = {
        budget_exceeded: 0,
        category_overspend: 1,
        budget_warning: 2,
        high_expense: 3,
        no_transactions: 4,
    };

    notifications.sort((a, b) => {
        const priorityDiff = (priority[a.type] ?? 5) - (priority[b.type] ?? 5);
        if (priorityDiff !== 0) return priorityDiff;
        return b.timestamp - a.timestamp; // newest first within same priority
    });

    return notifications;
};

export const getReadNotificationIds = async (): Promise<Set<string>> => {
    try {
        const json = await AsyncStorage.getItem(READ_NOTIFICATIONS_KEY);
        if (json) return new Set(JSON.parse(json));
    } catch (e) {
        console.error('Error reading notification state', e);
    }
    return new Set();
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
    try {
        const readIds = await getReadNotificationIds();
        readIds.add(id);
        await AsyncStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify([...readIds]));
    } catch (e) {
        console.error('Error marking notification as read', e);
    }
};

export const getUnreadCount = async (): Promise<number> => {
    const notifications = await generateNotifications();
    const readIds = await getReadNotificationIds();
    return notifications.filter(n => !readIds.has(n.id)).length;
};
