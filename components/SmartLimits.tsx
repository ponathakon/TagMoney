import { Category } from '@/constants/categories';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SmartLimitsProps {
    categories: Category[];
    limits: Record<string, number>;
    expenses: Record<string, number>;
    currencySymbol: string;
    onEdit: () => void;
}

export const SmartLimits = ({ categories, limits, expenses, currencySymbol, onEdit }: SmartLimitsProps) => {
    const limitsList = categories.filter(c => limits[c.id] !== undefined && limits[c.id] > 0);
    const { t } = useLanguage();

    return (
        <View>
            {limitsList.length === 0 ? (
                <TouchableOpacity style={styles.emptyCard} onPress={onEdit} activeOpacity={0.7}>
                    <View style={styles.emptyIcon}>
                        <Ionicons name="shield-checkmark-outline" size={24} color="#94A3B8" />
                    </View>
                    <View>
                        <Text style={styles.emptyTitle}>{t('no_category_limits')}</Text>
                        <Text style={styles.emptyText}>{t('tap_to_control_spending')}</Text>
                    </View>
                </TouchableOpacity>
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {limitsList.map(cat => {
                        const limit = limits[cat.id];
                        const spent = expenses[cat.id] || 0;
                        const percentage = Math.min(spent / limit, 1);
                        const isExceeded = spent > limit;

                        return (
                            <View key={cat.id} style={styles.limitCard}>
                                <View style={[styles.cardBg, { backgroundColor: cat.color + '08' }]} />

                                <View style={styles.cardHeader}>
                                    <View style={[styles.icon, { backgroundColor: cat.color + '20' }]}>
                                        <Ionicons name={cat.icon} size={20} color={cat.color} />
                                    </View>
                                    <View style={[styles.badge, { backgroundColor: isExceeded ? '#FECACA' : '#E0F2FE' }]}>
                                        <Text style={[styles.badgeText, { color: isExceeded ? '#DC2626' : '#0284C7' }]}>
                                            {isExceeded ? t('exceeded') : `${Math.round(percentage * 100)}%`}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.catName} numberOfLines={1}>{t(cat.name as TranslationKeys)}</Text>

                                <View style={styles.progressContainer}>
                                    <View style={[styles.progressBar, { width: `${percentage * 100}%`, backgroundColor: isExceeded ? '#EF4444' : cat.color }]} />
                                </View>

                                <View style={styles.cardFooter}>
                                    <Text style={[styles.spent, { color: isExceeded ? '#EF4444' : '#1F2937' }]}>
                                        {currencySymbol}{spent.toLocaleString()}
                                    </Text>
                                    <Text style={styles.limit}>
                                        / {limit.toLocaleString()}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({


    title: {
        fontSize: 20,
        fontFamily: 'Prompt_700Bold',
        color: '#1F2937',
    },
    subtitle: {
        fontSize: 13,
        fontFamily: 'Prompt_400Regular',
        color: '#64748B',
        marginTop: 2,
    },
    emptyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        gap: 16,
    },
    emptyIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: '#334155',
        marginBottom: 2,
    },
    emptyText: {
        fontSize: 13,
        color: '#94A3B8',
        fontFamily: 'Prompt_500Medium',
    },
    scrollContent: {
        paddingRight: 20,
        marginBottom: 10,
    },
    limitCard: {
        width: 160,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 24,
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        overflow: 'hidden',
    },
    cardBg: {
        ...StyleSheet.absoluteFillObject,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    icon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 10,
        fontFamily: 'Prompt_700Bold',
    },
    catName: {
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: '#334155',
        marginBottom: 10,
    },
    progressContainer: {
        height: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 3,
        marginBottom: 8,
    },
    progressBar: {
        height: '100%',
        borderRadius: 3,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    spent: {
        fontSize: 16,
        fontFamily: 'Prompt_700Bold',
        marginRight: 4,
    },
    limit: {
        fontSize: 12,
        color: '#94A3B8',
        fontFamily: 'Prompt_500Medium',
    },
});
