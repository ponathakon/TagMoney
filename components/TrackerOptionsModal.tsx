import { useLanguage } from '@/context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import Animated, { FadeInDown, SlideInDown, SlideOutDown } from 'react-native-reanimated';

interface TrackerOptionsModalProps {
    visible: boolean;
    onClose: () => void;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const TrackerOptionsModal: React.FC<TrackerOptionsModalProps> = ({ visible, onClose }) => {
    const router = useRouter();
    const { t } = useLanguage();

    const handleOptionSelect = (option: 'manual' | 'voice' | 'picture') => {
        onClose();
        switch (option) {
            case 'manual':
                router.push('/task/add-transaction');
                break;
            case 'voice':
                router.push('/task/voice-transaction');
                break;
            case 'picture':
                router.push('/task/picture-transaction');
                break;
        }
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
                    {/* Blur Background */}
                    {Platform.OS === 'ios' && (
                        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
                    )}

                    <TouchableWithoutFeedback>
                        <Animated.View
                            entering={SlideInDown.springify().damping(15)}
                            exiting={SlideOutDown.duration(200)}
                            style={styles.container}
                        >
                            {/* Glassmorphism Background */}
                            <View style={styles.glassBackground}>
                                {Platform.OS === 'ios' && (
                                    <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="light" />
                                )}
                                <View style={styles.glassOverlay} />
                            </View>

                            {/* Decorative Elements */}
                            <View style={styles.decorCircle1} />
                            <View style={styles.decorCircle2} />

                            {/* Handle Bar */}
                            <View style={styles.handleBar} />

                            {/* Header */}
                            <View style={styles.header}>
                                <Text style={styles.title}>{t('add_transaction')}</Text>
                                <Text style={styles.subtitle}>{t('choose_how_to_track')}</Text>
                            </View>

                            {/* Options */}
                            <View style={styles.optionsContainer}>
                                {/* Manual Option */}
                                <AnimatedTouchableOpacity
                                    entering={FadeInDown.delay(100).springify()}
                                    style={styles.optionCard}
                                    onPress={() => handleOptionSelect('manual')}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={['#6366F1', '#8B5CF6']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.optionGradient}
                                    >
                                        <Ionicons name="create" size={28} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.optionLabel}>{t('manual')}</Text>
                                    <Text style={styles.optionDesc}>{t('enter_details')}</Text>
                                </AnimatedTouchableOpacity>

                                {/* Voice Option */}
                                <AnimatedTouchableOpacity
                                    entering={FadeInDown.delay(200).springify()}
                                    style={styles.optionCard}
                                    onPress={() => handleOptionSelect('voice')}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={['#EC4899', '#F43F5E']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.optionGradient}
                                    >
                                        <Ionicons name="mic" size={28} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.optionLabel}>{t('voice')}</Text>
                                    <Text style={styles.optionDesc}>{t('speak_to_add')}</Text>
                                </AnimatedTouchableOpacity>

                                {/* Picture Option */}
                                <AnimatedTouchableOpacity
                                    entering={FadeInDown.delay(300).springify()}
                                    style={styles.optionCard}
                                    onPress={() => handleOptionSelect('picture')}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={['#10B981', '#14B8A6']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.optionGradient}
                                    >
                                        <Ionicons name="camera" size={28} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.optionLabel}>{t('picture')}</Text>
                                    <Text style={styles.optionDesc}>{t('scan_receipt_short')}</Text>
                                </AnimatedTouchableOpacity>
                            </View>

                            {/* Close Button */}
                            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                                <Text style={styles.closeButtonText}>{t('cancel')}</Text>
                            </TouchableOpacity>
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        marginHorizontal: 16,
        marginBottom: Platform.OS === 'ios' ? 100 : 90,
        borderRadius: 28,
        padding: 24,
        paddingTop: 16,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    glassBackground: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    glassOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    decorCircle1: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        top: -50,
        right: -30,
    },
    decorCircle2: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        bottom: 20,
        left: -30,
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.15)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    header: {
        marginBottom: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontFamily: 'Prompt_800ExtraBold',
        color: '#1F2937',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
        fontFamily: 'Prompt_400Regular',
    },
    optionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    optionCard: {
        alignItems: 'center',
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        marginHorizontal: 4,
    },
    optionGradient: {
        width: 60,
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        marginBottom: 10,
    },
    optionLabel: {
        fontSize: 15,
        fontFamily: 'Prompt_700Bold',
        color: '#1F2937',
    },
    optionDesc: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 2,
        fontFamily: 'Prompt_400Regular',
    },
    closeButton: {
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: '#6B7280',
    },
});
