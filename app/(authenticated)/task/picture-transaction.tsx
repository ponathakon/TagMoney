import { Category, INITIAL_CATEGORIES } from '@/constants/categories';
import { getCurrencyByCode } from '@/constants/currencies';
import { Colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { ParsedTransaction, parseImagesToTransactions } from '@/utils/imageProcessing';
import { addTransaction, getCategories, getCurrency, getWallets } from '@/utils/storage';
import { Transaction, Wallet } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    FadeInUp,
    SlideInDown,
    SlideOutDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    ZoomIn
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Phase = 'capture' | 'processing' | 'review';

export default function PictureTransaction() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const { t, languageCode } = useLanguage();

    // Phase
    const [phase, setPhase] = useState<Phase>('capture');

    // Image
    const [selectedImages, setSelectedImages] = useState<string[]>([]);

    // Data
    const [categories, setCategories] = useState<Category[]>([]);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [currencySymbol, setCurrencySymbol] = useState('$');
    const [defaultWalletId, setDefaultWalletId] = useState<string | null>(null);

    // Modal state for space-saving selection
    const [editingTxId, setEditingTxId] = useState<string | null>(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Parsed transactions for review
    const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);

    // Processing state
    const [processingElapsed, setProcessingElapsed] = useState(0);
    const cancelledRef = useRef(false);
    const processingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        let cats = await getCategories();
        if (!cats) cats = INITIAL_CATEGORIES;
        setCategories(cats);

        const w = await getWallets();
        setWallets(w);
        if (w.length > 0) setDefaultWalletId(w[0].id);

        const code = await getCurrency();
        setCurrencySymbol(getCurrencyByCode(code).symbol);
    };

    /* ------------------------------------------------------------------ */
    /*  Capture                                                          */
    /* ------------------------------------------------------------------ */

    // Helper to format date display
    const formatDate = (date: Date, t?: any, languageCode: string = 'en-US'): string => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return typeof t === 'function' ? t('today') : 'Today';
        if (date.toDateString() === yesterday.toDateString()) return typeof t === 'function' ? t('yesterday') : 'Yesterday';

        return date.toLocaleDateString(languageCode, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const handleDateChange = (event: any, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (date && editingTxId) {
            updateTransaction(editingTxId, { date });
        }
    };

    const requestPermissions = async () => {
        const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
        const galleryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
        return cameraStatus.status === 'granted' && galleryStatus.status === 'granted';
    };

    const handleCamera = async () => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) {
            Alert.alert('Permission needed', 'Please allow camera access to scan receipts.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
            base64: true,
        });

        handleImageResult(result);
    };

    const handleGallery = async () => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) {
            Alert.alert('Permission needed', 'Please allow gallery access to select receipts.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.5,
            base64: true,
        });

        handleImageResult(result);
    };

    const handleImageResult = async (result: ImagePicker.ImagePickerResult) => {
        if (!result.canceled && result.assets && result.assets.length > 0) {
            const validAssets = result.assets.filter(a => a.base64);
            if (validAssets.length > 0) {
                const uris = validAssets.map(a => a.uri);
                const base64s = validAssets.map(a => a.base64!);
                setSelectedImages(uris);
                setPhase('processing');
                startProcessingTimer();
                startScanAnimation();
                await processImages(base64s);
            } else {
                Alert.alert('Error', 'Could not read image data. Please try again.');
            }
        }
    };

    const startProcessingTimer = () => {
        setProcessingElapsed(0);
        cancelledRef.current = false;
        processingTimerRef.current = setInterval(() => {
            setProcessingElapsed(prev => prev + 1);
        }, 1000);
    };

    const stopProcessingTimer = () => {
        if (processingTimerRef.current) {
            clearInterval(processingTimerRef.current);
            processingTimerRef.current = null;
        }
    };

    // Animations
    const scanAnim = useSharedValue(0);

    const startScanAnimation = () => {
        scanAnim.value = withRepeat(
            withSequence(
                withTiming(210, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    };

    const stopScanAnimation = () => {
        scanAnim.value = 0;
    };

    const scanLineStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: scanAnim.value }]
    }));

    const handleCancelProcessing = () => {
        cancelledRef.current = true;
        stopProcessingTimer();
        stopScanAnimation();
        setPhase('capture');
        setSelectedImages([]);
    };

    const processImages = async (base64Images: string[]) => {
        try {
            // Parse meaning
            const parsed = await parseImagesToTransactions(base64Images, categories, wallets);

            stopProcessingTimer();
            stopScanAnimation();

            // User may have cancelled while waiting
            if (cancelledRef.current) return;

            if (parsed.length === 0) {
                Alert.alert('No transactions detected', 'Please ensure the receipt is clear and try again.');
                setPhase('capture');
                setSelectedImages([]);
                return;
            }

            // Use parser-detected wallet, fall back to default
            const withDefaults = parsed.map(t => ({
                ...t,
                walletId: t.walletId ?? defaultWalletId,
            }));

            setParsedTransactions(withDefaults);
            setPhase('review');
        } catch (err: any) {
            stopProcessingTimer();
            stopScanAnimation();
            if (cancelledRef.current) return;
            console.error('Image processing failed', err);
            Alert.alert(
                t('error'),
                err?.message || 'Could not extract transaction details. Please try again.',
            );
            setPhase('capture');
            setSelectedImages([]);
        }
    };

    /* ------------------------------------------------------------------ */
    /*  Review / Edit                                                      */
    /* ------------------------------------------------------------------ */

    const updateTransaction = (id: string, updates: Partial<ParsedTransaction>) => {
        setParsedTransactions(prev =>
            prev.map(t => (t.id === id ? { ...t, ...updates } : t)),
        );
    };

    const removeTransaction = (id: string) => {
        setParsedTransactions(prev => prev.filter(t => t.id !== id));
    };

    const handleSaveAll = async () => {
        if (parsedTransactions.length === 0) return;

        for (const pt of parsedTransactions) {
            if (pt.amount <= 0) {
                Alert.alert('Invalid', `Please enter a valid amount for "${pt.description}".`);
                return;
            }
        }

        try {
            for (const pt of parsedTransactions) {
                const tx: Transaction = {
                    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
                    title: pt.description || pt.categoryName || 'Picture Transaction',
                    amount: pt.amount,
                    date: pt.date.toISOString(),
                    type: pt.type,
                    categoryId: pt.categoryId ?? undefined,
                    walletId: pt.walletId ?? defaultWalletId ?? undefined,
                };
                await addTransaction(tx);
            }
            router.back();
            setParsedTransactions([]);
            setSelectedImages([]);
            setPhase('capture');
        } catch (err) {
            console.error('Save failed', err);
            Alert.alert('Error', 'Failed to save transactions.');
        }
    };

    const handleRetry = () => {
        setParsedTransactions([]);
        setSelectedImages([]);
        setPhase('capture');
    };

    /* ------------------------------------------------------------------ */
    /*  Render helpers                                                     */
    /* ------------------------------------------------------------------ */

    const getFilteredCategories = (type: 'income' | 'expense') =>
        categories.filter(c => c.type === type);

    const renderCapture = () => (
        <View style={styles.centeredContent}>
            <Animated.View entering={FadeInDown.duration(500)} style={styles.captureCard}>
                <View style={styles.captureIconContainer}>
                    <Ionicons name="receipt-outline" size={48} color="#6366F1" />
                </View>
                <Text style={styles.captureTitle}>{t('picture_transaction')}</Text>
                <Text style={styles.captureSubtitle}>
                    {t('scan_receipt_desc')}
                </Text>

                <View style={styles.captureButtonsRow}>
                    <TouchableOpacity style={styles.captureBtn} onPress={handleCamera}>
                        <LinearGradient
                            colors={['#6366F1', '#8B5CF6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.captureBtnGradient}
                        >
                            <Ionicons name="camera" size={24} color="#fff" />
                            <Text style={styles.captureBtnText}>{t('take_photo')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.captureBtnOutline} onPress={handleGallery}>
                        <Ionicons name="images-outline" size={24} color="#6366F1" />
                        <Text style={styles.captureBtnOutlineText}>{t('gallery')}</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(300)} style={styles.hintsContainer}>
                <Text style={styles.hintTitle}>{t('tips_good_results')}</Text>
                <View style={styles.hintPill}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.hintText}>{t('tip_lighting')}</Text>
                </View>
                <View style={styles.hintPill}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.hintText}>{t('tip_flat')}</Text>
                </View>
                <View style={styles.hintPill}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.hintText}>{t('tip_include_all')}</Text>
                </View>
            </Animated.View>
        </View>
    );

    const renderProcessing = () => (
        <View style={styles.centeredContent}>
            <Animated.View entering={ZoomIn.springify()} style={styles.processingContainer}>
                {selectedImages.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginBottom: 32 }}>
                        {selectedImages.map((img, idx) => (
                            <View key={idx} style={styles.imagePreviewContainer}>
                                <Image source={{ uri: img }} style={styles.imagePreview} />
                                <View style={styles.imageOverlay}>
                                    <Animated.View style={[styles.scanLine, scanLineStyle]} />
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}
                <View style={styles.processingDots}>
                    {[0, 1, 2].map(i => (
                        <Animated.View
                            key={i}
                            entering={FadeIn.delay(i * 200).duration(400)}
                            style={styles.processingDot}
                        />
                    ))}
                </View>
                <Text style={styles.processingText}>{t('analyzing_image')}</Text>
                <Text style={styles.processingSubText}>{t('extracting_details')}</Text>
                <Text style={styles.processingTimer}>{processingElapsed}s</Text>

                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelProcessing}
                >
                    <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );

    const renderReview = () => (
        <View style={styles.reviewContainer}>
            {selectedImages.length > 0 && (
                <Animated.View entering={FadeInDown.delay(100)} style={styles.miniPreviewContainer}>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                        {selectedImages.slice(0, 3).map((img, idx) => (
                            <Image key={idx} source={{ uri: img }} style={styles.miniPreviewImage} />
                        ))}
                        {selectedImages.length > 3 && (
                            <View style={[styles.miniPreviewImage, { backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ fontSize: 12, fontFamily: 'Prompt_600SemiBold', color: '#64748B' }}>+{selectedImages.length - 3}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.miniPreviewInfo}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={styles.miniPreviewText}>{selectedImages.length} Image{selectedImages.length > 1 ? 's' : ''} processed successfully</Text>
                    </View>
                </Animated.View>
            )}

            <Text style={styles.reviewTitle}>
                {parsedTransactions.length} {parsedTransactions.length !== 1 ? t('transactions_found') : t('transaction_found')}
            </Text>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
            >
                <ScrollView
                    style={styles.reviewScroll}
                    contentContainerStyle={{ paddingBottom: 160 }}
                    showsVerticalScrollIndicator={false}
                >
                    {parsedTransactions.map((pt, idx) => (
                        <Animated.View
                            key={pt.id}
                            entering={FadeInDown.delay(200 + idx * 100).springify()}
                            style={styles.txCard}
                        >
                            {/* Delete button */}
                            <TouchableOpacity
                                style={styles.txDeleteBtn}
                                onPress={() => removeTransaction(pt.id)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close-circle" size={22} color="#CBD5E1" />
                            </TouchableOpacity>

                            {/* Type Toggle */}
                            <View style={styles.txTypeRow}>
                                <TouchableOpacity
                                    style={[styles.txTypePill, pt.type === 'expense' && styles.txTypePillActiveExpense]}
                                    onPress={() => updateTransaction(pt.id, {
                                        type: 'expense',
                                        categoryId: null,
                                        categoryName: null,
                                        categoryIcon: null,
                                        categoryColor: null,
                                    })}
                                >
                                    <Text style={[styles.txTypePillText, pt.type === 'expense' && styles.txTypePillTextActive]}>
                                        {t('expense')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.txTypePill, pt.type === 'income' && styles.txTypePillActiveIncome]}
                                    onPress={() => updateTransaction(pt.id, {
                                        type: 'income',
                                        categoryId: null,
                                        categoryName: null,
                                        categoryIcon: null,
                                        categoryColor: null,
                                    })}
                                >
                                    <Text style={[styles.txTypePillText, pt.type === 'income' && styles.txTypePillTextActive]}>
                                        {t('income')}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Amount */}
                            <View style={styles.txAmountRow}>
                                <Text style={styles.txCurrency}>{currencySymbol}</Text>
                                <TextInput
                                    style={styles.txAmountInput}
                                    value={pt.amount.toString()}
                                    onChangeText={v => {
                                        const n = parseFloat(v) || 0;
                                        updateTransaction(pt.id, { amount: n });
                                    }}
                                    keyboardType="numeric"
                                    selectTextOnFocus
                                />
                            </View>

                            {/* Date Selector */}
                            <View style={styles.txDateRow}>
                                <Text style={styles.txSectionLabel}>{t('date')}</Text>
                                <TouchableOpacity
                                    style={styles.dateButtonCompact}
                                    onPress={() => {
                                        setEditingTxId(pt.id);
                                        setShowDatePicker(true);
                                    }}
                                >
                                    <Ionicons name="calendar-outline" size={16} color="#6366F1" />
                                    <Text style={styles.dateTextCompact}>{formatDate(pt.date, t, languageCode)}</Text>
                                    <Ionicons name="chevron-down" size={16} color="#CBD5E1" style={{ marginLeft: 'auto' }} />
                                </TouchableOpacity>
                            </View>

                            {/* Category & Wallet Modal Triggers */}
                            <View style={styles.txSelectorsRow}>
                                <View style={styles.txSelectorColumn}>
                                    <Text style={styles.txSectionLabel}>{t('category')}</Text>
                                    <TouchableOpacity
                                        style={styles.selectorButton}
                                        onPress={() => {
                                            setEditingTxId(pt.id);
                                            setShowCategoryModal(true);
                                        }}
                                    >
                                        {pt.categoryId ? (
                                            <>
                                                <View style={[styles.selectorIconBg, { backgroundColor: (pt.categoryColor || '#94A3B8') + '20' }]}>
                                                    <Ionicons name={(pt.categoryIcon as any) || 'list'} size={16} color={pt.categoryColor || '#94A3B8'} />
                                                </View>
                                                <Text style={styles.selectorTextActive} numberOfLines={1}>{pt.categoryName ? t(pt.categoryName as TranslationKeys) : ''}</Text>
                                            </>
                                        ) : (
                                            <>
                                                <View style={[styles.selectorIconBg, { backgroundColor: '#F1F5F9' }]}>
                                                    <Ionicons name="help" size={16} color="#94A3B8" />
                                                </View>
                                                <Text style={styles.selectorTextInactive}>{t('select')}...</Text>
                                            </>
                                        )}
                                        <Ionicons name="chevron-down" size={16} color="#CBD5E1" style={{ marginLeft: 'auto' }} />
                                    </TouchableOpacity>
                                </View>

                                {wallets.length > 0 && (
                                    <View style={styles.txSelectorColumn}>
                                        <Text style={styles.txSectionLabel}>{t('wallet')}</Text>
                                        <TouchableOpacity
                                            style={styles.selectorButton}
                                            onPress={() => {
                                                setEditingTxId(pt.id);
                                                setShowWalletModal(true);
                                            }}
                                        >
                                            {pt.walletId ? (() => {
                                                const w = wallets.find(x => x.id === pt.walletId);
                                                if (!w) return null;
                                                return (
                                                    <>
                                                        <View style={[styles.selectorIconBg, { backgroundColor: w.color + '20' }]}>
                                                            <Ionicons name={w.icon as any} size={16} color={w.color} />
                                                        </View>
                                                        <Text style={styles.selectorTextActive} numberOfLines={1}>{t(w.name as TranslationKeys)}</Text>
                                                    </>
                                                );
                                            })() : (
                                                <>
                                                    <View style={[styles.selectorIconBg, { backgroundColor: '#F1F5F9' }]}>
                                                        <Ionicons name="wallet-outline" size={16} color="#94A3B8" />
                                                    </View>
                                                    <Text style={styles.selectorTextInactive}>{t('select')}...</Text>
                                                </>
                                            )}
                                            <Ionicons name="chevron-down" size={16} color="#CBD5E1" style={{ marginLeft: 'auto' }} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* Note */}
                            <TextInput
                                style={styles.txNoteInput}
                                value={pt.description}
                                onChangeText={v => updateTransaction(pt.id, { description: v })}
                                placeholder={t('add_note')}
                                placeholderTextColor="#CBD5E1"
                            />
                        </Animated.View>
                    ))}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Footer */}
            <View style={[styles.reviewFooter, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                    <Ionicons name="refresh" size={20} color="#64748B" />
                    <Text style={styles.retryText}>{t('retry')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.saveAllButton, parsedTransactions.length === 0 && styles.saveAllDisabled]}
                    onPress={handleSaveAll}
                    disabled={parsedTransactions.length === 0}
                >
                    <LinearGradient
                        colors={['#10B981', '#14B8A6']} // Emerald to Teal gradient for picture tracker
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.saveAllGradient}
                    >
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.saveAllText}>
                            {t('save_all')} ({parsedTransactions.length})
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Category Modal */}
            <Modal visible={showCategoryModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <Animated.View
                        entering={SlideInDown.duration(300)}
                        exiting={SlideOutDown.duration(200)}
                        style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('select_category')}</Text>
                            <TouchableOpacity onPress={() => setShowCategoryModal(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                            {editingTxId && (() => {
                                const currentTx = parsedTransactions.find(t => t.id === editingTxId);
                                if (!currentTx) return null;
                                return getFilteredCategories(currentTx.type).map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            styles.modalOption,
                                            currentTx.categoryId === cat.id && styles.modalOptionActive
                                        ]}
                                        onPress={() => {
                                            updateTransaction(editingTxId, {
                                                categoryId: cat.id,
                                                categoryName: cat.name,
                                                categoryIcon: cat.icon as string,
                                                categoryColor: cat.color,
                                            });
                                            setShowCategoryModal(false);
                                        }}
                                    >
                                        <View style={[styles.modalOptionIconBg, { backgroundColor: cat.color + '20' }]}>
                                            <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                                        </View>
                                        <Text style={[
                                            styles.modalOptionText,
                                            currentTx.categoryId === cat.id && { color: cat.color, fontFamily: 'Prompt_600SemiBold' }
                                        ]}>{t(cat.name as TranslationKeys)}</Text>
                                        {currentTx.categoryId === cat.id && (
                                            <Ionicons name="checkmark" size={20} color={cat.color} style={{ marginLeft: 'auto' }} />
                                        )}
                                    </TouchableOpacity>
                                ));
                            })()}
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>

            {/* Wallet Modal */}
            <Modal visible={showWalletModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <Animated.View
                        entering={SlideInDown.duration(300)}
                        exiting={SlideOutDown.duration(200)}
                        style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('select_wallet')}</Text>
                            <TouchableOpacity onPress={() => setShowWalletModal(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                            {editingTxId && wallets.map(w => {
                                const currentTx = parsedTransactions.find(t => t.id === editingTxId);
                                const isSelected = currentTx?.walletId === w.id;
                                return (
                                    <TouchableOpacity
                                        key={w.id}
                                        style={[
                                            styles.modalOption,
                                            isSelected && styles.modalOptionActive
                                        ]}
                                        onPress={() => {
                                            updateTransaction(editingTxId, { walletId: w.id });
                                            setShowWalletModal(false);
                                        }}
                                    >
                                        <View style={[styles.modalOptionIconBg, { backgroundColor: w.color + '20' }]}>
                                            <Ionicons name={w.icon as any} size={20} color={w.color} />
                                        </View>
                                        <Text style={[
                                            styles.modalOptionText,
                                            isSelected && { color: w.color, fontFamily: 'Prompt_600SemiBold' }
                                        ]}>{t(w.name as TranslationKeys)}</Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark" size={20} color={w.color} style={{ marginLeft: 'auto' }} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>

            {/* Date Picker Modal (iOS) or Inline (Android) */}
            {Platform.OS === 'ios' ? (
                <Modal visible={showDatePicker} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <Animated.View
                            entering={SlideInDown.duration(300)}
                            exiting={SlideOutDown.duration(200)}
                            style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
                        >
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                    <Text style={styles.modalCancel}>Cancel</Text>
                                </TouchableOpacity>
                                <Text style={styles.modalTitle}>Select Date</Text>
                                <TouchableOpacity onPress={() => {
                                    setShowDatePicker(false);
                                    setEditingTxId(null);
                                }}>
                                    <Text style={styles.modalDone}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={editingTxId ? (parsedTransactions.find(t => t.id === editingTxId)?.date || new Date()) : new Date()}
                                mode="date"
                                display="spinner"
                                onChange={handleDateChange}
                                maximumDate={new Date()}
                            />
                        </Animated.View>
                    </View>
                </Modal>
            ) : (
                showDatePicker && (
                    <DateTimePicker
                        value={editingTxId ? (parsedTransactions.find(t => t.id === editingTxId)?.date || new Date()) : new Date()}
                        mode="date"
                        display="default"
                        onChange={handleDateChange}
                        maximumDate={new Date()}
                    />
                )
            )}
        </View>
    );

    /* ------------------------------------------------------------------ */
    /*  Main render                                                        */
    /* ------------------------------------------------------------------ */

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ width: 40 }} />
                <Text style={styles.headerTitle}>{t('picture_tracker')}</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.headerCloseBtn}
                >
                    <Ionicons name="close" size={24} color="#8B5CF6" />
                </TouchableOpacity>
            </View>

            {phase === 'capture' && renderCapture()}
            {phase === 'processing' && renderProcessing()}
            {phase === 'review' && renderReview()}
        </View>
    );
}

