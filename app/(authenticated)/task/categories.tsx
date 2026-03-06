import { Category, INITIAL_CATEGORIES } from '@/constants/categories';
import { Colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { addCategory, deleteCategory, getCategories, getTransactions, saveCategories } from '@/utils/storage';
import { Transaction } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Animated as RNAnimated,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    useWindowDimensions,
    View
} from 'react-native';
import { GestureHandlerRootView, RectButton, Swipeable } from 'react-native-gesture-handler';
import Animated, { Extrapolation, FadeInDown, interpolate, Layout, SlideInDown, SlideOutDown, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enhanced icon set
const ICON_OPTIONS: (keyof typeof Ionicons.glyphMap)[] = [
    'cash-outline', 'cart-outline', 'restaurant-outline', 'bus-outline',
    'home-outline', 'flash-outline', 'medkit-outline', 'game-controller-outline',
    'gift-outline', 'laptop-outline', 'trending-up-outline', 'school-outline',
    'fitness-outline', 'car-outline', 'airplane-outline', 'water-outline' as any,
    'briefcase-outline', 'cafe-outline', 'heart-outline', 'star-outline',
    'book-outline', 'build-outline', 'shirt-outline', 'paw-outline',
    'bicycle-outline', 'bed-outline', 'library-outline', 'trophy-outline'
];

// Modern refined color palette
const COLOR_OPTIONS = [
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#9C27B0', // Purple
    '#FF9800', // Orange
    '#FF5252', // Red
    '#00BCD4', // Cyan
    '#E91E63', // Pink
    '#3F51B5', // Indigo
    '#009688', // Teal
    '#FFC107', // Amber
    '#607D8B', // Blue Grey
    '#795548', // Brown
    '#673AB7', // Deep Purple
    '#FB8C00', // Deep Orange
    '#CDDC39'  // Lime
];

export default function CategoriesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useLanguage();
    const { width } = useWindowDimensions();

    // Data state
    const [categories, setCategories] = useState<Category[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);


    // UI state
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
    const [modalVisible, setModalVisible] = useState(false);

    // Form state
    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState<keyof typeof Ionicons.glyphMap>('cart-outline');
    const [selectedColor, setSelectedColor] = useState('#4CAF50');

    // Scroll animation
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
                [140, 70],
                Extrapolation.CLAMP
            ),
        };
    });

    const expandedStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(
                scrollY.value,
                [0, 40],
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

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        // Load categories
        const storedCats = await getCategories();
        if (storedCats) {
            setCategories(storedCats);
        } else {
            setCategories(INITIAL_CATEGORIES);
            await saveCategories(INITIAL_CATEGORIES);
        }

        // Load transactions for stats
        const storedTrans = await getTransactions(); // or getData(StorageKeys.TRANSACTIONS)
        setTransactions(storedTrans || []);

        setLoading(false);
    };

    // Calculate stats
    const stats = useMemo(() => {
        const total = categories.length;
        const income = categories.filter(c => c.type === 'income').length;
        const expense = categories.filter(c => c.type === 'expense').length;
        return { total, income, expense };
    }, [categories]);

    // Filter categories
    const filteredCategories = useMemo(() => {
        let result = categories;

        if (filter !== 'all') {
            result = result.filter(c => c.type === filter);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(c => c.name.toLowerCase().includes(query));
        }

        // Sort by name
        return result.sort((a, b) => a.name.localeCompare(b.name));
    }, [categories, filter, searchQuery]);

    const handleAddCategory = async () => {
        if (!name.trim()) {
            Alert.alert(t('error'), t('category_name'));
            return;
        }

        const newCategory: Category = {
            id: Date.now().toString(),
            name: name.trim(),
            type,
            icon: selectedIcon,
            color: selectedColor,
        };

        const updated = await addCategory(newCategory);
        setCategories(updated);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Reset and close
        setName('');
        setModalVisible(false);
    };

    const handleDeleteCategory = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            t('delete_category'),
            t('delete_category_confirm'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('delete'),
                    style: 'destructive',
                    onPress: async () => {
                        const updated = await deleteCategory(id);
                        setCategories(updated);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                }
            ]
        );
    };

    const renderRightActions = (id: string, dragX: any) => {
        const trans = dragX.interpolate({
            inputRange: [-100, 0],
            outputRange: [1, 0],
            extrapolate: 'clamp',
        });

        return (
            <RectButton style={styles.deleteAction} onPress={() => handleDeleteCategory(id)}>
                <RNAnimated.View style={{ transform: [{ scale: trans }] }}>
                    <Ionicons name="trash-outline" size={24} color="#fff" />
                </RNAnimated.View>
            </RectButton>
        );
    };

    const renderCategoryItem = ({ item, index }: { item: Category; index: number }) => (
        <Animated.View
            entering={FadeInDown.delay(index * 50).springify()}
            layout={Layout.springify()}
            style={styles.itemWrapper}
        >
            <Swipeable renderRightActions={(p, d) => renderRightActions(item.id, d)}>
                <View style={styles.categoryCard}>
                    <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                        <Ionicons name={item.icon} size={24} color={item.color} />
                    </View>

                    <View style={styles.contentContainer}>
                        <Text style={styles.categoryName} numberOfLines={1}>{t(item.name as TranslationKeys)}</Text>
                        <View style={styles.badgeContainer}>
                            <View style={[
                                styles.typePill,
                                item.type === 'income' ? styles.incomePill : styles.expensePill
                            ]}>
                                <Text style={[
                                    styles.typeText,
                                    item.type === 'income' ? styles.incomeText : styles.expenseText
                                ]}>
                                    {item.type.toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                </View>
            </Swipeable>
        </Animated.View>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.light.tint} />
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ width: 40 }} />
                    <Text style={styles.headerTitle}>{t('categories')}</Text>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.headerCloseBtn}
                    >
                        <Ionicons name="close" size={24} color="#8B5CF6" />
                    </TouchableOpacity>
                </View>

                {/* Collapsible Header */}
                <View style={styles.headerWrapper}>
                    <Animated.View style={[styles.headerCard, cardStyle]}>
                        <LinearGradient
                            colors={['#6366F1', '#8B5CF6', '#A855F7']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.decorCircle1} />
                        <View style={styles.decorCircle2} />

                        {/* Expanded Content */}
                        <Animated.View style={[styles.expandedHeaderContent, expandedStyle]}>
                            <Text style={styles.cardTitle}>{t('overview')}</Text>
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{stats.total}</Text>
                                    <Text style={styles.statLabel}>{t('total')}</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{stats.income}</Text>
                                    <Text style={styles.statLabel}>{t('income')}</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{stats.expense}</Text>
                                    <Text style={styles.statLabel}>{t('expense')}</Text>
                                </View>
                            </View>
                        </Animated.View>

                        {/* Collapsed Content */}
                        <Animated.View style={[styles.collapsedHeaderContent, collapsedStyle]}>
                            <View style={styles.collapsedRow}>
                                <Ionicons name="list" size={20} color="#fff" />
                                <Text style={styles.collapsedTitle}>{t('total_categories').replace('{count}', stats.total.toString())}</Text>
                            </View>
                        </Animated.View>
                    </Animated.View>
                </View>

                {/* Fixed Filters & Search */}
                <View style={styles.fixedHeaderControls}>
                    <View style={styles.filterContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
                            {(['all', 'income', 'expense'] as const).map((f) => (
                                <TouchableOpacity
                                    key={f}
                                    style={[
                                        styles.filterChip,
                                        filter === f && styles.filterChipActive,
                                        filter === f && f === 'income' && styles.incomeChipActive,
                                        filter === f && f === 'expense' && styles.expenseChipActive,
                                    ]}
                                    onPress={() => {
                                        setFilter(f);
                                        Haptics.selectionAsync();
                                    }}
                                >
                                    <Text style={[styles.filterLabel, filter === f && styles.filterLabelActive]}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#9CA3AF" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={t('search_categories')}
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <Animated.FlatList
                    data={filteredCategories}
                    keyExtractor={(item) => item.id}
                    renderItem={renderCategoryItem}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="file-tray-outline" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyTitle}>{t('no_categories_found')}</Text>
                            <Text style={styles.emptyText}>{t('tap_to_create_category')}</Text>
                        </View>
                    }
                />


                {/* FAB */}
                <Animated.View entering={FadeInDown.delay(500).springify()} style={[styles.fabContainer, { bottom: Math.max(insets.bottom, 20) + 20 }]}>
                    <TouchableOpacity
                        style={styles.fab}
                        onPress={() => {
                            setModalVisible(true);
                            Haptics.selectionAsync();
                        }}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={[Colors.light.tint, '#4F46E5']}
                            style={StyleSheet.absoluteFill}
                        />
                        <Ionicons name="add" size={30} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>

                {/* Modal */}
                <Modal
                    visible={modalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setModalVisible(false)}
                >
                    <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
                        <View style={styles.modalOverlay}>
                            {Platform.OS === 'ios' && (
                                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                            )}

                            <TouchableWithoutFeedback>
                                <KeyboardAvoidingView
                                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                                    style={styles.keyboardAvoidingView}
                                >
                                    <Animated.View
                                        entering={SlideInDown.duration(300)}
                                        exiting={SlideOutDown.duration(200)}
                                        style={styles.modalContent}
                                    >
                                        <View style={styles.modalHeader}>
                                            <TouchableOpacity onPress={handleAddCategory} style={styles.headerButton}>
                                                <Ionicons name="checkmark" size={24} color="#6366F1" />
                                            </TouchableOpacity>
                                            <Text style={styles.modalTitle}>{t('new_category')}</Text>
                                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.headerButton}>
                                                <Ionicons name="close" size={24} color="#64748B" />
                                            </TouchableOpacity>
                                        </View>

                                        <ScrollView
                                            style={styles.scrollViewContent}
                                            showsVerticalScrollIndicator={false}
                                            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                                        >
                                            {/* Preview Card */}
                                            <View style={styles.previewSection}>
                                                <LinearGradient
                                                    colors={[selectedColor, adjustColor(selectedColor, -30)]}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                    style={styles.previewCard}
                                                >
                                                    <View style={styles.previewDecor1} />
                                                    <View style={styles.previewDecor2} />
                                                    <View style={styles.previewContent}>
                                                        <View style={styles.previewIconContainer}>
                                                            <Ionicons name={selectedIcon} size={28} color="#fff" />
                                                        </View>
                                                        <Text style={styles.previewName}>
                                                            {name || t('category_name')}
                                                        </Text>
                                                        <View style={[
                                                            styles.previewTypePill,
                                                            type === 'income' ? styles.previewIncomePill : styles.previewExpensePill
                                                        ]}>
                                                            <Text style={[
                                                                styles.previewTypeText,
                                                                type === 'income' ? styles.previewIncomeText : styles.previewExpenseText
                                                            ]}>
                                                                {type.toUpperCase()}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </LinearGradient>
                                            </View>

                                            {/* Type Selector */}
                                            <View style={styles.formSection}>
                                                <Text style={styles.label}>{t('category_type')}</Text>
                                                <View style={styles.typeSelector}>
                                                    <TouchableOpacity
                                                        style={[styles.typeButton, type === 'income' && styles.activeIncome]}
                                                        onPress={() => setType('income')}
                                                    >
                                                        <Text style={[styles.typeButtonText, type === 'income' && styles.activeText]}>{t('income')}</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.typeButton, type === 'expense' && styles.activeExpense]}
                                                        onPress={() => setType('expense')}
                                                    >
                                                        <Text style={[styles.typeButtonText, type === 'expense' && styles.activeText]}>{t('expense')}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {/* Name Input */}
                                            <View style={styles.formSection}>
                                                <View style={styles.inputGroup}>
                                                    <Text style={styles.label}>{t('category_name')}</Text>
                                                    <View style={styles.inputContainer}>
                                                        <Ionicons name="text-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                                                        <TextInput
                                                            style={styles.input}
                                                            value={name}
                                                            onChangeText={setName}
                                                            placeholder={t('category_name_placeholder')}
                                                            placeholderTextColor="#9CA3AF"
                                                        />
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Icon Selection */}
                                            <View style={styles.formSection}>
                                                <Text style={styles.label}>{t('choose_icon')}</Text>
                                                <View style={styles.optionsGrid}>
                                                    {ICON_OPTIONS.map((icon) => (
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
                                                                name={icon}
                                                                size={24}
                                                                color={selectedIcon === icon ? selectedColor : '#6B7280'}
                                                            />
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>

                                            {/* Color Selection */}
                                            <View style={[styles.formSection, { marginBottom: 20 }]}>
                                                <Text style={styles.label}>{t('choose_color')}</Text>
                                                <View style={styles.optionsGrid}>
                                                    {COLOR_OPTIONS.map((color) => (
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
                                    </Animated.View>
                                </KeyboardAvoidingView>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>
            </View>
        </GestureHandlerRootView>
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
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
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
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
    },
    listContent: {
        paddingBottom: 100,
    },

    // Header Card
    headerWrapper: {
        zIndex: 10,
        backgroundColor: '#F8FAFC',
    },
    headerCard: {
        marginHorizontal: 20,
        marginTop: 10,
        marginBottom: 10,
        borderRadius: 24,
        overflow: 'hidden',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
    },
    fixedHeaderControls: {
        backgroundColor: '#F8FAFC',
        zIndex: 9,
        paddingBottom: 10,
    },
    expandedHeaderContent: {
        padding: 24,
        height: '100%',
        justifyContent: 'center',
    },
    collapsedHeaderContent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    collapsedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    collapsedTitle: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Prompt_700Bold',
    },
    decorCircle1: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        top: -40,
        right: -30,
    },
    decorCircle2: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        bottom: -20,
        left: -20,
    },
    cardTitle: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 14,
        fontFamily: 'Prompt_600SemiBold',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        color: '#fff',
        fontSize: 24,
        fontFamily: 'Prompt_700Bold',
        marginBottom: 4,
    },
    statLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        fontFamily: 'Prompt_500Medium',
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },

    // Filters
    filterContainer: {
        marginBottom: 16,
    },
    filterContent: {
        paddingHorizontal: 20,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    filterChipActive: {
        backgroundColor: '#6366F1',
        borderColor: '#6366F1',
    },
    incomeChipActive: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    expenseChipActive: {
        backgroundColor: '#EF4444',
        borderColor: '#EF4444',
    },
    filterLabel: {
        fontSize: 14,
        fontFamily: 'Prompt_600SemiBold',
        color: '#64748B',
    },
    filterLabelActive: {
        color: '#fff',
    },

    // Search
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginBottom: 20,
        paddingHorizontal: 16,
        height: 48,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: '#1E293B',
        fontFamily: 'Prompt_400Regular',
    },

    // List Items
    itemWrapper: {
        marginHorizontal: 20,
        marginBottom: 12,
    },
    categoryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    contentContainer: {
        flex: 1,
    },
    categoryName: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: '#1E293B',
        marginBottom: 4,
    },
    badgeContainer: {
        flexDirection: 'row',
    },
    typePill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    incomePill: {
        backgroundColor: '#ECFDF5',
    },
    expensePill: {
        backgroundColor: '#FEF2F2',
    },
    typeText: {
        fontSize: 10,
        fontFamily: 'Prompt_700Bold',
    },
    incomeText: {
        color: '#059669',
    },
    expenseText: {
        color: '#DC2626',
    },
    deleteAction: {
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        height: '100%',
        borderRadius: 16,
        marginLeft: 10,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_600SemiBold',
        color: '#1E293B',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#64748B',
        fontFamily: 'Prompt_400Regular',
    },

    // FAB
    fabContainer: {
        position: 'absolute',
        right: 20,
        // bottom set via inline style
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        overflow: 'hidden',
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
    },
    scrollViewContent: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 24,
    },

    // Preview
    previewSection: {
        marginBottom: 28,
    },
    previewCard: {
        borderRadius: 20,
        overflow: 'hidden',
        height: 150,
    },
    previewDecor1: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        top: -40,
        right: -30,
    },
    previewDecor2: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        bottom: -20,
        left: -20,
    },
    previewContent: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    previewName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    previewTypePill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    previewIncomePill: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    previewExpensePill: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    previewTypeText: {
        fontSize: 12,
        fontFamily: 'Prompt_600SemiBold',
        color: '#fff',
    },
    previewIncomeText: {
        color: '#fff',
    },
    previewExpenseText: {
        color: '#fff',
    },

    // Form
    formSection: {
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B5563',
        marginBottom: 10,
        letterSpacing: -0.2,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    inputIcon: {
        marginLeft: 14,
    },
    input: {
        flex: 1,
        padding: 16,
        fontSize: 16,
        color: '#1F2937',
    },

    // Type Selector
    typeSelector: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        padding: 4,
        marginBottom: 8,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
    },
    activeIncome: {
        backgroundColor: '#6366F1',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    activeExpense: {
        backgroundColor: '#6366F1',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    typeButtonText: {
        fontSize: 14,
        fontFamily: 'Prompt_600SemiBold',
        color: '#64748B',
    },
    activeText: {
        color: '#fff',
    },

    // Options Grid
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    iconOption: {
        width: 54,
        height: 54,
        borderRadius: 16,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    iconOptionSelected: {
        borderWidth: 2,
    },
    colorOption: {
        width: 54,
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    colorOptionSelected: {
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 6,
    },
});

