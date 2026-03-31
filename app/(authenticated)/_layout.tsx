import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />


            <Stack.Screen name="task/transactions" options={{
                animation: 'slide_from_right',
                animationDuration: 10,
                headerShown: false,
            }} />

            <Stack.Screen name="task/add-transaction" options={{
                animation: 'slide_from_bottom',
                animationDuration: 10,
                headerShown: false,
            }} />

            <Stack.Screen name="task/categories" options={{
                animation: 'slide_from_bottom',
                animationDuration: 10,
                headerShown: false,
            }} />

            <Stack.Screen name="task/wallets" options={{
                animation: 'slide_from_bottom',
                animationDuration: 10,
                headerShown: false,
            }} />

            <Stack.Screen name="task/voice-transaction" options={{
                animation: 'slide_from_bottom',
                animationDuration: 10,
                headerShown: false,
            }} />

            <Stack.Screen name="task/picture-transaction" options={{
                animation: 'slide_from_bottom',
                animationDuration: 10,
                headerShown: false,
            }} />

            <Stack.Screen name="task/notifications" options={{
                headerShown: false,
            }} />

        </Stack >
    );
}
