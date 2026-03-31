import { TransactionList } from '@/components/TransactionList';
import { WalletCard } from '@/components/WalletCard';
import { Category, INITIAL_CATEGORIES } from '@/constants/categories';
import { getCurrencyByCode } from '@/constants/currencies';
import { Colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { formatNumberParts } from '@/utils/formatNumber';
import { getUnreadCount } from '@/utils/notifications';
import { getCategories, getCurrency, getData, getWalletBalance, getWallets, saveCategories, StorageKeys } from '@/utils/storage';
import { Transaction, Wallet } from '@/utils/types';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Home() {
    const { user } = useUser();
    const router = useRouter();
    const { t } = useLanguage();
    const [categories, setCategories] = useState<Category[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [walletBalances, setWalletBalances] = useState<{ [key: string]: number }>({});
    const [balance, setBalance] = useState(0);
    const [income, setIncome] = useState(0);
    const [expense, setExpense] = useState(0);
    const [currencySymbol, setCurrencySymbol] = useState('$');
    const [notificationCount, setNotificationCount] = useState(0);

    const loadData = useCallback(async () => {
        const data = await getData(StorageKeys.TRANSACTIONS);
        let categoriesData = await getCategories();
        const walletsData = await getWallets();

        if (!categoriesData || categoriesData.length === 0) {
            categoriesData = INITIAL_CATEGORIES;
            await saveCategories(INITIAL_CATEGORIES);
        }

        // Sort transactions by date (latest first)
        const sortedData = (data || []).sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(sortedData);
        setCategories(categoriesData);
        setWallets(walletsData);

        // Calculate wallet balances
        const balances: { [key: string]: number } = {};
        for (const wallet of walletsData) {
            balances[wallet.id] = await getWalletBalance(wallet.id);
        }
        setWalletBalances(balances);

        // Load currency preference
        const currencyCode = await getCurrency();
        setCurrencySymbol(getCurrencyByCode(currencyCode).symbol);

        calculateSummary(sortedData, walletsData);

        // Load notification count (unread only)
        const unread = await getUnreadCount();
        setNotificationCount(unread);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const calculateSummary = (data: Transaction[], currentWallets: Wallet[]) => {
        let totalIncome = 0;
        let totalExpense = 0;

        data.forEach(item => {
            if (item.type === 'income') {
                totalIncome += item.amount;
            } else {
                totalExpense += item.amount;
            }
        });

        // Calculate total initial balance from wallets
        const initialBalanceSum = currentWallets.reduce((sum, wallet) => sum + (wallet.initialBalance || 0), 0);

        setIncome(totalIncome);
        setExpense(totalExpense);
        setBalance(initialBalanceSum + totalIncome - totalExpense);
    };

    const scrollY = useSharedValue(0);
    const handlescroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const cardStyle = useAnimatedStyle(() => {
        return {
            height: interpolate(
                scrollY.value,
                [0, 100],
                [180, 100], // Adjust these values based on your desired initial and final height
                Extrapolation.CLAMP
            ),
        };
    });

    const expandedStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(
                scrollY.value,
                [0, 50],
                [1, 0],
                Extrapolation.CLAMP
            ),
        };
    });

    const collapsedStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(
                scrollY.value,
                [50, 100],
                [0, 1],
                Extrapolation.CLAMP
            ),
        };
    });

    const walletStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(
                scrollY.value,
                [0, 100],
                [1, 0],
                Extrapolation.CLAMP
            ),
            transform: [
                {
                    translateY: interpolate(
                        scrollY.value,
                        [0, 100],
                        [0, -50],
                        Extrapolation.CLAMP
                    ),
                },
                {
                    scale: interpolate(
                        scrollY.value,
                        [0, 100],
                        [1, 0.9],
                        Extrapolation.CLAMP
                    ),
                },
            ],
        };
    });



    return (
        <GestureHandlerRootView>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />


                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>{t('welcome_back')}</Text>
                        <Text style={styles.title}>{user?.firstName || user?.username || 'My Wallet'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/task/notifications')}>
                            <Ionicons name="notifications-outline" size={23} color="#fff" />
                            {notificationCount > 0 && (
                                <View style={styles.badgeDot}>
                                    <Text style={styles.badgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.content}>

                    <Animated.View style={[styles.summaryCardWrapper, cardStyle]}>
                        <LinearGradient
                            colors={['#6366F1', '#8B5CF6', '#A855F7']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />

                        {/* Decorative Floating Circles */}
                        <View style={styles.decorCircle1} />
                        <View style={styles.decorCircle2} />
                        <View style={styles.decorCircle3} />


                        <View style={styles.glassOverlay} />

                        {/* Expanded Content */}
                        <Animated.View style={[styles.cardContent, expandedStyle]}>
                            <View>
                                <Text style={styles.label}>{t('total_balance')}</Text>
                                <View style={styles.balanceRow}>
                                    <Text style={[styles.currencySymbol, { fontSize: 17 }]}>{balance < 0 ? `-${currencySymbol}` : currencySymbol}</Text>
                                    <Text style={styles.balanceText}>
                                        {formatNumberParts(balance).integer}
                                        <Text style={[styles.balanceDecimal, { fontSize: 19 }]}>.{formatNumberParts(balance).decimal}</Text>
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.statsContainer}>
                                <View style={styles.statItem}>
                                    <Text style={styles.subLabel}>{t('income')}</Text>
                                    <Text style={styles.amountText}>
                                        <Text style={[styles.currencySymbol, { fontSize: 9 }]}>{currencySymbol}</Text>{formatNumberParts(income).integer}
                                        <Text style={[styles.balanceDecimal, { fontSize: 11 }]}>.{formatNumberParts(income).decimal}</Text>
                                    </Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.subLabel}>{t('expense')}</Text>
                                    <Text style={styles.amountText}>
                                        <Text style={[styles.currencySymbol, { fontSize: 9 }]}>{currencySymbol}</Text>{formatNumberParts(expense).integer}
                                        <Text style={[styles.balanceDecimal, { fontSize: 11 }]}>.{formatNumberParts(expense).decimal}</Text>
                                    </Text>
                                </View>
                            </View>
                        </Animated.View>

                        {/* Collapsed Content */}
                        <Animated.View style={[styles.cardContentCollapsed, collapsedStyle]}>
                            <Text style={styles.labelCollapsed}>{t('total_balance')}</Text>
                            <View style={styles.collapsedBalance}>
                                <Text style={styles.currencySmall}>{balance < 0 ? `-${currencySymbol}` : currencySymbol}</Text>
                                <Text style={styles.balanceTextCollapsed}>
                                    {formatNumberParts(balance).integer}
                                    <Text style={[styles.balanceDecimal, { fontSize: 14 }]}>.{formatNumberParts(balance).decimal}</Text>
                                </Text>
                            </View>
                        </Animated.View>
                    </Animated.View>


                    <Animated.ScrollView
                        showsVerticalScrollIndicator={false}
                        onScroll={handlescroll}
                        scrollEventThrottle={16}
                        snapToOffsets={[0, 150]}
                        decelerationRate="normal"
                        snapToEnd={false}
                        contentContainerStyle={{ paddingBottom: 120 }}
                    >

                        {/* Wallet Overview */}
                        {wallets.length > 0 && (
                            <Animated.View style={[styles.walletsSection, walletStyle]}>

                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {wallets.map((wallet) => (
                                        <WalletCard
                                            key={wallet.id}
                                            wallet={wallet}
                                            balance={walletBalances[wallet.id] || 0}
                                            currencySymbol={currencySymbol}
                                            onPress={() => router.push('/task/wallets')}
                                        />
                                    ))}
                                </ScrollView>
                            </Animated.View>
                        )}



                        <TransactionList
                            transactions={transactions}
                            categories={categories}
                            currencySymbol={currencySymbol}
                            onPress={(id) => router.push({ pathname: '/task/add-transaction', params: { id } })}
                            onViewAll={() => router.push('/task/transactions')}
                        />

                    </Animated.ScrollView>
                </View>



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
    content: {
        flex: 1, // Fix for scrolling issue
        paddingVertical: 10,
        paddingHorizontal: 15,
    },
    walletsSection: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
        color: Colors.light.text,
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 1,
    },
    greeting: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'Prompt_500Medium',
    },
    title: {
        fontSize: 27,
        fontFamily: 'Prompt_700Bold',
        color: Colors.light.text,
    },
    addButton: {
        backgroundColor: Colors.light.tint,
        width: 48,
        height: 48,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: Colors.light.tint,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    iconButton: {
        backgroundColor: '#fff',
        width: 48,
        height: 48,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
    },
    summaryCardWrapper: {
        borderRadius: 28,
        marginBottom: 10,
        elevation: 12,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        overflow: 'hidden',
    },
    decorCircle1: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: '#FFFFFF26',
        top: -60,
        right: -40,
    },
    decorCircle2: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFFFFF1A',
        bottom: -30,
        left: -20,
    },
    decorCircle3: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FFFFFF14',
        top: 60,
        left: 120,
    },

    glassOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFFFFF0D',
    },
    cardContent: {
        padding: 22,
        flex: 1,
        justifyContent: 'space-between',
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    currencySymbol: {
        color: '#ffffff9d',
        fontFamily: 'Prompt_600SemiBold',
        marginRight: 4,
    },
    cardContentCollapsed: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
    },
    collapsedBalance: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    currencySmall: {
        color: '#FFFFFFE6',
        fontSize: 14,
        fontFamily: 'Prompt_600SemiBold',
        marginRight: 2,
    },
    labelCollapsed: {
        color: '#FFFFFFD9',
        fontSize: 12,
        fontFamily: 'Prompt_700Bold',
        letterSpacing: 1.5,
    },
    balanceTextCollapsed: {
        color: '#fff',
        fontSize: 20,
        fontFamily: 'Prompt_600SemiBold',
        letterSpacing: -0.5,
    },
    label: {
        color: '#FFFFFFBF',
        fontSize: 11,
        fontFamily: 'Prompt_700Bold',
        letterSpacing: 2,
        marginBottom: 6,
    },
    balanceText: {
        color: '#fff',
        fontSize: 32,
        fontFamily: 'Prompt_600SemiBold',
        letterSpacing: -1,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 30,
    },
    statItem: {
        alignItems: 'flex-start',
    },
    subLabel: {
        color: '#ffffffcb',
        fontSize: 10,
        fontFamily: 'Prompt_600SemiBold',
        marginBottom: 4,
    },
    amountText: {
        color: '#FFFFFFCC',
        fontSize: 15,
        fontFamily: 'Prompt_400Regular',
    },
    balanceDecimal: {
        fontSize: 20,
        fontFamily: 'Prompt_300Light',
        letterSpacing: 0,
        color: '#FFFFFFCC',

    },
    badgeDot: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#EF4444',
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: Colors.light.tint,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontFamily: 'Prompt_700Bold',
    },
});
