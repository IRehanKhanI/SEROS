import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Icon, SerosLogo } from './Icon';
import { colors } from '../theme/colors';

export const Header: React.FC = () => {
  const { currentView, setCurrentView, settings, backendConnected } = useApp();
  const insets = useSafeAreaInsets();

  const isStackScreen = currentView === 'assistant' || currentView === 'settings' || currentView === 'onboarding';

  const getSubtitle = () => {
    switch (currentView) {
      case 'home':
        return 'Home';
      case 'rooms':
        return 'Rooms';
      case 'energy':
        return 'Energy';
      case 'devices':
        return 'Devices';
      case 'more':
        return 'More / Admin & Testing Hub';
      case 'assistant':
        return 'S.E.R.O.S. Ecosystem';
      case 'settings':
        return 'S.E.R.O.S. Ecosystem';
      case 'onboarding':
        return 'Easy Onboarding';
      default:
        return 'Smart Campus';
    }
  };

  const getStackTitle = () => {
    if (currentView === 'assistant') return 'Ai Voice Assistant & Insights';
    if (currentView === 'settings') return 'System Settings & Diagnostics';
    if (currentView === 'onboarding') return 'Welcome & First-Time Setup';
    return 'S.E.R.O.S.';
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.content}>
        {isStackScreen ? (
          <View style={styles.stackHeader}>
            <TouchableOpacity
              onPress={() => setCurrentView('more')}
              style={styles.backButton}
              activeOpacity={0.8}
              accessibilityLabel="Go back"
            >
              <Icon name="arrow_back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.titleCol}>
              <Text style={styles.stackTitle} numberOfLines={1}>
                {getStackTitle()}
              </Text>
              <Text style={styles.subtitle}>{getSubtitle()}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.mainTitleCol}>
            <View style={styles.titleRow}>
              <SerosLogo size={28} style={{ marginRight: 6 }} />
              <Text style={styles.mainTitle}>S.E.R.O.S.</Text>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText} numberOfLines={1}>
                  {settings.isDemoMode ? 'Demo Mode' : backendConnected ? 'Connected & Active' : 'Backend Offline'}
                </Text>
              </View>
            </View>
            <Text style={styles.subtitle}>{getSubtitle()}</Text>
          </View>
        )}

        <View style={styles.rightActions}>
          {settings.isDemoMode && (
            <View style={styles.demoBadge}>
              <Text style={styles.demoText}>Simulated</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => setCurrentView(currentView === 'settings' ? 'home' : 'settings')}
            style={styles.profileBtn}
            activeOpacity={0.8}
            accessibilityLabel="System Settings"
          >
            <Icon name="person" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'rgba(247, 244, 232, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(227, 229, 216, 0.6)',
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    paddingBottom: 12,
    zIndex: 50,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 52,
  },
  stackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  titleCol: {
    flex: 1,
    justifyContent: 'center',
  },
  stackTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  mainTitleCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primaryContainer,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  demoBadge: {
    backgroundColor: colors.surfacePeach,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  demoText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.tertiary,
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
