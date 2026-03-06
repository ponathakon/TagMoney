import { useLanguage } from '@/context/LanguageContext';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');
const SIZE = width * 0.68;
const STROKE_WIDTH = 20;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = RADIUS * Math.PI * 2;
const HALF_CIRCUMFERENCE = CIRCUMFERENCE / 2;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DailyPulseProps {
    spent: number;
    limit: number;
    currencySymbol: string;
}

export const DailyPulse = ({ spent, limit, currencySymbol }: DailyPulseProps) => {
    const hasLimit = limit > 0;
    const progress = hasLimit ? Math.min(spent / limit, 1) : 0;
    const isExceeded = spent > limit && hasLimit;
    const remaining = Math.max(0, limit - spent);
    const { t } = useLanguage();

    // Animation
    const progressValue = useSharedValue(0);

    useEffect(() => {
        progressValue.value = withTiming(progress, { duration: 1000 });
    }, [progress]);

    const animatedProps = useAnimatedProps(() => {
        const strokeDashoffset = HALF_CIRCUMFERENCE - (HALF_CIRCUMFERENCE * progressValue.value);
        return {
            strokeDashoffset,
        };
    });

    const getStatusText = () => {
        if (!hasLimit) return t('set_a_limit');
        if (isExceeded) return t('limit_exceeded');
        if (remaining < limit * 0.2) return t('low_budget');
        return t('safe_to_spend');
    };

    return (
        <View style={styles.container}>
            <View style={styles.chartContainer}>
                <Svg width={SIZE} height={SIZE / 2 + STROKE_WIDTH} viewBox={`0 0 ${SIZE} ${SIZE / 2 + STROKE_WIDTH}`}>
                    <Defs>
                        {/* Gradient for PROGESS */}
                        <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor="#A7F3D0" stopOpacity="1" />
                            <Stop offset="1" stopColor="#34D399" stopOpacity="1" />
                        </LinearGradient>
                        <LinearGradient id="gradExceeded" x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor="#FCA5A5" stopOpacity="1" />
                            <Stop offset="1" stopColor="#F87171" stopOpacity="1" />
                        </LinearGradient>
                    </Defs>

                    {/* Background Arc - Semi-transparent white */}
                    <Circle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth={STROKE_WIDTH}
                        fill="none"
                        strokeDasharray={`${HALF_CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                        strokeLinecap="round"
                        rotation="-180"
                        origin={`${SIZE / 2}, ${SIZE / 2}`}
                    />

                    {/* Progress Arc */}
                    <AnimatedCircle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        stroke={isExceeded ? "url(#gradExceeded)" : "url(#grad)"}
                        strokeWidth={STROKE_WIDTH}
                        fill="none"
                        strokeDasharray={`${HALF_CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                        strokeLinecap="round"
                        rotation="-180"
                        origin={`${SIZE / 2}, ${SIZE / 2}`}
                        animatedProps={animatedProps}
                    />
                </Svg>

                <View style={styles.centerContent}>
                    <Text style={styles.label}>{t('todays_left')}</Text>
                    {hasLimit ? (
                        <>
                            <Text style={styles.remaining}>
                                {currencySymbol}{Math.round(remaining).toLocaleString()}
                            </Text>
                            <View style={[
                                styles.statusBadge,
                                { backgroundColor: isExceeded ? 'rgba(254, 202, 202, 0.2)' : 'rgba(167, 243, 208, 0.2)' }
                            ]}>
                                <Text style={[
                                    styles.status,
                                    { color: isExceeded ? '#FECACA' : '#D1FAE5' }
                                ]}>
                                    {getStatusText()}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <Text style={styles.noLimit}>{t('no_limit')}</Text>
                    )}
                </View>
            </View>

            <View style={styles.footer}>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t('spent')}</Text>
                    <Text style={styles.statValue}>{currencySymbol}{spent.toLocaleString()}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t('limit_label')}</Text>
                    <Text style={styles.statValue}>{hasLimit ? `${currencySymbol}${limit.toLocaleString()}` : '-'}</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    chartContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: -20, // Pull text up
    },
    centerContent: {
        position: 'absolute',
        bottom: 15,
        alignItems: 'center',
    },
    label: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
        fontFamily: 'Prompt_600SemiBold',
        letterSpacing: 1,
        marginBottom: 4,
    },
    remaining: {
        fontSize: 36,
        color: '#fff',
        fontFamily: 'Prompt_800ExtraBold',
        letterSpacing: -1,
        marginBottom: 6,
    },
    noLimit: {
        fontSize: 24,
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'Prompt_700Bold',
        marginTop: 10,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    status: {
        fontSize: 12,
        fontFamily: 'Prompt_600SemiBold',
        letterSpacing: 0.5,
    },
    footer: {
        flexDirection: 'row',
        width: '80%',
        marginTop: 30,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    statItem: {
        alignItems: 'center',
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    statLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        fontFamily: 'Prompt_500Medium',
        marginBottom: 2,
    },
    statValue: {
        fontSize: 16,
        color: '#fff',
        fontFamily: 'Prompt_700Bold',
    },
});
