import { Category } from '@/constants/categories';
import { Colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { CategoryPickerModal } from './CategoryPickerModal';

interface EditLimitsModalProps {
    visible: boolean;
    onClose: () => void;
    currentDaily: number;
    currentMonthly: number;
    currentCategoryLimits: Record<string, number>;
    categories: Category[];
    onSave: (daily: number, monthly: number, categoryLimits: Record<string, number>) => void;
    currencySymbol: string;
    initialTab?: 'general' | 'categories';
}

export const EditLimitsModal = ({
    visible,
    onClose,
    currentDaily,
    currentMonthly,
    currentCategoryLimits,
    categories,
    onSave,
    currencySymbol,
    initialTab = 'general'
}: EditLimitsModalProps) => {
    const [daily, setDaily] = useState('');
    const [monthly, setMonthly] = useState('');
    const [categoryLimits, setCategoryLimits] = useState<Record<string, string>>({});
    const [activeTab, setActiveTab] = useState<'general' | 'categories'>('general');
    const [showPicker, setShowPicker] = useState(false);
    const { t } = useLanguage();

    useEffect(() => {
        if (visible) {
            setActiveTab(initialTab);
            setDaily(currentDaily > 0 ? currentDaily.toString() : '');
            setMonthly(currentMonthly > 0 ? currentMonthly.toString() : '');

            const limits: Record<string, string> = {};
            Object.entries(currentCategoryLimits).forEach(([id, limit]) => {
                if (limit > 0) limits[id] = limit.toString();
            });
            setCategoryLimits(limits);
        }
    }, [visible, currentDaily, currentMonthly, currentCategoryLimits]);

    const handleSave = () => {
        const d = parseFloat(daily) || 0;
        const m = parseFloat(monthly) || 0;

        const catLimits: Record<string, number> = {};
        Object.keys(categoryLimits).forEach(key => {
            const val = parseFloat(categoryLimits[key]);
            if (val > 0) catLimits[key] = val;
        });

        onSave(d, m, catLimits);
        onClose();
    };

    const updateCategoryLimit = (id: string, value: string) => {
        setCategoryLimits(prev => ({ ...prev, [id]: value }));
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    {Platform.OS === 'ios' && (
                        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                    )}

                    <TouchableWithoutFeedback>
                        <Animated.View
                            entering={SlideInDown.springify().damping(15)}
                            exiting={SlideOutDown.duration(200)}
                            style={styles.container}
                        >
                            <View style={styles.header}>
                                <Text style={styles.title}>{t('budget_limits')}</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                    <Ionicons name="close" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.tabsContainer}>
                                <View style={styles.tabs}>
                                    <TouchableOpacity
                                        style={[styles.tab, activeTab === 'general' && styles.activeTab]}
                                        onPress={() => setActiveTab('general')}
                                    >
                                        <Ionicons
                                            name={activeTab === 'general' ? "settings" : "settings-outline"}
                                            size={16}
                                            color={activeTab === 'general' ? "#fff" : "#64748B"}
                                            style={{ marginRight: 6 }}
                                        />
                                        <Text style={[styles.tabText, activeTab === 'general' && styles.activeTabText]}>{t('general')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.tab, activeTab === 'categories' && styles.activeTab]}
                                        onPress={() => setActiveTab('categories')}
                                    >
                                        <Ionicons
                                            name={activeTab === 'categories' ? "grid" : "grid-outline"}
                                            size={16}
                                            color={activeTab === 'categories' ? "#fff" : "#64748B"}
                                            style={{ marginRight: 6 }}
                                        />
                                        <Text style={[styles.tabText, activeTab === 'categories' && styles.activeTabText]}>{t('categories')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                                {activeTab === 'general' ? (
                                    <>
                                        <View style={styles.inputCard}>
                                            <View style={styles.cardHeader}>
                                                <View style={[styles.iconContainer, { backgroundColor: '#DBEAFE' }]}>
                                                    <Ionicons name="sunny" size={20} color="#2563EB" />
                                                </View>
                                                <Text style={styles.cardTitle}>{t('daily_spending_limit')}</Text>
                                            </View>
                                            <View style={styles.amountInputWrapper}>
                                                <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                                                <TextInput
                                                    style={styles.largeInput}
                                                    value={daily}
                                                    onChangeText={setDaily}
                                                    placeholder="0"
                                                    keyboardType="numeric"
                                                    placeholderTextColor="#CBD5E1"
                                                />
                                            </View>
                                            <Text style={styles.cardDesc}>{t('daily_limit_desc')}</Text>
                                        </View>

                                        <View style={styles.inputCard}>
                                            <View style={styles.cardHeader}>
                                                <View style={[styles.iconContainer, { backgroundColor: '#F3E8FF' }]}>
                                                    <Ionicons name="calendar" size={20} color="#9333EA" />
                                                </View>
                                                <Text style={styles.cardTitle}>{t('monthly_budget')}</Text>
                                            </View>
                                            <View style={styles.amountInputWrapper}>
                                                <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                                                <TextInput
                                                    style={styles.largeInput}
                                                    value={monthly}
                                                    onChangeText={setMonthly}
                                                    placeholder="0"
                                                    keyboardType="numeric"
                                                    placeholderTextColor="#CBD5E1"
                                                />
                                            </View>
                                            <Text style={styles.cardDesc}>{t('monthly_budget_desc')}</Text>
                                        </View>
                                    </>
                                ) : (
                                    <View>
                                        <View style={styles.infoBanner}>
                                            <Ionicons name="information-circle" size={20} color={Colors.light.tint} />
                                            <Text style={styles.infoText}>
                                                {t('limits_apply_month')}
                                            </Text>
                                        </View>

                                        <View style={styles.categoriesList}>
                                            {categories
                                                .filter(c => categoryLimits[c.id] !== undefined)
                                                .map(cat => (
                                                    <View key={cat.id} style={styles.categoryCard}>
                                                        <View style={styles.categoryLeft}>
                                                            <View style={[styles.catIcon, { backgroundColor: cat.color + '15' }]}>
                                                                <Ionicons name={cat.icon} size={22} color={cat.color} />
                                                            </View>
                                                            <Text style={styles.catName}>{t(cat.name as TranslationKeys)}</Text>
                                                        </View>
                                                        <View style={styles.categoryRight}>
                                                            <View style={styles.limitInputContainer}>
                                                                <Text style={styles.smallCurrency}>{currencySymbol}</Text>
                                                                <TextInput
                                                                    style={styles.limitInput}
                                                                    value={categoryLimits[cat.id]}
                                                                    onChangeText={(val) => updateCategoryLimit(cat.id, val)}
                                                                    placeholder="0"
                                                                    keyboardType="numeric"
                                                                    placeholderTextColor="#cbd5e1"
                                                                />
                                                            </View>
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    const newLimits = { ...categoryLimits };
                                                                    delete newLimits[cat.id];
                                                                    setCategoryLimits(newLimits);
                                                                }}
                                                                style={styles.deleteBtn}
                                                            >
                                                                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                ))}
                                        </View>

                                        <TouchableOpacity
                                            style={styles.addCategoryBtn}
                                            onPress={() => setShowPicker(true)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.addIconCircle}>
                                                <Ionicons name="add" size={24} color="#fff" />
                                            </View>
                                            <Text style={styles.addCategoryText}>{t('add_category_limit')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </ScrollView>

                            <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
                                <Text style={styles.saveButtonText}>{t('save_changes')}</Text>
                            </TouchableOpacity>

                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>

            <CategoryPickerModal
                visible={showPicker}
                onClose={() => setShowPicker(false)}
                categories={categories.filter(c => c.type === 'expense' && categoryLimits[c.id] === undefined)}
                onSelect={(cat) => updateCategoryLimit(cat.id, '')}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        height: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabsContainer: {
        marginBottom: 24,
        alignItems: 'center',
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
        padding: 4,
        width: '100%',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 16,
    },
    activeTab: {
        backgroundColor: Colors.light.tint,
        shadowColor: Colors.light.tint,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    tabText: {
        fontFamily: 'Prompt_500Medium',
        color: '#64748B',
        fontSize: 14,
    },
    activeTabText: {
        color: '#ffffff',
        fontFamily: 'Prompt_600SemiBold',
    },
    content: {
        flex: 1,
        marginBottom: 20,
    },
    inputCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: '#334155',
    },
    amountInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    currencyPrefix: {
        fontSize: 24,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
        marginRight: 8,
    },
    largeInput: {
        flex: 1,
        fontSize: 32,
        fontFamily: 'Prompt_700Bold',
        color: '#1E293B',
        padding: 0,
        height: 40,
    },
    cardDesc: {
        fontSize: 13,
        color: '#94A3B8',
        fontFamily: 'Prompt_400Regular',
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.tint + '10',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
        gap: 10,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: Colors.light.tint,
        fontFamily: 'Prompt_500Medium',
        lineHeight: 18,
    },
    categoriesList: {
        gap: 12,
        marginBottom: 24,
    },
    categoryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    categoryLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    catIcon: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    catName: {
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: '#334155',
        flex: 1,
    },
    categoryRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    limitInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        width: 100,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    smallCurrency: {
        fontSize: 14,
        fontFamily: 'Prompt_500Medium',
        color: '#64748B',
        marginRight: 4,
    },
    limitInput: {
        flex: 1,
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: '#1E293B',
        padding: 0,
    },
    deleteBtn: {
        padding: 8,
        backgroundColor: '#FEF2F2',
        borderRadius: 10,
    },
    addCategoryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        gap: 10,
    },
    addIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.light.tint,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addCategoryText: {
        fontSize: 15,
        fontFamily: 'Prompt_600SemiBold',
        color: Colors.light.tint,
    },
    saveButton: {
        backgroundColor: Colors.light.tint,
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        elevation: 4,
        shadowColor: Colors.light.tint,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        marginHorizontal: 24,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 17,
        fontFamily: 'Prompt_700Bold',
    },
});
