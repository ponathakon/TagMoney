import { Category, getCategoryById, INITIAL_CATEGORIES } from '@/constants/categories';
import { getCurrencyByCode } from '@/constants/currencies';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { formatNumberParts } from '@/utils/formatNumber';
import { getCategories, getCurrency, getData, getWallets, saveCategories, StorageKeys } from '@/utils/storage';
import { Transaction, Wallet } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type PeriodType = 'day' | 'week' | 'month' | 'year' | 'all';

function getPeriodBounds(anchor: Date, periodType: PeriodType) {
    if (periodType === 'all') {
        const start = new Date(0);
        const end = new Date(8640000000000000); // Max safe date
        return { start, end };
    }

    const start = new Date(anchor);
    const end = new Date(anchor);

    if (periodType === 'day') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (periodType === 'week') {
        const diff = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - diff);
        start.setHours(0, 0, 0, 0);
        end.setTime(start.getTime());
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (periodType === 'month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function shiftPeriod(anchor: Date, periodType: PeriodType, increment: number) {
    if (periodType === 'all') {
        return anchor;
    }

    const next = new Date(anchor);

    if (periodType === 'day') {
        next.setDate(next.getDate() + increment);
        return next;
    }

    if (periodType === 'week') {
        next.setDate(next.getDate() + increment * 7);
        return next;
    }

    if (periodType === 'month') {
        next.setMonth(next.getMonth() + increment);
        return next;
    }

    next.setFullYear(next.getFullYear() + increment);
    return next;
}

function formatPeriodLabel(anchor: Date, periodType: PeriodType, languageCode: string) {
    if (periodType === 'all') {
        return '';
    }

    if (periodType === 'day') {
        return anchor.toLocaleDateString(languageCode, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }

    if (periodType === 'week') {
        const { start, end } = getPeriodBounds(anchor, periodType);
        return `${start.toLocaleDateString(languageCode, { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString(languageCode, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }

    if (periodType === 'month') {
        return anchor.toLocaleDateString(languageCode, { month: 'long', year: 'numeric' });
    }

    return anchor.toLocaleDateString(languageCode, { year: 'numeric' });
}

export default function Transactions() {
    const router = useRouter();
    const { t, languageCode } = useLanguage();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [currencySymbol, setCurrencySymbol] = useState('$');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [periodType, setPeriodType] = useState<PeriodType>('month');
    const [selectedWalletId, setSelectedWalletId] = useState<string>('all');
    const [activeMenu, setActiveMenu] = useState<'period' | 'wallet' | null>(null);

    const loadData = useCallback(async () => {
        const data = await getData(StorageKeys.TRANSACTIONS);
        let storedCats = await getCategories();
        const storedWallets = await getWallets();

        if (!storedCats) {
            storedCats = INITIAL_CATEGORIES;
            await saveCategories(INITIAL_CATEGORIES);
        }

        setTransactions(data || []);
        setCategories(storedCats);
        setWallets(storedWallets);

        const currencyCode = await getCurrency();
        setCurrencySymbol(getCurrencyByCode(currencyCode).symbol);

        try {
            const savedPeriod = await AsyncStorage.getItem('tracker_transaction_period_filter');
            if (savedPeriod && ['day', 'week', 'month', 'year', 'all'].includes(savedPeriod)) {
                setPeriodType(savedPeriod as PeriodType);
            }
            const savedWallet = await AsyncStorage.getItem('tracker_transaction_wallet_filter');
            if (savedWallet) {
                if (savedWallet === 'all' || storedWallets.some(w => w.id === savedWallet)) {
                    setSelectedWalletId(savedWallet);
                }
            }
        } catch (e) {
            console.error('Error loading saved filters', e);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const activeRange = useMemo(() => getPeriodBounds(selectedDate, periodType), [selectedDate, periodType]);

    const filteredTransactions = useMemo(() => {
        let result = [...transactions];

        result = result.filter((tx) => {
            const date = new Date(tx.date);
            return date >= activeRange.start && date <= activeRange.end;
        });

        if (selectedWalletId !== 'all') {
            result = result.filter((tx) => tx.walletId === selectedWalletId);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter((tx) => {
                const category = tx.categoryId ? getCategoryById(categories, tx.categoryId) : null;
                const categoryLabel = category ? t(category.name as TranslationKeys).toLowerCase() : '';
                return tx.title.toLowerCase().includes(query) || categoryLabel.includes(query);
            });
        }

        return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, activeRange.end, activeRange.start, selectedWalletId, searchQuery, categories, t]);

    const summary = useMemo(() => {
        let income = 0;
        let expense = 0;

        filteredTransactions.forEach((tx) => {
            if (tx.type === 'income') income += tx.amount;
            else expense += tx.amount;
        });

        return { income, expense, balance: income - expense };
    }, [filteredTransactions]);

    const groupedTransactions = useMemo(() => {
        const groups: { [key: string]: { dateKey: string; label: string; transactions: Transaction[] } } = {};
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        filteredTransactions.forEach((tx) => {
            const date = new Date(tx.date);
            const dateKey = date.toISOString().split('T')[0];

            let label: string;
            if (date.toDateString() === today.toDateString()) {
                label = t('today');
            } else if (date.toDateString() === yesterday.toDateString()) {
                label = t('yesterday');
            } else {
                label = date.toLocaleDateString(languageCode, { month: 'short', day: 'numeric' });
            }

            if (!groups[dateKey]) {
                groups[dateKey] = { dateKey, label, transactions: [] };
            }

            groups[dateKey].transactions.push(tx);
        });

        return Object.values(groups);
    }, [filteredTransactions, languageCode, t]);

    const selectedWallet = wallets.find((wallet) => wallet.id === selectedWalletId);
    const selectedWalletLabel = selectedWalletId === 'all'
        ? t('all_transactions')
        : selectedWallet
            ? t(selectedWallet.name as TranslationKeys)
            : t('all_transactions');
    const periodLabel = periodType === 'all' ? (t('all') as string) : formatPeriodLabel(selectedDate, periodType, languageCode);

    const scrollY = useSharedValue(0);
    const handleScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const heroCardStyle = useAnimatedStyle(() => ({
        height: interpolate(scrollY.value, [0, 140], [198, 88], Extrapolation.CLAMP),
    }));

    const expandedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [0, 70], [1, 0], Extrapolation.CLAMP),
    }));

    const collapsedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [70, 140], [0, 1], Extrapolation.CLAMP),
    }));

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString(languageCode, { hour: 'numeric', minute: '2-digit' });
    };

    const formatDateShort = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return t('today');
        if (date.toDateString() === yesterday.toDateString()) return t('yesterday');
        return date.toLocaleDateString(languageCode, { month: 'short', day: 'numeric' });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#F6F7FB" />
            <GestureHandlerRootView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerBackBtn} onPress={() => router.back()} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={22} color="#8B5CF6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerPillBtn}
                        onPress={() => setActiveMenu(activeMenu === 'wallet' ? null : 'wallet')}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={selectedWalletId === 'all' ? 'globe-outline' : (selectedWallet?.icon as any || 'wallet-outline')}
                            size={14}
                            color="#334155"
                        />
                        <Text style={styles.headerPillText} numberOfLines={1}>{selectedWalletLabel}</Text>
                        <Ionicons name={activeMenu === 'wallet' ? 'chevron-up' : 'chevron-down'} size={12} color="#94A3B8" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerMenuBtn} onPress={() => setActiveMenu(activeMenu === 'period' ? null : 'period')} activeOpacity={0.7}>
                        <Ionicons name="ellipsis-vertical" size={22} color="#8B5CF6" />
                    </TouchableOpacity>
                </View>

                {activeMenu === 'period' && (
                    <View style={styles.menuCard}>
                        {(['day', 'week', 'month', 'year', 'all'] as const).map((item) => {
                            const active = periodType === item;
                            return (
                                <TouchableOpacity
                                    key={item}
                                    style={[styles.menuItem, active && styles.menuItemActive]}
                                    onPress={() => {
                                        setPeriodType(item);
                                        AsyncStorage.setItem('tracker_transaction_period_filter', item).catch(console.error);
                                        setActiveMenu(null);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>{t(item)}</Text>
                                    {active && <Ionicons name="checkmark" size={16} color="#6366F1" />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {activeMenu === 'wallet' && (
                    <View style={styles.menuCard}>
                        <TouchableOpacity
                            style={[styles.menuItem, selectedWalletId === 'all' && styles.menuItemActive]}
                            onPress={() => {
                                setSelectedWalletId('all');
                                AsyncStorage.setItem('tracker_transaction_wallet_filter', 'all').catch(console.error);
                                setActiveMenu(null);
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.menuItemText, selectedWalletId === 'all' && styles.menuItemTextActive]}>{t('all_transactions')}</Text>
                            {selectedWalletId === 'all' && <Ionicons name="checkmark" size={16} color="#6366F1" />}
                        </TouchableOpacity>
                        {wallets.map((wallet) => {
                            const active = selectedWalletId === wallet.id;
                            return (
                                <TouchableOpacity
                                    key={wallet.id}
                                    style={[styles.menuItem, active && styles.menuItemActive]}
                                    onPress={() => {
                                        setSelectedWalletId(wallet.id);
                                        AsyncStorage.setItem('tracker_transaction_wallet_filter', wallet.id).catch(console.error);
                                        setActiveMenu(null);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.walletMenuItemLeft}>
                                        <View style={[styles.walletMenuDot, { backgroundColor: wallet.color }]} />
                                        <Text style={[styles.menuItemText, active && styles.menuItemTextActive]} numberOfLines={1}>
                                            {t(wallet.name as TranslationKeys)}
                                        </Text>
                                    </View>
                                    {active && <Ionicons name="checkmark" size={16} color="#6366F1" />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                <View style={styles.heroWrapper}>
                    <Animated.View style={[styles.heroCard, heroCardStyle]}>
                        <LinearGradient
                            colors={['#6366F1', '#8B5CF6', '#A855F7']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.heroDecorLarge} />
                        <View style={styles.heroDecorSmall} />

                        <Animated.View style={[styles.heroExpanded, expandedStyle]}>
                            <View style={styles.heroTopRow}>
                                {periodType !== 'all' ? (
                                    <TouchableOpacity style={styles.heroArrowButton} onPress={() => setSelectedDate((prev) => shiftPeriod(prev, periodType, -1))}>
                                        <Ionicons name="chevron-back" size={16} color="#fff" />
                                    </TouchableOpacity>
                                ) : <View style={{ width: 34 }} />}
                                <View style={styles.heroTitleBlock}>
                                    <Text style={styles.heroTitle} numberOfLines={1}>{periodLabel}</Text>
                                </View>
                                {periodType !== 'all' ? (
                                    <TouchableOpacity style={styles.heroArrowButton} onPress={() => setSelectedDate((prev) => shiftPeriod(prev, periodType, 1))}>
                                        <Ionicons name="chevron-forward" size={16} color="#fff" />
                                    </TouchableOpacity>
                                ) : <View style={{ width: 34 }} />}
                            </View>

                            <View>
                                <Text style={styles.balanceLabel}>{t('net_balance')}</Text>
                                <View style={styles.balanceValueRow}>
                                    <Text style={styles.balanceCurrency}>{summary.balance < 0 ? `-${currencySymbol}` : currencySymbol}</Text>
                                    <Text style={styles.balanceInteger}>{formatNumberParts(Math.abs(summary.balance)).integer}</Text>
                                    <Text style={styles.balanceDecimal}>.{formatNumberParts(Math.abs(summary.balance)).decimal}</Text>
                                </View>
                            </View>

                            <View style={styles.summaryRow}>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>{t('income')}</Text>
                                    <Text style={styles.summaryValue}>{currencySymbol}{formatNumberParts(summary.income).integer}<Text style={styles.summaryDecimal}>.{formatNumberParts(summary.income).decimal}</Text></Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>{t('expense')}</Text>
                                    <Text style={styles.summaryValue}>{currencySymbol}{formatNumberParts(summary.expense).integer}<Text style={styles.summaryDecimal}>.{formatNumberParts(summary.expense).decimal}</Text></Text>
                                </View>
                            </View>
                        </Animated.View>

                        <Animated.View pointerEvents="none" style={[styles.heroCollapsed, collapsedStyle]}>
                            <View>
                                <Text style={styles.heroCollapsedLabel}>{t(periodType)}</Text>
                                <Text style={styles.heroCollapsedTitle} numberOfLines={1}>{periodLabel}</Text>
                            </View>
                            <Text style={styles.heroCollapsedAmount}>
                                {summary.balance < 0 ? '-' : ''}
                                <Text style={styles.heroCollapsedCurrency}>{currencySymbol}</Text>
                                {formatNumberParts(Math.abs(summary.balance)).integer}
                                <Text style={styles.heroCollapsedDecimal}>.{formatNumberParts(Math.abs(summary.balance)).decimal}</Text>
                            </Text>
                        </Animated.View>
                    </Animated.View>
                </View>

                <Animated.ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    snapToOffsets={[0, 140]}
                    decelerationRate="normal"
                    snapToEnd={false}
                >

                    {groupedTransactions.length === 0 ? (
                        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.emptyContainer}>
                            <View style={styles.emptyIconContainer}>
                                <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
                            </View>
                            <Text style={styles.emptyTitle}>{t('no_transactions_found')}</Text>
                            <Text style={styles.emptyText}>{t('try_adjusting')}</Text>
                        </Animated.View>
                    ) : (
                        groupedTransactions.map((group, groupIndex) => (
                            <Animated.View key={group.dateKey} entering={FadeInDown.delay(180 + groupIndex * 60).springify()}>
                                <Text style={styles.dateHeader}>{group.label}</Text>
                                <View style={styles.listContainer}>
                                    {group.transactions.map((item, index) => {
                                        const category = item.categoryId ? getCategoryById(categories, item.categoryId) : null;
                                        const iconName = category ? category.icon : (item.type === 'income' ? 'arrow-up' : 'arrow-down');
                                        const iconColor = category ? category.color : (item.type === 'income' ? '#10B981' : '#EF4444');
                                        const title = category ? t(category.name as TranslationKeys) : t(item.type);
                                        const isIncome = item.type === 'income';

                                        return (
                                            <Animated.View key={item.id} entering={FadeInDown.delay(220 + index * 50).springify()}>
                                                <TouchableOpacity
                                                    style={styles.transactionCard}
                                                    onPress={() => router.push({ pathname: '/(authenticated)/task/add-transaction', params: { id: item.id } })}
                                                    activeOpacity={0.6}
                                                >
                                                    <View style={[styles.transactionIcon, { backgroundColor: iconColor + '15' }]}>
                                                        <Ionicons name={iconName as any} size={22} color={iconColor} />
                                                    </View>
                                                    <View style={styles.transactionDetails}>
                                                        <Text style={styles.transactionTitle} numberOfLines={1}>{title}</Text>
                                                        <View style={styles.transactionMeta}>
                                                            <Text style={styles.transactionTime}>
                                                                {formatTime(item.date)}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Text style={[styles.transactionAmount, { color: isIncome ? '#10B981' : '#EF4444' }]}>
                                                        {isIncome ? '+' : '-'}
                                                        <Text style={styles.transactionCurrency}>{currencySymbol}</Text>
                                                        {formatNumberParts(item.amount).integer}
                                                        <Text style={styles.transactionDecimal}>.{formatNumberParts(item.amount).decimal}</Text>
                                                    </Text>
                                                </TouchableOpacity>
                                            </Animated.View>
                                        );
                                    })}
                                </View>
                            </Animated.View>
                        ))
                    )}
                </Animated.ScrollView>
            </GestureHandlerRootView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F6F7FB',
    },
    container: {
        flex: 1,
        backgroundColor: '#F6F7FB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 5,
    },
    headerBackBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_500Medium',
        color: '#1E293B',
    },
    headerPillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
        maxWidth: 200,
    },
    headerPillText: {
        fontSize: 14,
        fontFamily: 'Prompt_500Medium',
        color: '#1E293B',
    },
    headerMenuBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuCard: {
        marginHorizontal: 20,
        marginBottom: 10,
        padding: 8,
        borderRadius: 18,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#EEF2F7',
    },
    menuItem: {
        minHeight: 44,
        borderRadius: 12,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    menuItemActive: {
        backgroundColor: '#EEF2FF',
    },
    menuItemText: {
        fontSize: 14,
        fontFamily: 'Prompt_500Medium',
        color: '#1E293B',
    },
    menuItemTextActive: {
        color: '#6366F1',
        fontFamily: 'Prompt_600SemiBold',
    },
    walletMenuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    walletMenuDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    heroWrapper: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 14,
    },
    heroCard: {
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 20,
        elevation: 10,
    },
    heroDecorLarge: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(255,255,255,0.12)',
        top: -76,
        right: -44,
    },
    heroDecorSmall: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.08)',
        bottom: -24,
        left: -18,
    },
    heroExpanded: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 18,
        justifyContent: 'space-between',
    },
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    heroArrowButton: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroTitleBlock: {
        flex: 1,
        alignItems: 'center',
    },
    heroEyebrow: {
        fontSize: 11,
        fontFamily: 'Prompt_500Medium',
        color: 'rgba(255,255,255,0.78)',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    heroTitle: {
        marginTop: 2,
        fontSize: 18,
        fontFamily: 'Prompt_600SemiBold',
        color: '#fff',
    },
    balanceLabel: {
        fontSize: 11,
        fontFamily: 'Prompt_500Medium',
        color: 'rgba(255,255,255,0.78)',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    balanceValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    balanceCurrency: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: 'rgba(255,255,255,0.8)',
        marginRight: 4,
    },
    balanceInteger: {
        fontSize: 31,
        fontFamily: 'Prompt_600SemiBold',
        color: '#fff',
        letterSpacing: -0.8,
    },
    balanceDecimal: {
        fontSize: 18,
        fontFamily: 'Prompt_400Regular',
        color: 'rgba(255,255,255,0.9)',
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryItem: {
        flex: 1,
    },
    summaryDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: 14,
    },
    summaryLabel: {
        fontSize: 11,
        fontFamily: 'Prompt_500Medium',
        color: 'rgba(255,255,255,0.74)',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: '#fff',
    },
    summaryDecimal: {
        fontSize: 12,
        fontFamily: 'Prompt_400Regular',
        color: 'rgba(255,255,255,0.86)',
    },
    heroCollapsed: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    heroCollapsedLabel: {
        fontSize: 11,
        fontFamily: 'Prompt_500Medium',
        color: 'rgba(255,255,255,0.72)',
        textTransform: 'uppercase',
    },
    heroCollapsedTitle: {
        marginTop: 2,
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: '#fff',
        maxWidth: 180,
    },
    heroCollapsedAmount: {
        fontSize: 18,
        fontFamily: 'Prompt_600SemiBold',
        color: '#fff',
    },
    heroCollapsedCurrency: {
        fontSize: 12,
        fontFamily: 'Prompt_500Medium',
    },
    heroCollapsedDecimal: {
        fontSize: 13,
        fontFamily: 'Prompt_400Regular',
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 120,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 17,
        fontFamily: 'Prompt_600SemiBold',
        color: '#374151',
        marginBottom: 6,
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        fontFamily: 'Prompt_400Regular',
    },
    dateHeader: {
        fontSize: 13,
        fontFamily: 'Prompt_600SemiBold',
        color: '#6B7280',
        marginTop: 10,
        marginBottom: 10,
        paddingHorizontal: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    listContainer: {
        gap: 8,
    },
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    transactionIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    transactionDetails: {
        flex: 1,
    },
    transactionTitle: {
        fontSize: 15,
        fontFamily: 'Prompt_500Medium',
        color: '#1F2937',
        marginBottom: 4,
    },
    transactionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    transactionTime: {
        fontSize: 12,
        color: '#9CA3AF',
        fontFamily: 'Prompt_400Regular',
    },
    transactionAmount: {
        fontSize: 16,
        fontFamily: 'Prompt_500Medium',
        letterSpacing: -0.5,
    },
    transactionCurrency: {
        fontSize: 11,
        fontFamily: 'Prompt_500Medium',
    },
    transactionDecimal: {
        fontSize: 12,
        fontFamily: 'Prompt_400Regular',
    },
});
