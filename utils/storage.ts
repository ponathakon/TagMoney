import { Category } from '@/constants/categories';
import { INITIAL_WALLETS } from '@/constants/wallets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { Transaction, Wallet } from './types';

export interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    pinned?: boolean;
}

// Add Message interface for AI Chat
export interface Message {
    id?: string;
    sessionId?: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
}

// Database instance
let db: SQLite.SQLiteDatabase | null = null;

// Storage keys for backward compatibility during migration
export const StorageKeys = {
    TRANSACTIONS: 'transactions',
    CATEGORIES: 'categories',
    WALLETS: 'wallets',
    CURRENCY: 'currency',
    BUDGET_SETTINGS: 'user_budget_settings',
};

// Re-export Category type for convenience
export type { Category } from '@/constants/categories';

// Initialize the database
export const initDatabase = async (): Promise<void> => {
    if (db) return;

    db = await SQLite.openDatabaseAsync('tracker.db');

    // Check if the categories table exists and has the 'type' column
    const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(categories)');
    const hasTypeColumn = tableInfo.some(col => col.name === 'type');

    // If categories table exists but lacks 'type' column, drop it to recreate with new schema
    if (tableInfo.length > 0 && !hasTypeColumn) {
        console.log('Schema mismatch detected: categories table lacks "type" column. Recreating tables...');
        await db.execAsync('DROP TABLE IF EXISTS categories');
        await db.execAsync('DROP TABLE IF EXISTS transactions'); // Drop transactions too to stay in sync
        await AsyncStorage.removeItem('sqlite_migration_done'); // Reset migration flag
    }

    // Create tables
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            type TEXT NOT NULL,
            category TEXT,
            categoryId TEXT,
            walletId TEXT
        );

        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            icon TEXT NOT NULL,
            color TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS wallets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT NOT NULL,
            color TEXT NOT NULL,
            initialBalance REAL NOT NULL,
            createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chat_history (
            id TEXT PRIMARY KEY,
            sessionId TEXT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL
        );
    `);

    // Check if transactions table has walletId column, add if missing
    const transactionTableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(transactions)');
    const hasWalletIdColumn = transactionTableInfo.some(col => col.name === 'walletId');
    if (!hasWalletIdColumn) {
        console.log('Adding walletId column to transactions table...');
        await db.execAsync('ALTER TABLE transactions ADD COLUMN walletId TEXT');
    }

    // Check if chat_history table has sessionId column, add if missing
    const chatHistoryTableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(chat_history)');
    const hasSessionIdColumn = chatHistoryTableInfo.some(col => col.name === 'sessionId');
    if (!hasSessionIdColumn) {
        console.log('Adding sessionId column to chat_history table...');
        await db.execAsync('ALTER TABLE chat_history ADD COLUMN sessionId TEXT');
    }

    // Check if chat_sessions table has pinned column, add if missing
    const chatSessionsTableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(chat_sessions)');
    const hasPinnedColumn = chatSessionsTableInfo.some(col => col.name === 'pinned');
    if (!hasPinnedColumn) {
        console.log('Adding pinned column to chat_sessions table...');
        await db.execAsync('ALTER TABLE chat_sessions ADD COLUMN pinned INTEGER DEFAULT 0');
    }

    // Migrate from AsyncStorage if needed
    await migrateFromAsyncStorage();

    // Initialize default wallets if none exist
    await initializeDefaultWallets();

    // Migrate existing transactions without walletId to default wallet
    await migrateTransactionsToDefaultWallet();

    // Migrate existing standalone chat messages to a default session
    await migrateChatHistoryToSessions();
};

const migrateChatHistoryToSessions = async (): Promise<void> => {
    try {
        const messagesWithoutSession = await db!.getAllAsync<Message>(
            'SELECT * FROM chat_history WHERE sessionId IS NULL OR sessionId = ""'
        );

        if (messagesWithoutSession.length > 0) {
            console.log(`Migrating ${messagesWithoutSession.length} raw messages to a new Chat Session...`);
            const defaultSessionId = `session_${Date.now()}`;
            const defaultSessionTitle = "Previous Chat";
            const now = Date.now();

            await db!.runAsync(
                `INSERT INTO chat_sessions (id, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)`,
                [defaultSessionId, defaultSessionTitle, now, now]
            );

            for (const msg of messagesWithoutSession) {
                await db!.runAsync(
                    'UPDATE chat_history SET sessionId = ? WHERE id = ?',
                    [defaultSessionId, msg.id || '']
                );
            }
            console.log('Chat migration completed');
        }
    } catch (e) {
        console.error('Error migrating chat history to sessions:', e);
    }
};

// Migrate data from AsyncStorage to SQLite (one-time migration)
const migrateFromAsyncStorage = async (): Promise<void> => {
    try {
        const migrationDone = await AsyncStorage.getItem('sqlite_migration_done');
        if (migrationDone === 'true') return;

        // Migrate transactions
        const transactionsJson = await AsyncStorage.getItem(StorageKeys.TRANSACTIONS);
        if (transactionsJson) {
            const transactions: Transaction[] = JSON.parse(transactionsJson);
            for (const t of transactions) {
                await db!.runAsync(
                    `INSERT OR REPLACE INTO transactions (id, title, amount, date, type, category, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [t.id, t.title, t.amount, t.date, t.type, t.category || null, t.categoryId || null]
                );
            }
        }

        // Migrate categories
        const categoriesJson = await AsyncStorage.getItem(StorageKeys.CATEGORIES);
        if (categoriesJson) {
            const categories: Category[] = JSON.parse(categoriesJson);
            for (const c of categories) {
                await db!.runAsync(
                    `INSERT OR REPLACE INTO categories (id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)`,
                    [c.id, c.name, c.type, c.icon, c.color]
                );
            }
        }

        // Migrate wallets
        const walletsJson = await AsyncStorage.getItem(StorageKeys.WALLETS);
        if (walletsJson) {
            const wallets: Wallet[] = JSON.parse(walletsJson);
            for (const w of wallets) {
                await db!.runAsync(
                    `INSERT OR REPLACE INTO wallets (id, name, icon, color, initialBalance, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
                    [w.id, w.name, w.icon, w.color, w.initialBalance, w.createdAt]
                );
            }
        }

        await AsyncStorage.setItem('sqlite_migration_done', 'true');
        console.log('Migration from AsyncStorage to SQLite completed');
    } catch (e) {
        console.error('Error migrating from AsyncStorage:', e);
    }
};

// Initialize default wallets if none exist
const initializeDefaultWallets = async (): Promise<void> => {
    try {
        const wallets = await db!.getAllAsync<Wallet>('SELECT * FROM wallets');
        if (wallets.length === 0) {
            console.log('No wallets found. Creating default wallets...');
            for (const w of INITIAL_WALLETS) {
                await db!.runAsync(
                    `INSERT INTO wallets (id, name, icon, color, initialBalance, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
                    [w.id, w.name, w.icon, w.color, w.initialBalance, w.createdAt]
                );
            }
            console.log('Default wallets created');
        }
    } catch (e) {
        console.error('Error initializing default wallets:', e);
    }
};

