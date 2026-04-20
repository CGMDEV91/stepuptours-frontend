// components/layout/PageFlatList.tsx
// Page-level FlatList wrapper that locks bounce/overscroll/inset behaviour
// so pages hosting the Footer (as ListFooterComponent) never allow scrolling
// past the last element.
import { FlatList, FlatListProps } from 'react-native';

type Props<T> = FlatListProps<T> & { innerRef?: React.Ref<FlatList<T>> };

export function PageFlatList<T>(props: Props<T>) {
  const { innerRef, ...rest } = props;
  return (
    <FlatList
      ref={innerRef}
      {...rest}
      bounces={false}
      alwaysBounceVertical={false}
      overScrollMode="never"
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
    />
  );
}
