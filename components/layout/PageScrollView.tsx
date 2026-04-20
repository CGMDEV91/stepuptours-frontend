// components/layout/PageScrollView.tsx
// Page-level ScrollView wrapper that locks bounce/overscroll/inset behaviour
// so pages hosting the Footer never allow scrolling past the last element.
import { forwardRef } from 'react';
import { ScrollView, ScrollViewProps } from 'react-native';

export const PageScrollView = forwardRef<ScrollView, ScrollViewProps>(
  (props, ref) => (
    <ScrollView
      ref={ref}
      {...props}
      bounces={false}
      alwaysBounceVertical={false}
      overScrollMode="never"
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
    />
  )
);

PageScrollView.displayName = 'PageScrollView';
