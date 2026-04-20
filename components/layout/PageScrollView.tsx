// components/layout/PageScrollView.tsx
import { forwardRef } from 'react';
import { ScrollView, ScrollViewProps, Platform } from 'react-native';

export const PageScrollView = forwardRef<ScrollView, ScrollViewProps>(
    ({ style, contentContainerStyle, ...props }, ref) => (
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
            scrollIndicatorInsets={{ right: 1 }}
            {...(Platform.OS === 'web' && {
                // @ts-ignore
                style: [{ flex: 1, minHeight: 0, WebkitOverflowScrolling: 'auto' }, style],
            })}
        />
    )
);
PageScrollView.displayName = 'PageScrollView';