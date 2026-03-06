import { useLanguage } from '@/context/LanguageContext';
import { AppNotification, generateNotifications, getReadNotificationIds, markNotificationAsRead } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Notifications() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useLanguage();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            const load = async () => {
                setLoading(true);
                const [result, readSet] = await Promise.all([
                    generateNotifications(),
                    getReadNotificationIds(),
                ]);
                setNotifications(result);
                setReadIds(readSet);
                setLoading(false);
            };
            load();
        }, [])
    );

    const handleMarkAsRead = async (id: string) => {
        if (readIds.has(id)) return; // already read
        await markNotificationAsRead(id);
        setReadIds(prev => new Set(prev).add(id));
    };

    const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

    const getTimeAgo = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const getTypeLabel = (type: AppNotification['type']) => {
        switch (type) {
            case 'budget_exceeded': return t('alert');
            case 'budget_warning': return t('warning');
            case 'category_overspend': return t('limit');
            case 'high_expense': return t('insight');
            case 'no_transactions': return t('reminder');
            default: return 'INFO';
        }
    };

    const formatMessage = (key: string, params?: Record<string, string | number>) => {
        let text = t(key as any);
        if (params) {
            Object.keys(params).forEach(k => {
                const val = params[k];
                // Translate the value if a translation exists (e.g. for category names or category-based titles)
                const translatedVal = typeof val === 'string' && t(val as any) !== val ? t(val as any) : val;
                text = text.replace(`{{${k}}}`, String(translatedVal));
            });
        }
        return text;
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('notifications_title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Count Badge */}
                <View style={styles.countRow}>
                    <View style={styles.countBadge}>
                        <Ionicons name="notifications" size={14} color="#6366F1" />
                        <Text style={styles.countText}>
                            {unreadCount} {t('unread')} · {notifications.length} {t('total')}
                        </Text>
                    </View>
                </View>

                {!loading && notifications.length === 0 ? (
                    <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.emptyState}>
                        <View style={styles.emptyIconContainer}>
                            <Ionicons name="checkmark-circle" size={56} color="#10B981" />
                        </View>
                        <Text style={styles.emptyTitle}>{t('all_clear')}</Text>
                        <Text style={styles.emptySubtext}>
                            {t('no_alerts')}
                        </Text>
                    </Animated.View>
                ) : (
                    notifications.map((notification, index) => {
                        const isRead = readIds.has(notification.id);
                        return (
                            <Animated.View
                                key={notification.id}
                                entering={FadeInDown.delay(100 + index * 80).springify()}
                                style={[styles.card, isRead && styles.cardRead]}
                            >
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => handleMarkAsRead(notification.id)}
                                    style={styles.cardTouchable}
                                >
                                    {/* Color accent bar */}
                                    <View style={[styles.accentBar, { backgroundColor: isRead ? '#CBD5E1' : notification.color }]} />

                                    <View style={styles.cardContent}>
                                        {/* Icon + label row */}
                                        <View style={styles.cardHeader}>
                                            <View style={[styles.iconCircle, { backgroundColor: (isRead ? '#94A3B8' : notification.color) + '15' }]}>
                                                <Ionicons
                                                    name={isRead ? 'checkmark-circle' : notification.icon as any}
                                                    size={22}
                                                    color={isRead ? '#94A3B8' : notification.color}
                                                />
                                            </View>
                                            <View style={styles.cardHeaderRight}>
                                                <View style={[styles.typeBadge, { backgroundColor: (isRead ? '#94A3B8' : notification.color) + '15' }]}>
                                                    <Text style={[styles.typeText, { color: isRead ? '#94A3B8' : notification.color }]}>
                                                        {isRead ? t('noted') : getTypeLabel(notification.type)}
                                                    </Text>
                                                </View>
                                                <Text style={styles.timeText}>{getTimeAgo(notification.timestamp)}</Text>
                                            </View>
                                        </View>

                                        {/* Title + message */}
                                        <Text style={[styles.cardTitle, isRead && styles.cardTitleRead]}>{formatMessage(notification.titleKey, notification.messageParams)}</Text>
                                        <Text style={[styles.cardMessage, isRead && styles.cardMessageRead]}>{formatMessage(notification.messageKey, notification.messageParams)}</Text>
                                    </View>
                                </TouchableOpacity>
                            </Animated.View>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    countRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    countBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    countText: {
        fontSize: 13,
        fontFamily: 'Prompt_600SemiBold',
        color: '#6366F1',
    },

    // Cards
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginBottom: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
    },
    cardRead: {
        opacity: 0.55,
        elevation: 0,
        shadowOpacity: 0,
    },
    cardTouchable: {
        flexDirection: 'row',
    },
    accentBar: {
        width: 4,
    },
    cardContent: {
        flex: 1,
        padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardHeaderRight: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginLeft: 12,
    },
    typeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 8,
    },
    typeText: {
        fontSize: 10,
        fontFamily: 'Prompt_700Bold',
        letterSpacing: 1,
    },
    timeText: {
        fontSize: 12,
        fontFamily: 'Prompt_400Regular',
        color: '#94A3B8',
    },
    cardTitle: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: '#1E293B',
        marginBottom: 4,
    },
    cardMessage: {
        fontSize: 14,
        fontFamily: 'Prompt_400Regular',
        color: '#64748B',
        lineHeight: 20,
    },
    cardTitleRead: {
        color: '#94A3B8',
    },
    cardMessageRead: {
        color: '#CBD5E1',
    },

    // Empty state
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
    },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 22,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 15,
        fontFamily: 'Prompt_400Regular',
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 40,
    },
});
