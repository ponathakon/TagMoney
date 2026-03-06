import { Category } from '@/constants/categories';
import { useLanguage } from '@/context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { CategoryGrid } from './CategoryGrid';

interface CategoryPickerModalProps {
    visible: boolean;
    onClose: () => void;
    categories: Category[];
    onSelect: (category: Category) => void;
}

export const CategoryPickerModal = ({ visible, onClose, categories, onSelect }: CategoryPickerModalProps) => {
    const { t } = useLanguage();
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
                                <Text style={styles.title}>{t('select_category')}</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                    <Ionicons name="close" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                                <CategoryGrid
                                    categories={categories}
                                    onSelect={(cat) => {
                                        onSelect(cat);
                                        onClose();
                                    }}
                                />
                            </ScrollView>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        height: '70%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontFamily: 'Prompt_700Bold',
        color: '#1F2937',
    },
    closeBtn: {
        padding: 4,
    },
    content: {
        flex: 1,
    },
});
