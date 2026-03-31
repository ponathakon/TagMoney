import { Category, INITIAL_CATEGORIES } from '@/constants/categories';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { addCategory, deleteCategory, getCategories, saveCategories } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Dimensions,
    Keyboard,
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
import Animated, { Extrapolation, FadeInDown, FadeInUp, FadeOutDown, SlideInDown, SlideOutDown, interpolate, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const ICON_OPTIONS: (keyof typeof Ionicons.glyphMap)[] = [
    'cash-outline', 'cart-outline', 'restaurant-outline', 'bus-outline',
    'home-outline', 'flash-outline', 'medkit-outline', 'game-controller-outline',
    'gift-outline', 'laptop-outline', 'trending-up-outline', 'school-outline',
    'fitness-outline', 'car-outline', 'airplane-outline', 'water-outline' as any,
    'briefcase-outline', 'cafe-outline', 'heart-outline', 'star-outline',
    'book-outline', 'build-outline', 'shirt-outline', 'paw-outline',
    'bicycle-outline', 'bed-outline', 'library-outline', 'trophy-outline'
];

const COLOR_OPTIONS = [
    '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#FF5252',
    '#00BCD4', '#E91E63', '#3F51B5', '#009688', '#FFC107',
    '#607D8B', '#795548', '#673AB7', '#FB8C00', '#CDDC39'
];

function adjustColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export default function CategoriesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useLanguage();

    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

    // Add Modal
    const [modalVisible, setModalVisible] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    // Delete Modal
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

    // Form state
    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState<keyof typeof Ionicons.glyphMap>('cart-outline');
    const [selectedColor, setSelectedColor] = useState('#4CAF50');

    // Hide FAB when keyboard shows
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
        return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    // Swipe-to-dismiss modal
    const modalTranslateY = useSharedValue(0);
    const SCREEN_HEIGHT = Dimensions.get('window').height;
    const DISMISS_THRESHOLD = 120;

    const closeModal = () => setModalVisible(false);

    const modalPanResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gs) => gs.dy > 4 && Math.abs(gs.dy) > Math.abs(gs.dx) * 0.8,
            onPanResponderMove: (_, gs) => {
                if (gs.dy > 0) modalTranslateY.value = gs.dy;
            },
            onPanResponderRelease: (_, gs) => {
                if (gs.dy > DISMISS_THRESHOLD || gs.vy > 0.5) {
                    modalTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, () => {
                        runOnJS(closeModal)();
                    });
                } else {
                    modalTranslateY.value = withSpring(0, { damping: 20, stiffness: 200 });
                }
            },
        })
    ).current;

    const modalAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: modalTranslateY.value }],
    }));

    // Scroll animation for collapsible header
    const scrollY = useSharedValue(0);
    const handleScroll = useAnimatedScrollHandler({
        onScroll: (event) => { scrollY.value = event.contentOffset.y; },
    });

    const cardStyle = useAnimatedStyle(() => ({
        height: interpolate(scrollY.value, [0, 100], [150, 90], Extrapolation.CLAMP),
    }));

    const expandedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [0, 50], [1, 0], Extrapolation.CLAMP),
    }));

    const collapsedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [50, 70], [0, 1], Extrapolation.CLAMP),
    }));

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const storedCats = await getCategories();
        if (storedCats) {
            setCategories(storedCats);
        } else {
            setCategories(INITIAL_CATEGORIES);
            await saveCategories(INITIAL_CATEGORIES);
        }
        setLoading(false);
    };

    const stats = useMemo(() => {
        const total = categories.length;
        const income = categories.filter(c => c.type === 'income').length;
        const expense = categories.filter(c => c.type === 'expense').length;
        return { total, income, expense };
    }, [categories]);

    const filteredCategories = useMemo(() => {
        let result = categories;
        if (filter !== 'all') result = result.filter(c => c.type === filter);
        return [...result].sort((a, b) => Number(b.id) - Number(a.id));
    }, [categories, filter]);

    const openAddModal = () => {
        setEditingCategory(null);
        setName('');
        setType('expense');
        setSelectedIcon('cart-outline');
        setSelectedColor('#4CAF50');
        modalTranslateY.value = 0;
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!name.trim()) return;

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
        setName('');
        setModalVisible(false);
    };

    const confirmDelete = (cat: Category) => {
        setCategoryToDelete(cat);
        setDeleteModalVisible(true);
    };

    const executeDelete = async () => {
        if (categoryToDelete) {
            const updated = await deleteCategory(categoryToDelete.id);
            setCategories(updated);
            setDeleteModalVisible(false);
            setCategoryToDelete(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    if (loading) return <SafeAreaView style={styles.container} />;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ width: 40 }} />
                <Text style={styles.headerTitle}>{t('categories')}</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerCloseBtn}>
                    <Ionicons name="close" size={24} color="#8B5CF6" />
                </TouchableOpacity>
            </View>

            {/* Collapsible Stats Card */}
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
                                <Ionicons name="folder" size={18} color="#fff" />
                            </View>
                            <Text style={styles.totalLabel}>{t('overview')}</Text>
                        </View>
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
                    <Animated.View style={[styles.totalCardCollapsed, collapsedStyle]}>
                        <Text style={styles.collapsedLabel}>{t('overview').toUpperCase()}</Text>
                        <View style={styles.collapsedBadgeRow}>
                            <Text style={styles.collapsedAmount}>{stats.total}</Text>
                            <Text style={styles.collapsedUnit}> {t('total')}</Text>
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
                snapToOffsets={[0, 70]}
                decelerationRate="normal"
                snapToEnd={false}
            >
                {/* Section Header with Filter */}
                <Animated.View
                    entering={FadeInDown.delay(200).springify()}
                    style={styles.sectionHeader}
                >
                    <View style={styles.filterRow}>
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
                                    {f === 'all' ? t('all') : f === 'income' ? t('income') : t('expense')}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TouchableOpacity style={styles.addSmallButton} onPress={openAddModal}>
                        <Ionicons name="add" size={18} color="#6366F1" />
                        <Text style={styles.addSmallButtonText}>{t('add')}</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Categories List */}
                {filteredCategories.length > 0 ? (
                    <View style={styles.categoriesList}>
                        {filteredCategories.map((cat, index) => (
                            <Animated.View
                                key={cat.id}
                                entering={FadeInDown.delay(300 + index * 60).springify()}
                            >
                                <TouchableOpacity
                                    style={styles.categoryCard}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.categoryCardInner}>
                                        <View style={[styles.categoryCardDecoration, { backgroundColor: cat.color + '18' }]} />

                                        {/* Delete Button — absolute top-right corner */}
                                        <TouchableOpacity
                                            style={[styles.actionBtnPremium, styles.deleteBtnPremium]}
                                            onPress={() => confirmDelete(cat)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="trash" size={13} color="#EF4444" />
                                        </TouchableOpacity>

                                        <View style={styles.categoryInfoRow}>
                                            <LinearGradient
                                                colors={[cat.color, adjustColor(cat.color, -25)]}
                                                style={styles.categoryIconPremium}
                                            >
                                                <Ionicons name={cat.icon as any} size={20} color="#fff" />
                                            </LinearGradient>
                                            <View>
                                                <Text style={styles.categoryNamePremium}>
                                                    {t(cat.name as TranslationKeys)}
                                                </Text>
                                                <View style={styles.typePillRow}>
                                                    <View style={[
                                                        styles.typePill,
                                                        cat.type === 'income' ? styles.incomePill : styles.expensePill
                                                    ]}>
                                                        <Text style={[
                                                            styles.typeText,
                                                            cat.type === 'income' ? styles.incomeText : styles.expenseText
                                                        ]}>
                                                            {cat.type === 'income' ? t('income') : t('expense')}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            </Animated.View>
                        ))}
                    </View>
                ) : (
                    <Animated.View
                        entering={FadeInDown.delay(300).springify()}
                        style={styles.emptyState}
                    >
                        <View style={styles.emptyIconContainer}>
                            <Ionicons name="folder-open-outline" size={48} color="#D1D5DB" />
                        </View>
                        <Text style={styles.emptyTitle}>{t('no_categories_found')}</Text>
                        <Text style={styles.emptyText}>{t('tap_to_create_category')}</Text>
                        <TouchableOpacity style={styles.emptyButton} onPress={openAddModal}>
                            <Ionicons name="add-circle" size={20} color="#fff" />
                            <Text style={styles.emptyButtonText}>{t('add')}</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </Animated.ScrollView>

            {/* Add/Edit Modal */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback onPress={closeModal}>
                        <View style={StyleSheet.absoluteFill}>
                            {Platform.OS === 'ios' && (
                                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                            )}
                        </View>
                    </TouchableWithoutFeedback>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={styles.keyboardAvoidingView}
                    >
                        <Animated.View
                            entering={SlideInDown.duration(300)}
                            exiting={SlideOutDown.duration(200)}
                            style={[styles.modalContent, modalAnimatedStyle]}
                        >
                            {/* Drag Handle */}
                            <View style={styles.modalHeader} {...modalPanResponder.panHandlers}>
                                <View style={styles.dragIndicator} />
                            </View>

                            <ScrollView
                                style={styles.scrollViewContent}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 100 }}
                            >
                                {/* Preview Card */}
                                <View style={styles.previewSection}>
                                    <LinearGradient
                                        colors={[selectedColor, adjustColor(selectedColor, -35)]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.previewCard}
                                    >
                                        <View style={styles.previewDecor1} />
                                        <View style={styles.previewDecor2} />
                                        <View style={styles.previewContent}>
                                            <View style={styles.previewHeader}>
                                                <View>
                                                    <Text style={styles.previewLabel}>{t('category_type')}</Text>
                                                    <Text style={styles.previewName} numberOfLines={1}>
                                                        {name || t('category_name')}
                                                    </Text>
                                                </View>
                                                <View style={styles.previewIconCircle}>
                                                    <Ionicons name={selectedIcon as any} size={22} color="#fff" />
                                                </View>
                                            </View>
                                            <View style={styles.previewFooter}>
                                                <View style={styles.previewTypePill}>
                                                    <Text style={styles.previewTypeText}>
                                                        {type === 'income' ? t('income') : t('expense')}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    </LinearGradient>
                                </View>

                                {/* Type Selector */}
                                <View style={styles.formSection}>
                                    <Text style={styles.label}>{t('category_type')}</Text>
                                    <View style={styles.typeSelector}>
                                        <TouchableOpacity
                                            style={[styles.typeButton, type === 'income' && styles.typeButtonActive]}
                                            onPress={() => setType('income')}
                                        >
                                            <Text style={[styles.typeButtonText, type === 'income' && styles.activeText]}>{t('income')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.typeButton, type === 'expense' && styles.typeButtonActive]}
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
                                                    selectedIcon === icon && { borderColor: selectedColor, backgroundColor: selectedColor + '15' }
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
                                <View style={[styles.formSection, { marginBottom: 32 }]}>
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

                            {/* FAB Submit Button */}
                            {!isKeyboardVisible && (
                                <Animated.View
                                    entering={FadeInUp.delay(50).springify()}
                                    exiting={FadeOutDown.duration(50)}
                                    style={[styles.fabContainer, { bottom: Math.max(insets.bottom, 20) }]}
                                >
                                    <TouchableOpacity 
                                        style={styles.fab} 
                                        onPress={handleSave} 
                                        activeOpacity={0.85}
                                        disabled={!name.trim()}
                                    >
                                        <LinearGradient
                                            colors={name.trim() ? ['#6366F1', '#8B5CF6'] : ['#E2E8F0', '#CBD5E1']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.fabGradient}
                                        >
                                            <Ionicons name="add" size={22} color={name.trim() ? "#fff" : "#94A3B8"} style={{ marginRight: 6 }} />
                                            <Text style={[styles.fabText, !name.trim() && { color: "#94A3B8" }]}>{t('new_category')}</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </Animated.View>
                            )}
                        </Animated.View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Delete Confirmation Modal */}
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
                                <View style={styles.deleteIconBg}>
                                    <Ionicons name="trash" size={32} color="#EF4444" />
                                </View>
                                <Text style={styles.deleteModalTitle}>{t('delete_category')}</Text>
                                <Text style={styles.deleteModalText}>{t('delete_category_confirm')}</Text>

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
        </SafeAreaView>
    );
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
        backgroundColor: '#F5F3FF',
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
        padding: 20,
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
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 26,
        fontFamily: 'Prompt_700Bold',
        color: '#fff',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        fontFamily: 'Prompt_500Medium',
        color: 'rgba(255,255,255,0.7)',
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    totalCardCollapsed: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
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
    collapsedBadgeRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    collapsedAmount: {
        fontSize: 22,
        fontFamily: 'Prompt_700Bold',
        color: '#fff',
    },
    collapsedUnit: {
        fontSize: 13,
        fontFamily: 'Prompt_400Regular',
        color: 'rgba(255,255,255,0.7)',
    },

    // Section Header
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        flex: 1,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
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
        fontSize: 12,
        fontFamily: 'Prompt_600SemiBold',
        color: '#64748B',
    },
    filterLabelActive: {
        color: '#fff',
    },
    addSmallButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#6366F1',
        backgroundColor: '#EEF2FF',
        marginLeft: 8,
    },
    addSmallButtonText: {
        fontSize: 13,
        fontFamily: 'Prompt_600SemiBold',
        color: '#6366F1',
    },

    // Category Cards (wallet-style)
    categoriesList: {
        gap: 12,
    },
    categoryCard: {
        borderRadius: 20,
        backgroundColor: '#fff',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
        overflow: 'hidden',
    },
    categoryCardInner: {
        padding: 16,
    },
    categoryCardDecoration: {
        position: 'absolute',
        top: -15,
        right: -15,
        width: 72,
        height: 72,
        borderRadius: 36,
    },
    categoryCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    categoryInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        flex: 1,
    },
    categoryIconPremium: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryNamePremium: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: '#1E293B',
        marginBottom: 4,
    },
    typePillRow: {
        flexDirection: 'row',
    },
    typePill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    incomePill: {
        backgroundColor: '#ECFDF5',
    },
    expensePill: {
        backgroundColor: '#FEF2F2',
    },
    typeText: {
        fontSize: 10,
        fontFamily: 'Prompt_600SemiBold',
    },
    incomeText: {
        color: '#059669',
    },
    expenseText: {
        color: '#DC2626',
    },
    actionBtnPremium: {
        position: 'absolute',
        top: 10,
        right: 10,
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

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_600SemiBold',
        color: '#1E293B',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#64748B',
        fontFamily: 'Prompt_400Regular',
        marginBottom: 24,
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#6366F1',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 14,
    },
    emptyButtonText: {
        color: '#fff',
        fontFamily: 'Prompt_600SemiBold',
        fontSize: 15,
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
        alignItems: 'center',
        paddingVertical: 14,
    },
    dragIndicator: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E2E8F0',
    },
    scrollViewContent: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 8,
    },

    // Preview Card (wallet-style)
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
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: 'rgba(255,255,255,0.12)',
        top: -40,
        right: -30,
    },
    previewDecor2: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.08)',
        bottom: -20,
        left: -20,
    },
    previewContent: {
        flex: 1,
        padding: 20,
        justifyContent: 'space-between',
    },
    previewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    previewLabel: {
        fontSize: 12,
        fontFamily: 'Prompt_400Regular',
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 4,
    },
    previewName: {
        fontSize: 20,
        fontFamily: 'Prompt_700Bold',
        color: '#fff',
    },
    previewIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewFooter: {
        flexDirection: 'row',
    },
    previewTypePill: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    previewTypeText: {
        fontSize: 12,
        fontFamily: 'Prompt_600SemiBold',
        color: '#fff',
    },

    // Form
    formSection: {
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontFamily: 'Prompt_600SemiBold',
        color: '#4B5563',
        marginBottom: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
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
        fontFamily: 'Prompt_400Regular',
    },

    // Type Selector
    typeSelector: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        padding: 4,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
    },
    typeButtonActive: {
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
        backgroundColor: '#F8FAFC',
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

    // Delete Modal
    deleteModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    deleteModalContentWrapper: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    deleteIconBg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    deleteModalTitle: {
        fontSize: 20,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
        marginBottom: 8,
        textAlign: 'center',
    },
    deleteModalText: {
        fontSize: 14,
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
        height: 50,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteCancelBtnText: {
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: '#475569',
    },
    deleteConfirmBtn: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteConfirmBtnText: {
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: '#fff',
    },
});
