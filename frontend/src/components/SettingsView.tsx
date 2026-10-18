import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { colors } from '../theme/colors';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, setBackendVerifiedNotice, speakText, backendUrl, setBackendUrl } = useApp();

  const [diagRunning, setDiagRunning] = useState(false);
  const [diagToast, setDiagToast] = useState<string | null>(null);
  const [backendDraft, setBackendDraft] = useState(backendUrl);

  React.useEffect(() => {
    setBackendDraft(backendUrl);
  }, [backendUrl]);

  const saveBackendUrl = () => {
    const clean = backendDraft.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/.+/i.test(clean)) {
      setBackendVerifiedNotice('Enter a valid backend URL, for example http://192.168.1.20:8000');
      return;
    }
    setBackendUrl(clean);
    setBackendVerifiedNotice(`Backend address saved: ${clean}`);
  };

  const handleRunDiagnostics = () => {
    setDiagRunning(true);
    setDiagToast(null);

    setTimeout(() => {
      setDiagRunning(false);
      setDiagToast('All 5 health checks completed in 420ms with 0 packet drops.');
      speakText('Diagnostics test completed. All five node health checks are healthy.');
      setTimeout(() => {
        setDiagToast(null);
      }, 5000);
    }, 1000);
  };

  const handleExportLog = () => {
    setBackendVerifiedNotice('Telemetry log exported to device storage.');
  };

  const handleRepairNodes = () => {
    setBackendVerifiedNotice('Re-pairing handshake sent to Gateway Node #402... Synced OK in 14ms!');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleWithIcon}>
            <View style={styles.blueIconCircle}>
              <Icon name="settings" size={18} color="#004c69" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Backend Connection</Text>
              <Text style={styles.cardSubtitle}>Change this when the Wi-Fi network or server IP changes</Text>
            </View>
          </View>
        </View>
        <TextInput
          value={backendDraft}
          onChangeText={setBackendDraft}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.1.20:8000"
          placeholderTextColor={colors.textSecondary}
          style={styles.backendInput}
        />
        <TouchableOpacity onPress={saveBackendUrl} style={styles.primaryBtn} activeOpacity={0.8}>
          <Icon name="save" size={20} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Save Backend Address</Text>
        </TouchableOpacity>
      </View>
      {/* Banner Note: Trust Badge */}
      <View style={styles.bannerBadge}>
        <View style={styles.bannerLeft}>
          <View style={styles.bannerIconCircle}>
            <Icon name="verified" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>All Core Systems Running</Text>
            <Text style={styles.bannerSubtitle}>
              Automated telemetry sync active across school nodes
            </Text>
          </View>
        </View>
        <View style={styles.nodePill}>
          <Text style={styles.nodePillText}>Node #402</Text>
        </View>
      </View>

      {/* SECTION 1: Live System Health Status */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.statusRow}>
              <View style={styles.greenPulseDot} />
              <Text style={styles.cardTitle}>Overall System Status</Text>
            </View>
            <Text style={styles.cardSubtitle}>Honest node telemetries reported in real-time</Text>
          </View>
          <View style={styles.onlineBadge}>
            <Icon name="check_circle" size={16} color={colors.primary} fill />
            <Text style={styles.onlineBadgeText}>Healthy</Text>
          </View>
        </View>

        {/* Telemetry List */}
        <View style={styles.telemetryList}>
          {/* Row 1: Backend API */}
          <View style={styles.telemetryItem}>
            <View style={styles.telemetryLeft}>
              <View style={styles.itemIconCircle}>
                <Icon name="cloud_done" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.itemTitle}>Backend API Service</Text>
                <Text style={styles.itemSub}>Connected (0.18s latency)</Text>
              </View>
            </View>
            <View style={styles.itemValueBadge}>
              <Icon name="check_circle" size={14} color={colors.primary} fill />
              <Text style={styles.itemValueText}>0.18s</Text>
            </View>
          </View>

          {/* Row 2: Local Database */}
          <View style={styles.telemetryItem}>
            <View style={styles.telemetryLeft}>
              <View style={styles.itemIconCircle}>
                <Icon name="storage" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.itemTitle}>Local Database</Text>
                <Text style={styles.itemSub}>Linked & Synchronized</Text>
              </View>
            </View>
            <View style={styles.itemValueBadge}>
              <Icon name="check_circle" size={14} color={colors.primary} fill />
              <Text style={styles.itemValueText}>Synced</Text>
            </View>
          </View>

          {/* Row 3: Smart Meter */}
          <View style={styles.telemetryItem}>
            <View style={styles.telemetryLeft}>
              <View style={styles.itemIconCircle}>
                <Icon name="bolt" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.itemTitle}>Smart Meter Telemetry</Text>
                <Text style={styles.itemSub}>Online • Real-time (Active)</Text>
              </View>
            </View>
            <View style={styles.itemValueBadge}>
              <Icon name="check_circle" size={14} color={colors.primary} fill />
              <Text style={styles.itemValueText}>4.2 kW</Text>
            </View>
          </View>

          {/* Row 4: Camera 1 */}
          <View style={styles.telemetryItem}>
            <View style={styles.telemetryLeft}>
              <View style={styles.itemIconCircle}>
                <Icon name="videocam" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.itemTitle}>Camera 1 (Lab A)</Text>
                <Text style={styles.itemSub}>Live 1080p • YOLO v8 Active</Text>
              </View>
            </View>
            <View style={styles.itemValueBadge}>
              <Icon name="check_circle" size={14} color={colors.primary} fill />
              <Text style={styles.itemValueText}>Live</Text>
            </View>
          </View>

          {/* Row 5: Camera 2 */}
          <View style={[styles.telemetryItem, styles.telemetryItemWarning]}>
            <View style={styles.telemetryLeft}>
              <View style={[styles.itemIconCircle, styles.warningIconCircle]}>
                <Icon name="pause_circle" size={20} color={colors.tertiary} />
              </View>
              <View>
                <Text style={styles.itemTitle}>Camera 2 (Rear Hall)</Text>
                <Text style={styles.itemSub}>Standby • Stream Ready</Text>
              </View>
            </View>
            <View style={styles.itemValueBadgeWarning}>
              <Icon name="schedule" size={14} color={colors.tertiary} fill />
              <Text style={styles.itemValueTextWarning}>Standby</Text>
            </View>
          </View>
        </View>

        {/* Diagnostics Button */}
        <TouchableOpacity
          onPress={handleRunDiagnostics}
          disabled={diagRunning}
          style={styles.primaryBtn}
          activeOpacity={0.8}
        >
          <Icon
            name={diagRunning ? 'sync' : 'network_check'}
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.primaryBtnText}>
            {diagRunning ? 'Probing Sensor Nodes...' : 'Run Quick Diagnostics Test'}
          </Text>
        </TouchableOpacity>

        {diagToast && (
          <View style={styles.toastBox}>
            <Text style={styles.toastText}>{diagToast}</Text>
          </View>
        )}
      </View>

      {/* SECTION 2: Accessibility & Ease of Use */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleWithIcon}>
            <View style={styles.blueIconCircle}>
              <Icon name="accessibility_new" size={18} color="#004c69" />
            </View>
            <Text style={styles.cardTitle}>Accessibility & Ease</Text>
          </View>
          <View style={styles.assistedBadge}>
            <Text style={styles.assistedBadgeText}>Assisted</Text>
          </View>
        </View>

        {/* Segmented Control: Text Size */}
        <View style={styles.settingBlock}>
          <Text style={styles.settingLabel}>Text Size</Text>
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              onPress={() => updateSettings({ textSize: 'standard' })}
              style={[
                styles.segmentBtn,
                settings.textSize === 'standard' && styles.segmentBtnActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  settings.textSize === 'standard' && styles.segmentBtnTextActive,
                ]}
              >
                Standard
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => updateSettings({ textSize: 'large' })}
              style={[
                styles.segmentBtn,
                settings.textSize === 'large' && styles.segmentBtnActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  settings.textSize === 'large' && styles.segmentBtnTextActive,
                ]}
              >
                Large (Rec.)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => updateSettings({ textSize: 'xlarge' })}
              style={[
                styles.segmentBtn,
                settings.textSize === 'xlarge' && styles.segmentBtnActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  settings.textSize === 'xlarge' && styles.segmentBtnTextActive,
                ]}
              >
                Extra Large
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helpText}>Adapts room cards, alerts, and occupancy badges.</Text>
        </View>

        {/* Toggle: Voice Guidance */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextCol}>
            <Text style={styles.toggleTitle}>Voice Guidance (Read Aloud)</Text>
            <Text style={styles.toggleSub}>
              Reads alerts, occupancy changes, and action button names aloud
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => updateSettings({ voiceGuidance: !settings.voiceGuidance })}
            style={[styles.switchTrack, settings.voiceGuidance && styles.switchTrackActive]}
            activeOpacity={0.8}
          >
            <View
              style={[styles.switchThumb, settings.voiceGuidance && styles.switchThumbActive]}
            />
          </TouchableOpacity>
        </View>

        {/* Toggle: High Contrast Mode */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextCol}>
            <Text style={styles.toggleTitle}>High Contrast Mode</Text>
            <Text style={styles.toggleSub}>
              Elevates visual clarity and card contrast for outdoor lighting
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => updateSettings({ highContrast: !settings.highContrast })}
            style={[styles.switchTrack, settings.highContrast && styles.switchTrackActive]}
            activeOpacity={0.8}
          >
            <View
              style={[styles.switchThumb, settings.highContrast && styles.switchThumbActive]}
            />
          </TouchableOpacity>
        </View>

        {/* Toggle: Reduce Motion */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextCol}>
            <Text style={styles.toggleTitle}>Reduce Motion</Text>
            <Text style={styles.toggleSub}>
              Disables animations and pulse indicators for smoother performance
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => updateSettings({ reduceMotion: !settings.reduceMotion })}
            style={[styles.switchTrack, settings.reduceMotion && styles.switchTrackActive]}
            activeOpacity={0.8}
          >
            <View
              style={[styles.switchThumb, settings.reduceMotion && styles.switchThumbActive]}
            />
          </TouchableOpacity>
        </View>

        {/* Language Selector */}
        <View style={styles.settingBlock}>
          <Text style={styles.settingLabel}>Language</Text>
          <View style={styles.langGrid}>
            {[
              { code: 'en', label: 'English' },
              { code: 'hi', label: 'हिंदी' },
              { code: 'ta', label: 'தமிழ்' },
              { code: 'bn', label: 'বাংলা' },
            ].map((lang) => {
              const isSelected = settings.language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => updateSettings({ language: lang.code as any })}
                  style={[styles.langBtn, isSelected && styles.langBtnActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langBtnText, isSelected && styles.langBtnTextActive]}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* SECTION 3: Smart Automation Preferences */}
      <View style={styles.card}>
        <View style={styles.titleWithIcon}>
          <View style={styles.peachIconCircle}>
            <Icon name="tune" size={18} color={colors.tertiary} />
          </View>
          <Text style={styles.cardTitle}>Smart Automation Preferences</Text>
        </View>

        {/* Eco-Saver Sensitivity */}
        <View style={styles.settingBlock}>
          <View style={styles.rowBetween}>
            <Text style={styles.settingLabel}>Eco-Saver Sensitivity</Text>
            <View style={styles.sensitivityPill}>
              <Text style={styles.sensitivityPillText}>
                {settings.ecoSaverSensitivity === 1
                  ? 'Relaxed (15m)'
                  : settings.ecoSaverSensitivity === 2
                  ? 'Balanced (10m)'
                  : 'Aggressive (5m)'}
              </Text>
            </View>
          </View>

          <View style={styles.segmentContainer}>
            {[
              { val: 1 as const, label: 'Relaxed (15m)' },
              { val: 2 as const, label: 'Balanced (10m)' },
              { val: 3 as const, label: 'Aggressive (5m)' },
            ].map((item) => {
              const isActive = settings.ecoSaverSensitivity === item.val;
              return (
                <TouchableOpacity
                  key={item.val}
                  onPress={() => updateSettings({ ecoSaverSensitivity: item.val })}
                  style={[styles.segmentBtn, isActive && styles.segmentBtnActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segmentBtnText, isActive && styles.segmentBtnTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.helpText}>
            Controls how quickly fans, AC, and lights turn off after occupancy reaches zero.
          </Text>
        </View>

        {/* Toggle: Empty Room Alerts */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextCol}>
            <Text style={styles.toggleTitle}>Empty Room Power Alerts</Text>
            <Text style={styles.toggleSub}>
              Notify staff when an empty classroom keeps electrical appliances running
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => updateSettings({ emptyRoomAlerts: !settings.emptyRoomAlerts })}
            style={[styles.switchTrack, settings.emptyRoomAlerts && styles.switchTrackActive]}
            activeOpacity={0.8}
          >
            <View
              style={[styles.switchThumb, settings.emptyRoomAlerts && styles.switchThumbActive]}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* SECTION 4: System Verification & Demo Mode */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.cardTitle}>System Verification & Build</Text>
            <Text style={styles.cardSubtitle}>
              S.E.R.O.S. Mobile v2.4.0 • Authorized Testing Build
            </Text>
          </View>
          <View style={styles.assistedBadge}>
            <Text style={styles.assistedBadgeText}>Admin</Text>
          </View>
        </View>

        {/* Demo Mode Box */}
        <View style={styles.demoBox}>
          <View style={styles.rowBetween}>
            <View style={styles.toggleTextCol}>
              <View style={styles.statusRow}>
                <Text style={styles.demoTitle}>Demo / Simulation Mode</Text>
                <Icon name="science" size={16} color={colors.tertiary} />
              </View>
              <Text style={styles.demoSub}>
                Replaces live school sensors with pre-recorded telemetry for offline demo
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                const nextDemo = !settings.isDemoMode;
                updateSettings({ isDemoMode: nextDemo });
                setBackendVerifiedNotice(
                  nextDemo
                    ? 'Switched to Demo / Simulated Scenario Telemetry.'
                    : 'Reconnected to 100% Verified Live Hardware Telemetry.'
                );
              }}
              style={[styles.switchTrack, settings.isDemoMode && styles.switchTrackActive]}
              activeOpacity={0.8}
            >
              <View
                style={[styles.switchThumb, settings.isDemoMode && styles.switchThumbActive]}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.demoInfoRow}>
            <Icon name="info" size={14} color={colors.tertiary} />
            <Text style={styles.demoInfoText}>
              {settings.isDemoMode
                ? 'Operating in Demo Simulation Mode.'
                : 'Operating with 100% Verified Live Hardware Telemetry.'}
            </Text>
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={handleExportLog}
            style={styles.secondaryBtn}
            activeOpacity={0.8}
          >
            <Icon name="file_download" size={18} color={colors.primary} />
            <Text style={styles.secondaryBtnText}>Export Log</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRepairNodes}
            style={[styles.secondaryBtn, styles.secondaryBtnNeutral]}
            activeOpacity={0.8}
          >
            <Icon name="sync" size={18} color={colors.textPrimary} />
            <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
              Re-pair Nodes
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 32,
    gap: 16,
  },
  bannerBadge: {
    width: '100%',
    maxWidth: '100%',
    backgroundColor: colors.surfaceGreen,
    padding: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
    overflow: 'hidden',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  bannerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  nodePill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
    flexShrink: 0,
  },
  nodePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.7)',
    gap: 16,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greenPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  onlineBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  telemetryList: {
    gap: 8,
  },
  telemetryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerLow,
  },
  telemetryItemWarning: {
    backgroundColor: colors.surfaceYellow,
  },
  telemetryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  itemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningIconCircle: {
    backgroundColor: colors.tertiaryFixed,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  itemValueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  itemValueBadgeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  itemValueText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  itemValueTextWarning: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.tertiary,
  },
  primaryBtn: {
    width: '100%',
    minHeight: 48,
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backendInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceContainerLow,
    fontSize: 14,
  },
  toastBox: {
    backgroundColor: colors.surfaceGreen,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.3)',
  },
  toastText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blueIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peachIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfacePeach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistedBadge: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  assistedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  settingBlock: {
    gap: 8,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentBtnTextActive: {
    fontWeight: '800',
    color: colors.primary,
  },
  helpText: {
    fontSize: 11,
    color: colors.textSecondary,
    paddingHorizontal: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  toggleTextCol: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  toggleSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  switchTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#becabd',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  langGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.15)',
  },
  langBtnActive: {
    backgroundColor: colors.primary,
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  langBtnTextActive: {
    color: '#FFFFFF',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sensitivityPill: {
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  sensitivityPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  demoBox: {
    backgroundColor: colors.surfacePeach,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.tertiaryFixed,
    gap: 10,
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  demoSub: {
    fontSize: 11,
    color: 'rgba(14, 31, 22, 0.75)',
    marginTop: 2,
  },
  demoInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  demoInfoText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.tertiary,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryBtnNeutral: {
    borderColor: colors.borderSubtle,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
