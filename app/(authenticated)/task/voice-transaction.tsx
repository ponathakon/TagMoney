import { Category, INITIAL_CATEGORIES } from '@/constants/categories';
import { getCurrencyByCode } from '@/constants/currencies';
import { Colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { addTransaction, getCategories, getCurrency, getWalletBalance, getWallets } from '@/utils/storage';
import { Transaction, Wallet } from '@/utils/types';
import { ParsedTransaction, parseMultipleTransactions } from '@/utils/voiceProcessing';
import { transcribeAudio } from '@/utils/whisperApi';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
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
    FadeInDown,
    FadeInUp,
    SlideInDown,
    SlideOutDown,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
    ZoomIn
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Phase = 'recording' | 'processing' | 'review';

const AnimatedDot = ({ index }: { index: number }) => {
    const anim = useSharedValue(0);

    useEffect(() => {
        anim.value = withDelay(
            index * 200,
            withRepeat(
                withSequence(
                    withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            )
        );
    }, [index]);

    const rStyle = useAnimatedStyle(() => ({
        opacity: 0.4 + anim.value * 0.6,
        transform: [
            { scale: 0.8 + anim.value * 0.4 },
            { translateY: anim.value * -6 }
        ]
    }));

    return <Animated.View style={[styles.processingDot, rStyle]} />;
};

export default function VoiceTransaction() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t, languageCode } = useLanguage();

    // Phase
    const [phase, setPhase] = useState<Phase>('recording');

    // Recording
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [transcribedText, setTranscribedText] = useState('');

    // Data
    const [categories, setCategories] = useState<Category[]>([]);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});
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

    // Animations
    const pulseAnim = useSharedValue(1);
    const wave1 = useSharedValue(0.3);
    const wave2 = useSharedValue(0.3);
    const wave3 = useSharedValue(0.3);
    const wave4 = useSharedValue(0.3);
    const wave5 = useSharedValue(0.3);

    const idleWave1 = useSharedValue(1);
    const idleWave2 = useSharedValue(1);
    const idleWave3 = useSharedValue(1);
    const idleWave4 = useSharedValue(1);
    const idleWave5 = useSharedValue(1);

    useEffect(() => {
        loadData();

        const randomIdle = (min: number, max: number, dur: number) =>
            withRepeat(
                withSequence(
                    withTiming(max, { duration: dur, easing: Easing.inOut(Easing.ease) }),
                    withTiming(min, { duration: dur, easing: Easing.inOut(Easing.ease) }),
                ),
                -1, true,
            );
        idleWave1.value = randomIdle(0.7, 1.2, 1000);
        idleWave2.value = randomIdle(0.8, 1.1, 1200);
        idleWave3.value = randomIdle(0.6, 1.3, 1100);
        idleWave4.value = randomIdle(0.75, 1.15, 1050);
        idleWave5.value = randomIdle(0.8, 1.2, 1150);

        return () => {
            if (recording) {
                recording.stopAndUnloadAsync().catch(() => { });
            }
        };
    }, []);

    const loadData = async () => {
        let cats = await getCategories();
        if (!cats) cats = INITIAL_CATEGORIES;
        setCategories(cats);

        const w = await getWallets();
        setWallets(w);
        if (w.length > 0) setDefaultWalletId(w[0].id);

        const balances: Record<string, number> = {};
        for (const wallet of w) {
            balances[wallet.id] = await getWalletBalance(wallet.id);
        }
        setWalletBalances(balances);

        const code = await getCurrency();
        setCurrencySymbol(getCurrencyByCode(code).symbol);
    };

    /* ------------------------------------------------------------------ */
    /*  Recording                                                          */
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

    const startAnimation = () => {
        pulseAnim.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            ),
            -1, true,
        );
        const randomWave = (min: number, max: number, dur: number) =>
            withRepeat(
                withSequence(
                    withTiming(max, { duration: dur, easing: Easing.inOut(Easing.ease) }),
                    withTiming(min, { duration: dur, easing: Easing.inOut(Easing.ease) }),
                ),
                -1, true,
            );
        wave1.value = randomWave(0.2, 1, 400);
        wave2.value = randomWave(0.3, 0.9, 550);
        wave3.value = randomWave(0.2, 1, 350);
        wave4.value = randomWave(0.3, 0.8, 500);
        wave5.value = randomWave(0.1, 1, 450);
    };

    const stopAnimation = () => {
        pulseAnim.value = withTiming(1, { duration: 300 });
        [wave1, wave2, wave3, wave4, wave5].forEach(w => {
            w.value = withTiming(0.3, { duration: 300 });
        });
    };

    const startRecording = async () => {
        try {
            const perm = await Audio.requestPermissionsAsync();
            if (perm.status !== 'granted') {
                Alert.alert(t('permission_needed'), t('mic_permission_desc'));
                return;
            }
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording: rec } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY,
            );
            setRecording(rec);
            setIsRecording(true);
            startAnimation();
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert(t('error'), t('could_not_start_recording'));
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

    const handleCancelProcessing = () => {
        cancelledRef.current = true;
        stopProcessingTimer();
        setPhase('recording');
    };

    const stopRecording = async () => {
        if (!recording) return;
        stopAnimation();
        setIsRecording(false);
        setPhase('processing');
        startProcessingTimer();

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);

            if (!uri) {
                throw new Error('No recording URI available');
            }

            // Transcribe with 30s timeout
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Transcription timed out. Please try again.')), 30000)
            );

            const text = await Promise.race([
                transcribeAudio(uri),
                timeoutPromise,
            ]);

            stopProcessingTimer();

            // User may have cancelled while waiting
            if (cancelledRef.current) return;

            if (!text || text.trim().length === 0) {
                Alert.alert(t('no_speech_detected'), t('try_speak_clearly'));
                setPhase('recording');
                return;
            }

            handleTranscription(text);
        } catch (err: any) {
            stopProcessingTimer();
            if (cancelledRef.current) return;
            console.error('Transcription failed', err);
            Alert.alert(
                'Transcription Failed',
                err?.message || 'Could not transcribe audio. Please try again.',
            );
            setPhase('recording');
        }
    };

    const handleTranscription = async (text: string) => {
        setTranscribedText(text);

        // Now wait for GPT to parse the meaning
        const parsed = await parseMultipleTransactions(text, categories, wallets);

        // Use parser-detected wallet, fall back to default
        const withDefaults = parsed.map(t => ({
            ...t,
            walletId: t.walletId ?? defaultWalletId,
        }));

        setParsedTransactions(withDefaults);
        setPhase('review');
    };

    const handleToggle = () => {
        if (isRecording) stopRecording();
        else startRecording();
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
                    title: pt.description || pt.categoryName || 'Voice Transaction',
                    amount: pt.amount,
                    date: pt.date.toISOString(),
                    type: pt.type,
                    categoryId: pt.categoryId ?? undefined,
                    walletId: pt.walletId ?? defaultWalletId ?? undefined,
                };
                await addTransaction(tx);
            }
            router.back();
        } catch (err) {
            console.error('Save failed', err);
            Alert.alert('Error', 'Failed to save transactions.');
        }
    };

    const handleRetry = () => {
        setParsedTransactions([]);
        setTranscribedText('');
        setPhase('recording');
    };

    /* ------------------------------------------------------------------ */
    /*  Animated styles                                                    */
    /* ------------------------------------------------------------------ */

    const micPulse = useAnimatedStyle(() => ({
        transform: [{ scale: pulseAnim.value }],
    }));

    const ws1 = useAnimatedStyle(() => ({
        transform: [{ scaleY: wave1.value }],
        opacity: 0.5 + wave1.value * 0.5,
    }));
    const ws2 = useAnimatedStyle(() => ({
        transform: [{ scaleY: wave2.value }],
        opacity: 0.5 + wave2.value * 0.5,
    }));
    const ws3 = useAnimatedStyle(() => ({
        transform: [{ scaleY: wave3.value }],
        opacity: 0.5 + wave3.value * 0.5,
    }));
    const ws4 = useAnimatedStyle(() => ({
        transform: [{ scaleY: wave4.value }],
        opacity: 0.5 + wave4.value * 0.5,
    }));
    const ws5 = useAnimatedStyle(() => ({
        transform: [{ scaleY: wave5.value }],
        opacity: 0.5 + wave5.value * 0.5,
    }));

    const iws1 = useAnimatedStyle(() => ({ transform: [{ scaleY: idleWave1.value }] }));
    const iws2 = useAnimatedStyle(() => ({ transform: [{ scaleY: idleWave2.value }] }));
    const iws3 = useAnimatedStyle(() => ({ transform: [{ scaleY: idleWave3.value }] }));
    const iws4 = useAnimatedStyle(() => ({ transform: [{ scaleY: idleWave4.value }] }));
    const iws5 = useAnimatedStyle(() => ({ transform: [{ scaleY: idleWave5.value }] }));

    /* ------------------------------------------------------------------ */
    /*  Render helpers                                                     */
    /* ------------------------------------------------------------------ */

    const getFilteredCategories = (type: 'income' | 'expense') =>
        categories.filter(c => c.type === type);

    const renderRecording = () => (
        <View style={styles.centeredContent}>
            {/* Waveform */}
            <View style={styles.waveContainer}>
                {isRecording ? (
                    <>
                        <Animated.View style={[styles.waveBar, { height: 50, backgroundColor: '#EC4899' }, ws1]} />
                        <Animated.View style={[styles.waveBar, { height: 70, backgroundColor: '#F43F5E' }, ws2]} />
                        <Animated.View style={[styles.waveBar, { height: 60, backgroundColor: '#EC4899' }, ws3]} />
                        <Animated.View style={[styles.waveBar, { height: 80, backgroundColor: '#F43F5E' }, ws4]} />
                        <Animated.View style={[styles.waveBar, { height: 50, backgroundColor: '#EC4899' }, ws5]} />
                    </>
                ) : (
                    <View style={styles.idleWaveContainer}>
                        <Animated.View style={[styles.waveBar, { height: 30, backgroundColor: '#E2E8F0' }, iws1]} />
                        <Animated.View style={[styles.waveBar, { height: 20, backgroundColor: '#E2E8F0' }, iws2]} />
                        <Animated.View style={[styles.waveBar, { height: 40, backgroundColor: '#E2E8F0' }, iws3]} />
                        <Animated.View style={[styles.waveBar, { height: 25, backgroundColor: '#E2E8F0' }, iws4]} />
                        <Animated.View style={[styles.waveBar, { height: 35, backgroundColor: '#E2E8F0' }, iws5]} />
                    </View>
                )}
            </View>

            {/* Status */}
            <Text style={styles.statusText}>
                {isRecording ? t('listening') : t('tap_to_speak')}
            </Text>
            {isRecording && <Text style={styles.subStatus}>{t('tap_to_stop')}</Text>}

            {/* Mic Button */}
            <TouchableOpacity activeOpacity={0.8} onPress={handleToggle}>
                <Animated.View style={micPulse}>
                    <LinearGradient
                        colors={isRecording ? ['#EC4899', '#F43F5E'] : ['#6366F1', '#8B5CF6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.micButton}
                    >
                        <Ionicons name={isRecording ? 'stop' : 'mic'} size={44} color="#fff" />
                    </LinearGradient>
                </Animated.View>
            </TouchableOpacity>

            {/* Hints */}
            {!isRecording && (
                <Animated.View entering={FadeInUp.delay(200)} style={styles.hintsContainer}>
                    <Text style={styles.hintTitle}>{t('try_saying')}</Text>
                    <View style={styles.hintPill}>
                        <Text style={styles.hintText}>{t('voice_example_1')}</Text>
                    </View>
                    <View style={styles.hintPill}>
                        <Text style={styles.hintText}>{t('voice_example_2')}</Text>
                    </View>
                </Animated.View>
            )}
        </View>
    );

    const renderProcessing = () => (
        <View style={styles.centeredContent}>
            <Animated.View entering={ZoomIn.springify()} style={styles.processingContainer}>
                <View style={styles.processingDots}>
                    {[0, 1, 2].map(i => (
                        <AnimatedDot key={i} index={i} />
                    ))}
                </View>
                <Text style={styles.processingText}>{t('processing_voice')}</Text>
                <Text style={styles.processingSubText}>{t('identifying_transactions')}</Text>
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
            {/* Transcribed text */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.transcriptCard}>
                <Ionicons name="chatbubble-outline" size={16} color="#6366F1" />
                <Text style={styles.transcriptText} numberOfLines={2}>"{transcribedText}"</Text>
            </Animated.View>

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

                    {parsedTransactions.length === 0 && (
                        <View style={styles.emptyReview}>
                            <Ionicons name="alert-circle-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyReviewText}>{t('no_transactions_detected')}</Text>
                        </View>
                    )}
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
                        colors={['#6366F1', '#8B5CF6']}
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
                <Text style={styles.headerTitle}>{t('voice_tracker')}</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.headerCloseBtn}
                >
                    <Ionicons name="close" size={24} color="#8B5CF6" />
                </TouchableOpacity>
            </View>

            {phase === 'recording' && renderRecording()}
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
        backgroundColor: '#F5F3FF', // Very light violet background
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
    },

    /* Centered content (recording + processing) */
    centeredContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingBottom: 40,
    },

    /* Waveform */
    waveContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 90,
        marginBottom: 32,
    },
    idleWaveContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    waveBar: {
        width: 8,
        borderRadius: 4,
    },

    /* Status */
    statusText: {
        fontSize: 26,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
        marginBottom: 6,
    },
    subStatus: {
        fontSize: 15,
        fontFamily: 'Prompt_400Regular',
        color: '#94A3B8',
        marginBottom: 24,
    },

    /* Mic */
    micButton: {
        width: 110,
        height: 110,
        borderRadius: 55,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
        elevation: 12,
        marginTop: 16,
    },

    /* Hints */
    hintsContainer: {
        alignItems: 'center',
        marginTop: 48,
        width: '100%',
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
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    hintText: {
        fontSize: 15,
        color: '#64748B',
        fontFamily: 'Prompt_500Medium',
    },

    /* Processing */
    processingContainer: {
        alignItems: 'center',
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

    /* Review */
    reviewContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    transcriptCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#EEF2FF',
    },
    transcriptText: {
        flex: 1,
        fontSize: 14,
        color: '#64748B',
        fontFamily: 'Prompt_500Medium',
        fontStyle: 'italic',
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

    /* Transaction card */
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

    /* Empty */
    emptyReview: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyReviewText: {
        fontSize: 16,
        color: '#94A3B8',
        fontFamily: 'Prompt_500Medium',
        marginTop: 12,
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