/* ================================================================== */
/*  Styles                                                              */
/* ================================================================== */

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },

    /* Header */
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
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
    },

    /* Centered content */
    centeredContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingBottom: 40,
    },

    /* Capture Phase */
    captureCard: {
        width: '100%',
        backgroundColor: '#F8FAFC',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EEF2FF',
    },
    captureIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    captureTitle: {
        fontSize: 22,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
        marginBottom: 8,
    },
    captureSubtitle: {
        fontSize: 15,
        fontFamily: 'Prompt_400Regular',
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 32,
    },
    captureButtonsRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    captureBtn: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    captureBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
    },
    captureBtnText: {
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: '#fff',
    },
    captureBtnOutline: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#EEF2FF',
        backgroundColor: '#fff',
        gap: 8,
    },
    captureBtnOutlineText: {
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: '#6366F1',
    },

    /* Hints */
    hintsContainer: {
        width: '100%',
        marginTop: 32,
        paddingHorizontal: 16,
    },
    hintTitle: {
        fontSize: 13,
        color: '#94A3B8',
        fontFamily: 'Prompt_600SemiBold',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    hintPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        gap: 10,
    },
    hintText: {
        fontSize: 14,
        color: '#64748B',
        fontFamily: 'Prompt_500Medium',
    },

    /* Processing Phase */
    processingContainer: {
        alignItems: 'center',
    },
    imagePreviewContainer: {
        width: 160,
        height: 220,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 32,
        borderWidth: 4,
        borderColor: '#EEF2FF',
        position: 'relative',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
    },
    scanLine: {
        width: '100%',
        height: 2,
        backgroundColor: '#6366F1',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 5,
    },
    processingDots: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
    },
    processingDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#6366F1',
    },
    processingText: {
        fontSize: 22,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
        marginBottom: 8,
    },
    processingSubText: {
        fontSize: 15,
        fontFamily: 'Prompt_400Regular',
        color: '#94A3B8',
    },

    /* Review Phase */
    reviewContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    miniPreviewContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#EEF2FF',
        gap: 12,
    },
    miniPreviewImage: {
        width: 48,
        height: 48,
        borderRadius: 8,
    },
    miniPreviewInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    miniPreviewText: {
        flex: 1,
        fontSize: 14,
        color: '#64748B',
        fontFamily: 'Prompt_500Medium',
    },
    reviewTitle: {
        fontSize: 20,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
        marginBottom: 16,
    },
    reviewScroll: {
        flex: 1,
    },

    /* Transaction card (Reused heavily from voice tracker) */
    txCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    txDeleteBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
    },
    txTypeRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    txTypePill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    txTypePillActiveExpense: {
        backgroundColor: Colors.light.danger + '15',
        borderColor: Colors.light.danger,
    },
    txTypePillActiveIncome: {
        backgroundColor: Colors.light.success + '15',
        borderColor: Colors.light.success,
    },
    txTypePillText: {
        fontSize: 13,
        fontFamily: 'Prompt_600SemiBold',
        color: '#94A3B8',
    },
    txTypePillTextActive: {
        color: '#1E293B',
    },
    txAmountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    txCurrency: {
        fontSize: 28,
        fontFamily: 'Prompt_700Bold',
        color: '#334155',
        marginRight: 4,
    },
    txAmountInput: {
        fontSize: 36,
        fontFamily: 'Prompt_800ExtraBold',
        color: '#1E293B',
        flex: 1,
        padding: 0,
    },
    txSectionLabel: {
        fontSize: 12,
        fontFamily: 'Prompt_600SemiBold',
        color: '#94A3B8',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    txSelectorsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    txSelectorColumn: {
        flex: 1,
    },
    selectorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 8,
    },
    selectorIconBg: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectorTextActive: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'Prompt_600SemiBold',
        color: '#1E293B',
    },
    selectorTextInactive: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'Prompt_500Medium',
        color: '#94A3B8',
    },
    txNoteInput: {
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderRadius: 12,
        fontSize: 14,
        fontFamily: 'Prompt_400Regular',
        color: '#334155',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        marginTop: 4,
    },

    /* Footer */
    reviewFooter: {
        flexDirection: 'row',
        gap: 12,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
    },
    retryText: {
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: '#64748B',
    },
    saveAllButton: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    saveAllDisabled: {
        opacity: 0.4,
    },
    saveAllGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
    },
    saveAllText: {
        fontSize: 16,
        fontFamily: 'Prompt_700Bold',
        color: '#fff',
    },

    /* Processing extras */
    processingTimer: {
        fontSize: 14,
        fontFamily: 'Prompt_500Medium',
        color: '#94A3B8',
        marginTop: 16,
    },
    cancelButton: {
        marginTop: 24,
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
    },
    cancelButtonText: {
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: '#64748B',
    },

    /* Modals */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalScroll: {
        padding: 20,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    modalOptionActive: {
        borderColor: '#E2E8F0',
        backgroundColor: '#fff',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    modalOptionIconBg: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    modalOptionText: {
        fontSize: 15,
        fontFamily: 'Prompt_500Medium',
        color: '#334155',
    },
    txDateRow: {
        marginBottom: 16,
    },
    dateButtonCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        gap: 8,
    },
    dateTextCompact: {
        flex: 1,
        fontSize: 15,
        color: '#334155',
        fontFamily: 'Prompt_500Medium',
    },
    modalCancel: {
        fontSize: 16,
        color: '#94A3B8',
        fontFamily: 'Prompt_400Regular',
    },
    modalDone: {
        fontSize: 16,
        color: '#6366F1',
        fontFamily: 'Prompt_600SemiBold',
    },
});
