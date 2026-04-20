import { forwardRef, useEffect, useRef } from 'react';
import { ScrollView, ScrollViewProps, Platform, Text, View } from 'react-native';

export const PageScrollView = forwardRef<ScrollView, ScrollViewProps>(
    ({ style, contentContainerStyle, ...props }, ref) => {
        const internalRef = useRef<ScrollView>(null);
        const actualRef = (ref as any) || internalRef;

        useEffect(() => {
            if (Platform.OS !== 'web') return;
            const node = (actualRef.current as any)?._nativeTag || actualRef.current;
            const el = document.querySelector('[data-testid="page-scroll"]');
            if (el) {
                const div = document.createElement('div');
                div.style.cssText = 'position:fixed;top:0;left:0;background:red;color:white;font-size:12px;z-index:99999;padding:4px';
                div.id = 'scroll-debug';
                document.body.appendChild(div);
                el.addEventListener('scroll', () => {
                    const d = document.getElementById('scroll-debug');
                    if (d) d.textContent = `scrollTop:${el.scrollTop} scrollH:${el.scrollHeight} clientH:${el.clientHeight}`;
                });
            }
        }, []);

        return (
            <ScrollView
                style={[{ flex: 1, minHeight: 0 }, style]}
                contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
                ref={actualRef}
                {...props}
                bounces={false}
                alwaysBounceVertical={false}
                overScrollMode="never"
                automaticallyAdjustContentInsets={false}
                contentInsetAdjustmentBehavior="never"
                // @ts-ignore
                data-testid="page-scroll"
            />
        );
    }
);
PageScrollView.displayName = 'PageScrollView';