import { Category } from '@/constants/categories';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKeys } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CategoryGridProps {
    categories: Category[];
    onSelect: (category: Category) => void;
    selectedId?: string | null;
}

export const CategoryGrid = ({ categories, onSelect, selectedId }: CategoryGridProps) => {
    const { t } = useLanguage();
    return (
        <View style={styles.grid}>
            {categories.map((cat) => (
                <TouchableOpacity
                    key={cat.id}
                    style={[
                        styles.item,
                        selectedId === cat.id && styles.itemActive,
                        selectedId === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color }
                    ]}
                    onPress={() => onSelect(cat)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.iconCircle, { backgroundColor: cat.color + '20' }]}>
                        <Ionicons name={cat.icon} size={24} color={cat.color} />
                    </View>
                    <Text
                        style={[
                            styles.name,
                            selectedId === cat.id && { color: cat.color, fontWeight: '700' }
                        ]}
                        numberOfLines={1}
                    >
                        {t(cat.name as TranslationKeys)}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    item: {
        width: '30%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#eee',
        backgroundColor: '#fff',
    },
    itemActive: {
        borderColor: 'transparent',
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    name: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        fontFamily: 'Prompt_400Regular',
    },
});
