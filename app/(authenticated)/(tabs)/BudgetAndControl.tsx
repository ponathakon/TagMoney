import { CategoryBarChart } from '@/components/CategoryBarChart';
import { DailyPulse } from '@/components/DailyPulse';
import { EditLimitsModal } from '@/components/EditLimitsModal';
import { MonthlyMarathon } from '@/components/MonthlyMarathon';
import { SmartLimits } from '@/components/SmartLimits';
import { Category, INITIAL_CATEGORIES } from '@/constants/categories';
import { getCurrencyByCode } from '@/constants/currencies';
import { Colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { getCategories, getCurrency, getData, getPreferences, saveCategories, savePreferences, StorageKeys } from '@/utils/storage';
import { Transaction } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BudgetAndControl() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [currencySymbol, setCurrencySymbol] = useState('$');
    const [loading, setLoading] = useState(true);

    // Budget State
    const [dailyLimit, setDailyLimit] = useState(0);
    const [monthlyLimit, setMonthlyLimit] = useState(0);
    const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({});
    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [editModalInitialTab, setEditModalInitialTab] = useState<'general' | 'categories'>('general');
    const { t } = useLanguage();

    // Calculated Metrics
    const [todaySpent, setTodaySpent] = useState(0);
    const [monthSpent, setMonthSpent] = useState(0);
    const [categoryExpenses, setCategoryExpenses] = useState<Record<string, number>>({});

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Load Core Data
            const txData = await getData(StorageKeys.TRANSACTIONS) || [];
            let catData = await getCategories();
            if (!catData || catData.length === 0) {
                catData = INITIAL_CATEGORIES;
                await saveCategories(INITIAL_CATEGORIES);
            }
            const currencyCode = await getCurrency();
            const prefs = await getPreferences();

            setTransactions(txData);
            setCategories(catData);
            setCurrencySymbol(getCurrencyByCode(currencyCode).symbol);

            // 2. Set Limits
            setDailyLimit(prefs.dailyLimit || 0);
            setMonthlyLimit(prefs.monthlyLimit || 0);
            setCategoryLimits(prefs.categoryLimits || {});

            // 3. Calculate Metrics
            calculateMetrics(txData);

        } catch (e) {
            console.error("Failed to load budget data", e);
        } finally {
            setLoading(false);
        }
    }, []);

    const calculateMetrics = (txs: Transaction[]) => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let todayTotal = 0;
        let monthTotal = 0;
        const catTotals: Record<string, number> = {};

        txs.forEach(t => {
            if (t.type !== 'expense') return;

            const tDate = new Date(t.date);
            const tDateStr = t.date.split('T')[0];

            if (tDateStr === todayStr) {
                todayTotal += t.amount;
            }

            if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
                monthTotal += t.amount;
                if (t.categoryId) {
                    catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
                }
            }
        });

        setTodaySpent(todayTotal);
        setMonthSpent(monthTotal);
        setCategoryExpenses(catTotals);
    };

    const handleSaveLimits = async (d: number, m: number, c: Record<string, number>) => {
        setDailyLimit(d);
        setMonthlyLimit(m);
        setCategoryLimits(c);
        await savePreferences({ dailyLimit: d, monthlyLimit: m, categoryLimits: c });
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    return (
        <GestureHandlerRootView>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />

                {/* Standard Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>{t('financial_control')}</Text>
                        <Text style={styles.title}>{t('budget_limits')}</Text>
                    </View>
                    <TouchableOpacity style={styles.editButton} onPress={() => {
                        setEditModalInitialTab('general');
                        setEditModalVisible(true);
                    }}>
                        <Ionicons name="settings-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={Colors.light.tint} />}
                    >
                        {/* Static Gradient Card */}
                        <View style={styles.summaryCardWrapper}>
                            <LinearGradient
                                colors={['#6366F1', '#8B5CF6', '#A855F7']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />

                            {/* Decor */}
                            <View style={styles.decorCircle1} />
                            <View style={styles.decorCircle2} />
                            <View style={styles.decorCircle3} />

                            {Platform.OS === 'ios' && (
                                <BlurView intensity={25} tint="light" style={styles.blurOverlay} />
                            )}


                            {/* Content: Daily Pulse */}
                            <View style={styles.cardContent}>
                                <DailyPulse
                                    spent={todaySpent}
                                    limit={dailyLimit}
                                    currencySymbol={currencySymbol}
                                />
                            </View>
                        </View>

                        <View style={styles.spacer} />

                        {/* 2. The Marathon (Monthly) */}
                        <View style={styles.section}>
                            <MonthlyMarathon
                                spent={monthSpent}
                                limit={monthlyLimit}
                                currencySymbol={currencySymbol}
                            />
                        </View>

                        {/* 3. Smart Limits (Categories) */}
                        <View style={styles.section}>
                            <View style={styles.smartLimitsHeader}>
                                <View>
                                    <Text style={styles.sectionTitle}>{t('smart_limits')}</Text>
                                    <Text style={styles.sectionSubtitle}>{t('set_monthly_limits')}</Text>
                                </View>
                                <TouchableOpacity onPress={() => {
                                    setEditModalInitialTab('categories');
                                    setEditModalVisible(true);
                                }} style={styles.addButton}>
                                    <Text style={styles.link}>{t('manage')}</Text>
                                    <Ionicons name="chevron-forward" size={14} color={Colors.light.tint} />
                                </TouchableOpacity>
                            </View>
                            <SmartLimits
                                categories={categories}
                                limits={categoryLimits}
                                expenses={categoryExpenses}
                                currencySymbol={currencySymbol}
                                onEdit={() => {
                                    setEditModalInitialTab('categories');
                                    setEditModalVisible(true);
                                }}
                            />
                        </View>

                        {/* 4. Deep Dive (Analytics) */}
                        <View style={styles.analyticsSection}>
                            <Text style={styles.sectionTitle}>{t('deep_dive')}</Text>
                            <Text style={styles.sectionSubtitle}>{t('detailed_analytics')}</Text>

                            <CategoryBarChart
                                transactions={transactions}
                                type="expense"
                            />
                        </View>
                    </ScrollView>
                </View>

                <EditLimitsModal
                    visible={isEditModalVisible}
                    onClose={() => setEditModalVisible(false)}
                    currentDaily={dailyLimit}
                    currentMonthly={monthlyLimit}
                    currentCategoryLimits={categoryLimits}
                    categories={categories}
                    onSave={handleSaveLimits}
                    currencySymbol={currencySymbol}
                    initialTab={editModalInitialTab}
                />
            </SafeAreaView>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
        paddingTop: 15,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 5,
        marginBottom: 15,
    },
    greeting: {
        fontSize: 13,
        color: '#666',
        fontFamily: 'Prompt_500Medium',
    },
    title: {
        fontSize: 24,
        fontFamily: 'Prompt_700Bold',
        color: Colors.light.text,
    },
    editButton: {
        backgroundColor: Colors.light.tint,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: Colors.light.tint,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    content: {
        flex: 1,
    },
    summaryCardWrapper: {
        borderRadius: 28,
        elevation: 12,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        overflow: 'hidden',
        minHeight: 300, // Fixed height for Pulse
        marginBottom: 20,
    },
    cardContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
    },
    decorCircle1: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 90,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        top: -60,
        right: -40,
    },
    decorCircle2: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        bottom: -30,
        left: -20,
    },
    decorCircle3: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        top: 60,
        left: 120,
    },
    blurOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    glassOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    scrollContent: {
        paddingBottom: 150,
        paddingHorizontal: 20,
    },
    spacer: {
        height: 0,
    },
    section: {
        marginBottom: 20,
    },
    analyticsSection: {
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 17,
        fontFamily: 'Prompt_700Bold',
        color: Colors.light.text,
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 12,
        fontFamily: 'Prompt_400Regular',
        color: '#64748B',
        marginTop: -8,
        marginBottom: 10,
    },
    chartCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    chartTitle: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: '#475569',
        marginBottom: 12,
        marginLeft: 4,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 4,
    },
    link: {
        fontSize: 14,
        color: Colors.light.tint,
        fontFamily: 'Prompt_600SemiBold',
    },
    smartLimitsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',

    },
});