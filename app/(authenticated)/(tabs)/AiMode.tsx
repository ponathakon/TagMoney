import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Easing, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Animated as RNAnimated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/ChatBubble';
import { useLanguage } from '@/context/LanguageContext';
import { askFinancialAssistant } from '@/utils/aiApi';
import { ChatSession, createChatSession, deleteChatSession, getCategories, getChatHistory, getChatSessions, getCurrency, getPreferences, getTransactions, getWalletBalance, getWallets, Message, saveChatMessage, toggleChatSessionPin, updateChatSessionTitle } from '@/utils/storage';

const TypingDot = ({ delay }: { delay: number }) => {
    const isDark = useColorScheme() === 'dark';
    const opacity = React.useRef(new RNAnimated.Value(0.3)).current;

    React.useEffect(() => {
        const animation = RNAnimated.loop(
            RNAnimated.sequence([
                RNAnimated.timing(opacity, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                    easing: Easing.inOut(Easing.ease)
                }),
                RNAnimated.timing(opacity, {
                    toValue: 0.3,
                    duration: 400,
                    useNativeDriver: true,
                    easing: Easing.inOut(Easing.ease)
                }),
                RNAnimated.delay(delay)
            ])
        );

        // Start after the initial delay to stagger the animations
        setTimeout(() => animation.start(), delay);

        return () => animation.stop();
    }, [delay, opacity]);

    return (
        <RNAnimated.View
            style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: isDark ? '#A78BFA' : '#8B5CF6',
                marginHorizontal: 3,
                opacity
            }}
        />
    );
};

const TypingIndicator = () => {

    return (
        <View style={styles.typingIndicatorContainer}>
            <View style={styles.typingDotsContainer}>
                <TypingDot delay={0} />
                <TypingDot delay={150} />
                <TypingDot delay={300} />
            </View>
        </View>
    );
};

