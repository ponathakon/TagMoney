import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { Wallet } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface WalletSelectorProps {
    wallets: Wallet[];
    selectedWalletId: string | null;
    currencySymbol?: string;
    walletBalances?: Record<string, number>;
    onSelect: (walletId: string) => void;
}

export const WalletSelector: React.FC<WalletSelectorProps> = ({ wallets, selectedWalletId, currencySymbol = '$', walletBalances, onSelect }) => {
    const { t } = useLanguage();
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <Ionicons name="wallet" size={16} color="#6366F1" />
                    </View>
                    <Text style={styles.headerTitle}>{t('select_wallet')}</Text>
                </View>
                <Text style={styles.walletCount}>{wallets.length} {t('wallets').toLowerCase()}</Text>
            </View>

            <View style={styles.grid}>
                {wallets.map((wallet, index) => {
                    const isSelected = selectedWalletId === wallet.id;

                    return (
                        <Animated.View
                            key={wallet.id}
                            entering={FadeInDown.delay(index * 50).springify()}
                            style={styles.walletWrapper}
                        >
                            <TouchableOpacity
                                style={[
                                    styles.walletCard,
                                    isSelected && styles.walletCardActive,
                                    isSelected && {
                                        borderColor: wallet.color,
                                        shadowColor: wallet.color,
                                        shadowOpacity: 0.3,
                                    }
                                ]}
                                onPress={() => onSelect(wallet.id)}
                                activeOpacity={0.7}
                            >
                                {/* Selection indicator */}
                                {isSelected && (
                                    <View style={[styles.selectedBadge, { backgroundColor: wallet.color }]}>
                                        <Ionicons name="checkmark" size={10} color="#fff" />
                                    </View>
                                )}

                                {/* Icon with gradient-like background */}
                                <View style={[
                                    styles.iconContainer,
                                    { backgroundColor: wallet.color + '15' },
                                    isSelected && { backgroundColor: wallet.color + '25' }
                                ]}>
                                    <View style={[styles.iconInner, { backgroundColor: wallet.color + '20' }]}>
                                        <Ionicons
                                            name={wallet.icon as any}
                                            size={24}
                                            color={wallet.color}
                                        />
                                    </View>
                                </View>

                                {/* Wallet name */}
                                <Text
                                    style={[
                                        styles.walletName,
                                        isSelected && { color: wallet.color, fontWeight: '700' }
                                    ]}
                                    numberOfLines={1}
                                >
                                    {t(wallet.name as TranslationKeys)}
                                </Text>

                                {/* Balance display */}
                                <Text style={[
                                    styles.balanceText,
                                    isSelected && { color: wallet.color + 'CC' }
                                ]}>
                                    {currencySymbol}{(walletBalances?.[wallet.id] ?? wallet.initialBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerIconContainer: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#6366F1' + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 15,
        fontFamily: 'Prompt_700Bold',
        color: '#1F2937',
        letterSpacing: -0.3,
    },
    walletCount: {
        fontSize: 12,
        color: '#9CA3AF',
        fontFamily: 'Prompt_500Medium',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -6,
    },
    walletWrapper: {
        width: '33.33%',
        padding: 6,
    },
    walletCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 8,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#F3F4F6',
        backgroundColor: '#FAFAFA',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        position: 'relative',
        overflow: 'hidden',
    },
    walletCardActive: {
        backgroundColor: '#fff',
        borderWidth: 2,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 4,
    },
    selectedBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    iconInner: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    walletName: {
        fontSize: 13,
        fontFamily: 'Prompt_600SemiBold',
        color: '#374151',
        textAlign: 'center',
        letterSpacing: -0.2,
    },
    balanceText: {
        fontSize: 11,
        fontFamily: 'Prompt_500Medium',
        color: '#9CA3AF',
        marginTop: 4,
    },
});
