import { useLanguage } from '@/context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface MonthlyMarathonProps {
    spent: number;
    limit: number;
    currencySymbol: string;
}

export const MonthlyMarathon = ({ spent, limit, currencySymbol }: MonthlyMarathonProps) => {
    const hasLimit = limit > 0;
    const progress = hasLimit ? Math.min(spent / limit, 1) : 0;
    const { t } = useLanguage();

    // Time elapsed in month
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const timeProgress = currentDay / daysInMonth;

    const progressWidth = useSharedValue(0);

    useEffect(() => {
        progressWidth.value = withTiming(progress, { duration: 1000 });
    }, [progress]);

    const barStyle = useAnimatedStyle(() => {
        return {
            width: `${progressWidth.value * 100}%`,
        };
    });

    const isPacingWell = progress <= timeProgress + 0.01;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <View style={styles.iconBadge}>
                        <Ionicons name="flag" size={18} color="#D946EF" />
                    </View>
                    <View>
                        <Text style={styles.title}>{t('monthly_limit')}</Text>
                        <Text style={styles.subtitle}>{t('keep_pacing')}</Text>
                    </View>
                </View>
                {hasLimit && (
                    <Text style={styles.limitText}>
                        {currencySymbol}{limit.toLocaleString()}
                    </Text>
                )}
            </View>

            {hasLimit ? (
                <>
                    <View style={styles.barContainer}>
                        <View style={styles.bgBar} />
                        <Animated.View style={[styles.fillBar, barStyle, { backgroundColor: progress > 1 ? '#EF4444' : '#E879F9' }]} />

                        {/* Time Marker */}
                        <View style={[styles.timeMarker, { left: `${timeProgress * 100}%` }]}>
                            <View style={styles.timeLine} />
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.spentText}>
                            <Text style={{ color: '#1F2937', fontFamily: 'Prompt_700Bold' }}>{currencySymbol}{spent.toLocaleString()}</Text> {t('spent')}
                        </Text>

                        <View style={[styles.statusBadge, { backgroundColor: isPacingWell ? '#D1FAE5' : '#FEF3C7' }]}>
                            <Text style={[styles.statusText, { color: isPacingWell ? '#059669' : '#D97706' }]}>
                                {isPacingWell ? t('on_track') : t('using_too_fast')}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.timeInfo}>
                        {t('today_is_day').replace('{currentDay}', currentDay.toString()).replace('{daysInMonth}', daysInMonth.toString())}
                    </Text>
                </>
            ) : (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>{t('set_monthly_budget_insights')}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBadge: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: '#FAE8FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 16,
        fontFamily: 'Prompt_700Bold',
        color: '#1F2937',
    },
    subtitle: {
        fontSize: 12,
        color: '#94A3B8',
        fontFamily: 'Prompt_500Medium',
    },
    limitText: {
        fontSize: 14,
        fontFamily: 'Prompt_600SemiBold',
        color: '#64748B',
    },
    barContainer: {
        height: 32,
        justifyContent: 'center',
        marginBottom: 16,
    },
    bgBar: {
        height: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 4,
        width: '100%',
    },
    fillBar: {
        height: 8,
        borderRadius: 4,
        position: 'absolute',
        shadowColor: '#d946ef',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    timeMarker: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        width: 20,
        transform: [{ translateX: -10 }],
    },
    timeLine: {
        height: 20,
        width: 3,
        backgroundColor: '#1E293B',
        borderRadius: 1.5,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    spentText: {
        fontSize: 14,
        color: '#64748B',
        fontFamily: 'Prompt_500Medium',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontFamily: 'Prompt_600SemiBold',
    },
    timeInfo: {
        fontSize: 11,
        color: '#94A3B8',
        fontFamily: 'Prompt_500Medium',
        textAlign: 'center',
    },
    emptyState: {
        paddingVertical: 10,
    },
    emptyText: {
        fontSize: 14,
        color: '#94A3B8',
        fontFamily: 'Prompt_500Medium',
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
