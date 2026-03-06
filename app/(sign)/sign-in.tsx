import { Colors } from '@/constants/theme';
import { useSignIn, useSSO } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
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

export default function SignIn() {
    const { signIn, setActive, isLoaded } = useSignIn();
    const router = useRouter();
    const [emailAddress, setEmailAddress] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { startSSOFlow } = useSSO();


    // Handle standard email/password login
    const onSignInPress = async () => {
        if (!isLoaded) {
            return;
        }
        setLoading(true);
        try {
            const completeSignIn = await signIn.create({
                identifier: emailAddress,
                password,
            });

            // This indicates the user is signed in
            await setActive({ session: completeSignIn.createdSessionId });
            // Navigation is handled by the root layout's useEffect
        } catch (err: any) {
            Alert.alert('Error', err.errors[0]?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const onGoogleSignIn = async () => {
        try {
            const { createdSessionId, setActive, signIn, signUp } = await startSSOFlow({
                strategy: 'oauth_google',
                redirectUrl: AuthSession.makeRedirectUri(),
            });
            console.log("createdSessionId", createdSessionId);

            if (createdSessionId) {
                setActive!({
                    session: createdSessionId,
                    navigate: async ({ session }) => {
                        if (session?.currentTask) {
                            console.log(session?.currentTask)
                            return
                        }
                        router.push('/')
                    }
                });
            }
        } catch (error) {
            console.log(error);
        }
    };

    const onFacebookSignIn = async () => {
        try {
            const { createdSessionId, setActive, signIn, signUp } = await startSSOFlow({
                strategy: 'oauth_facebook',
                redirectUrl: AuthSession.makeRedirectUri(),
            });
            console.log("createdSessionId", createdSessionId);

            if (createdSessionId) {
                setActive!({
                    session: createdSessionId,
                    navigate: async ({ session }) => {
                        if (session?.currentTask) {
                            console.log(session?.currentTask)
                            return
                        }
                        router.push('/')
                    }
                });
            }
        } catch (error) {
            console.log(error);
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
                        <Ionicons name="wallet" size={40} color={Colors.light.tint} />
                    </View>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Sign in to your account</Text>
                </View>

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
                            placeholder="Enter your password"
                            secureTextEntry={true}
                            onChangeText={(password) => setPassword(password)}
                            style={styles.input}
                            placeholderTextColor="#999"
                        />
                    </View>

                    <TouchableOpacity style={styles.button} onPress={onSignInPress} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Sign In</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or continue with</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity style={styles.googleButton} onPress={onGoogleSignIn}>
                        <Ionicons name="logo-google" size={20} color="#333" />
                        <Text style={styles.googleButtonText}>Google</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.googleButton} onPress={onFacebookSignIn}>
                        <Ionicons name="logo-facebook" size={20} color="#333" />
                        <Text style={styles.googleButtonText}>Facebook</Text>
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account?</Text>
                        <Link href="/sign-up" asChild>
                            <TouchableOpacity>
                                <Text style={styles.link}>Sign up</Text>
                            </TouchableOpacity>
                        </Link>
                    </View>

                </View>
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
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#eee',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#999',
        fontSize: 14,
        fontFamily: 'Prompt_500Medium',
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 16,
        borderRadius: 12,
        gap: 12,
    },
    googleButtonText: {
        fontSize: 16,
        fontFamily: 'Prompt_600SemiBold',
        color: '#333',
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
