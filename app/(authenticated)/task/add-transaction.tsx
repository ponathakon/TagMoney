import { Category, INITIAL_CATEGORIES } from '@/constants/categories';
import { getCurrencyByCode } from '@/constants/currencies';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { addTransaction, deleteTransaction, getCategories, getCurrency, getData, getWalletBalance, getWallets, saveCategories, StorageKeys, updateTransaction } from '@/utils/storage';
import { Transaction, Wallet } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import Animated, { FadeInDown, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
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
        const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
        if (!/^[\d+\-*/.\s]+$/.test(sanitized)) return null;
        const result = new Function('return ' + sanitized)();
        return typeof result === 'number' && isFinite(result) ? result : null;
    } catch {
        return null;
    }
};

export default function AddTransaction() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const isEditing = !!id;
    const insets = useSafeAreaInsets();
    const { t, languageCode } = useLanguage();

    const [loading, setLoading] = useState(false);

    // Form state
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Calculator Keyboard State
    const [showCalcKeyboard, setShowCalcKeyboard] = useState(!isEditing); // visible by default for add, hidden for edit
    const [isSystemKeyboardVisible, setIsSystemKeyboardVisible] = useState(false);
    const amountInputRef = useRef<TextInput>(null);

    // Category and Wallet Modal State
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Swipe-to-dismiss Calc Keyboard
    const calcTranslateY = useSharedValue(0);
    const SCREEN_HEIGHT = Dimensions.get('window').height;

    const dismissCalculator = () => {
        setShowCalcKeyboard(false);
        const expr = amount;
        if (expr) {
            const calculated = evaluateExpression(expr);
            if (calculated !== null) {
                setAmount(calculated.toString());
            }
        }
    };

    const calcPanResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gs) => gs.dy > 5,
            onPanResponderMove: (_, gs) => {
                if (gs.dy > 0) calcTranslateY.value = gs.dy;
            },
            onPanResponderRelease: (_, gs) => {
                if (gs.dy > 120 || gs.vy > 0.5) {
                    calcTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
                    setTimeout(() => {
                        dismissCalculator();
                        // Reset on next tick so component is unmounted first
                        setTimeout(() => { calcTranslateY.value = 0; }, 50);
                    }, 200);
                } else {
                    calcTranslateY.value = withSpring(0, { damping: 20, stiffness: 200 });
                }
            }
        })
    ).current;

    const calcAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: calcTranslateY.value }]
    }));

    // Data state
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});
    const [currencySymbol, setCurrencySymbol] = useState('$');

    useEffect(() => {
        loadData();

        // Hide our custom calc keyboard if the system keyboard shows up (e.g. Note input)
        const kbDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
            setShowCalcKeyboard(false);
            setIsSystemKeyboardVisible(true);
        });
        const kbDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
            setIsSystemKeyboardVisible(false);
        });
        return () => {
            kbDidShowListener.remove();
            kbDidHideListener.remove();
        };
    }, [id]);

    const loadData = async () => {
        setLoading(true);

        // Load categories
        let stored = await getCategories();
        if (!stored) {
            stored = INITIAL_CATEGORIES;
            await saveCategories(INITIAL_CATEGORIES);
        }
        setAllCategories(stored);

        // Load wallets
        const walletsData = await getWallets();
        setWallets(walletsData);
        const balances: Record<string, number> = {};
        for (const wallet of walletsData) {
            balances[wallet.id] = await getWalletBalance(wallet.id);
        }
        setWalletBalances(balances);

        // Load currency
        const currencyCode = await getCurrency();
        setCurrencySymbol(getCurrencyByCode(currencyCode).symbol);

        if (isEditing) {
            // Edit mode: load existing transaction
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
        } else {
            // Add mode: auto-select defaults
            const expenseCats = stored.filter(c => c.type === 'expense');
            if (expenseCats.length > 0) {
                setSelectedCategory(expenseCats[0].id);
            }
            if (walletsData.length > 0) {
                setSelectedWallet(walletsData[0].id);
            }
        }

        setLoading(false);
    };

    const categories = allCategories.filter(c => c.type === type);

    // Calculator Actions
    const handleNumberPress = (num: string) => {
        setAmount(prev => {
            if (prev === '0' && num !== '.') return num;
            if (num === '.') {
                const parts = prev.split(/[+\-×÷]/);
                const lastPart = parts[parts.length - 1];
                if (lastPart.includes('.')) return prev;
            }
            return prev + num;
        });
    };

    const handleOperatorPress = (op: string) => {
        setAmount(prev => {
            if (!prev) return '0' + op;
            const lastChar = prev[prev.length - 1];
            if (['+', '−', '×', '÷'].includes(lastChar)) {
                return prev.slice(0, -1) + op;
            }
            return prev + op;
        });
    };

    const handleBackspace = () => {
        setAmount(prev => {
            if (prev.length <= 1) return '';
            return prev.slice(0, -1);
        });
    };

    const handleClear = () => {
        setAmount('');
    };

    // Get calculated result for display
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

    const handleSave = async () => {
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

        const title = description.trim();

        if (isEditing) {
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
        } else {
            const newTransaction: Transaction = {
                id: Date.now().toString(),
                title,
                amount: calculatedValue,
                date: selectedDate.toISOString(),
                type,
                categoryId: category.id,
                walletId: selectedWallet,
            };
            await addTransaction(newTransaction);
        }
        router.back();
    };

    const handleDelete = () => {
        Keyboard.dismiss();
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (id) {
            await deleteTransaction(id as string);
            setShowDeleteModal(false);
            router.back();
        }
    };

    if (loading) return <View style={styles.container} />;

    const hasExpression = amount.includes('+') || amount.includes('−') || amount.includes('×') || amount.includes('÷');
    const calculatedDisplay = hasExpression ? getCalculatedAmount() : null;

    const headerColor = type === 'income' ? '#10B981' : '#EF4444';

    return (
        <View
            style={styles.container}
        >
            {/* Custom Header Area */}
            <View style={[styles.topHeader, { paddingTop: insets.top + 10 }]}>
                <View style={styles.topNav}>
                    {isEditing ? (
                        <TouchableOpacity onPress={handleDelete} style={styles.navBtnDelete}>
                            <Ionicons name="trash-outline" size={22} color="#EF4444" />
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 44 }} />
                    )}
                    <Text style={styles.navTitle}>{isEditing ? t('edit_transaction') : t('add_transaction')}</Text>
                    <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
                        <Ionicons name="close" size={24} color="#6366F1" />
                    </TouchableOpacity>
                </View>

                {/* Amount Display */}
                <View style={styles.amountArea}>
                    <View style={[styles.typeBadge, { backgroundColor: headerColor + '15' }]}>
                        <Text style={[styles.typeBadgeText, { color: headerColor }]}>
                            {type === 'income' ? t('income') : t('expense')}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.amountInputWrapper}
                        activeOpacity={1}
                        onPress={() => {
                            Keyboard.dismiss();
                            setShowCalcKeyboard(true);
                        }}
                    >
                        <Text style={[styles.currencySymbolLarge, { color: headerColor }, !amount && { opacity: 0.4 }]}>{currencySymbol}</Text>
                        <TextInput
                            ref={amountInputRef}
                            style={[styles.amountInputLarge, { color: headerColor }]}
                            value={amount}
                            onChangeText={setAmount}
                            placeholder="0"
                            placeholderTextColor={headerColor + '60'}
                            showSoftInputOnFocus={false}
                            onFocus={() => {
                                Keyboard.dismiss();
                                setShowCalcKeyboard(true);
                            }}
                        />
                    </TouchableOpacity>
                    {calculatedDisplay !== null ? (
                        <Animated.View entering={FadeInDown.duration(200)}>
                            <Text style={styles.calculatedPreviewTop}>
                                = {currencySymbol}{calculatedDisplay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                        </Animated.View>
                    ) : (
                        <View style={{ height: 28, marginTop: 4 }} />
                    )}
                </View>
            </View>


            <KeyboardAvoidingView
                style={styles.wrapScroll}
                behavior="padding"
                keyboardVerticalOffset={25}
            >

                {/* Scrollable Form Content */}
                <ScrollView
                    style={styles.wrapScroll}
                    contentContainerStyle={{ paddingBottom: showCalcKeyboard ? 340 : insets.bottom + 100 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    onScrollBeginDrag={() => {
                        Keyboard.dismiss();
                        setShowCalcKeyboard(false);
                    }}
                >
                    <View style={styles.formContent}>

                        {/* Type Selector */}
                        <View style={styles.typeSelectorContainer}>
                            <TouchableOpacity
                                style={[styles.typeBtn, type === 'expense' && styles.typeBtnExpenseActive]}
                                onPress={() => { setType('expense'); setSelectedCategory(null); }}
                            >
                                <Text style={[styles.typeBtnText, type === 'expense' && styles.typeBtnTextActive]}>{t('expense')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.typeBtn, type === 'income' && styles.typeBtnIncomeActive]}
                                onPress={() => { setType('income'); setSelectedCategory(null); }}
                            >
                                <Text style={[styles.typeBtnText, type === 'income' && styles.typeBtnTextActive]}>{t('income')}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Date Picker */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>{t('date')}</Text>
                            <TouchableOpacity style={styles.inputCard} onPress={() => setShowDatePicker(true)}>
                                <Ionicons name="calendar-outline" size={20} color="#64748B" style={styles.inputIcon} />
                                <Text style={styles.inputText}>{formatDate(selectedDate, t, languageCode)}</Text>
                                <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        {/* Category Selection */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>{t('category')}</Text>
                                <TouchableOpacity onPress={() => router.push('/task/categories')}>
                                    <Text style={styles.manageBtn}>{t('manage')}</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                style={styles.inputCard}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setShowCalcKeyboard(false);
                                    setShowCategoryModal(true);
                                }}
                            >
                                {selectedCategory ? (() => {
                                    const cat = categories.find(c => c.id === selectedCategory);
                                    if (!cat) return null;
                                    return (
                                        <>
                                            <View style={[styles.inputIcon, { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: cat.color + '20' }]}>
                                                <Ionicons name={cat.icon as any} size={18} color={cat.color} />
                                            </View>
                                            <Text style={styles.inputText}>{t(cat.name as TranslationKeys)}</Text>
                                        </>
                                    );
                                })() : (
                                    <>
                                        <View style={[styles.inputIcon, { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' }]}>
                                            <Ionicons name="help" size={18} color="#94A3B8" />
                                        </View>
                                        <Text style={[styles.inputText, { color: '#94A3B8' }]}>{t('select_category')}</Text>
                                    </>
                                )}
                                <Ionicons name="chevron-down" size={20} color="#CBD5E1" style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>
                        </View>

                        {/* Wallet Selection */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>{t('wallet')}</Text>
                                <TouchableOpacity onPress={() => router.push('/task/wallets')}>
                                    <Text style={styles.manageBtn}>{t('manage')}</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                style={styles.inputCard}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setShowCalcKeyboard(false);
                                    setShowWalletModal(true);
                                }}
                            >
                                {selectedWallet ? (() => {
                                    const w = wallets.find(wall => wall.id === selectedWallet);
                                    if (!w) return null;
                                    return (
                                        <>
                                            <View style={[styles.inputIcon, { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: w.color + '20' }]}>
                                                <Ionicons name={w.icon as any} size={18} color={w.color} />
                                            </View>
                                            <Text style={styles.inputText}>{t(w.name as TranslationKeys)}</Text>
                                        </>
                                    );
                                })() : (
                                    <>
                                        <View style={[styles.inputIcon, { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' }]}>
                                            <Ionicons name="wallet" size={18} color="#94A3B8" />
                                        </View>
                                        <Text style={[styles.inputText, { color: '#94A3B8' }]}>{t('select_wallet')}</Text>
                                    </>
                                )}
                                <Ionicons name="chevron-down" size={20} color="#CBD5E1" style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>
                        </View>

                        {/* Note Input */}
                        <View style={[styles.inputGroup, { marginBottom: 40 }]}>
                            <Text style={styles.label}>{t('note')}</Text>
                            <View style={styles.inputCard}>
                                <Ionicons name="document-text-outline" size={20} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.noteInput}
                                    value={description}
                                    onChangeText={setDescription}
                                    placeholder={t('add_a_note')}
                                    placeholderTextColor="#94A3B8"
                                    onFocus={() => setShowCalcKeyboard(false)}
                                />
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>



            {/* Category Bottom Sheet Modal */}
            <Modal visible={showCategoryModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowCategoryModal(false)}>
                        <View style={StyleSheet.absoluteFill} />
                    </TouchableWithoutFeedback>
                    <Animated.View
                        entering={SlideInDown.duration(300)}
                        exiting={SlideOutDown.duration(200)}
                        style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20), maxHeight: '60%' }]}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('select_category')}</Text>
                            <TouchableOpacity onPress={() => setShowCategoryModal(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                            {categories.map(cat => {
                                const isSelected = selectedCategory === cat.id;
                                return (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            styles.modalOption,
                                            isSelected && styles.modalOptionActive
                                        ]}
                                        onPress={() => {
                                            setSelectedCategory(cat.id);
                                            setShowCategoryModal(false);
                                        }}
                                        activeOpacity={0.5}
                                    >
                                        <View style={[styles.modalOptionIconBg, { backgroundColor: cat.color + '20' }]}>
                                            <Ionicons name={cat.icon as any} size={24} color={cat.color} />
                                        </View>
                                        <Text style={[
                                            styles.modalOptionText,
                                            isSelected && { color: cat.color, fontFamily: 'Prompt_600SemiBold' }
                                        ]}>{t(cat.name as TranslationKeys)}</Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark" size={20} color={cat.color} style={{ marginLeft: 'auto' }} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>

            {/* Wallet Bottom Sheet Modal */}
            <Modal visible={showWalletModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowWalletModal(false)}>
                        <View style={StyleSheet.absoluteFill} />
                    </TouchableWithoutFeedback>
                    <Animated.View
                        entering={SlideInDown.duration(300)}
                        exiting={SlideOutDown.duration(200)}
                        style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20), maxHeight: '60%' }]}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('select_wallet')}</Text>
                            <TouchableOpacity onPress={() => setShowWalletModal(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                            {wallets.map(w => {
                                const isSelected = selectedWallet === w.id;
                                const balance = walletBalances[w.id] ?? w.initialBalance ?? 0;
                                return (
                                    <TouchableOpacity
                                        key={w.id}
                                        style={[
                                            styles.modalOption,
                                            isSelected && styles.modalOptionActive
                                        ]}
                                        onPress={() => {
                                            setSelectedWallet(w.id);
                                            setShowWalletModal(false);
                                        }}
                                        activeOpacity={0.5}
                                    >
                                        <View style={[styles.modalOptionIconBg, { backgroundColor: w.color + '20' }]}>
                                            <Ionicons name={w.icon as any} size={24} color={w.color} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[
                                                styles.modalOptionText,
                                                isSelected && { color: w.color, fontFamily: 'Prompt_600SemiBold' }
                                            ]}>{t(w.name as TranslationKeys)}</Text>
                                            <Text style={[styles.modalOptionSubText, isSelected && { color: w.color + 'CC' }]}>
                                                {currencySymbol}{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </Text>
                                        </View>
                                        {isSelected && (
                                            <Ionicons name="checkmark" size={20} color={w.color} style={{ marginLeft: 'auto' }} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>

            {/* Custom Calculator Keyboard Modal overlaying at bottom */}
            {showCalcKeyboard && (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    <TouchableWithoutFeedback onPress={dismissCalculator}>
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} />
                    </TouchableWithoutFeedback>
                    <Animated.View
                        entering={SlideInDown.duration(250).springify()}
                        exiting={SlideOutDown.duration(200)}
                        style={[styles.calcKeyboardContainer, calcAnimatedStyle, { paddingBottom: Math.max(insets.bottom, 20) }]}
                        {...calcPanResponder.panHandlers}
                    >
                        <View style={styles.calcDragIndicator} />

                        {/* Quick Select Row (Category & Wallet) */}
                        {(() => {
                            const selectedCat = selectedCategory ? categories.find(c => c.id === selectedCategory) : null;
                            const selectedWal = selectedWallet ? wallets.find(w => w.id === selectedWallet) : null;
                            return (
                                <View style={styles.calcQuickSelectRow}>
                                    <TouchableOpacity
                                        style={styles.calcQuickSelectChip}
                                        onPress={() => setShowCategoryModal(true)}
                                        activeOpacity={0.6}
                                    >
                                        <Ionicons
                                            name={selectedCat?.icon as any || 'folder-outline'}
                                            size={18}
                                            color={selectedCat?.color || '#64748B'}
                                        />
                                        <Text style={styles.calcQuickSelectText} numberOfLines={1}>
                                            {selectedCat ? t(selectedCat.name as TranslationKeys) : t('category')}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.calcQuickSelectChip}
                                        onPress={() => setShowWalletModal(true)}
                                        activeOpacity={0.6}
                                    >
                                        <Ionicons
                                            name={selectedWal?.icon as any || 'wallet-outline'}
                                            size={18}
                                            color={selectedWal?.color || '#64748B'}
                                        />
                                        <Text style={styles.calcQuickSelectText} numberOfLines={1}>
                                            {selectedWal ? t(selectedWal.name as TranslationKeys) : t('wallet')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })()}

                        {/* Row 1: C ÷ × ⌫ */}
                        <View style={styles.calcRow}>
                            <TouchableOpacity style={[styles.calcKey, styles.calcKeyFunc]} onPress={handleClear} activeOpacity={0.6}>
                                <Text style={[styles.calcKeyText, styles.calcKeyFuncText]}>C</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.calcKey, styles.calcKeyFunc]} onPress={() => handleOperatorPress('÷')} activeOpacity={0.6}>
                                <Text style={[styles.calcKeyText, styles.calcKeyFuncText]}>÷</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.calcKey, styles.calcKeyFunc]} onPress={() => handleOperatorPress('×')} activeOpacity={0.6}>
                                <Text style={[styles.calcKeyText, styles.calcKeyFuncText]}>×</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.calcKey, styles.calcKeyFunc]} onPress={handleBackspace} activeOpacity={0.6}>
                                <Ionicons name="backspace-outline" size={24} color="#8B5CF6" />
                            </TouchableOpacity>
                        </View>
                        {/* Row 2: 7 8 9 − */}
                        <View style={styles.calcRow}>
                            <TouchableOpacity style={styles.calcKey} onPress={() => handleNumberPress('7')} activeOpacity={0.6}>
                                <Text style={styles.calcKeyText}>7</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.calcKey} onPress={() => handleNumberPress('8')} activeOpacity={0.6}>
                                <Text style={styles.calcKeyText}>8</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.calcKey} onPress={() => handleNumberPress('9')} activeOpacity={0.6}>
                                <Text style={styles.calcKeyText}>9</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.calcKey, styles.calcKeyFunc]} onPress={() => handleOperatorPress('−')} activeOpacity={0.6}>
                                <Text style={[styles.calcKeyText, styles.calcKeyFuncText]}>−</Text>
                            </TouchableOpacity>
                        </View>
                        {/* Row 3: 4 5 6 + */}
                        <View style={styles.calcRow}>
                            <TouchableOpacity style={styles.calcKey} onPress={() => handleNumberPress('4')} activeOpacity={0.6}>
                                <Text style={styles.calcKeyText}>4</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.calcKey} onPress={() => handleNumberPress('5')} activeOpacity={0.6}>
                                <Text style={styles.calcKeyText}>5</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.calcKey} onPress={() => handleNumberPress('6')} activeOpacity={0.6}>
                                <Text style={styles.calcKeyText}>6</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.calcKey, styles.calcKeyFunc]} onPress={() => handleOperatorPress('+')} activeOpacity={0.6}>
                                <Text style={[styles.calcKeyText, styles.calcKeyFuncText]}>+</Text>
                            </TouchableOpacity>
                        </View>
                        {/* Row 4 & 5: 1 2 3 ✓ (save spans 2 rows) | 0 . ✓ */}
                        <View style={styles.calcBottomRows}>
                            <View style={styles.calcBottomLeft}>
                                <View style={styles.calcRow}>
                                    <TouchableOpacity style={styles.calcKey} onPress={() => handleNumberPress('1')} activeOpacity={0.6}>
                                        <Text style={styles.calcKeyText}>1</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.calcKey} onPress={() => handleNumberPress('2')} activeOpacity={0.6}>
                                        <Text style={styles.calcKeyText}>2</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.calcKey} onPress={() => handleNumberPress('3')} activeOpacity={0.6}>
                                        <Text style={styles.calcKeyText}>3</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.calcRow}>
                                    <TouchableOpacity style={[styles.calcKey, { flex: 2 }]} onPress={() => handleNumberPress('0')} activeOpacity={0.6}>
                                        <Text style={styles.calcKeyText}>0</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.calcKey} onPress={() => handleNumberPress('.')} activeOpacity={0.6}>
                                        <Text style={styles.calcKeyText}>.</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.calcKeySave}
                                onPress={dismissCalculator}
                                activeOpacity={0.75}
                            >
                                <LinearGradient
                                    colors={['#6366F1', '#8B5CF6']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.calcKeySaveGradient}
                                >
                                    <Ionicons name="checkmark" size={32} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            )}

            {/* Date Picker Modal (iOS) or Inline (Android) */}
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
                                <Text style={styles.modalTitle}>{t('select_date')}</Text>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                    <Text style={styles.modalDone}>{t('done')}</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={selectedDate}
                                mode="date"
                                display="inline"
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

            {/* Save Button (Fixed at bottom only when calculator is hidden) */}
            {!showCalcKeyboard && !isSystemKeyboardVisible && (
                <Animated.View entering={FadeInDown.duration(150).delay(100)} style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                    <TouchableOpacity
                        style={[styles.saveButton, (!selectedCategory || !selectedWallet || getCalculatedAmount() <= 0) && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={!selectedCategory || !selectedWallet || getCalculatedAmount() <= 0}
                    >
                        <Text style={styles.saveButtonText}>{t('save')}</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Custom Delete Confirmation Modal */}
            <Modal visible={showDeleteModal} transparent animationType="fade">
                <View style={styles.alertOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowDeleteModal(false)}>
                        <View style={StyleSheet.absoluteFill} />
                    </TouchableWithoutFeedback>
                    <Animated.View
                        entering={FadeInDown.duration(200).springify()}
                        style={styles.alertBox}
                    >
                        <View style={styles.alertIconWrapper}>
                            <Ionicons name="trash" size={32} color="#EF4444" />
                        </View>
                        <Text style={styles.alertTitle}>{t('delete_transaction')}</Text>
                        <Text style={styles.alertMessage}>{t('delete_transaction_confirm')}</Text>

                        <View style={styles.alertButtonsRow}>
                            <TouchableOpacity
                                style={styles.alertCancelBtn}
                                onPress={() => setShowDeleteModal(false)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.alertCancelText}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.alertDeleteBtn}
                                onPress={handleConfirmDelete}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.alertDeleteText}>{t('delete')}</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    topHeader: {
        paddingHorizontal: 20,
        paddingBottom: 24,
        backgroundColor: '#fff',
        zIndex: 10,
    },
    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    navBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    navBtnDelete: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    navTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
    },
    amountArea: {
        alignItems: 'center',
    },
    typeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 8,
    },
    typeBadgeText: {
        fontSize: 12,
        fontFamily: 'Prompt_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    amountInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    currencySymbolLarge: {
        fontSize: 36,
        fontFamily: 'Prompt_600SemiBold',
        marginRight: 6,
        paddingBottom: 4,
    },
    amountInputLarge: {
        fontSize: 56,
        fontFamily: 'Prompt_700Bold',
        minWidth: 60,
        textAlign: 'center',
        padding: 0,
        margin: 0,
    },
    calculatedPreviewTop: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: '#64748B',
        marginTop: 4,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 12,
        overflow: 'hidden',
    },

    wrapScroll: {
        flex: 1,
    },

    formContent: {
        padding: 20,
        paddingTop: 32,
    },

    typeSelectorContainer: {
        flexDirection: 'row',
        backgroundColor: '#E2E8F0',
        borderRadius: 16,
        padding: 6,
        marginBottom: 28,
    },
    typeBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 14,
    },
    typeBtnExpenseActive: {
        backgroundColor: '#fff',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    typeBtnIncomeActive: {
        backgroundColor: '#fff',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    typeBtnText: {
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: '#64748B',
    },
    typeBtnTextActive: {
        color: '#0F172A',
    },

    inputGroup: {
        marginBottom: 24,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontSize: 14,
        fontFamily: 'Prompt_500Medium',
        color: '#475569',
        marginBottom: 10,
    },
    inputCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 58,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    inputIcon: {
        marginRight: 12,
    },
    inputText: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Prompt_500Medium',
        color: '#1E293B',
    },
    noteInput: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Prompt_400Regular',
        color: '#1E293B',
    },



    // Footer Save Button
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    saveButton: {
        backgroundColor: '#6366F1',
        height: 58,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 4,
    },
    saveButtonDisabled: {
        backgroundColor: '#CBD5E1',
        shadowOpacity: 0,
        elevation: 0,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
    },

    // Calculator Keyboard UI
    calcKeyboardContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#F8FAFC',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 16,
        paddingTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 15,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    calcRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10,
    },
    calcKey: {
        flex: 1,
        height: 60,
        borderRadius: 16,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    calcKeyText: {
        fontSize: 26,
        fontFamily: 'Prompt_500Medium',
        color: '#1E293B',
    },
    calcKeyFunc: {
        backgroundColor: '#EEF2FF',
    },
    calcKeyFuncText: {
        color: '#8B5CF6',
        fontSize: 26,
    },
    calcQuickSelectRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    calcQuickSelectChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        gap: 8,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    calcQuickSelectText: {
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: '#475569',
    },
    calcBottomRows: {
        flexDirection: 'row',
        gap: 10,
    },
    calcBottomLeft: {
        flex: 3,
        gap: 0,
    },
    calcKeySave: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 10,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    calcKeySaveGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 8,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
    },
    manageBtn: {
        color: '#6366F1',
        fontFamily: 'Prompt_600SemiBold',
        fontSize: 13,
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalScroll: {
        padding: 24,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    modalOptionActive: {
        borderColor: '#E2E8F0',
        backgroundColor: '#fff',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    modalOptionIconBg: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    modalOptionText: {
        fontSize: 16,
        fontFamily: 'Prompt_500Medium',
        color: '#334155',
    },
    modalOptionSubText: {
        fontSize: 12,
        fontFamily: 'Prompt_400Regular',
        color: '#94A3B8',
        marginTop: 2,
    },
    calcDragIndicator: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E2E8F0',
        alignSelf: 'center',
        marginBottom: 20,
    },
    modalCancel: {
        fontSize: 16,
        color: '#64748B',
        fontFamily: 'Prompt_400Regular',
    },
    modalDone: {
        fontSize: 16,
        color: '#6366F1',
        fontFamily: 'Prompt_600SemiBold',
    },
    // Custom Alert Styles
    alertOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    alertBox: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    alertIconWrapper: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    alertTitle: {
        fontSize: 20,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
        marginBottom: 8,
        textAlign: 'center',
    },
    alertMessage: {
        fontSize: 15,
        fontFamily: 'Prompt_400Regular',
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    alertButtonsRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    alertCancelBtn: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    alertCancelText: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: '#475569',
    },
    alertDeleteBtn: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    alertDeleteText: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: '#fff',
    },
});
