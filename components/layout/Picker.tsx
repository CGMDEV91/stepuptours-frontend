// components/layout/Picker.tsx
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AMBER_DARK = '#D97706';

export interface PickerItem {
  id: string;
  label: string;
}

export interface PickerProps {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selectedId: string;
  onSelect: (id: string, label: string) => void;
  onClose: () => void;
  isDesktop: boolean;
  anchorRef: React.RefObject<any>;
}

export function Picker({ visible, title, items, selectedId, onSelect, onClose, isDesktop, anchorRef }: PickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{
    x: number;
    y: number;
    width: number;
    listMaxHeight: number;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      if (isDesktop && anchorRef.current) {
        anchorRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
          const screenHeight =
            Platform.OS === 'web' && typeof window !== 'undefined'
              ? window.innerHeight
              : 800;
          const dropdownTop = y + h + 4;
          const availableSpace = screenHeight - dropdownTop - 16;
          const listMaxHeight = Math.min(280, Math.max(80, availableSpace - 64));
          setDropdownPos({ x, y: dropdownTop, width: w, listMaxHeight });
        });
      }
    }
  }, [visible, isDesktop]);

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const searchBar = (
    <View style={styles.searchWrapper}>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search..."
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );

  const renderOptionList = (listMaxHeight: number) => (
    <FlatList
      data={filteredItems}
      keyExtractor={(item) => item.id}
      style={{ maxHeight: listMaxHeight }}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.pickerItem, item.id === selectedId && styles.pickerItemSelected]}
          onPress={() => { onSelect(item.id, item.label); onClose(); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.pickerItemText, item.id === selectedId && styles.pickerItemTextSelected]}>
            {item.label}
          </Text>
          {item.id === selectedId && <Ionicons name="checkmark" size={18} color={AMBER_DARK} />}
        </TouchableOpacity>
      )}
    />
  );

  // ── Desktop: dropdown flotante anclado al botón, altura dinámica ──────────
  if (isDesktop) {
    if (!visible || !dropdownPos) return null;
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Pressable
            style={[
              styles.desktopDropdown,
              {
                left: dropdownPos.x,
                top: dropdownPos.y,
                width: dropdownPos.width,
              },
            ]}
          >
            {searchBar}
            {renderOptionList(dropdownPos.listMaxHeight)}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ── Mobile: pantalla completa con slide ───────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.mobileFullscreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>
        </View>
        {searchBar}
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.pickerItem, item.id === selectedId && styles.pickerItemSelected]}
              onPress={() => { onSelect(item.id, item.label); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerItemText, item.id === selectedId && styles.pickerItemTextSelected]}>
                {item.label}
              </Text>
              {item.id === selectedId && <Ionicons name="checkmark" size={18} color={AMBER_DARK} />}
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mobileFullscreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 52 : 28,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  desktopDropdown: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 32px rgba(0,0,0,0.14)' } as any)
      : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 20,
        elevation: 12,
      }),
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    height: 40,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    height: 40,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  pickerItemSelected: {
    backgroundColor: '#FFFBEB',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  pickerItemTextSelected: {
    color: AMBER_DARK,
    fontWeight: '700',
  },
});
