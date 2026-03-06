
import { CURRENCIES, Currency, getCurrencyByCode } from '@/constants/currencies';
import { useLanguage } from '@/context/LanguageContext';
import { LANGUAGES } from '@/i18n';
import {
    StorageKeys,
    getCategories,
    getCurrency,
    getData,
    getWallets,
    removeData,
    saveCurrency
} from '@/utils/storage';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Profile() {
    const { signOut } = useAuth();
    const { user } = useUser();
    const router = useRouter();
    const { t, language, setLanguage } = useLanguage();
    const [currentCurrency, setCurrentCurrency] = useState<Currency>(CURRENCIES[0]);
    const [showCurrencyModal, setShowCurrencyModal] = useState(false);
    const [showLanguageModal, setShowLanguageModal] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadCurrency();
        }, [])
    );

    const loadCurrency = async () => {
        const code = await getCurrency();
        setCurrentCurrency(getCurrencyByCode(code));
    };

    const handleCurrencySelect = async (currency: Currency) => {
        await saveCurrency(currency.code);
        setCurrentCurrency(currency);
        setShowCurrencyModal(false);
    };

    const handleExportData = async () => {
        try {
            setIsExporting(true);
            const transactions = await getData(StorageKeys.TRANSACTIONS);
            const wallets = await getWallets();
            const categories = await getCategories();

            if (!transactions || transactions.length === 0) {
                Alert.alert(t('no_data'), t('no_transactions_export'));
                setIsExporting(false);
                return;
            }

            // Create CSV content
            const header = 'Date,Title,Amount,Type,Category,Wallet\n';
            const rows = transactions.map((t: any) => {
                const walletName = wallets.find(w => w.id === t.walletId)?.name || 'Unknown';
                const category = categories?.find(c => c.id === t.categoryId);
                const categoryName = category?.name || 'Uncategorized';
                return `${t.date},"${t.title}",${t.amount},${t.type},${categoryName},${walletName}`;
            }).join('\n');

            const csvContent = header + rows;
            const filename = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
            const fileUri = FileSystem.documentDirectory + filename;

            await FileSystem.writeAsStringAsync(fileUri, csvContent, {
                encoding: 'utf8',
            });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
            } else {
                Alert.alert(t('error'), t('sharing_unavailable'));
            }
        } catch (error) {
            console.error('Export error:', error);
            Alert.alert(t('error'), t('export_failed'));
        } finally {
            setIsExporting(false);
        }
    };

    const handleClearData = () => {
        Alert.alert(
            t('clear_data_title'),
            t('clear_data_message'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('reset'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeData(StorageKeys.TRANSACTIONS);
                            Alert.alert(t('success'), t('all_data_reset'));
                            router.replace('/');
                        } catch (e) {
                            Alert.alert(t('error'), t('failed_clear'));
                        }
                    }
                }
            ]
        );
    };

    const onSignOutPress = async () => {
        try {
            await signOut();
            router.replace('/(sign)/sign-in');
        } catch (err: any) {
            console.error('Error signing out:', err);
        }
    };

    return (
        <View style={styles.container}>
            {/* Background Gradient */}
            <LinearGradient
                colors={['#F8FAFC', '#F1F5F9']}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.content}>
                {/* Custom Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('my_profile')}</Text>

                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {/* User Profile Card */}
                    <View style={styles.profileSection}>
                        <View style={styles.avatarContainer}>
                            <LinearGradient
                                colors={['#6366F1', '#8B5CF6']}
                                style={styles.avatarGradient}
                            >
                                {user?.imageUrl ? (
                                    <View style={styles.avatarInner}>
                                        <Image
                                            source={{ uri: user.imageUrl }}
                                            style={styles.avatarImage}
                                            contentFit="cover"
                                            transition={1000}
                                        />

                                    </View>
                                ) : (
                                    <View style={styles.avatarInner}>
                                        <Text style={styles.avatarInitial}>
                                            {user?.firstName ? user.firstName[0] : user?.username ? user.username[0] : 'U'}
                                        </Text>
                                    </View>
                                )}
                            </LinearGradient>
                            <View style={styles.badgeContainer}>
                                <LinearGradient
                                    colors={['#F59E0B', '#D97706']}
                                    style={styles.proBadge}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Text style={styles.proText}>PRO</Text>
                                </LinearGradient>
                            </View>
                        </View>

                        <Text style={styles.userName}>{user?.fullName || user?.username || 'User'}</Text>
                        <Text style={styles.userEmail}>{user?.primaryEmailAddress?.emailAddress}</Text>
                    </View>

                    {/* Settings Sections */}
                    <View style={styles.settingsGroup}>
                        <Text style={styles.sectionTitle}>{t('general')}</Text>
                        <View style={styles.sectionCard}>
                            <SettingsItem
                                icon="cash-outline"
                                iconColor="#10B981"
                                label={t('currency')}
                                value={`${currentCurrency.symbol} ${currentCurrency.code}`}
                                onPress={() => setShowCurrencyModal(true)}
                            />
                            <View style={styles.separator} />
                            <SettingsItem
                                icon="language-outline"
                                iconColor="#6366F1"
                                label={t('language')}
                                value={LANGUAGES.find(l => l.code === language)?.flag + ' ' + LANGUAGES.find(l => l.code === language)?.label}
                                onPress={() => setShowLanguageModal(true)}
                            />
                            <View style={styles.separator} />
                            <SettingsItem
                                icon="notifications-outline"
                                iconColor="#F59E0B"
                                label={t('notifications')}
                                rightElement={
                                    <Switch
                                        value={notificationsEnabled}
                                        onValueChange={setNotificationsEnabled}
                                        trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
                                        thumbColor={'#fff'}
                                    />
                                }
                            />
                            <View style={styles.separator} />
                        </View>
                    </View>

                    <View style={styles.settingsGroup}>
                        <Text style={styles.sectionTitle}>{t('data_management')}</Text>
                        <View style={styles.sectionCard}>
                            <SettingsItem
                                icon="download-outline"
                                iconColor="#3B82F6"
                                label={t('export_data')}
                                onPress={handleExportData}
                                rightElement={isExporting ? <ActivityIndicator size="small" color="#3B82F6" /> : null}
                            />
                            <View style={styles.separator} />
                            <SettingsItem
                                icon="trash-outline"
                                iconColor="#EF4444"
                                label={t('clear_all_data')}
                                onPress={handleClearData}
                                isDestructive
                            />
                        </View>
                    </View>

                    <View style={styles.settingsGroup}>
                        <Text style={styles.sectionTitle}>{t('account')}</Text>
                        <View style={styles.sectionCard}>
                            <SettingsItem
                                icon="log-out-outline"
                                iconColor="#EF4444"
                                label={t('sign_out')}
                                onPress={onSignOutPress}
                                isDestructive
                            />
                        </View>
                    </View>

                    <Text style={styles.versionText}>{t('version')} 1.0.0 • Build 15</Text>
                </ScrollView>
            </SafeAreaView>

            {/* Currency Modal */}
            <Modal
                visible={showCurrencyModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowCurrencyModal(false)}
            >
                <View style={styles.modalOverlay}>
                    {Platform.OS === 'ios' && (
                        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                    )}
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('select_currency')}</Text>
                            <TouchableOpacity onPress={() => setShowCurrencyModal(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.currencyList}>
                            {CURRENCIES.map((currency) => (
                                <TouchableOpacity
                                    key={currency.code}
                                    style={[
                                        styles.currencyItem,
                                        currentCurrency.code === currency.code && styles.currencyItemSelected
                                    ]}
                                    onPress={() => handleCurrencySelect(currency)}
                                >
                                    <View style={styles.currencyInfo}>
                                        <View style={styles.currencyIconContainer}>
                                            <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.currencyCode}>{currency.code}</Text>
                                            <Text style={styles.currencyName}>{currency.name}</Text>
                                        </View>
                                    </View>
                                    {currentCurrency.code === currency.code && (
                                        <Ionicons name="checkmark-circle" size={24} color="#6366F1" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Language Modal */}
            <Modal
                visible={showLanguageModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowLanguageModal(false)}
            >
                <View style={styles.modalOverlay}>
                    {Platform.OS === 'ios' && (
                        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                    )}
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('select_language')}</Text>
                            <TouchableOpacity onPress={() => setShowLanguageModal(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.currencyList}>
                            {LANGUAGES.map((lang) => (
                                <TouchableOpacity
                                    key={lang.code}
                                    style={[
                                        styles.currencyItem,
                                        language === lang.code && styles.currencyItemSelected
                                    ]}
                                    onPress={() => {
                                        setLanguage(lang.code);
                                        setShowLanguageModal(false);
                                    }}
                                >
                                    <View style={styles.currencyInfo}>
                                        <View style={styles.currencyIconContainer}>
                                            <Text style={styles.langFlag}>{lang.flag}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.currencyCode}>{lang.label}</Text>
                                            <Text style={styles.currencyName}>{lang.code.toUpperCase()}</Text>
                                        </View>
                                    </View>
                                    {language === lang.code && (
                                        <Ionicons name="checkmark-circle" size={24} color="#6366F1" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

interface SettingsItemProps {
    icon: any;
    iconColor: string;
    label: string;
    value?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    isDestructive?: boolean;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
    icon,
    iconColor,
    label,
    value,
    onPress,
    rightElement,
    isDestructive
}) => (
    <TouchableOpacity
        style={styles.settingsItem}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.7}
    >
        <View style={styles.settingsItemLeft}>
            <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
                <Ionicons name={icon} size={20} color={iconColor} />
            </View>
            <Text style={[styles.settingsLabel, isDestructive && styles.destructiveLabel]}>
                {label}
            </Text>
        </View>
        <View style={styles.settingsItemRight}>
            {value && <Text style={styles.settingsValue}>{value}</Text>}
            {rightElement}
            {!rightElement && onPress && (
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            )}
        </View>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 10,
        marginBottom: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    profileSection: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 10,
    },
    avatarContainer: {
        marginBottom: 16,
        position: 'relative',
    },
    avatarGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    avatarInner: {
        width: 94,
        height: 94,
        borderRadius: 47,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: 94,
        height: 94,
        borderRadius: 47,
    },
    avatarInitial: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#6366F1',
    },
    badgeContainer: {
        position: 'absolute',
        bottom: -6,
        alignSelf: 'center',
    },
    proBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#fff',
    },
    proText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.5,
    },
    userName: {
        fontSize: 24,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 14,
        color: '#64748B',
        fontFamily: 'Prompt_500Medium',
    },
    settingsGroup: {
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 13,
        fontFamily: 'Prompt_600SemiBold',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        marginLeft: 4,
    },
    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    settingsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    settingsItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingsLabel: {
        fontSize: 16,
        fontFamily: 'Prompt_500Medium',
        color: '#334155',
    },
    destructiveLabel: {
        color: '#EF4444',
    },
    settingsItemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    settingsValue: {
        fontSize: 14,
        color: '#64748B',
        fontFamily: 'Prompt_500Medium',
    },
    separator: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginLeft: 62,
    },
    versionText: {
        textAlign: 'center',
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 10,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
    },
    closeButton: {
        padding: 4,
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
    },
    currencyList: {
        padding: 24,
    },
    currencyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    currencyItemSelected: {
        backgroundColor: '#EEF2FF',
        borderColor: '#6366F1',
    },
    currencyInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    currencyIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    currencySymbol: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    currencyCode: {
        fontSize: 16,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
        marginBottom: 2,
    },
    currencyName: {
        fontSize: 13,
        color: '#64748B',
    },
    langFlag: {
        fontSize: 24,
    },
});
