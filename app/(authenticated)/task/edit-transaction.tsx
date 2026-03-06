import { WalletSelector } from '@/components/WalletSelector';
import { Category, INITIAL_CATEGORIES } from '@/constants/categories';
import { getCurrencyByCode } from '@/constants/currencies';
import { Colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { getCategories, getCurrency, getData, getWalletBalance, getWallets, saveCategories, StorageKeys, updateTransaction } from '@/utils/storage';
import { Transaction, Wallet } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Helper to format date display
const formatDate = (date: Date, t?: any, languageCode: string = 'en-US'): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return typeof t === 'function' ? t('today') : 'Today';
    if (date.toDateString() === yesterday.toDateString()) return typeof t === 'function' ? t('yesterday') : 'Yesterday';

    return date.toLocaleDateString(languageCode, { month: 'short', day: 'numeric', year: 'numeric' });
};

// Simple calculator evaluation
const evaluateExpression = (expr: string): number | null => {
    try {
        const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/');
        if (!/^[\d+\-*/.\s]+$/.test(sanitized)) return null;
        const result = new Function('return ' + sanitized)();
        return typeof result === 'number' && isFinite(result) ? result : null;
    } catch {
        return null;
    }
};

export default function EditTransaction() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const { t, languageCode } = useLanguage();

    const [loading, setLoading] = useState(true);
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});
    const [currencySymbol, setCurrencySymbol] = useState('$');

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        setLoading(true);

        let storedCats = await getCategories();
        if (!storedCats) {
            storedCats = INITIAL_CATEGORIES;
            await saveCategories(INITIAL_CATEGORIES);
        }
        setAllCategories(storedCats);

        const walletsData = await getWallets();
        setWallets(walletsData);

        // Load balances for all wallets
        const balances: Record<string, number> = {};
        for (const wallet of walletsData) {
            balances[wallet.id] = await getWalletBalance(wallet.id);
        }
        setWalletBalances(balances);

        const data = await getData(StorageKeys.TRANSACTIONS);
        const transaction = data?.find((t: Transaction) => t.id === id);

        if (transaction) {
            setAmount(transaction.amount.toString());
            setType(transaction.type);
            setSelectedCategory(transaction.categoryId || null);
            setSelectedWallet(transaction.walletId || null);
            setDescription(transaction.title);
            setSelectedDate(new Date(transaction.date));
        } else {
            Alert.alert(t('error'), t('no_transactions_found'));
            router.back();
        }

        const currencyCode = await getCurrency();
        setCurrencySymbol(getCurrencyByCode(currencyCode).symbol);

        setLoading(false);
    };

    const categories = allCategories.filter(c => c.type === type);

    const insertOperator = (op: string) => {
        if (amount && !amount.endsWith('+') && !amount.endsWith('-') && !amount.endsWith('×') && !amount.endsWith('÷')) {
            setAmount(prev => prev + op);
        }
    };

    const getCalculatedAmount = (): number => {
        const result = evaluateExpression(amount);
        return result !== null && result > 0 ? result : 0;
    };

    const handleDateChange = (event: any, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (date) {
            setSelectedDate(date);
        }
    };

    const handleUpdate = async () => {
        const calculatedValue = getCalculatedAmount();

        if (calculatedValue <= 0) {
            Alert.alert(t('invalid_amount'), t('invalid_amount_desc'));
            return;
        }
        if (!selectedCategory || !selectedWallet) {
            Alert.alert(t('missing_info'), t('missing_info_desc'));
            return;
        }

        const category = categories.find(c => c.id === selectedCategory);
        if (!category) return;

        const title = description.trim() || category.name;

        const updatedTransaction: Transaction = {
            id: id as string,
            title,
            amount: calculatedValue,
            date: selectedDate.toISOString(),
            type,
            categoryId: category.id,
            walletId: selectedWallet,
        };

        await updateTransaction(updatedTransaction);
        router.back();
    };

    if (loading) return <View style={styles.container} />;

    const calculatedDisplay = amount.includes('+') || amount.includes('-') || amount.includes('×') || amount.includes('÷')
        ? getCalculatedAmount()
        : null;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ width: 40 }} />
                <Text style={styles.headerTitle}>{t('edit_transaction')}</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.headerCloseBtn}
                >
                    <Ionicons name="close" size={24} color="#8B5CF6" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
            >
                <Animated.ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                    {/* Type Selector */}
                    <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.typeSelector}>
                        <TouchableOpacity
                            style={[styles.typeButton, type === 'income' && styles.activeIncome]}
                            onPress={() => { setType('income'); setSelectedCategory(null); }}
                        >
                            <Text style={[styles.typeText, type === 'income' && styles.activeText]}>{t('income')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeButton, type === 'expense' && styles.activeExpense]}
                            onPress={() => { setType('expense'); setSelectedCategory(null); }}
                        >
                            <Text style={[styles.typeText, type === 'expense' && styles.activeText]}>{t('expense')}</Text>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Amount Input with Calculator */}
                    <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.inputSection}>
                        <Text style={styles.label}>{t('amount')}</Text>
                        <View style={styles.amountContainer}>
                            <Text style={styles.currencySymbol}>{currencySymbol}</Text>
                            <TextInput
                                style={styles.amountInput}
                                value={amount}
                                onChangeText={setAmount}
                                keyboardType="numeric"
                                placeholder="0.00"
                                placeholderTextColor="#ccc"
                            />
                        </View>
                        {calculatedDisplay !== null && (
                            <Text style={styles.calculatedPreview}>= {currencySymbol}{calculatedDisplay.toFixed(2)}</Text>
                        )}
                        <View style={styles.calculatorRow}>
                            <TouchableOpacity style={styles.calcBtn} onPress={() => insertOperator('+')}>
                                <Text style={styles.calcBtnText}>+</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.calcBtn} onPress={() => insertOperator('-')}>
                                <Text style={styles.calcBtnText}>−</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.calcBtn} onPress={() => insertOperator('×')}>
                                <Text style={styles.calcBtnText}>×</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.calcBtn} onPress={() => insertOperator('÷')}>
                                <Text style={styles.calcBtnText}>÷</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.calcBtn} onPress={() => setAmount('')}>
                                <Ionicons name="backspace-outline" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>

                    {/* Date Picker */}
                    <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.inputSection}>
                        <Text style={styles.label}>{t('date')}</Text>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                            <Ionicons name="calendar-outline" size={20} color={Colors.light.tint} />
                            <Text style={styles.dateText}>{formatDate(selectedDate, t, languageCode)}</Text>
                            <Ionicons name="chevron-forward" size={18} color="#999" />
                        </TouchableOpacity>
                    </Animated.View>

                    {Platform.OS === 'ios' ? (
                        <Modal visible={showDatePicker} transparent animationType="fade">
                            <View style={styles.modalOverlay}>
                                <Animated.View
                                    entering={SlideInDown.duration(300)}
                                    exiting={SlideOutDown.duration(200)}
                                    style={styles.modalContent}
                                >
                                    <View style={styles.modalHeader}>
                                        <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                            <Text style={styles.modalCancel}>{t('cancel')}</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.modalTitle}>{t('select_date')}</Text>                                        <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                            <Text style={styles.modalDone}>{t('done')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <DateTimePicker
                                        value={selectedDate}
                                        mode="date"
                                        display="spinner"
                                        onChange={handleDateChange}
                                        maximumDate={new Date()}
                                    />
                                </Animated.View>
                            </View>
                        </Modal>
                    ) : (
                        showDatePicker && (
                            <DateTimePicker
                                value={selectedDate}
                                mode="date"
                                display="default"
                                onChange={handleDateChange}
                                maximumDate={new Date()}
                            />
                        )
                    )}

                    {/* Category Selection */}
                    <Animated.View entering={FadeInDown.delay(250).springify()}>
                        <View style={styles.categoryHeader}>
                            <Text style={styles.label}>{t('category')}</Text>
                            <TouchableOpacity onPress={() => router.push('/(authenticated)/task/categories')}>
                                <Text style={styles.manageBtn}>{t('manage')}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.categoryGrid}>
                            {categories.map((cat) => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                        styles.categoryItem,
                                        selectedCategory === cat.id && styles.categoryItemActive,
                                        selectedCategory === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color }
                                    ]}
                                    onPress={() => setSelectedCategory(cat.id)}
                                >
                                    <View style={[styles.iconCircle, { backgroundColor: cat.color + '20' }]}>
                                        <Ionicons name={cat.icon} size={24} color={cat.color} />
                                    </View>
                                    <Text style={[
                                        styles.categoryName,
                                        selectedCategory === cat.id && { color: cat.color, fontWeight: '700' }
                                    ]}>{t(cat.name as TranslationKeys)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Animated.View>

                    {/* Wallet Selection */}
                    <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.inputSection}>
                        <Text style={styles.label}>{t('wallet')}</Text>
                        <WalletSelector
                            wallets={wallets}
                            selectedWalletId={selectedWallet}
                            currencySymbol={currencySymbol}
                            walletBalances={walletBalances}
                            onSelect={setSelectedWallet}
                        />
                    </Animated.View>

                    {/* Note */}
                    <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.inputSection}>
                        <Text style={styles.label}>{t('note')}</Text>
                        <TextInput
                            style={styles.noteInput}
                            value={description}
                            onChangeText={setDescription}
                            placeholder={t('add_a_note')}
                            placeholderTextColor="#999"
                        />
                    </Animated.View>
                </Animated.ScrollView>
            </KeyboardAvoidingView>

            {/* Update Button */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]}>
                <TouchableOpacity
                    style={[styles.saveButton, (!selectedCategory || !selectedWallet || getCalculatedAmount() <= 0) && styles.saveButtonDisabled]}
                    onPress={handleUpdate}
                    disabled={!selectedCategory || !selectedWallet || getCalculatedAmount() <= 0}
                >
                    <Text style={styles.saveButtonText}>{t('save')}</Text>
                </TouchableOpacity>
            </View>
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerCloseBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F3FF', // Very light violet background
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    typeSelector: {
        flexDirection: 'row',
        marginBottom: 24,
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        padding: 4,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeIncome: {
        backgroundColor: Colors.light.success,
    },
    activeExpense: {
        backgroundColor: Colors.light.danger,
    },
    typeText: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: '#666',
    },
    activeText: {
        color: '#fff',
    },
    inputSection: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: '#666',
        marginBottom: 10,
        fontFamily: 'Prompt_500Medium',
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    currencySymbol: {
        fontSize: 32,
        fontFamily: 'Prompt_700Bold',
        color: '#333',
        marginRight: 4,
    },
    amountInput: {
        fontSize: 40,
        fontFamily: 'Prompt_700Bold',
        color: '#333',
        flex: 1,
    },
    calculatedPreview: {
        fontSize: 18,
        color: Colors.light.success,
        fontFamily: 'Prompt_600SemiBold',
        marginTop: 8,
    },
    calculatorRow: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 8,
    },
    calcBtn: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calcBtnText: {
        fontSize: 20,
        fontFamily: 'Prompt_600SemiBold',
        color: '#333',
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
        gap: 10,
    },
    dateText: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        fontFamily: 'Prompt_500Medium',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: 17,
        fontFamily: 'Prompt_600SemiBold',
        color: '#333',
    },
    modalCancel: {
        fontSize: 16,
        color: '#999',
        fontFamily: 'Prompt_400Regular',
    },
    modalDone: {
        fontSize: 16,
        color: Colors.light.tint,
        fontFamily: 'Prompt_600SemiBold',
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    manageBtn: {
        color: Colors.light.tint,
        fontFamily: 'Prompt_600SemiBold',
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    categoryItem: {
        width: '30%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#eee',
        backgroundColor: '#fff',
    },
    categoryItemActive: {
        borderColor: 'transparent',
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    categoryName: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        fontFamily: 'Prompt_400Regular',
    },
    noteInput: {
        backgroundColor: '#f9f9f9',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#eee',
        color: '#333',
        fontFamily: 'Prompt_400Regular',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    saveButton: {
        backgroundColor: Colors.light.tint,
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: Colors.light.tint,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonDisabled: {
        backgroundColor: '#ccc',
        shadowOpacity: 0,
        elevation: 0,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
    },
});
