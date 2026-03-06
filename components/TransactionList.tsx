import { Category, getCategoryById } from '@/constants/categories';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { formatNumberParts } from '@/utils/formatNumber';
import { Transaction } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface TransactionListProps {
    categories: Category[];
    transactions: Transaction[];
    currencySymbol?: string;
    onPress: (id: string) => void;
    onViewAll?: () => void;
}

export const TransactionList = ({ categories, transactions, currencySymbol = '$', onPress, onViewAll }: TransactionListProps) => {
    const { t, languageCode } = useLanguage();

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return t('today');
        } else if (date.toDateString() === yesterday.toDateString()) {
            return t('yesterday');
        } else {
            return date.toLocaleDateString(languageCode, { month: 'short', day: 'numeric' });
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString(languageCode, { hour: 'numeric', minute: '2-digit' });
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                    <View style={styles.sectionIcon}>
                        <Ionicons name="receipt-outline" size={16} color="#6366F1" />
                    </View>
                    <View>
                        <Text style={styles.header}>{t('recent_transactions')}</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{transactions.length}</Text>
                    </View>
                    {onViewAll && (
                        <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
                            <Text style={styles.viewAllText}>{t('see_all')}</Text>
                            <Ionicons name="chevron-forward" size={14} color="#ffffffff" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Empty State */}
            {transactions.length === 0 ? (
                <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.emptyContainer}>
                    <View style={styles.emptyIconContainer}>
                        <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
                    </View>
                    <Text style={styles.emptyTitle}>{t('no_transactions_yet')}</Text>
                    <Text style={styles.emptyText}>{t('add_first_transaction')}</Text>
                </Animated.View>
            ) : (
                <View style={styles.listContainer}>
                    {transactions.slice(0, 10).map((item, index) => {
                        const category = item.categoryId ? getCategoryById(categories, item.categoryId) : null;
                        const iconName = category ? category.icon : (item.type === 'income' ? 'arrow-up' : 'arrow-down');
                        const iconColor = category ? category.color : (item.type === 'income' ? '#10B981' : '#EF4444');
                        const isIncome = item.type === 'income';

                        return (
                            <Animated.View
                                key={item.id}
                                entering={FadeInDown.delay(300 + index * 80).springify()}
                            >
                                <TouchableOpacity style={styles.transactionCard} onPress={() => onPress(item.id)} activeOpacity={0.6}>
                                    {/* Icon */}
                                    <View style={[styles.transactionIcon, { backgroundColor: iconColor + '15' }]}>
                                        <Ionicons
                                            name={iconName as any}
                                            size={22}
                                            color={iconColor}
                                        />
                                    </View>

                                    {/* Details */}
                                    <View style={styles.transactionDetails}>
                                        <Text style={styles.transactionTitle} numberOfLines={1}>{category ? t(category.name as TranslationKeys) : ''}</Text>
                                        <View style={styles.transactionMeta}>

                                            <Text style={styles.transactionTime}>
                                                {formatDate(item.date)} • {formatTime(item.date)}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Amount */}
                                    <Text style={[
                                        styles.transactionAmount,
                                        { color: isIncome ? '#10B981' : '#EF4444' }
                                    ]}>
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
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingVertical: 8,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    sectionIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        fontSize: 15,
        fontFamily: 'Prompt_700Bold',
        color: '#1F2937',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    countBadge: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
    },
    countText: {
        fontSize: 12,
        fontFamily: 'Prompt_700Bold',
        color: '#6366F1',
    },
    viewAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#6366F1',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 4,
    },
    viewAllText: {
        color: '#fff',
        fontFamily: 'Prompt_600SemiBold',
        fontSize: 12,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
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
        paddingHorizontal: 40,
        fontFamily: 'Prompt_400Regular',
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
    categoryPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    categoryPillText: {
        fontSize: 10,
        fontFamily: 'Prompt_700Bold',
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