// Migrate existing transactions without walletId to default wallet
const migrateTransactionsToDefaultWallet = async (): Promise<void> => {
    try {
        const transactionsWithoutWallet = await db!.getAllAsync<Transaction>(
            'SELECT * FROM transactions WHERE walletId IS NULL OR walletId = ""'
        );

        if (transactionsWithoutWallet.length > 0) {
            console.log(`Migrating ${transactionsWithoutWallet.length} transactions to default wallet...`);
            const defaultWalletId = INITIAL_WALLETS[0].id; // Use first wallet (Cash) as default

            for (const tx of transactionsWithoutWallet) {
                await db!.runAsync(
                    'UPDATE transactions SET walletId = ? WHERE id = ?',
                    [defaultWalletId, tx.id]
                );
            }
            console.log('Transaction migration to default wallet completed');
        }
    } catch (e) {
        console.error('Error migrating transactions to default wallet:', e);
    }
};

// Ensure database is initialized
const ensureDb = async (): Promise<SQLite.SQLiteDatabase> => {
    if (!db) await initDatabase();
    return db!;
};

// Generic store data (for backward compatibility)
export const storeData = async (key: string, value: any): Promise<void> => {
    const database = await ensureDb();

    if (key === StorageKeys.TRANSACTIONS && Array.isArray(value)) {
        // Clear and insert all transactions
        await database.runAsync('DELETE FROM transactions');
        for (const t of value) {
            await database.runAsync(
                `INSERT INTO transactions (id, title, amount, date, type, category, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [t.id, t.title, t.amount, t.date, t.type, t.category || null, t.categoryId || null]
            );
        }
    } else if (key === StorageKeys.CATEGORIES && Array.isArray(value)) {
        // Clear and insert all categories
        await database.runAsync('DELETE FROM categories');
        for (const c of value) {
            await database.runAsync(
                `INSERT INTO categories (id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)`,
                [c.id, c.name, c.type, c.icon, c.color]
            );
        }
    }
};

// Generic get data (for backward compatibility)
export const getData = async (key: string): Promise<any> => {
    const database = await ensureDb();

    if (key === StorageKeys.TRANSACTIONS) {
        const rows = await database.getAllAsync('SELECT * FROM transactions');
        return rows.length > 0 ? rows : null;
    } else if (key === StorageKeys.CATEGORIES) {
        const rows = await database.getAllAsync('SELECT * FROM categories');
        return rows.length > 0 ? rows : null;
    }
    return null;
};

// Remove data (for backward compatibility)
export const removeData = async (key: string): Promise<void> => {
    const database = await ensureDb();

    if (key === StorageKeys.TRANSACTIONS) {
        await database.runAsync('DELETE FROM transactions');
    } else if (key === StorageKeys.CATEGORIES) {
        await database.runAsync('DELETE FROM categories');
    }
};

// Transaction operations
export const addTransaction = async (transaction: Transaction): Promise<Transaction[]> => {
    const database = await ensureDb();

    await database.runAsync(
        `INSERT INTO transactions (id, title, amount, date, type, category, categoryId, walletId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [transaction.id, transaction.title, transaction.amount, transaction.date, transaction.type, transaction.category || null, transaction.categoryId || null, transaction.walletId || null]
    );

    return getTransactions();
};

export const getTransactions = async (): Promise<Transaction[]> => {
    const database = await ensureDb();
    const rows = await database.getAllAsync<Transaction>('SELECT * FROM transactions ORDER BY date DESC');
    return rows;
};

export const deleteTransaction = async (id: string): Promise<Transaction[]> => {
    try {
        const database = await ensureDb();
        await database.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
        return getTransactions();
    } catch (e) {
        console.error("Error deleting transaction", e);
        return [];
    }
};

export const updateTransaction = async (transaction: Transaction): Promise<Transaction[]> => {
    try {
        const database = await ensureDb();
        await database.runAsync(
            `UPDATE transactions SET title = ?, amount = ?, date = ?, type = ?, category = ?, categoryId = ?, walletId = ? WHERE id = ?`,
            [transaction.title, transaction.amount, transaction.date, transaction.type, transaction.category || null, transaction.categoryId || null, transaction.walletId || null, transaction.id]
        );
        return getTransactions();
    } catch (e) {
        console.error("Error updating transaction", e);
        return [];
    }
};

// Category operations
export const getCategories = async (): Promise<Category[] | null> => {
    const database = await ensureDb();
    const rows = await database.getAllAsync<Category>('SELECT * FROM categories');
    return rows.length > 0 ? rows : null;
};

export const saveCategories = async (categories: Category[]): Promise<void> => {
    const database = await ensureDb();

    await database.runAsync('DELETE FROM categories');
    for (const c of categories) {
        await database.runAsync(
            `INSERT INTO categories (id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)`,
            [c.id, c.name, c.type, c.icon, c.color]
        );
    }
};

export const addCategory = async (category: Category): Promise<Category[]> => {
    try {
        const database = await ensureDb();
        await database.runAsync(
            `INSERT INTO categories (id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)`,
            [category.id, category.name, category.type, category.icon, category.color]
        );
        return (await getCategories()) || [];
    } catch (e) {
        console.error("Error adding category", e);
        return [];
    }
};

export const deleteCategory = async (id: string): Promise<Category[]> => {
    try {
        const database = await ensureDb();
        // Nullify categoryId on associated transactions (don't delete them)
        await database.runAsync('UPDATE transactions SET categoryId = NULL, category = NULL WHERE categoryId = ?', [id]);
        // Delete the category
        await database.runAsync('DELETE FROM categories WHERE id = ?', [id]);
        return (await getCategories()) || [];
    } catch (e) {
        console.error("Error deleting category", e);
        return [];
    }
};

// Wallet operations
export const getWallets = async (): Promise<Wallet[]> => {
    const database = await ensureDb();
    const rows = await database.getAllAsync<Wallet>('SELECT * FROM wallets ORDER BY createdAt DESC');
    return rows;
};

export const addWallet = async (wallet: Wallet): Promise<Wallet[]> => {
    try {
        const database = await ensureDb();
        await database.runAsync(
            `INSERT INTO wallets (id, name, icon, color, initialBalance, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
            [wallet.id, wallet.name, wallet.icon, wallet.color, wallet.initialBalance, wallet.createdAt]
        );
        return getWallets();
    } catch (e) {
        console.error("Error adding wallet", e);
        return [];
    }
};

export const updateWallet = async (wallet: Wallet): Promise<Wallet[]> => {
    try {
        const database = await ensureDb();
        await database.runAsync(
            `UPDATE wallets SET name = ?, icon = ?, color = ?, initialBalance = ? WHERE id = ?`,
            [wallet.name, wallet.icon, wallet.color, wallet.initialBalance, wallet.id]
        );
        return getWallets();
    } catch (e) {
        console.error("Error updating wallet", e);
        return [];
    }
};

export const deleteWallet = async (id: string): Promise<Wallet[]> => {
    try {
        const database = await ensureDb();
        // Nullify walletId on associated transactions (don't delete them)
        await database.runAsync('UPDATE transactions SET walletId = NULL WHERE walletId = ?', [id]);
        // Delete the wallet
        await database.runAsync('DELETE FROM wallets WHERE id = ?', [id]);
        return getWallets();
    } catch (e) {
        console.error("Error deleting wallet", e);
        return [];
    }
};

export const getWalletBalance = async (walletId: string): Promise<number> => {
    try {
        const database = await ensureDb();
        const wallet = await database.getFirstAsync<Wallet>('SELECT * FROM wallets WHERE id = ?', [walletId]);
        const transactions = await database.getAllAsync<Transaction>('SELECT * FROM transactions WHERE walletId = ?', [walletId]);

        let balance = wallet?.initialBalance || 0;
        transactions.forEach(tx => {
            if (tx.type === 'income') {
                balance += tx.amount;
            } else {
                balance -= tx.amount;
            }
        });

        return balance;
    } catch (e) {
        console.error("Error calculating wallet balance", e);
        return 0;
    }
};

// Currency preference operations (using AsyncStorage for simplicity)
export const getCurrency = async (): Promise<string> => {
    try {
        const currency = await AsyncStorage.getItem(StorageKeys.CURRENCY);
        return currency || 'USD';
    } catch (e) {
        console.error("Error getting currency", e);
        return 'USD';
    }
};

export const saveCurrency = async (currencyCode: string): Promise<void> => {
    try {
        await AsyncStorage.setItem(StorageKeys.CURRENCY, currencyCode);
    } catch (e) {
        console.error("Error saving currency", e);
    }
};

// Budget Preference Operations
export const getPreferences = async (): Promise<{ dailyLimit: number; monthlyLimit: number; categoryLimits?: Record<string, number> }> => {
    try {
        const json = await AsyncStorage.getItem(StorageKeys.BUDGET_SETTINGS);
        if (json) {
            return JSON.parse(json);
        }
        return { dailyLimit: 0, monthlyLimit: 0, categoryLimits: {} };
    } catch (e) {
        console.error("Error getting budget preferences", e);
        return { dailyLimit: 0, monthlyLimit: 0, categoryLimits: {} };
    }
};

export const savePreferences = async (prefs: { dailyLimit?: number; monthlyLimit?: number; categoryLimits?: Record<string, number> }): Promise<void> => {
    try {
        const current = await getPreferences();
        const updated = { ...current, ...prefs };
        await AsyncStorage.setItem(StorageKeys.BUDGET_SETTINGS, JSON.stringify(updated));
    } catch (e) {
        console.error("Error saving budget preferences", e);
    }
};

// --- Chat Session Operations ---

export const createChatSession = async (title: string): Promise<ChatSession | null> => {
    try {
        const database = await ensureDb();
        const id = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const now = Date.now();

        await database.runAsync(
            `INSERT INTO chat_sessions (id, title, createdAt, updatedAt, pinned) VALUES (?, ?, ?, ?, ?)`,
            [id, title, now, now, 0]
        );

        return { id, title, createdAt: now, updatedAt: now, pinned: false };
    } catch (e) {
        console.error("Error creating chat session", e);
        return null;
    }
};

export const getChatSessions = async (): Promise<ChatSession[]> => {
    try {
        const database = await ensureDb();
        const rows = await database.getAllAsync<any>('SELECT * FROM chat_sessions ORDER BY pinned DESC, updatedAt DESC');
        return rows.map(r => ({ ...r, pinned: r.pinned === 1 }));
    } catch (e) {
        console.error("Error getting chat sessions", e);
        return [];
    }
};

export const updateChatSessionTitle = async (id: string, title: string): Promise<void> => {
    try {
        const database = await ensureDb();
        const now = Date.now();
        await database.runAsync(
            `UPDATE chat_sessions SET title = ?, updatedAt = ? WHERE id = ?`,
            [title, now, id]
        );
    } catch (e) {
        console.error("Error updating chat session title", e);
    }
};

export const toggleChatSessionPin = async (id: string, pinned: boolean): Promise<void> => {
    try {
        const database = await ensureDb();
        const now = Date.now();
        await database.runAsync(
            `UPDATE chat_sessions SET pinned = ?, updatedAt = ? WHERE id = ?`,
            [pinned ? 1 : 0, now, id]
        );
    } catch (e) {
        console.error("Error toggling chat session pin", e);
    }
};

export const deleteChatSession = async (id: string): Promise<void> => {
    try {
        const database = await ensureDb();
        await database.runAsync('DELETE FROM chat_history WHERE sessionId = ?', [id]);
        await database.runAsync('DELETE FROM chat_sessions WHERE id = ?', [id]);
    } catch (e) {
        console.error("Error deleting chat session", e);
    }
};

// --- Chat History Operations ---

export const saveChatMessage = async (message: Message): Promise<void> => {
    try {
        const database = await ensureDb();
        const id = message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const timestamp = message.timestamp || Date.now();

        await database.runAsync(
            `INSERT INTO chat_history (id, sessionId, role, content, timestamp) VALUES (?, ?, ?, ?, ?)`,
            [id, message.sessionId || null, message.role, message.content, timestamp]
        );

        if (message.sessionId) {
            await database.runAsync(
                `UPDATE chat_sessions SET updatedAt = ? WHERE id = ?`,
                [timestamp, message.sessionId]
            );
        }
    } catch (e) {
        console.error("Error saving chat message", e);
    }
};

export const getChatHistory = async (sessionId?: string): Promise<Message[]> => {
    try {
        const database = await ensureDb();
        if (sessionId) {
            return await database.getAllAsync<Message>('SELECT * FROM chat_history WHERE sessionId = ? ORDER BY timestamp ASC', [sessionId]);
        }
        return await database.getAllAsync<Message>('SELECT * FROM chat_history ORDER BY timestamp ASC');
    } catch (e) {
        console.error("Error getting chat history", e);
        return [];
    }
};

export const clearChatHistory = async (sessionId?: string): Promise<void> => {
    try {
        const database = await ensureDb();
        if (sessionId) {
            await database.runAsync('DELETE FROM chat_history WHERE sessionId = ?', [sessionId]);
        } else {
            await database.runAsync('DELETE FROM chat_history');
        }
    } catch (e) {
        console.error("Error clearing chat history", e);
    }
};

// --- Processed Slips Operations Removed ---
