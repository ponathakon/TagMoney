import { Colors } from '@/constants/theme';
import { useSignUp } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignUp() {
    const { isLoaded, signUp, setActive } = useSignUp();
    const router = useRouter();

    const [emailAddress, setEmailAddress] = useState('');
    const [password, setPassword] = useState('');
    const [pendingVerification, setPendingVerification] = useState(false);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    // Handle submission of sign-up form
    const onSignUpPress = async () => {
        if (!isLoaded) {
            return;
        }
        setLoading(true);

        try {
            // Create the user on Clerk
            await signUp.create({
                emailAddress,
                password,
            });

            // Send verification email
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

            // Change key to show verification form
            setPendingVerification(true);
        } catch (err: any) {
            Alert.alert('Error', err.errors[0]?.message);
        } finally {
            setLoading(false);
        }
    };

    // Handle verification code submission
    const onPressVerify = async () => {
        if (!isLoaded) {
            return;
        }
        setLoading(true);

        try {
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code,
            });

            await setActive({ session: completeSignUp.createdSessionId });
            // Navigation handled by root layout
        } catch (err: any) {
            Alert.alert('Error', err.errors[0]?.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Ionicons name="person-add" size={40} color={Colors.light.tint} />
                    </View>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Sign up to start tracking</Text>
                </View>

                {!pendingVerification ? (
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                autoCapitalize="none"
                                value={emailAddress}
                                placeholder="Enter your email"
                                onChangeText={(email) => setEmailAddress(email)}
                                style={styles.input}
                                placeholderTextColor="#999"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                value={password}
                                placeholder="Create a password"
                                secureTextEntry={true}
                                onChangeText={(password) => setPassword(password)}
                                style={styles.input}
                                placeholderTextColor="#999"
                            />
                        </View>

                        <TouchableOpacity style={styles.button} onPress={onSignUpPress} disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Sign Up</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Already have an account?</Text>
                            <Link href="/sign-in" asChild>
                                <TouchableOpacity>
                                    <Text style={styles.link}>Sign in</Text>
                                </TouchableOpacity>
                            </Link>
                        </View>
                    </View>
                ) : (
                    <View style={styles.form}>
                        <Text style={styles.instruction}>
                            We've sent a verification code to {emailAddress}
                        </Text>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Verification Code</Text>
                            <TextInput
                                value={code}
                                placeholder="123456"
                                onChangeText={(code) => setCode(code)}
                                style={styles.input}
                                keyboardType="number-pad"
                                placeholderTextColor="#999"
                            />
                        </View>

                        <TouchableOpacity style={styles.button} onPress={onPressVerify} disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Verify Email</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );

}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff',
    },
    container: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.light.tint + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontFamily: 'Prompt_700Bold',
        color: '#333',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        fontFamily: 'Prompt_400Regular',
    },
    instruction: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
        textAlign: 'center',
        fontFamily: 'Prompt_400Regular',
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontFamily: 'Prompt_600SemiBold',
        color: '#333',
    },
    input: {
        backgroundColor: '#f9f9f9',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
        fontSize: 16,
        fontFamily: 'Prompt_400Regular',
    },
    button: {
        backgroundColor: Colors.light.tint,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Prompt_700Bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
        gap: 4,
    },
    footerText: {
        color: '#666',
        fontSize: 14,
        fontFamily: 'Prompt_400Regular',
    },
    link: {
        color: Colors.light.tint,
        fontSize: 14,
        fontFamily: 'Prompt_700Bold',
    },
});
