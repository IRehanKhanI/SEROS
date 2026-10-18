import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { NavTab } from '../types';
import { Icon } from './Icon';
import { colors } from '../theme/colors';

export const BottomNav: React.FC = () => {
  const { currentView, navigateToTab } = useApp();
  const insets = useSafeAreaInsets();

  const tabs: { id: NavTab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'rooms', label: 'Rooms', icon: 'meeting_room' },
    { id: 'energy', label: 'Energy', icon: 'bolt' },
    { id: 'devices', label: 'Devices', icon: 'power_settings_new' },
    { id: 'more', label: 'More', icon: 'grid_view' },
  ];

  return (
    <View style={[styles.navContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const isActive = currentView === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => navigateToTab(tab.id)}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              activeOpacity={0.8}
            >
              <Icon
                name={tab.icon}
                size={26}
                color={isActive ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    shadowColor: '#26372D',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
    zIndex: 50,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 4,
    height: 60,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 52,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 18,
  },
  tabButtonActive: {
    backgroundColor: colors.surfaceGreen,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '800',
    color: colors.primary,
  },
  tabLabelInactive: {
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
