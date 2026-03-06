import { Category, getCategoryById, INITIAL_CATEGORIES } from '@/constants/categories';
import { getCurrencyByCode } from '@/constants/currencies';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { getCategories, getCurrency, getData, saveCategories, StorageKeys } from '@/utils/storage';
import { Transaction } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Transactions() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
    const [currencySymbol, setCurrencySymbol] = useState('$');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const { t, languageCode } = useLanguage();

    const loadData = useCallback(async () => {
        const data = await getData(StorageKeys.TRANSACTIONS);
        let storedCats = await getCategories();
        if (!storedCats) {
            storedCats = INITIAL_CATEGORIES;
            await saveCategories(INITIAL_CATEGORIES);
        }
        setTransactions(data || []);
        setCategories(storedCats);

        const currencyCode = await getCurrency();
        setCurrencySymbol(getCurrencyByCode(currencyCode).symbol);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    // Filter transactions by selected month, type, and search query
    const filteredTransactions = useMemo(() => {
        let result = transactions;

        // Filter by month
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

        result = result.filter(t => {
            const date = new Date(t.date);
            return date >= startOfMonth && date <= endOfMonth;
        });

        // Filter by type
        if (filter !== 'all') {
            result = result.filter(t => t.type === filter);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(t => t.title.toLowerCase().includes(query));
        }

        return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, filter, searchQuery, selectedDate]);


    // Calculate summary based on filtered transactions
    const summary = useMemo(() => {
        let income = 0;
        let expense = 0;
        filteredTransactions.forEach(t => {
            // Only count income/expense if it matches the global filter or if filter is 'all'
            if (t.type === 'income') income += t.amount;
            else expense += t.amount;
        });
        return { income, expense, balance: income - expense };
    }, [filteredTransactions]);


    // Group transactions by date
    const groupedTransactions = useMemo(() => {
        const groups: { [key: string]: { dateKey: string; label: string; transactions: Transaction[] } } = {};
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        filteredTransactions.forEach(tx => {
            const date = new Date(tx.date);
            const dateStr = date.toISOString().split('T')[0];

            let label: string;
            if (dateStr === today.toISOString().split('T')[0]) {
                label = t('today'); // Using translation key

            } else if (dateStr === yesterday.toISOString().split('T')[0]) {
                label = t('yesterday'); // Using translation key to support Thai
            } else {
                label = date.toLocaleDateString(languageCode, { month: 'short', day: 'numeric', year: 'numeric' });
            }

            if (!groups[dateStr]) {
                groups[dateStr] = { dateKey: dateStr, label, transactions: [] };
            }
            groups[dateStr].transactions.push(tx);
        });

        return Object.values(groups);
    }, [filteredTransactions]);


    // Scroll animation for collapsible header
    const scrollY = useSharedValue(0);
    const handleScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const cardStyle = useAnimatedStyle(() => {
        return {
            height: interpolate(
                scrollY.value,
                [0, 120],
                [160, 60],
                Extrapolation.CLAMP
            ),
        };
    });

    const expandedStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(
                scrollY.value,
                [0, 60],
                [1, 0],
                Extrapolation.CLAMP
            ),
        };
    });

    const collapsedStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(
                scrollY.value,
                [60, 120],
                [0, 1],
                Extrapolation.CLAMP
            ),
        };
    });

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const changeMonth = (increment: number) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + increment);
        setSelectedDate(newDate);
    };

    return (
        <GestureHandlerRootView style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ width: 40 }} />
                    <Text style={styles.headerTitle}>{t('transactions')}</Text>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.headerCloseBtn}
                    >
                        <Ionicons name="close" size={24} color="#8B5CF6" />
                    </TouchableOpacity>
                </View>


                {/* Month Selector Card (Static - No Collapse) */}
                <View style={styles.monthSelectorCard}>
                    <LinearGradient
                        colors={['#6366F1', '#8B5CF6', '#A855F7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />

                    <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrowBtn}>
                        <View style={styles.monthArrowCircle}>
                            <Ionicons name="chevron-back" size={18} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <View style={styles.monthLabelContainer}>
                        <Ionicons name="calendar-outline" size={20} color="rgba(255,255,255,0.8)" style={{ marginRight: 8 }} />
                        <Text style={styles.monthLabelText}>
                            {selectedDate.toLocaleDateString(languageCode, { month: 'long', year: 'numeric' })}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrowBtn}>
                        <View style={styles.monthArrowCircle}>
                            <Ionicons name="chevron-forward" size={18} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Collapsible Summary Card */}
                <View style={styles.headerCardWrapper}>
                    <Animated.View style={[styles.summaryCardAnimated, cardStyle]}>
                        <LinearGradient
                            colors={['#6366F1', '#8B5CF6', '#A855F7']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.decorCircle1} />
                        <View style={styles.decorCircle2} />

                        {/* Expanded Content */}
                        <Animated.View style={[styles.expandedContent, expandedStyle]}>
                            <View style={styles.summaryRow}>
                                <View style={styles.summaryItem}>
                                    <View style={[styles.summaryIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.3)' }]}>
                                        <Ionicons name="arrow-up" size={16} color="#10B981" />
                                    </View>
                                    <Text style={styles.summaryLabel}>Income</Text>
                                    <Text style={styles.summaryAmount}>{currencySymbol}{formatCurrency(summary.income)}</Text>
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.summaryItem}>
                                    <View style={[styles.summaryIconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                                        <Ionicons name="arrow-down" size={16} color="#EF4444" />
                                    </View>
                                    <Text style={styles.summaryLabel}>Expense</Text>
                                    <Text style={styles.summaryAmount}>{currencySymbol}{formatCurrency(summary.expense)}</Text>
                                </View>
                            </View>
                            <View style={styles.balanceRow}>
                                <Text style={styles.balanceLabel}>Net Balance</Text>
                                <Text style={[styles.balanceAmount, summary.balance < 0 && { color: '#FCA5A5' }]}>
                                    {summary.balance < 0 ? '-' : '+'}{currencySymbol}{formatCurrency(Math.abs(summary.balance))}
                                </Text>
                            </View>
                        </Animated.View>

                        {/* Collapsed Content */}
                        <Animated.View pointerEvents="none" style={[styles.collapsedContent, collapsedStyle]}>
                            <View style={styles.collapsedRow}>
                                <View style={styles.collapsedItem}>
                                    <Ionicons name="arrow-up" size={14} color="#10B981" />
                                    <Text style={styles.collapsedAmount}>{currencySymbol}{formatCurrency(summary.income)}</Text>
                                </View>
                                <View style={styles.collapsedDivider} />
                                <View style={styles.collapsedItem}>
                                    <Ionicons name="arrow-down" size={14} color="#EF4444" />
                                    <Text style={styles.collapsedAmount}>{currencySymbol}{formatCurrency(summary.expense)}</Text>
                                </View>
                            </View>
                        </Animated.View>
                    </Animated.View>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color="#9CA3AF" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search transactions..."
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Filter Chips */}
                <View style={styles.filterContainer}>
                    {(['all', 'income', 'expense'] as const).map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[
                                styles.filterChip,
                                filter === f && styles.filterChipActive,
                                filter === f && f === 'income' && styles.incomeChipActive,
                                filter === f && f === 'expense' && styles.expenseChipActive,
                            ]}
                            onPress={() => setFilter(f)}
                        >
                            {f === 'income' && <Ionicons name="arrow-up" size={14} color={filter === f ? '#fff' : '#10B981'} />}
                            {f === 'expense' && <Ionicons name="arrow-down" size={14} color={filter === f ? '#fff' : '#EF4444'} />}
                            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Animated.ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                >

                    {/* Transaction List */}
                    <View style={styles.transactionSection}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionTitleRow}>
                                <View style={styles.sectionIcon}>
                                    <Ionicons name="receipt-outline" size={16} color="#6366F1" />
                                </View>
                                <Text style={styles.sectionTitle}>
                                    {selectedDate.toLocaleDateString(languageCode, { month: 'long' })} {t('transactions')}
                                </Text>
                            </View>
                            <View style={styles.countBadge}>
                                <Text style={styles.countText}>{filteredTransactions.length}</Text>
                            </View>
                        </View>

                        {groupedTransactions.length === 0 ? (
                            <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.emptyState}>
                                <View style={styles.emptyIconContainer}>
                                    <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
                                </View>
                                <Text style={styles.emptyTitle}>No transactions found</Text>
                                <Text style={styles.emptyText}>Try adjusting your search or filters</Text>
                            </Animated.View>
                        ) : (
                            groupedTransactions.map((group, groupIndex) => (
                                <Animated.View
                                    key={group.dateKey}
                                    entering={FadeInDown.delay(300 + groupIndex * 80).springify()}
                                >
                                    <Text style={styles.dateHeader}>{group.label}</Text>
                                    {group.transactions.map((item, index) => {
                                        const category = item.categoryId ? getCategoryById(categories, item.categoryId) : null;
                                        const iconName = category ? category.icon : (item.type === 'income' ? 'arrow-up' : 'arrow-down');
                                        const iconColor = category ? category.color : (item.type === 'income' ? '#10B981' : '#EF4444');

                                        return (
                                            <TouchableOpacity
                                                key={item.id}
                                                style={styles.transactionCard}
                                                onPress={() => router.push({ pathname: '/(authenticated)/task/edit-transaction', params: { id: item.id } })}
                                                activeOpacity={0.6}
                                            >
                                                <View style={[styles.transactionIcon, { backgroundColor: iconColor + '15' }]}>
                                                    <Ionicons name={iconName as any} size={22} color={iconColor} />
                                                </View>
                                                <View style={styles.transactionDetails}>
                                                    <Text style={styles.transactionTitle} numberOfLines={1}>{category ? t(category.name as TranslationKeys) : ''}</Text>
                                                    <View style={styles.transactionMeta}>
                                                        <Text style={styles.transactionTime}>
                                                            {new Date(item.date).toLocaleTimeString(languageCode, { hour: 'numeric', minute: '2-digit' })}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={[
                                                    styles.transactionAmount,
                                                    { color: item.type === 'income' ? '#10B981' : '#EF4444' }
                                                ]}>
                                                    {item.type === 'income' ? '+' : '-'}{currencySymbol}{formatCurrency(item.amount)}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </Animated.View>
                            ))
                        )}
                    </View>
                </Animated.ScrollView>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
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
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
    },

    // Month Selector Card
    monthSelectorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 20,
        marginTop: 8,
        marginBottom: 10,
        borderRadius: 20,
        paddingVertical: 16,
        paddingHorizontal: 16,
        overflow: 'hidden',
        elevation: 6,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
    },
    monthDecorCircle: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        top: -30,
        right: -20,
    },
    monthArrowBtn: {
        padding: 4,
    },
    monthArrowCircle: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthLabelContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthLabelText: {
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
        color: '#fff',
        letterSpacing: 0.3,
    },

    // Collapsible Header Card
    headerCardWrapper: {
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    summaryCardAnimated: {
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
    },
    decorCircle1: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        top: -40,
        right: -30,
    },
    decorCircle2: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        bottom: -20,
        left: -20,
    },
    expandedContent: {
        flex: 1,
        padding: 20,
        justifyContent: 'space-between',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    summaryItem: {
        alignItems: 'center',
        flex: 1,
    },
    summaryIconBadge: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    summaryLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: 4,
        fontFamily: 'Prompt_600SemiBold',
        letterSpacing: 0.5,
    },
    summaryAmount: {
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
        color: '#fff',
    },
    divider: {
        width: 1,
        height: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    balanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 12,
        marginTop: 12,
    },
    balanceLabel: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.8)',
        fontFamily: 'Prompt_600SemiBold',
    },
    balanceAmount: {
        fontSize: 16,
        fontFamily: 'Prompt_800ExtraBold',
        color: '#A7F3D0',
    },
    collapsedContent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    collapsedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
    },
    collapsedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    collapsedDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    collapsedAmount: {
        fontSize: 16,
        fontFamily: 'Prompt_700Bold',
        color: '#fff',
    },

    // Search
    searchContainer: {
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: '#1F2937',
        fontFamily: 'Prompt_500Medium',
    },

    // Filters
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 16,
        gap: 10,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterChipActive: {
        backgroundColor: '#6366F1',
        borderColor: '#6366F1',
    },
    incomeChipActive: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    expenseChipActive: {
        backgroundColor: '#EF4444',
        borderColor: '#EF4444',
    },
    filterText: {
        fontFamily: 'Prompt_600SemiBold',
        fontSize: 13,
        color: '#6B7280',
    },
    filterTextActive: {
        color: '#fff',
    },

    // Content
    content: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },

    // Transaction List
    transactionSection: {
        marginTop: 4,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: 'Prompt_700Bold',
        color: '#1F2937',
    },
    countBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    countText: {
        fontSize: 12,
        fontFamily: 'Prompt_600SemiBold',
        color: '#6B7280',
    },
    dateHeader: {
        fontSize: 13,
        fontFamily: 'Prompt_600SemiBold',
        color: '#6B7280',
        marginTop: 16,
        marginBottom: 8,
        paddingHorizontal: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        marginBottom: 10,
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
        marginRight: 16,
    },
    transactionTitle: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: '#1E293B',
        marginBottom: 4,
    },
    transactionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    categoryPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    categoryPillText: {
        fontSize: 10,
        fontFamily: 'Prompt_600SemiBold',
    },
    transactionTime: {
        fontSize: 12,
        color: '#94A3B8',
        fontFamily: 'Prompt_400Regular',
    },
    transactionAmount: {
        fontSize: 16,
        fontFamily: 'Prompt_700Bold',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
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
        fontSize: 18,
        fontFamily: 'Prompt_600SemiBold',
        color: '#374151',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        fontFamily: 'Prompt_400Regular',
    },
    deleteButton: {
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        borderRadius: 16,
        marginBottom: 10,
        marginLeft: 10,
    },
});