const AiMode = () => {
    const isDark = useColorScheme() === 'dark';
    const router = useRouter();
    const { t } = useLanguage();


    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isScrolledUp, setIsScrolledUp] = useState(false);
    const isScrolledUpRef = React.useRef(false); // ref to avoid stale closure in onContentSizeChange

    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const currentSessionIdRef = React.useRef(currentSessionId);

    React.useEffect(() => {
        currentSessionIdRef.current = currentSessionId;
    }, [currentSessionId]);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const sidebarAnim = React.useRef(new RNAnimated.Value(0)).current;

    const [selectedSessionForOptions, setSelectedSessionForOptions] = useState<ChatSession | null>(null);
    const [isOptionsVisible, setIsOptionsVisible] = useState(false);
    const [isRenameVisible, setIsRenameVisible] = useState(false);
    const [renameText, setRenameText] = useState('');

    const [isConfirmVisible, setIsConfirmVisible] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{
        title: string;
        message: string;
        confirmLabel: string;
        onConfirm: () => void;
    }>({ title: '', message: '', confirmLabel: '', onConfirm: () => { } });

    const openSidebar = () => {
        setIsSidebarOpen(true);
        RNAnimated.timing(sidebarAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease)
        }).start();
    };

    const closeSidebar = () => {
        RNAnimated.timing(sidebarAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
            easing: Easing.in(Easing.ease)
        }).start(() => {
            setIsSidebarOpen(false);
        });
    };

    const abortControllerRef = React.useRef<AbortController | null>(null);
    const flatListRef = React.useRef<FlatList>(null);
    const insets = useSafeAreaInsets();



    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    };

    // Financial Data Context
    const [financialContext, setFinancialContext] = useState({
        budget: { dailyLimit: 0, monthlyLimit: 0 },
        wallets: [] as any[],
        transactions: [] as any[]
    });

    // Load context on focus
    useFocusEffect(
        useCallback(() => {
            const loadContext = async () => {
                const prefs = await getPreferences();
                const wallets = await getWallets();
                const tx = await getTransactions();

                setFinancialContext({
                    budget: prefs,
                    wallets: wallets,
                    transactions: tx || []
                });
            };
            loadContext();
        }, [])
    );

    // Load Chat Sessions
    useFocusEffect(
        useCallback(() => {
            const loadSessions = async () => {
                const loadedSessions = await getChatSessions();
                setSessions(loadedSessions);

            };
            loadSessions();
        }, [])
    );

    const openOptions = (session: ChatSession) => {
        setSelectedSessionForOptions(session);
        setIsOptionsVisible(true);
    };

    const handlePinToggle = async () => {
        if (!selectedSessionForOptions) return;
        const newPinnedStatus = !selectedSessionForOptions.pinned;
        await toggleChatSessionPin(selectedSessionForOptions.id, newPinnedStatus);

        setSessions(prev => {
            const updated = prev.map(s => s.id === selectedSessionForOptions.id ? { ...s, pinned: newPinnedStatus } : s);
            return updated.sort((a, b) => {
                if (a.pinned === b.pinned) return b.updatedAt - a.updatedAt;
                return a.pinned ? -1 : 1;
            });
        });
        setIsOptionsVisible(false);
    };

    const handleRenameSubmit = async () => {
        if (!selectedSessionForOptions || !renameText.trim()) return;
        const newTitle = renameText.trim();
        await updateChatSessionTitle(selectedSessionForOptions.id, newTitle);
        setSessions(prev => prev.map(s => s.id === selectedSessionForOptions.id ? { ...s, title: newTitle } : s));
        setIsRenameVisible(false);
        setIsOptionsVisible(false);
    };

    const handleDeleteSession = () => {
        if (!selectedSessionForOptions) return;
        setIsOptionsVisible(false);
        setTimeout(() => {
            setConfirmConfig({
                title: t('delete_chat'),
                message: t('delete_chat_confirm'),
                confirmLabel: t('delete'),
                onConfirm: async () => {
                    await deleteChatSession(selectedSessionForOptions.id);
                    setSessions(prev => prev.filter(s => s.id !== selectedSessionForOptions?.id));
                    if (currentSessionId === selectedSessionForOptions.id) setCurrentSessionId(null);
                    setIsConfirmVisible(false);
                }
            });
            setIsConfirmVisible(true);
        }, 200);
    };

    // Load Chat History
    useFocusEffect(
        useCallback(() => {
            const loadHistory = async () => {
                if (currentSessionId) {
                    const history = await getChatHistory(currentSessionId);
                    if (history && history.length > 0) {
                        // Filter out the old hardcoded initial message if it exists
                        const filtered = history.filter(m => !(m.role === 'assistant' && m.content.startsWith('Hi! I am your Tracker')));
                        setMessages(filtered);
                    } else {
                        setMessages([]);
                    }
                } else {
                    setMessages([]);
                }
            };
            loadHistory();
        }, [currentSessionId])
    );

    const handleSuggestionItem = (text: string) => {
        setInputText(text);
        // Optionally auto-send: handleSend(text);
    };

    const handleSend = async () => {
        if (!inputText.trim() || isLoading) return;

        Keyboard.dismiss();

        const userMsg = inputText.trim();
        setInputText('');

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // 1. Optimistically update UI IMMEDIATELY
        const userMessageOptimistic: Message = { role: 'user', content: userMsg, sessionId: currentSessionId || undefined };
        const newMessagesOptimistic: Message[] = [
            ...messages,
            userMessageOptimistic
        ];

        setMessages(newMessagesOptimistic);
        setIsScrolledUp(false);
        isScrolledUpRef.current = false;

        // Yield to the UI thread so React Native renders the user message immediately (clears empty state)
        await new Promise(resolve => setTimeout(resolve, 50));
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 10);

        // 2. NOW we can show the loading state
        setIsLoading(true);

        // 3. Create Session DB records if needed
        let sessionId = currentSessionId;
        if (!sessionId) {
            const newSessionTitle = userMsg.length > 30 ? userMsg.substring(0, 30) + '...' : userMsg;
            const newSession = await createChatSession(newSessionTitle);
            if (newSession) {
                sessionId = newSession.id;
                setCurrentSessionId(sessionId);
                setSessions(prev => [newSession, ...prev]);
                // update optimistic message with new session id
                userMessageOptimistic.sessionId = sessionId;
            }
        }

        await saveChatMessage(userMessageOptimistic);

        try {
            // Format for API
            const apiMessages = newMessagesOptimistic.map(m => ({ role: m.role, content: m.content }));

            // Fetch FRESH financial data right before calling the AI
            const freshPrefs = await getPreferences();
            const freshWallets = await getWallets();
            const freshTx = await getTransactions();
            const freshCurrency = await getCurrency();
            const freshCategories = await getCategories() || [];

            // Build lookup maps: ID → human-readable name
            const categoryMap: Record<string, string> = {};
            for (const cat of freshCategories) {
                categoryMap[cat.id] = t(cat.name as any) || cat.name;
            }
            const walletMap: Record<string, string> = {};
            for (const w of freshWallets) {
                walletMap[w.id] = t(w.name as any) || w.name;
            }

            // Compute actual wallet balances (not just initialBalance)
            const walletsWithBalance = await Promise.all(
                freshWallets.map(async (w) => ({
                    ...w,
                    displayName: t(w.name as any) || w.name,
                    currentBalance: await getWalletBalance(w.id),
                }))
            );

            // Resolve category/wallet IDs to names on transactions
            const resolvedTx = (freshTx || []).map(tx => ({
                ...tx,
                categoryName: tx.categoryId ? (categoryMap[tx.categoryId] || 'Uncategorized') : 'Uncategorized',
                walletName: tx.walletId ? (walletMap[tx.walletId] || 'Unknown') : 'Unknown',
            }));

            // Resolve category limit IDs to names
            const categoryLimits = freshPrefs.categoryLimits || {};
            const resolvedCategoryLimits: Record<string, number> = {};
            for (const [catId, limit] of Object.entries(categoryLimits)) {
                const name = categoryMap[catId] || catId;
                resolvedCategoryLimits[name] = limit as number;
            }

            const freshContext = {
                budget: { ...freshPrefs, categoryLimits: resolvedCategoryLimits },
                wallets: walletsWithBalance,
                transactions: resolvedTx,
                currency: freshCurrency,
            };

            const response = await askFinancialAssistant(apiMessages, freshContext, abortController.signal);
            const assistantMessage: Message = { role: 'assistant', content: response, sessionId: sessionId || undefined };

            // Save to DB immediately
            await saveChatMessage(assistantMessage);

            // 4. Update UI with AI response ONLY if the user is still in the same chat session
            if (currentSessionIdRef.current === sessionId) {
                setMessages(prev => [
                    ...prev,
                    assistantMessage
                ]);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Chat aborted by user');
            } else {
                console.error("Chat error:", error);
                setMessages(prev => [
                    ...prev,
                    { role: 'assistant', content: "Sorry, I encountered an error connecting to my brain. Please try again later." }
                ]);
            }
        } finally {
            setIsLoading(false);
            if (abortControllerRef.current === abortController) {
                abortControllerRef.current = null;
            }
        }
    };

    const handleScroll = (event: any) => {
        const yOffset = event.nativeEvent.contentOffset.y;
        const contentHeight = event.nativeEvent.contentSize.height;
        const layoutHeight = event.nativeEvent.layoutMeasurement.height;

        const distanceFromBottom = contentHeight - layoutHeight - yOffset;

        const scrolledUp = distanceFromBottom > 150;
        isScrolledUpRef.current = scrolledUp;
        setIsScrolledUp(scrolledUp);
    };

    const scrollToBottom = () => {
        flatListRef.current?.scrollToEnd({ animated: true });
        isScrolledUpRef.current = false;
        setIsScrolledUp(false);
    };

    const backgroundColor = isDark ? '#212121' : '#FFFFFF';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor, marginTop: 5 }]}>

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={24} color={isDark ? '#D1D5DB' : '#5F6368'} />
                </TouchableOpacity>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        onPress={() => { setCurrentSessionId(null); }}
                        style={styles.headerBtn}
                    >
                        <Ionicons name="create-outline" size={24} color={isDark ? '#D1D5DB' : '#5F6368'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={openSidebar} style={styles.headerBtn}>
                        <Ionicons name="time-outline" size={24} color={isDark ? '#D1D5DB' : '#5F6368'} />
                    </TouchableOpacity>
                </View>
            </View>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.container}
            >
                {messages.length === 0 ? (
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.emptyStateContainer} showsVerticalScrollIndicator={false}>
                        <View style={styles.greetingContainer}>
                            <Text style={[styles.greetingText, { color: isDark ? '#FFFFFF' : '#1E293B' }]}>
                                {t('ai_greeting')}
                            </Text>
                            <Text style={[styles.greetingSubtext, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                                {t('ai_help')}
                            </Text>
                        </View>

                        <View style={styles.suggestionsContainer}>
                            <TouchableOpacity style={[styles.suggestionChip, { backgroundColor: isDark ? '#2F2F2F' : '#F4F4F5' }]} onPress={() => handleSuggestionItem(t('prompt_check_budget' as any))}>
                                <Ionicons name="pie-chart-outline" size={20} color={isDark ? '#A78BFA' : '#8B5CF6'} />
                                <Text style={[styles.suggestionText, { color: isDark ? '#E2E8F0' : '#334155' }]}>{t('check_budget')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.suggestionChip, { backgroundColor: isDark ? '#2F2F2F' : '#F4F4F5' }]} onPress={() => handleSuggestionItem(t('prompt_recent_expenses' as any))}>
                                <Ionicons name="receipt-outline" size={20} color={isDark ? '#F87171' : '#EF4444'} />
                                <Text style={[styles.suggestionText, { color: isDark ? '#E2E8F0' : '#334155' }]}>{t('recent_expenses')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.suggestionChip, { backgroundColor: isDark ? '#2F2F2F' : '#F4F4F5' }]} onPress={() => handleSuggestionItem(t('prompt_wallet_balances' as any))}>
                                <Ionicons name="wallet-outline" size={20} color={isDark ? '#34D399' : '#10B981'} />
                                <Text style={[styles.suggestionText, { color: isDark ? '#E2E8F0' : '#334155' }]}>{t('wallet_balances')}</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(_, index) => index.toString()}
                        renderItem={({ item, index }) => <ChatBubble message={item} index={index} />}
                        contentContainerStyle={[styles.listContent]}
                        showsVerticalScrollIndicator={false}
                        style={{ flex: 1 }}
                        ListFooterComponent={isLoading ? <TypingIndicator /> : null}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        onContentSizeChange={() => {
                            if (!isScrolledUpRef.current) {
                                flatListRef.current?.scrollToEnd({ animated: true });
                            }
                        }}
                    />
                )}

                {isScrolledUp && messages.length > 0 && (
                    <TouchableOpacity
                        style={[
                            styles.jumpToBottomBtn,
                            {
                                backgroundColor: isDark ? '#475569' : '#F1F5F9',
                                bottom: insets.bottom + 50
                            }
                        ]}
                        onPress={scrollToBottom}
                    >
                        <Ionicons name="arrow-down" size={20} color={isDark ? '#F8FAFC' : '#0F172A'} />
                    </TouchableOpacity>
                )}

                <View style={[styles.inputContainer]}>
                    <View style={[
                        styles.inputWrapper,
                        {
                            backgroundColor: isDark ? '#2F2F2F' : '#F4F4F5',
                        }
                    ]}>
                        <TextInput
                            style={[styles.input, { color: isDark ? '#FFFFFF' : '#000000' }]}
                            placeholder={t('ai_placeholder')}
                            placeholderTextColor={isDark ? '#EBEBF560' : '#3C3C4360'}
                            value={inputText}
                            onChangeText={setInputText}
                            multiline

                            maxLength={500}
                        />

                        {isLoading ? (
                            <TouchableOpacity
                                style={[
                                    styles.sendButton,
                                    { backgroundColor: isDark ? '#FFFFFF' : '#000000' }
                                ]}
                                onPress={handleStop}
                            >
                                <Ionicons
                                    name="stop"
                                    size={18}
                                    color={isDark ? '#000000' : '#FFFFFF'}
                                />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[
                                    styles.sendButton,
                                    { backgroundColor: inputText.trim() ? (isDark ? '#FFFFFF' : '#000000') : (isDark ? '#424242' : '#E5E5E5') }
                                ]}
                                onPress={handleSend}
                                disabled={!inputText.trim()}
                            >
                                <Ionicons
                                    name="arrow-up"
                                    size={18}
                                    color={inputText.trim() ? (isDark ? '#000000' : '#FFFFFF') : (isDark ? '#8A8A8D' : '#9CA3AF')}
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* Sidebar Modal */}
            <Modal
                visible={isSidebarOpen}
                animationType="none"
                transparent={true}
                onRequestClose={closeSidebar}
            >
                <View style={styles.sidebarOverlay}>
                    <RNAnimated.View style={[styles.sidebarBackdrop, { opacity: sidebarAnim }]}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeSidebar} />
                    </RNAnimated.View>
                    <RNAnimated.View
                        style={[
                            styles.sidebarContent,
                            {
                                backgroundColor: isDark ? '#1C1C1E' : '#F8FAFC',
                                transform: [{
                                    translateX: sidebarAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [-400, 0] // Start further left to ensure it's hidden
                                    })
                                }]
                            }
                        ]}
                    >
                        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
                            <View style={styles.sidebarHeaderContainer}>
                                <TouchableOpacity
                                    style={[styles.newChatBtn, { backgroundColor: isDark ? '#2C2C2E' : '#E2E8F0' }]}
                                    onPress={() => {
                                        setCurrentSessionId(null);
                                        closeSidebar();
                                    }}
                                >
                                    <View style={styles.newChatBtnInner}>
                                        <Ionicons name="add" size={20} color={isDark ? '#FFFFFF' : '#0F172A'} />
                                        <Text style={[styles.newChatText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{t('new_chat')}</Text>
                                    </View>
                                </TouchableOpacity>

                            </View>
                            <Text style={[styles.sidebarSectionTitle, { color: isDark ? '#8E8E93' : '#64748B' }]}>{t('recent')}</Text>
                            <FlatList
                                data={sessions}
                                keyExtractor={item => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.sessionItem, currentSessionId === item.id && { backgroundColor: isDark ? '#2C2C2E' : '#E2E8F0' }]}
                                        onPress={() => {
                                            setCurrentSessionId(item.id);
                                            closeSidebar();
                                        }}
                                        onLongPress={() => openOptions(item)}
                                    >
                                        <View style={styles.sessionItemContent}>
                                            <Ionicons name="chatbubble-outline" size={18} color={isDark ? '#E5E5EA' : '#334155'} />
                                            <Text style={[styles.sessionTitle, { color: isDark ? '#E5E5EA' : '#1E293B' }]} numberOfLines={1}>{item.title}</Text>
                                        </View>
                                        {item.pinned && (
                                            <MaterialIcons name="push-pin" size={16} color={isDark ? '#A78BFA' : '#8B5CF6'} style={{ transform: [{ rotate: '45deg' }] }} />
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        </SafeAreaView>
                    </RNAnimated.View>
                </View>
            </Modal>

            {/* Options Bottom Sheet Modal */}
            <Modal
                visible={isOptionsVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setIsOptionsVisible(false)}
            >
                <View style={styles.optionsOverlay}>
                    <TouchableOpacity style={styles.optionsBackdrop} onPress={() => setIsOptionsVisible(false)} />
                    <View style={[styles.optionsContent, { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' }]}>
                        <View style={styles.optionsDragHandle} />

                        <TouchableOpacity style={styles.optionItem} activeOpacity={0.7} onPress={handlePinToggle}>
                            <MaterialIcons name="push-pin" size={24} color={isDark ? '#E5E5EA' : '#1E293B'} style={!selectedSessionForOptions?.pinned ? styles.outlineIcon : undefined} />
                            <Text style={[styles.optionText, { color: isDark ? '#E5E5EA' : '#1E293B' }]}>
                                {selectedSessionForOptions?.pinned ? t('unpin') : t('pin')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.optionItem} activeOpacity={0.7} onPress={() => {
                            setRenameText(selectedSessionForOptions?.title || '');
                            setIsOptionsVisible(false);
                            setTimeout(() => setIsRenameVisible(true), 300); // slight delay to allow first modal to close
                        }}>
                            <MaterialIcons name="edit" size={24} color={isDark ? '#E5E5EA' : '#1E293B'} />
                            <Text style={[styles.optionText, { color: isDark ? '#E5E5EA' : '#1E293B' }]}>{t('rename_chat')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.optionItem} activeOpacity={0.7} onPress={handleDeleteSession}>
                            <MaterialIcons name="delete-outline" size={24} color="#EF4444" />
                            <Text style={[styles.optionText, { color: '#EF4444' }]}>{t('delete')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Rename Modal */}
            <Modal
                visible={isRenameVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setIsRenameVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.renameModalContainer}
                    >
                        <View style={[styles.renameContent, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
                            <Text style={[styles.renameTitle, { color: isDark ? '#FFFFFF' : '#1E293B' }]}>{t('rename_chat')}</Text>
                            <TextInput
                                style={[
                                    styles.renameInput,
                                    {
                                        color: isDark ? '#FFFFFF' : '#1E293B',
                                        backgroundColor: isDark ? '#2C2C2E' : '#F1F5F9',
                                        borderColor: isDark ? '#3C3C3E' : '#E2E8F0'
                                    }
                                ]}
                                value={renameText}
                                onChangeText={setRenameText}
                                placeholder={t('chat_title')}
                                placeholderTextColor={isDark ? '#8E8E93' : '#94A3B8'}
                                autoFocus
                            />
                            <View style={styles.renameActions}>
                                <TouchableOpacity
                                    style={[styles.renameBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F1F5F9' }]}
                                    onPress={() => setIsRenameVisible(false)}
                                >
                                    <Text style={[styles.renameBtnText, { color: isDark ? '#FFFFFF' : '#64748B' }]}>{t('cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.renameBtn, { backgroundColor: '#8B5CF6' }]}
                                    onPress={handleRenameSubmit}
                                >
                                    <Text style={[styles.renameBtnText, { color: '#FFFFFF' }]}>{t('save')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Custom Confirm Modal */}
            <Modal
                visible={isConfirmVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setIsConfirmVisible(false)}
            >
                <View style={styles.confirmOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setIsConfirmVisible(false)} />
                    <View style={[styles.confirmCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
                        <View style={[styles.confirmIconCircle, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)' }]}>
                            <Ionicons name="warning-outline" size={28} color="#EF4444" />
                        </View>
                        <Text style={[styles.confirmTitle, { color: isDark ? '#FFFFFF' : '#1E293B' }]}>{confirmConfig.title}</Text>
                        <Text style={[styles.confirmMessage, { color: isDark ? '#9CA3AF' : '#64748B' }]}>{confirmConfig.message}</Text>
                        <View style={styles.confirmActions}>
                            <TouchableOpacity
                                style={[styles.confirmBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F1F5F9' }]}
                                onPress={() => setIsConfirmVisible(false)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.confirmBtnText, { color: isDark ? '#D1D5DB' : '#64748B' }]}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmBtn, styles.confirmDestructiveBtn]}
                                onPress={confirmConfig.onConfirm}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>{confirmConfig.confirmLabel}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default AiMode;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 30,
    },
    inputContainer: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 15
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 32,
        paddingHorizontal: 16,
        paddingVertical: 8,
        minHeight: 56,
        maxHeight: 120,
    },
    input: {
        flex: 1,
        fontSize: 16,
        lineHeight: 22,
        paddingTop: 8,
        paddingBottom: 8,
    },
    sendButton: {
        marginLeft: 8,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingTop: 4,
        paddingBottom: 4,
        height: 52,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 'auto',
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyStateContainer: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 80,
    },
    greetingContainer: {
        marginBottom: 40,
    },
    greetingText: {
        fontSize: 32,
        fontFamily: 'Prompt_700Bold',
        marginBottom: 8,
    },
    greetingSubtext: {
        fontSize: 20,
        fontFamily: 'Prompt_500Medium',
        lineHeight: 28,
    },
    suggestionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    suggestionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 24,
        gap: 8,
    },
    suggestionText: {
        fontSize: 15,
        fontFamily: 'Prompt_500Medium',
    },
    typingIndicatorContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        marginVertical: 8,
        maxWidth: '100%',
    },

    typingDotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 24,
        marginTop: 8,
    },
    jumpToBottomBtn: {
        position: 'absolute',
        alignSelf: 'center',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
        zIndex: 10,
    },
    sidebarOverlay: {
        flex: 1,
        flexDirection: 'row',
    },
    sidebarBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sidebarContent: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: '80%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    },
    sidebarHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    newChatBtn: {
        flex: 1,
        borderRadius: 20,
        marginRight: 10,
    },
    newChatBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    newChatText: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        marginLeft: 8,
    },

    sidebarSectionTitle: {
        fontSize: 13,
        fontFamily: 'Prompt_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginTop: 8,
    },
    sessionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginHorizontal: 8,
        borderRadius: 12,
    },
    sessionItemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    sessionTitle: {
        fontSize: 15,
        fontFamily: 'Prompt_500Medium',
        marginLeft: 12,
        flex: 1,
    },
    optionsOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    optionsBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    optionsContent: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    },
    optionsDragHandle: {
        width: 36,
        height: 5,
        backgroundColor: '#9CA3AF',
        borderRadius: 2.5,
        alignSelf: 'center',
        marginBottom: 24,
        opacity: 0.8,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 16,
        marginBottom: 4,
    },
    optionText: {
        fontSize: 17,
        fontFamily: 'Prompt_500Medium',
        marginLeft: 20,
    },
    outlineIcon: {
        opacity: 0.8,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    renameModalContainer: {
        width: '100%',
        alignItems: 'center',
    },
    renameContent: {
        width: '85%',
        borderRadius: 20,
        padding: 24,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    renameTitle: {
        fontSize: 18,
        fontFamily: 'Prompt_600SemiBold',
        marginBottom: 16,
        textAlign: 'center',
    },
    renameInput: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        fontFamily: 'Prompt_400Regular',
        marginBottom: 24,
    },
    renameActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    renameBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginHorizontal: 8,
    },
    renameBtnText: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
    },
    confirmOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    confirmCard: {
        width: '82%',
        borderRadius: 24,
        paddingVertical: 28,
        paddingHorizontal: 24,
        alignItems: 'center',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
    },
    confirmIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    confirmTitle: {
        fontSize: 19,
        fontFamily: 'Prompt_600SemiBold',
        marginBottom: 8,
        textAlign: 'center',
    },
    confirmMessage: {
        fontSize: 14,
        fontFamily: 'Prompt_400Regular',
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 24,
    },
    confirmActions: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    confirmBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },

    confirmDestructiveBtn: {
        backgroundColor: '#EF4444',
    },
    confirmBtnText: {
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
    },
});