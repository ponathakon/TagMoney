import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { formatNumberParts } from '@/utils/formatNumber';
import { Wallet } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface WalletCardProps {
    wallet: Wallet;
    balance: number;
    currencySymbol?: string;
    onPress: () => void;
}

const platformBlur = (children: React.ReactNode) => {
    return (
        <BlurView
            intensity={Platform.OS === 'ios' ? 30 : 20}
            tint="light"
            style={StyleSheet.absoluteFill}
        >
            {children}
        </BlurView>
    );
};

export const WalletCard: React.FC<WalletCardProps> = ({ wallet, balance, currencySymbol = '$', onPress }) => {
    const { t } = useLanguage();
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.9}
            style={[styles.cardWrapper, { shadowColor: wallet.color }]}
        >
            <LinearGradient
                colors={[wallet.color, adjustColor(wallet.color, -40)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}
            >
                {/* Texture / Noise Overlay (Optional - simplified to gradients for now) */}
                <View style={styles.sheen} />

                {/* Glassy Header Background */}
                <View style={styles.glassHeader} />

                <View style={styles.content}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.walletLabel}>{t('current_balance')}</Text>
                            <Text style={styles.walletName} numberOfLines={1}>{t(wallet.name as TranslationKeys)}</Text>
                        </View>
                        <View style={styles.iconCircle}>
                            {platformBlur(
                                <View style={styles.iconCircleInner}>
                                    <Ionicons name={wallet.icon as any} size={20} color="#fff" />
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <View style={styles.chip} />
                        <Text style={styles.balance}>
                            <Text style={styles.currency}>{currencySymbol}</Text>
                            {formatNumberParts(balance).integer}
                            <Text style={styles.balanceDecimal}>.{formatNumberParts(balance).decimal}</Text>
                        </Text>
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};



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
    cardWrapper: {
        marginRight: 10,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    card: {
        width: 220,
        height: 140,
        borderRadius: 24,
        padding: 17,
        overflow: 'hidden',
    },
    sheen: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFFFFF0D',
        transform: [{ rotate: '45deg' }, { translateY: -50 }],
    },
    glassHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        backgroundColor: '#FFFFFF08',
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    walletLabel: {
        color: '#FFFFFFB3',
        fontSize: 10,
        fontFamily: 'Prompt_600SemiBold',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    walletName: {
        color: '#fff',
        fontSize: 15,
        fontFamily: 'Prompt_700Bold',
        letterSpacing: -0.2,
        textShadowColor: '#0000001A',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
        // Platform blur wrapper handles styles
    },
    iconCircleInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF1A', // Fallback /Tint
    },
    footer: {
        justifyContent: 'flex-end',
    },
    chip: {
        width: 32,
        height: 22,
        borderRadius: 6,
        backgroundColor: '#FFFFFF33',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#FFFFFF4D',
    },
    balance: {
        color: '#fff',
        fontSize: 18,
        paddingTop: 12,
        fontFamily: 'Prompt_500Medium',
        letterSpacing: -0.5,
    },
    currency: {
        fontSize: 12,
        color: '#FFFFFFCC',
        fontWeight: '600',
    },
    balanceDecimal: {
        fontSize: 12,
        fontFamily: 'Prompt_300Light',
        color: '#FFFFFFCC',
    },
});
