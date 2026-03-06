import { TrackerOptionsModal } from '@/components/TrackerOptionsModal';
import { Colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
    const insets = useSafeAreaInsets();
    const [showTrackerOptions, setShowTrackerOptions] = useState(false);
    const { t } = useLanguage();

    return (
        <>
            <Tabs
                screenOptions={{
                    headerShown: false,
                    animation: 'shift',
                    tabBarBackground: () => (
                        <View style={styles.tabBarBackground}>
                            <BlurView
                                intensity={90}
                                style={StyleSheet.absoluteFill}
                                tint="light"
                            />
                            <View style={styles.tabBarGlassOverlay} />
                        </View>
                    ),
                    tabBarStyle: {
                        position: 'absolute',
                        bottom: insets.bottom,
                        left: 16,
                        right: 16,
                        backgroundColor: 'transparent',
                        borderRadius: 28,
                        height: 70,
                        elevation: 0,
                        shadowColor: '#6366F1',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.25,
                        shadowRadius: 20,
                        borderTopWidth: 0,
                        paddingBottom: 0,
                    },
                    tabBarItemStyle: {
                        paddingVertical: 8,
                    },
                    tabBarActiveTintColor: Colors.light.tint,
                    tabBarInactiveTintColor: '#94A3B8',
                    tabBarShowLabel: true,
                    tabBarLabelStyle: {
                        fontSize: 10,
                        fontFamily: 'Prompt_600SemiBold',
                        marginTop: 2,
                    },
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: t('tab_home'),
                        tabBarIcon: ({ color, focused }) => (
                            <View style={[styles.iconContainer, focused && styles.activeIcon]}>
                                <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="BudgetAndControl"
                    options={{
                        title: t('tab_control'),
                        tabBarIcon: ({ color, focused }) => (
                            <View style={[styles.iconContainer, focused && styles.activeIcon]}>
                                <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={22} color={color} />
                            </View>
                        ),
                    }}
                />


                <Tabs.Screen
                    name="track"
                    listeners={{
                        tabPress: (e) => {
                            e.preventDefault();
                            setShowTrackerOptions(true);
                        },
                    }}
                    options={{
                        title: '',
                        tabBarIconStyle: {
                            marginTop: -5,
                        },
                        tabBarIcon: ({ focused }) => (
                            <View style={styles.addButtonWrapper}>
                                <LinearGradient
                                    colors={['#6366F1', '#8B5CF6']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.addButton}
                                >
                                    <Ionicons name="add" size={28} color="#fff" />
                                </LinearGradient>
                            </View>
                        ),
                    }}
                />

                <Tabs.Screen
                    name="AiMode"
                    options={{
                        title: t('tab_ai'),
                        tabBarStyle: { display: 'none' },
                        tabBarIcon: ({ color, focused }) => (
                            <View style={[styles.iconContainer, focused && styles.activeIcon]}>
                                <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={22} color={color} />
                            </View>
                        ),
                    }}
                />

                <Tabs.Screen
                    name="profile"
                    options={{
                        title: t('tab_profile'),
                        tabBarIcon: ({ color, focused }) => (
                            <View style={[styles.iconContainer, focused && styles.activeIcon]}>
                                <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
                            </View>
                        ),
                    }}
                />
            </Tabs>
            <TrackerOptionsModal visible={showTrackerOptions} onClose={() => setShowTrackerOptions(false)} />
        </>
    );
}

const styles = StyleSheet.create({
    tabBarBackground: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    tabBarGlassOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 32,
        borderRadius: 16,
    },
    activeIcon: {
        backgroundColor: Colors.light.tint + '15',
    },
    addButtonWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
    },
    addButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
});
