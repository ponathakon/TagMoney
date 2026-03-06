import { Category, getCategoryById, INITIAL_CATEGORIES } from '@/constants/categories';
import { getCurrencyByCode } from '@/constants/currencies';
import { Colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { getCategories, getCurrency, saveCategories } from '@/utils/storage';
import { Transaction } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

interface CategoryBarChartProps {
    transactions: Transaction[];
    type: 'income' | 'expense';
}

type TimeRange = '1D' | '1W' | '1M' | '1Y';

export const CategoryBarChart = ({ transactions, type }: CategoryBarChartProps) => {
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [currencySymbol, setCurrencySymbol] = useState('$');
    const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');
    const { t } = useLanguage();

    useEffect(() => {
        const loadCategories = async () => {
            let stored = await getCategories();
            if (!stored) {
                stored = INITIAL_CATEGORIES;
                await saveCategories(INITIAL_CATEGORIES);
            }
            setAllCategories(stored);

            const currencyCode = await getCurrency();
            setCurrencySymbol(getCurrencyByCode(currencyCode).symbol);

            setLoading(false);
        };
        loadCategories();
    }, []);

    const { pieData, totalAmount, categoryList } = useMemo(() => {
        if (loading) return { pieData: [], totalAmount: 0, categoryList: [] };

        const now = new Date();
        let startDate = new Date();

        switch (selectedRange) {
            case '1D':
                // For day, we want strictly today
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case '1W':
                startDate.setDate(now.getDate() - 7);
                break;
            case '1M':
                startDate.setMonth(now.getMonth() - 1);
                break;
            case '1Y':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
        }

        const filtered = transactions.filter(t => {
            const tDate = new Date(t.date);
            if (t.type !== type) return false;

            // For '1D', we need to check if it matches today exactly, handling time if stored
            if (selectedRange === '1D') {
                return tDate >= startDate && tDate < new Date(startDate.getTime() + 86400000);
            }

            return tDate >= startDate;
        });

        const categoryTotals: Record<string, number> = {};
        let total = 0;

        filtered.forEach(t => {
            const catId = t.categoryId || 'unknown';
            categoryTotals[catId] = (categoryTotals[catId] || 0) + t.amount;
            total += t.amount;
        });

        const list = Object.keys(categoryTotals)
            .map(catId => {
                const category = getCategoryById(allCategories, catId);
                const amount = categoryTotals[catId];
                return {
                    id: catId,
                    name: category ? t(category.name as TranslationKeys) : t('other'),
                    amount,
                    color: category?.color || Colors.light.tabIconDefault,
                    icon: category?.icon || 'help-circle-outline',
                    percentage: total > 0 ? (amount / total) * 100 : 0
                };
            })
            .sort((a, b) => b.amount - a.amount);

        const data = list.map(item => ({
            value: item.amount,
            color: item.color,
            text: '',
        }));

        const finalPieData = data.map(item => ({ ...item, shiftTextX: 10 }));

        return { pieData: finalPieData, totalAmount: total, categoryList: list };
    }, [transactions, type, allCategories, loading, selectedRange]);

    const handleRangeChange = (range: TimeRange) => {
        Haptics.selectionAsync();
        setSelectedRange(range);
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="small" color={Colors.light.tint} />
            </View>
        );
    }

    // New Segmented Control without title
    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.segmentedControl}>
                {(['1D', '1W', '1M', '1Y'] as TimeRange[]).map((range) => (
                    <TouchableOpacity
                        key={range}
                        style={[styles.segmentBtn, selectedRange === range && styles.activeSegmentBtn]}
                        onPress={() => handleRangeChange(range)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.segmentText, selectedRange === range && styles.activeSegmentText]}>{range}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    if (pieData.length === 0) {
        return (
            <View style={styles.container}>
                {renderHeader()}
                <View style={styles.emptyState}>
                    <Ionicons name="pie-chart-outline" size={32} color="#CBD5E1" />
                    <Text style={styles.emptyText}>{t('no_data_period')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {renderHeader()}

            <View style={styles.chartContainer}>
                <PieChart
                    data={pieData}
                    donut
                    radius={95}
                    innerRadius={70}
                    innerCircleColor={'#fff'}
                    centerLabelComponent={() => {
                        return (
                            <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={styles.centerLabel}>{t('total')}</Text>
                                <Text style={styles.centerValue}>
                                    {currencySymbol}{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </Text>
                            </View>
                        );
                    }}
                />
            </View>

            <View style={styles.listContainer}>
                {categoryList.slice(0, 5).map((item, index) => (
                    <View key={item.id} style={styles.listItem}>
                        <View style={styles.itemLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                                <Ionicons name={item.icon as any} size={18} color={item.color} />
                            </View>
                            <Text style={styles.categoryName} numberOfLines={1}>{item.name}</Text>
                        </View>

                        <View style={styles.itemRight}>
                            <Text style={styles.itemAmount}>
                                {currencySymbol}{item.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </Text>
                            <View style={styles.percentageBadge}>
                                <Text style={styles.percentageText}>{item.percentage.toFixed(0)}%</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
    },
    header: {
        alignItems: 'center', // Center the segmented control
        marginBottom: 24,
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 4,
        width: '100%',
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
    },
    activeSegmentBtn: {
        backgroundColor: Colors.light.tint,
        shadowColor: Colors.light.tint,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    segmentText: {
        fontSize: 12,
        fontFamily: 'Prompt_600SemiBold',
        color: '#94A3B8',
    },
    activeSegmentText: {
        color: '#fff',
    },
    chartContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    centerLabel: {
        fontSize: 12,
        color: '#64748B',
        fontFamily: 'Prompt_500Medium',
    },
    centerValue: {
        fontSize: 20,
        color: '#0F172A',
        fontFamily: 'Prompt_700Bold',
    },
    listContainer: {
        gap: 12,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryName: {
        fontSize: 14,
        fontFamily: 'Prompt_600SemiBold',
        color: '#334155',
        flex: 1,
    },
    itemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    itemAmount: {
        fontSize: 14,
        fontFamily: 'Prompt_600SemiBold',
        color: '#0F172A',
    },
    percentageBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        minWidth: 40,
        alignItems: 'center',
    },
    percentageText: {
        fontSize: 11,
        fontFamily: 'Prompt_500Medium',
        color: '#64748B',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 30,
        gap: 8,
    },
    emptyText: {
        color: '#94A3B8',
        fontFamily: 'Prompt_500Medium',
        fontSize: 14,
    },
});
