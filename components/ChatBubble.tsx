import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export interface ChatBubbleProps {
    message: { role: 'user' | 'assistant'; content: string };
    index: number;
}

export const ChatBubble = ({ message }: ChatBubbleProps) => {
    const isDark = useColorScheme() === 'dark';
    const isUser = message.role === 'user';

    return (
        <Animated.View
            entering={FadeInDown.delay(50).damping(12)}
            style={isUser ? styles.containerUser : styles.containerAssistant}
        >
            {isUser ? (
                <LinearGradient
                    colors={['#6366F1', '#8B5CF6', '#A855F7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.bubble, styles.bubbleUser]}
                >
                    <Text style={[styles.text, styles.textUser, { color: '#ffffffff' }]}>
                        {message.content}
                    </Text>
                </LinearGradient>
            ) : (
                <View style={[styles.bubbleAssistant]}>
                    <View style={styles.assistantIconContainer}>
                        <Ionicons name="sparkles" size={20} color={isDark ? '#A78BFA' : '#8B5CF6'} />
                    </View>
                    <View style={styles.assistantTextContainer}>
                        <Text style={[
                            styles.text,
                            { color: isDark ? '#ECECEC' : '#0D0D0D' }
                        ]}>
                            {message.content}
                        </Text>
                    </View>
                </View>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    containerUser: {
        width: '100%',
        marginVertical: 15,
        flexDirection: 'row',
        paddingHorizontal: 16,
        justifyContent: 'flex-end',
    },
    containerAssistant: {
        width: '100%',
        marginVertical: 8,
        flexDirection: 'row',
        paddingHorizontal: 16,
        justifyContent: 'flex-start',
    },
    bubble: {
        maxWidth: '85%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
    },
    bubbleUser: {
        borderBottomRightRadius: 4,
    },
    bubbleAssistant: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        maxWidth: '100%',
    },
    assistantIconContainer: {
        marginRight: 12,
        marginTop: 10,
        marginBottom: 10,
    },
    assistantTextContainer: {
        flexShrink: 1,
    },

    text: {
        fontSize: 15,
        lineHeight: 24,
    },
    textUser: {
        fontFamily: 'Prompt_500Medium',
    }
});
