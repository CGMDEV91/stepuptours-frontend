import { forwardRef } from 'react';
import { ScrollView, ScrollViewProps, Platform } from 'react-native';

export const PageScrollView = forwardRef<ScrollView, ScrollViewProps>(
    ({ style, contentContainerStyle, ...props }, ref) => {
        return (
            <ScrollView
                style={[{ flex: 1, minHeight: 0 }, style]}
                contentContainerStyle={contentContainerStyle}
                ref={ref}
                {...props}
                bounces={false}
                alwaysBounceVertical={false}
                overScrollMode="never"
                automaticallyAdjustContentInsets={false}
                contentInsetAdjustmentBehavior="never"
            />
        );
    }
);
PageScrollView.displayName = 'PageScrollView';