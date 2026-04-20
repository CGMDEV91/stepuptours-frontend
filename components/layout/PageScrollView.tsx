import { forwardRef } from 'react';
import { ScrollView, ScrollViewProps, Platform, Text, View } from 'react-native';

export const PageScrollView = forwardRef<ScrollView, ScrollViewProps>(
    ({ style, contentContainerStyle, children, ...props }, ref) => {
        return (
            <ScrollView
                style={[{ flex: 1, minHeight: 0 }, style]}
                contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
                ref={ref}
                {...props}
                bounces={false}
                alwaysBounceVertical={false}
                overScrollMode="never"
                automaticallyAdjustContentInsets={false}
                contentInsetAdjustmentBehavior="never"
                onLayout={(e) => {
                    const { height } = e.nativeEvent.layout;
                    console.log('ScrollView height:', height);
                }}
                onContentSizeChange={(w, h) => {
                    console.log('Content height:', h);
                }}
            >
                {children}
                {Platform.OS === 'web' && (
                    <View style={{ backgroundColor: 'red', padding: 10 }}>
                        <Text style={{ color: 'white', fontSize: 12 }}>
                            DEBUG: si ves esto hay contenido extra
                        </Text>
                    </View>
                )}
            </ScrollView>
        );
    }
);
PageScrollView.displayName = 'PageScrollView';