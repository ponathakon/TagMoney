import { getCurrencyByCode } from '@/constants/currencies';
import { WALLET_COLORS, WALLET_ICONS } from '@/constants/wallets';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { formatNumberParts } from '@/utils/formatNumber';
import { addWallet, deleteWallet, getCurrency, getWalletBalance, getWallets, updateWallet } from '@/utils/storage';
import { Wallet } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
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
import Animated, { Extrapolation, FadeInDown, FadeInUp, SlideInDown, SlideOutDown, interpolate, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


export default function Wallets() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useLanguage();
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [balances, setBalances] = useState<{ [key: string]: number }>({});
    const [modalVisible, setModalVisible] = useState(false);
    const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
    const [totalBalance, setTotalBalance] = useState(0);
    const [currencySymbol, setCurrencySymbol] = useState('$');
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [walletToDelete, setWalletToDelete] = useState<Wallet | null>(null);

    // Form state
    const [walletName, setWalletName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(WALLET_ICONS[0]);
    const [selectedColor, setSelectedColor] = useState(WALLET_COLORS[0]);
    const [initialBalance, setInitialBalance] = useState('0');

    // Swipe-to-dismiss: Reanimated shared value for translateY
    const modalTranslateY = useSharedValue(0);
    const SCREEN_HEIGHT = Dimensions.get('window').height;
    const DISMISS_THRESHOLD = 120;

    const closeModal = () => setModalVisible(false);

    const modalPanResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
            onPanResponderMove: (_, gs) => {
                // Only allow dragging downward (positive dy)
                if (gs.dy > 0) {
                    modalTranslateY.value = gs.dy;
                }
            },
            onPanResponderRelease: (_, gs) => {
                if (gs.dy > DISMISS_THRESHOLD || gs.vy > 0.5) {
                    // Slide out and close
                    modalTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, () => {
                        runOnJS(closeModal)();
                    });
                } else {
                    // Snap back
                    modalTranslateY.value = withSpring(0, { damping: 20, stiffness: 200 });
                }
            },
        })
    ).current;

    const modalAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: modalTranslateY.value }],
    }));

    useEffect(() => {
        loadWallets();
    }, []);

    const loadWallets = async () => {
        const walletsData = await getWallets();
        setWallets(walletsData);

        // Load balances for each wallet
        const balanceData: { [key: string]: number } = {};
        let total = 0;
        for (const wallet of walletsData) {
            const balance = await getWalletBalance(wallet.id);
            balanceData[wallet.id] = balance;
            total += balance;
        }
        setBalances(balanceData);
        setTotalBalance(total);

        // Load currency preference
        const currencyCode = await getCurrency();
        setCurrencySymbol(getCurrencyByCode(currencyCode).symbol);
    };

    const openAddModal = () => {
        setEditingWallet(null);
        setWalletName('');
        setSelectedIcon(WALLET_ICONS[0]);
        setSelectedColor(WALLET_COLORS[0]);
        setInitialBalance('0');
        modalTranslateY.value = 0;
        setModalVisible(true);
    };

    const openEditModal = (wallet: Wallet) => {
        setEditingWallet(wallet);
        setWalletName(wallet.name);
        setSelectedIcon(wallet.icon);
        setSelectedColor(wallet.color);
        setInitialBalance(wallet.initialBalance.toString());
        modalTranslateY.value = 0;
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!walletName.trim()) {
            Alert.alert(t('error'), t('wallet_name_placeholder'));
            return;
        }

        const balance = parseFloat(initialBalance) || 0;

        if (editingWallet) {
            const updatedWallet: Wallet = {
                ...editingWallet,
                name: walletName,
                icon: selectedIcon,
                color: selectedColor,
                initialBalance: balance
            };
            await updateWallet(updatedWallet);
        } else {
            const newWallet: Wallet = {
                id: `wallet-${Date.now()}`,
                name: walletName,
                icon: selectedIcon,
                color: selectedColor,
                initialBalance: balance,
                createdAt: new Date().toISOString()
            };
            await addWallet(newWallet);
        }

        setModalVisible(false);
        loadWallets();
    };

    const confirmDelete = (wallet: Wallet) => {
        setWalletToDelete(wallet);
        setDeleteModalVisible(true);
    };

    const executeDelete = async () => {
        if (walletToDelete) {
            await deleteWallet(walletToDelete.id);
            setDeleteModalVisible(false);
            setWalletToDelete(null);
            loadWallets();
        }
    };


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
                [0, 100],
                [160, 100],
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

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ width: 40 }} />
                <Text style={styles.headerTitle}>{t('wallets')}</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.headerCloseBtn}
                >
                    <Ionicons name="close" size={24} color="#8B5CF6" />
                </TouchableOpacity>
            </View>

            {/* Collapsible Total Balance Card */}
            <View style={styles.headerCardWrapper}>
                <Animated.View style={[styles.totalCardAnimated, cardStyle]}>
                    <LinearGradient
                        colors={['#6366F1', '#8B5CF6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.totalCardDecor1} />
                    <View style={styles.totalCardDecor2} />

                    {/* Expanded Content */}
                    <Animated.View style={[styles.totalCardContent, expandedStyle]}>
                        <View style={styles.totalCardHeader}>
                            <View style={styles.totalIconBadge}>
                                <Ionicons name="wallet" size={20} color="#fff" />
                            </View>
                            <Text style={styles.totalLabel}>{t('total_wallets_balance')}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 }}>
                            <Text style={[styles.currencySmall, { fontSize: 17, color: '#ffffff9d', marginRight: 4 }]}>{totalBalance < 0 ? `-${currencySymbol}` : currencySymbol}</Text>
                            <Text style={styles.totalAmount}>
                                {formatNumberParts(totalBalance).integer}
                                <Text style={[styles.balanceDecimal, { fontSize: 19 }]}>.{formatNumberParts(totalBalance).decimal}</Text>
                            </Text>
                        </View>
                        <Text style={styles.walletsCount}>
                            {t('total_wallets_connected').replace('{count}', wallets.length.toString())}
                        </Text>
                    </Animated.View>

                    {/* Collapsed Content */}
                    <Animated.View style={[styles.totalCardCollapsed, collapsedStyle]}>
                        <Text style={styles.collapsedLabel}>{t('current_balance').toUpperCase()}</Text>
                        <View style={styles.collapsedBalance}>
                            <Text style={styles.currencySmall}>{totalBalance < 0 ? `-${currencySymbol}` : currencySymbol}</Text>
                            <Text style={styles.collapsedAmount}>
                                {formatNumberParts(totalBalance).integer}
                                <Text style={[styles.balanceDecimal, { fontSize: 14 }]}>.{formatNumberParts(totalBalance).decimal}</Text>
                            </Text>
                        </View>
                    </Animated.View>
                </Animated.View>
            </View>

            <Animated.ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                snapToOffsets={[0, 100]}
                decelerationRate="normal"

            >
                {/* Section Header */}
                <Animated.View
                    entering={FadeInDown.delay(200).springify()}
                    style={styles.sectionHeader}
                >
                    <View style={styles.sectionTitleRow}>
                        <View style={styles.sectionIconContainer}>
                            <Ionicons name="layers" size={16} color="#6366F1" />
                        </View>
                        <Text style={styles.sectionTitle}>{t('wallets')}</Text>
                    </View>
                    <TouchableOpacity style={styles.addSmallButton} onPress={openAddModal}>
                        <Ionicons name="add" size={18} color="#6366F1" />
                        <Text style={styles.addSmallButtonText}>{t('add')}</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Wallets List */}
                {wallets.length > 0 ? (
                    <View style={styles.walletsList}>
                        {wallets.map((wallet, index) => {
                            const balance = balances[wallet.id] || 0;
                            const isPositive = balance >= 0;

                            return (
                                <Animated.View
                                    key={wallet.id}
                                    entering={FadeInDown.delay(300 + index * 80).springify()}
                                >
                                    <TouchableOpacity
                                        style={styles.walletCard}
                                        onPress={() => openEditModal(wallet)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.walletCardInner}>
                                            <View style={[styles.walletCardDecoration, { backgroundColor: wallet.color + '15' }]} />

                                            <View style={styles.walletCardHeader}>
                                                <View style={styles.walletInfoRow}>
                                                    <LinearGradient
                                                        colors={[wallet.color, adjustColor(wallet.color, -25)]}
                                                        style={styles.walletIconPremium}
                                                    >
                                                        <Ionicons name={wallet.icon as any} size={22} color="#fff" />
                                                    </LinearGradient>
                                                    <View>
                                                        <Text style={styles.walletNamePremium}>{t(wallet.name as TranslationKeys)}</Text>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                            <View style={[styles.statusDot, { backgroundColor: isPositive ? '#10B981' : '#EF4444' }]} />
                                                            <Text style={styles.walletStatusPremium}>
                                                                {isPositive ? t('active_status') : t('negative_status')}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>

                                                <View style={styles.walletActionsPremium}>
                                                    <TouchableOpacity
                                                        style={styles.actionBtnPremium}
                                                        onPress={() => openEditModal(wallet)}
                                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    >
                                                        <Ionicons name="pencil" size={16} color="#9CA3AF" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.actionBtnPremium, styles.deleteBtnPremium]}
                                                        onPress={() => confirmDelete(wallet)}
                                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    >
                                                        <Ionicons name="trash" size={16} color="#EF4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            <View style={styles.walletCardBody}>
                                                <Text style={styles.walletBalanceLabel}>{t('current_balance')}</Text>
                                                <Text style={[
                                                    styles.walletBalancePremium,
                                                    { color: isPositive ? '#1F2937' : '#EF4444' }
                                                ]}>
                                                    <Text style={styles.currencyPremium}>{currencySymbol}</Text>
                                                    {formatNumberParts(balance).integer}
                                                    <Text style={styles.walletDecimalPremium}>.{formatNumberParts(balance).decimal}</Text>
                                                </Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                </Animated.View>
                            );
                        })}
                    </View>
                ) : (
                    <Animated.View
                        entering={FadeInDown.delay(300).springify()}
                        style={styles.emptyState}
                    >
                        <View style={styles.emptyIconContainer}>
                            <Ionicons name="wallet-outline" size={48} color="#D1D5DB" />
                        </View>
                        <Text style={styles.emptyTitle}>{t('no_wallets_found')}</Text>
                        <Text style={styles.emptyText}>
                            {t('create_first_wallet')}
                        </Text>
                        <TouchableOpacity style={styles.emptyButton} onPress={openAddModal}>
                            <Ionicons name="add-circle" size={20} color="#fff" />
                            <Text style={styles.emptyButtonText}>{t('save_wallet')}</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </Animated.ScrollView>



            {/* Add/Edit Modal */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    {/* Touchable Backdrop */}
                    <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
                        <View style={StyleSheet.absoluteFill}>
                            {Platform.OS === 'ios' && (
                                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                            )}
                        </View>
                    </TouchableWithoutFeedback>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.keyboardAvoidingView}
                    >
                        <Animated.View
                            entering={SlideInDown.duration(300)}
                            exiting={SlideOutDown.duration(200)}
                            style={[styles.modalContent, modalAnimatedStyle]}
                        >
                            {/* Modal Header (Drag to Dismiss) */}
                            <View style={styles.modalHeader} {...modalPanResponder.panHandlers}>
                                <View style={styles.dragIndicator} />
                            </View>

                            <ScrollView
                                style={styles.scrollViewContent}
                                showsVerticalScrollIndicator={true}
                                contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
                            >
                                {/* Preview Card */}
                                <View style={styles.previewSection}>
                                    <LinearGradient
                                        colors={[selectedColor, adjustColor(selectedColor, -40)]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.previewCard}
                                    >
                                        {/* Texture / Noise Overlay */}
                                        <View style={styles.sheen} />

                                        {/* Glassy Header Background */}
                                        <View style={styles.glassHeader} />

                                        <View style={styles.previewContent}>
                                            <View style={styles.previewHeader}>
                                                <View>
                                                    <Text style={styles.walletLabel}>{t('current_balance')}</Text>
                                                    <Text style={styles.previewName} numberOfLines={1}>
                                                        {walletName || t('wallet_name')}
                                                    </Text>
                                                </View>
                                                <View style={styles.iconCircle}>
                                                    {Platform.OS === 'ios' ? (
                                                        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill}>
                                                            <View style={styles.iconCircleInner}>
                                                                <Ionicons name={selectedIcon as any} size={20} color="#fff" />
                                                            </View>
                                                        </BlurView>
                                                    ) : (
                                                        <View style={[styles.iconCircleInner, { backgroundColor: '#ffffff33' }]}>
                                                            <Ionicons name={selectedIcon as any} size={20} color="#fff" />
                                                        </View>
                                                    )}
                                                </View>
                                            </View>

                                            <View style={styles.previewFooter}>
                                                <View style={styles.chip} />
                                                <Text style={styles.balance}>
                                                    <Text style={styles.currency}>{currencySymbol}</Text>
                                                    {/* Fix for NaN: Handle empty string or invalid number safely */}
                                                    {(Number(initialBalance) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </Text>
                                            </View>
                                        </View>
                                    </LinearGradient>
                                </View>

                                {/* Form Fields */}
                                <View style={styles.formSection}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>{t('wallet_name')}</Text>
                                        <View style={styles.inputContainer}>
                                            <Ionicons name="text-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                value={walletName}
                                                onChangeText={setWalletName}
                                                placeholder={t('wallet_name_placeholder')}
                                                placeholderTextColor="#9CA3AF"
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>{t('initial_balance')}</Text>
                                        <View style={styles.inputContainer}>
                                            <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                                            <TextInput
                                                style={[styles.input, styles.inputWithPrefix]}
                                                value={initialBalance}
                                                onChangeText={setInitialBalance}
                                                placeholder="0.00"
                                                keyboardType="numeric"
                                                placeholderTextColor="#9CA3AF"
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Icon Selection */}
                                <View style={styles.formSection}>
                                    <Text style={styles.label}>{t('select_icon')}</Text>
                                    <View style={styles.optionsGrid}>
                                        {WALLET_ICONS.map((icon) => (
                                            <TouchableOpacity
                                                key={icon}
                                                style={[
                                                    styles.iconOption,
                                                    selectedIcon === icon && styles.iconOptionSelected,
                                                    selectedIcon === icon && {
                                                        borderColor: selectedColor,
                                                        backgroundColor: selectedColor + '15'
                                                    }
                                                ]}
                                                onPress={() => setSelectedIcon(icon)}
                                            >
                                                <Ionicons
                                                    name={icon as any}
                                                    size={24}
                                                    color={selectedIcon === icon ? selectedColor : '#6B7280'}
                                                />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Color Selection */}
                                <View style={[styles.formSection, { marginBottom: 32 }]}>
                                    <Text style={styles.label}>{t('select_color')}</Text>
                                    <View style={styles.optionsGrid}>
                                        {WALLET_COLORS.map((color) => (
                                            <TouchableOpacity
                                                key={color}
                                                style={[
                                                    styles.colorOption,
                                                    { backgroundColor: color },
                                                    selectedColor === color && styles.colorOptionSelected
                                                ]}
                                                onPress={() => setSelectedColor(color)}
                                            >
                                                {selectedColor === color && (
                                                    <Ionicons name="checkmark" size={22} color="#fff" />
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                            </ScrollView>

                            {/* FAB Submit Button */}
                            <Animated.View
                                entering={FadeInUp.delay(300).springify()}
                                style={[styles.fabContainer, { bottom: Math.max(insets.bottom, 20) }]}
                            >
                                <TouchableOpacity style={styles.fab} onPress={handleSave} activeOpacity={0.85}>
                                    <LinearGradient
                                        colors={['#6366F1', '#8B5CF6']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.fabGradient}
                                    >
                                        <Ionicons name={editingWallet ? "checkmark" : "add"} size={22} color="#fff" style={{ marginRight: 6 }} />
                                        <Text style={styles.fabText}>
                                            {editingWallet ? t('edit_wallet') : t('save_wallet')}
                                        </Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </Animated.View>
                        </Animated.View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Custom Delete Confirmation Modal */}
            <Modal
                visible={deleteModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDeleteModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setDeleteModalVisible(false)}>
                    <View style={styles.deleteModalOverlay}>
                        {Platform.OS === 'ios' && (
                            <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                        )}
                        <TouchableWithoutFeedback>
                            <Animated.View
                                entering={FadeInDown.duration(300).springify()}
                                style={styles.deleteModalContentWrapper}
                            >
                                <View style={styles.deleteIconContainerModal}>
                                    <View style={styles.deleteIconBg}>
                                        <Ionicons name="trash" size={32} color="#EF4444" />
                                    </View>
                                </View>
                                <Text style={styles.deleteModalTitle}>{t('delete_wallet')}</Text>
                                <Text style={styles.deleteModalText}>
                                    {t('delete_wallet_confirm')}
                                </Text>

                                <View style={styles.deleteModalActions}>
                                    <TouchableOpacity
                                        style={styles.deleteCancelBtn}
                                        onPress={() => setDeleteModalVisible(false)}
                                    >
                                        <Text style={styles.deleteCancelBtnText}>{t('cancel')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.deleteConfirmBtn}
                                        onPress={executeDelete}
                                    >
                                        <Text style={styles.deleteConfirmBtnText}>{t('delete')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

// Helper function to darken/lighten colors
function adjustColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 5,
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
        fontFamily: 'Prompt_500Medium',
        color: '#1E293B',
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 100,
    },

    // Collapsible Header Card
    headerCardWrapper: {
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 10,
    },
    totalCardAnimated: {
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
    },
    totalCardCollapsed: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
    },
    collapsedLabel: {
        fontSize: 12,
        fontFamily: 'Prompt_500Medium',
        color: '#fff',
        letterSpacing: 1,
    },
    collapsedBalance: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    currencySmall: {
        color: '#FFFFFFE6',
        fontSize: 14,
        fontFamily: 'Prompt_500Medium',
        marginRight: 2,
    },
    collapsedAmount: {
        fontSize: 24,
        fontFamily: 'Prompt_500Medium',
        color: '#fff',
    },


    // Total Balance Card

    totalCardDecor1: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#ffffff1a',
        top: -50,
        right: -30,
    },
    totalCardDecor2: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#ffffff14',
        bottom: -30,
        left: -20,
    },
    totalCardContent: {
        padding: 15,
    },
    totalCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    totalIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#ffffff33',
        alignItems: 'center',
        justifyContent: 'center',
    },
    totalLabel: {
        fontSize: 13,
        fontFamily: 'Prompt_500Medium',
        color: '#ffffffcc',
        letterSpacing: 0.5,
    },
    totalAmount: {
        fontSize: 29,
        fontFamily: 'Prompt_500Medium',
        color: '#fff',
        letterSpacing: -1,
    },
    balanceDecimal: {
        fontFamily: 'Prompt_400Regular',
        letterSpacing: 0,
        color: '#FFFFFFCC',
    },
    walletsCount: {
        fontSize: 13,
        paddingTop: 4,
        color: '#ffffffb3',
        fontFamily: 'Prompt_400Regular',
    },

    // Section Header
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    sectionIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#6366F1' + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 17,
        fontFamily: 'Prompt_500Medium',
        color: '#1F2937',
        letterSpacing: -0.3,
    },
    addSmallButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#6366F1' + '10',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    addSmallButtonText: {
        fontSize: 13,
        fontFamily: 'Prompt_500Medium',
        color: '#6366F1',
    },

    // Wallets List
    walletsList: {
        gap: 16,
    },
    walletCard: {
        backgroundColor: '#fff',
        borderRadius: 18,
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    walletCardInner: {
        padding: 12,
    },
    walletCardDecoration: {
        position: 'absolute',
        top: -40,
        right: -40,
        width: 120,
        height: 120,
        borderRadius: 60,
        opacity: 0.6,
    },
    walletCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    walletInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    walletIconPremium: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    walletNamePremium: {
        fontSize: 15,
        fontFamily: 'Prompt_500Medium',
        color: '#1E293B',
        letterSpacing: -0.3,
        marginBottom: 0,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    walletStatusPremium: {
        fontSize: 12,
        fontFamily: 'Prompt_400Regular',
        color: '#64748B',
    },
    walletActionsPremium: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtnPremium: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    deleteBtnPremium: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FEE2E2',
    },
    walletCardBody: {
        marginTop: 4,
    },
    walletBalanceLabel: {
        fontSize: 11,
        fontFamily: 'Prompt_500Medium',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    walletBalancePremium: {
        fontSize: 20,
        fontFamily: 'Prompt_500Medium',
        letterSpacing: -0.5,
    },
    currencyPremium: {
        fontSize: 14,
        color: '#94A3B8',
        fontFamily: 'Prompt_500Medium',
    },
    walletDecimalPremium: {
        fontSize: 14,
        color: '#94A3B8',
        fontFamily: 'Prompt_500Medium',
        letterSpacing: -0.5,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
    },
    emptyIconContainer: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontFamily: 'Prompt_500Medium',
        color: '#374151',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#6366F1',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
    },
    emptyButtonText: {
        fontSize: 15,
        fontFamily: 'Prompt_500Medium',
        color: '#fff',
    },

    // FAB
    fabContainer: {
        position: 'absolute',
        right: 20,
    },
    fab: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
    },
    fabGradient: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fabText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Prompt_500Medium',
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: '#0000004d',
        justifyContent: 'flex-end',
    },
    keyboardAvoidingView: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        overflow: 'hidden',
    },
    modalHeader: {
        paddingTop: 12,
        paddingHorizontal: 24,
        paddingBottom: 20,
        backgroundColor: '#fff',
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },


    scrollViewContent: {
        flex: 1,
        paddingHorizontal: 24,
    },

    // Preview - Updated to match WalletCard
    previewSection: {
        alignItems: 'center',
        marginBottom: 28,
    },
    previewCard: {
        width: 280, // Kept slightly larger for preview context
        height: 170, // Kept slightly larger for preview context
        borderRadius: 24,
        padding: 24, // Matched padding scale
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
    },
    sheen: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#ffffff0d',
        transform: [{ rotate: '45deg' }, { translateY: -50 }],
    },
    glassHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 70, // Scaled up slightly from 60
        backgroundColor: '#ffffff08',
    },
    previewContent: {
        flex: 1,
        justifyContent: 'space-between',
    },
    previewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    walletLabel: {
        color: '#ffffffb3',
        fontSize: 11, // Matched/Scaled
        fontFamily: 'Prompt_500Medium',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    previewName: {
        color: '#fff',
        fontSize: 17, // Scaled up slightly from 15
        fontFamily: 'Prompt_500Medium',
        letterSpacing: -0.2,
        textShadowColor: '#0000001a',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    iconCircle: {
        width: 42, // Scaled for preview
        height: 42,
        borderRadius: 21,
        overflow: 'hidden',
    },
    iconCircleInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff1a',
    },
    previewFooter: {
        justifyContent: 'flex-end',
    },
    chip: {
        width: 40, // Scaled
        height: 26,
        borderRadius: 7,
        backgroundColor: '#ffffff33',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#ffffff4d',
    },
    balance: {
        color: '#fff',
        fontSize: 26, // Scaled
        fontFamily: 'Prompt_500Medium',
        letterSpacing: -0.5,
    },
    currency: {
        fontSize: 20, // Scaled
        color: '#ffffffcc',
        fontFamily: 'Prompt_500Medium',
    },

    // Form
    label: {
        fontSize: 14,
        fontFamily: 'Prompt_500Medium',
        color: '#4B5563',
        marginBottom: 10,
        letterSpacing: -0.2,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
        height: 56,
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 10,
    },
    currencyPrefix: {
        fontSize: 18,
        fontFamily: 'Prompt_500Medium',
        color: '#64748B',
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Prompt_400Regular',
        color: '#1E293B',
    },
    inputWithPrefix: {
        paddingLeft: 0,
    },

    // Options Grid
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    iconOption: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    iconOptionSelected: {
        borderWidth: 2,
    },
    colorOption: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    colorOptionSelected: {
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    formSection: {
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 16,
    },
    walletDecimal: {
        letterSpacing: 0,
        fontSize: 13,
        color: '#6B7280',
        fontFamily: 'Prompt_400Regular',
    },


    // Delete Modal
    deleteModalOverlay: {
        flex: 1,
        backgroundColor: '#0000004d',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    deleteModalContentWrapper: {
        backgroundColor: '#fff',
        borderRadius: 28,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    deleteIconContainerModal: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    deleteIconBg: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteModalTitle: {
        fontSize: 20,
        fontFamily: 'Prompt_500Medium',
        color: '#1E293B',
        marginBottom: 8,
        textAlign: 'center',
    },
    deleteModalText: {
        fontSize: 15,
        fontFamily: 'Prompt_400Regular',
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    deleteModalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    deleteCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
    },
    deleteCancelBtnText: {
        fontSize: 15,
        fontFamily: 'Prompt_500Medium',
        color: '#475569',
    },
    deleteConfirmBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: '#EF4444',
        alignItems: 'center',
    },
    deleteConfirmBtnText: {
        fontSize: 15,
        fontFamily: 'Prompt_500Medium',
        color: '#fff',
    }
});
