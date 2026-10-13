import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { colors } from '../theme/colors';

export const MoreView: React.FC = () => {
  const {
    setCurrentView,
    navigateToTab,
    setIsRuleWizardOpen,
    pingLatency,
    isPinging,
    triggerDiagnosticsPing,
    sendChatMessage
  } = useApp();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handlePing = async () => {
    const lat = await triggerDiagnosticsPing();
    showToast(`All 3 diagnostic nodes responded OK in ${lat}ms!`);
  };

  const handleSuggestionClick = (query: string) => {
    sendChatMessage(query);
    setCurrentView('assistant');
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>More</Text>
          <Text style={styles.topBarSubtitle}>Admin & configuration hub</Text>
        </View>
        <TouchableOpacity
          onPress={() => setCurrentView('settings')}
          style={styles.settingsButton}
          activeOpacity={0.8}
          accessibilityLabel="Backend settings"
        >
          <Icon name="settings" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      {/* Authorized Tester Banner */}
      <View style={styles.testerBanner}>
        <View style={styles.rowAlign}>
          <View style={styles.shieldIconCircle}>
            <Icon name="verified_user" size={22} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.testerTitle}>Authorized Tester Mode</Text>
            <Text style={styles.testerSub}>
              Diagnostic controls & system override unlocked
            </Text>
          </View>
        </View>
        <View style={styles.versionPill}>
          <View style={styles.pulseDot} />
          <Text style={styles.versionText}>Live v2.4</Text>
        </View>
      </View>

      {/* Gemma Assistant Hero Card */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowAlign}>
            <View style={styles.robotCircle}>
              <Icon name="smart_toy" size={32} color={colors.tertiary} fill />
            </View>
            <View>
              <View style={styles.rowAlignCompact}>
                <Text style={styles.gemmaTitle}>Gemma Assistant</Text>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>Active</Text>
                </View>
              </View>
              <Text style={styles.gemmaSub}>AI Energy & Occupancy Co-pilot</Text>
            </View>
          </View>
          <Icon name="chat_bubble_outline" size={24} color={colors.textSecondary} />
        </View>

        <Text style={styles.gemmaBody}>
          Ask instant questions about school power consumption, classroom headcount anomalies, or upcoming billing forecasts.
        </Text>

        {/* Suggestion Pills */}
        <View style={styles.promptRow}>
          <TouchableOpacity
            onPress={() => handleSuggestionClick('Who used power after 6 PM?')}
            style={styles.promptPill}
            activeOpacity={0.8}
          >
            <Icon name="psychology" size={16} color={colors.primary} />
            <Text style={styles.promptPillText}>"Who used power after 6 PM?"</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSuggestionClick('Suggest 3 savings tips')}
            style={styles.promptPill}
            activeOpacity={0.8}
          >
            <Icon name="lightbulb" size={16} color={colors.primary} />
            <Text style={styles.promptPillText}>"Suggest 3 savings tips"</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => setCurrentView('assistant')}
          style={styles.talkBtn}
          activeOpacity={0.85}
        >
          <Icon name="forum" size={20} color="#FFFFFF" />
          <Text style={styles.talkBtnText}>Talk to Assistant</Text>
        </TouchableOpacity>
      </View>

      {/* System Alerts */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowAlign}>
            <View style={styles.alertIconCircle}>
              <Icon name="verified" size={18} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>System Alerts</Text>
          </View>
          <View style={styles.zeroCriticalPill}>
            <Text style={styles.zeroCriticalText}>0 Critical</Text>
          </View>
        </View>

        <View style={styles.tipBox}>
          <Icon name="tips_and_updates" size={22} color={colors.tertiary} />
          <View style={styles.colFlex}>
            <Text style={styles.tipTitle}>Helpful Tip from Yesterday</Text>
            <Text style={styles.tipSub}>
              AC unit remained running in empty Room 104 for 38 mins after students left. Automation rule drafted to auto-shutoff next time.
            </Text>
          </View>
        </View>
      </View>

      {/* Grouped Modules */}
      {/* 1. MONITORING */}
      <View style={styles.groupSection}>
        <View style={styles.rowBetween}>
          <View style={styles.rowAlign}>
            <Icon name="videocam" size={20} color={colors.primary} />
            <Text style={styles.groupTitle}>Monitoring</Text>
          </View>
          <Text style={styles.groupCount}>2 Tools</Text>
        </View>

        <TouchableOpacity
          onPress={() => navigateToTab('rooms')}
          style={styles.rowItem}
          activeOpacity={0.8}
        >
          <View style={styles.rowAlign}>
            <View style={[styles.moduleIconBox, { backgroundColor: colors.surfaceGreen }]}>
              <Icon name="stream" size={24} color={colors.primary} />
            </View>
            <View style={styles.colFlex}>
              <Text style={styles.moduleTitle}>Live Camera Feeds</Text>
              <Text style={styles.moduleSub} numberOfLines={1}>
                2 active camera streams · YOLO occupancy live
              </Text>
            </View>
          </View>
          <View style={styles.rowAlignCompact}>
            <View style={styles.onlinePill}>
              <Text style={styles.onlineText}>2 Online</Text>
            </View>
            <Icon name="chevron_right" size={22} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigateToTab('rooms')}
          style={styles.rowItem}
          activeOpacity={0.8}
        >
          <View style={styles.rowAlign}>
            <View style={[styles.moduleIconBox, { backgroundColor: colors.surfacePeach }]}>
              <Icon name="crop_square" size={24} color={colors.tertiary} />
            </View>
            <View style={styles.colFlex}>
              <Text style={styles.moduleTitle}>Zone Polygon Editor</Text>
              <Text style={styles.moduleSub} numberOfLines={1}>
                Calibrate detection areas & sensor boundaries
              </Text>
            </View>
          </View>
          <Icon name="chevron_right" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* 2. INSIGHTS & PREDICTIONS */}
      <View style={styles.groupSection}>
        <View style={styles.rowBetween}>
          <View style={styles.rowAlign}>
            <Icon name="insights" size={20} color={colors.primary} />
            <Text style={styles.groupTitle}>Insights & Predictions</Text>
          </View>
          <Text style={styles.groupCount}>3 Analytics Tools</Text>
        </View>

        <TouchableOpacity
          onPress={() => navigateToTab('energy')}
          style={styles.rowItem}
          activeOpacity={0.8}
        >
          <View style={styles.rowAlign}>
            <View style={[styles.moduleIconBox, { backgroundColor: colors.surfaceGreen }]}>
              <Icon name="analytics" size={24} color={colors.primary} />
            </View>
            <View style={styles.colFlex}>
              <Text style={styles.moduleTitle}>Detailed Analytics</Text>
              <Text style={styles.moduleSub}>Daily and weekly campus electrical patterns</Text>
            </View>
          </View>
          <Icon name="chevron_right" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigateToTab('energy')}
          style={styles.rowItem}
          activeOpacity={0.8}
        >
          <View style={styles.rowAlign}>
            <View style={[styles.moduleIconBox, { backgroundColor: colors.surfaceYellow }]}>
              <Icon name="receipt_long" size={24} color={colors.tertiary} />
            </View>
            <View style={styles.colFlex}>
              <View style={styles.rowAlignCompact}>
                <Text style={styles.moduleTitle}>Tariff & Bill Forecaster</Text>
                <View style={styles.geminiBadge}>
                  <Text style={styles.geminiBadgeText}>Gemini 3</Text>
                </View>
              </View>
              <Text style={styles.moduleSub}>Predict month-end utility bills with AI simulation</Text>
            </View>
          </View>
          <Icon name="chevron_right" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* 3. CONTROL & AUTOMATION */}
      <View style={styles.groupSection}>
        <View style={styles.rowBetween}>
          <View style={styles.rowAlign}>
            <Icon name="tune" size={20} color={colors.primary} />
            <Text style={styles.groupTitle}>Control & Automation</Text>
          </View>
          <Text style={styles.groupCount}>2 Modules</Text>
        </View>

        <TouchableOpacity
          onPress={() => navigateToTab('devices')}
          style={styles.rowItem}
          activeOpacity={0.8}
        >
          <View style={styles.rowAlign}>
            <View style={[styles.moduleIconBox, { backgroundColor: colors.surfaceGreen }]}>
              <Icon name="toggle_on" size={24} color={colors.primary} />
            </View>
            <View style={styles.colFlex}>
              <Text style={styles.moduleTitle}>Device Inventory & Relays</Text>
              <Text style={styles.moduleSub}>8 connected campus fixtures, smart outlets & ACs</Text>
            </View>
          </View>
          <View style={styles.rowAlignCompact}>
            <View style={styles.onlinePill}>
              <Text style={styles.onlineText}>8 Relays</Text>
            </View>
            <Icon name="chevron_right" size={22} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setIsRuleWizardOpen(true)}
          style={[styles.rowItem, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}
          activeOpacity={0.8}
        >
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <View style={[styles.moduleIconBox, { backgroundColor: colors.surfaceYellow }]}>
                <Icon name="auto_fix_high" size={24} color={colors.textPrimary} />
              </View>
              <View>
                <Text style={styles.moduleTitle}>Rule Builder Wizard</Text>
                <Text style={styles.moduleSub}>Create automated energy logic</Text>
              </View>
            </View>
            <Icon name="chevron_right" size={22} color={colors.textSecondary} />
          </View>

          <View style={styles.rulePreviewBar}>
            <View style={styles.rowAlignCompact}>
              <View style={styles.previewWhen}>
                <Text style={styles.previewWhenText}>WHEN</Text>
              </View>
              <Text style={styles.previewBody}>Occupancy = 0 for 15m</Text>
              <View style={styles.previewThen}>
                <Text style={styles.previewThenText}>THEN</Text>
              </View>
              <Text style={styles.previewBody}>Turn off AC & Lights</Text>
            </View>
            <Icon name="check_circle" size={18} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* 4. DIAGNOSTICS & SYSTEM HEALTH */}
      <View style={styles.groupSection}>
        <View style={styles.rowBetween}>
          <View style={styles.rowAlign}>
            <Icon name="monitor_heart" size={20} color={colors.primary} />
            <Text style={styles.groupTitle}>Diagnostics & System Health</Text>
          </View>
          <View style={styles.allHealthyBadge}>
            <Text style={styles.allHealthyText}>All Healthy</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <View style={[styles.moduleIconBox, { backgroundColor: colors.surfaceGreen }]}>
                <Icon name="dns" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.moduleTitle}>Connection Diagnostics</Text>
                <Text style={styles.moduleSub}>
                  Latency {pingLatency}ms · Edge Gateway Online
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handlePing}
              disabled={isPinging}
              style={styles.pingBtn}
              activeOpacity={0.8}
            >
              <Icon name="sync" size={16} color={colors.primary} />
              <Text style={styles.pingBtnText}>{isPinging ? 'Testing...' : 'Ping'}</Text>
            </TouchableOpacity>
          </View>

          {/* Triplet status boxes */}
          <View style={styles.tripletRow}>
            <View style={styles.tripletBox}>
              <View style={styles.tripletDotRow}>
                <View style={styles.tripletDot} />
                <Text style={styles.tripletLabel}>API</Text>
              </View>
              <Text style={styles.tripletVal}>Connected</Text>
              <Text style={styles.tripletSub}>FastAPI 0.95</Text>
            </View>

            <View style={styles.tripletBox}>
              <View style={styles.tripletDotRow}>
                <View style={styles.tripletDot} />
                <Text style={styles.tripletLabel}>Database</Text>
              </View>
              <Text style={styles.tripletVal}>Linked</Text>
              <Text style={styles.tripletSub}>TimescaleDB</Text>
            </View>

            <View style={styles.tripletBox}>
              <View style={styles.tripletDotRow}>
                <View style={styles.tripletDot} />
                <Text style={styles.tripletLabel}>Video</Text>
              </View>
              <Text style={styles.tripletVal}>30 FPS</Text>
              <Text style={styles.tripletSub}>YOLOv8 n</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 5. ACCESSIBILITY & ABOUT */}
      <View style={styles.groupSection}>
        <View style={styles.rowAlign}>
          <Icon name="accessibility_new" size={20} color={colors.primary} />
          <Text style={styles.groupTitle}>Accessibility & About</Text>
        </View>

        <TouchableOpacity
          onPress={() => setCurrentView('settings')}
          style={styles.rowItem}
          activeOpacity={0.8}
        >
          <View style={styles.rowAlign}>
            <View style={[styles.moduleIconBox, { backgroundColor: colors.surfacePeach }]}>
              <Icon name="record_voice_over" size={24} color={colors.tertiary} />
            </View>
            <View style={styles.colFlex}>
              <Text style={styles.moduleTitle}>Text Size & Voice Settings</Text>
              <Text style={styles.moduleSub}>High-contrast, large text, spoken alerts</Text>
            </View>
          </View>
          <View style={styles.configurePill}>
            <Text style={styles.configureText}>Configure</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setCurrentView('onboarding')}
          style={styles.rowItem}
          activeOpacity={0.8}
        >
          <View style={styles.rowAlign}>
            <View style={[styles.moduleIconBox, { backgroundColor: colors.canvas }]}>
              <Icon name="info" size={24} color={colors.textSecondary} />
            </View>
            <View style={styles.colFlex}>
              <Text style={styles.moduleTitle}>About S.E.R.O.S.</Text>
              <Text style={styles.moduleSub}>Smart Energy & Room Optimization System</Text>
            </View>
          </View>
          <Text style={styles.versionSub}>v2.4 (Build 108)</Text>
        </TouchableOpacity>
      </View>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <View style={styles.floatingToast}>
          <View style={styles.rowAlign}>
            <Icon name="check_circle" size={20} color="#80d997" fill />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
          <Text style={styles.toastMs}>{pingLatency}ms</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  topBarTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  topBarSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  testerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceYellow,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(159, 104, 0, 0.2)',
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowAlignCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colFlex: {
    flex: 1,
  },
  shieldIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.tertiaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  testerSub: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  versionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.7)',
    gap: 14,
  },
  robotCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfacePeach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemmaTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  activePill: {
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  gemmaSub: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  gemmaBody: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  promptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.8)',
    gap: 6,
  },
  promptPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  talkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    minHeight: 50,
    gap: 8,
  },
  talkBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  alertIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  zeroCriticalPill: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  zeroCriticalText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3f4940',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surfacePeach,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 221, 180, 0.8)',
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  tipSub: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
    marginTop: 2,
  },
  groupSection: {
    gap: 8,
  },
  groupTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  groupCount: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  moduleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  moduleSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  onlinePill: {
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  geminiBadge: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  geminiBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.secondary,
  },
  rulePreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.canvas,
    borderRadius: 14,
    padding: 10,
  },
  previewWhen: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  previewWhenText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
  },
  previewThen: {
    backgroundColor: colors.tertiaryContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  previewThenText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
  },
  previewBody: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  allHealthyBadge: {
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  allHealthyText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  pingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pingBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tripletRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tripletBox: {
    flex: 1,
    backgroundColor: colors.canvas,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.6)',
  },
  tripletDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  tripletLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  tripletVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  tripletSub: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  configurePill: {
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  configureText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  versionSub: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  floatingToast: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#23342a',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 99,
    elevation: 6,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toastMs: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.accentLime,
  },
});
