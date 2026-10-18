import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { colors } from '../theme/colors';

export const OnboardingView: React.FC = () => {
  const {
    navigateToTab,
    setCurrentView,
    settings,
    updateSettings,
    speakText,
    setSelectedRoomId
  } = useApp();

  const [audioBannerVisible, setAudioBannerVisible] = useState(false);
  const [selectedStep, setSelectedStep] = useState<number>(2);

  const handleAudioListen = () => {
    setAudioBannerVisible(true);
    speakText(
      'Welcome to S.E.R.O.S.! This checklist guides you through four simple steps: Connecting to campus hub, selecting your room, verifying camera view, and testing your connected devices.'
    );
  };

  const handleContinue = () => {
    setSelectedRoomId('room-101');
    navigateToTab('rooms');
  };

  const handleExploreDemo = () => {
    updateSettings({ isDemoMode: true });
    navigateToTab('home');
  };

  return (
    <View style={styles.container}>
      {/* Friendly Hero */}
      <View style={styles.heroBox}>
        <View style={styles.plantCircle}>
          <View style={styles.sunBadge}>
            <Icon name="light_mode" size={18} color={colors.tertiary} fill />
          </View>
          <Icon name="potted_plant" size={40} color={colors.primary} fill />
        </View>

        <View style={styles.systemOnlinePill}>
          <Icon name="check_circle" size={16} color={colors.primary} fill />
          <Text style={styles.systemOnlineText}>System Online & Ready</Text>
        </View>

        <Text style={styles.heroTitle}>Welcome to S.E.R.O.S. 🌱</Text>
        <Text style={styles.heroSub}>
          See room activity, automate lights & fans, and easily understand your energy use.
        </Text>
      </View>

      {/* Language Selector */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowAlign}>
            <Icon name="translate" size={18} color={colors.primary} />
            <Text style={styles.langHeader}>Choose Language & Assist</Text>
          </View>
          <Text style={styles.langSub}>भाषा चुनें</Text>
        </View>

        <View style={styles.langRow}>
          <TouchableOpacity
            onPress={() => updateSettings({ language: 'en' })}
            style={[styles.langBtn, settings.language === 'en' && styles.langBtnActive]}
            activeOpacity={0.8}
          >
            {settings.language === 'en' && (
              <Icon name="check" size={18} color="#FFFFFF" />
            )}
            <Text
              style={[
                styles.langBtnText,
                settings.language === 'en' && styles.langBtnTextActive,
              ]}
            >
              English
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => updateSettings({ language: 'hi' })}
            style={[styles.langBtn, settings.language === 'hi' && styles.langBtnActive]}
            activeOpacity={0.8}
          >
            {settings.language === 'hi' && (
              <Icon name="check" size={18} color="#FFFFFF" />
            )}
            <Text
              style={[
                styles.langBtnText,
                settings.language === 'hi' && styles.langBtnTextActive,
              ]}
            >
              हिंदी
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleAudioListen}
            style={[styles.langBtn, styles.listenBtn]}
            activeOpacity={0.8}
          >
            <Icon name="volume_up" size={20} color={colors.tertiary} />
            <Text style={[styles.langBtnText, { color: colors.textPrimary }]}>Listen</Text>
          </TouchableOpacity>
        </View>

        {audioBannerVisible && (
          <View style={styles.audioBanner}>
            <Icon name="record_voice_over" size={20} color={colors.tertiary} />
            <Text style={styles.audioBannerText}>
              Audio guidance turned on. Tapping any card will read instructions out loud.
            </Text>
            <TouchableOpacity onPress={() => setAudioBannerVisible(false)}>
              <Text style={styles.audioDismiss}>OK</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Setup Checklist */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.checklistTitle}>Setup Checklist</Text>
            <Text style={styles.checklistSub}>4 simple steps to get your room running</Text>
          </View>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>Step {selectedStep} of 4</Text>
          </View>
        </View>

        <View style={styles.stepList}>
          {/* Step 1 */}
          <TouchableOpacity
            onPress={() => setSelectedStep(1)}
            style={styles.stepDoneRow}
            activeOpacity={0.8}
          >
            <View style={styles.stepDoneCheck}>
              <Icon name="check" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.colFlex}>
              <View style={styles.rowAlignCompact}>
                <Text style={styles.stepDoneTitle}>1. Connect to Campus Hub</Text>
                <View style={styles.donePill}>
                  <Text style={styles.donePillText}>Done</Text>
                </View>
              </View>
              <Text style={styles.stepDoneSub}>Connected to Local Server • Strong Signal</Text>
            </View>
          </TouchableOpacity>

          {/* Step 2 (Active) */}
          <View style={styles.stepActiveRow}>
            <View style={styles.rowBetween}>
              <View style={styles.rowAlign}>
                <View style={styles.stepActiveCircle}>
                  <Text style={styles.stepActiveNum}>2</Text>
                </View>
                <View>
                  <Text style={styles.stepActiveTitle}>Select your first Room</Text>
                  <Text style={styles.stepActiveStatus}>In Progress</Text>
                </View>
              </View>
              <View style={styles.selectedPill}>
                <Text style={styles.selectedPillText}>Selected</Text>
              </View>
            </View>

            <View style={styles.selectedRoomCard}>
              <View style={styles.selectedRoomIcon}>
                <Icon name="meeting_room" size={28} color={colors.primary} fill />
              </View>
              <View style={styles.colFlex}>
                <Text style={styles.roomCardName}>Room 101 - Smart Lab</Text>
                <Text style={styles.roomCardSub}>Main Academic Wing • Ground Floor</Text>
              </View>
              <TouchableOpacity
                onPress={() => setCurrentView('rooms')}
                style={styles.changeBtn}
              >
                <Text style={styles.changeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Step 3 */}
          <TouchableOpacity
            onPress={() => setSelectedStep(3)}
            style={styles.stepPendingRow}
            activeOpacity={0.8}
          >
            <View style={styles.stepPendingCircle}>
              <Text style={styles.stepPendingNum}>3</Text>
            </View>
            <View style={styles.colFlex}>
              <View style={styles.rowAlignCompact}>
                <Text style={styles.stepPendingTitle}>3. Verify Camera & Zone View</Text>
                <View style={styles.nextPill}>
                  <Text style={styles.nextPillText}>Next</Text>
                </View>
              </View>
              <Text style={styles.stepPendingSub}>Quick camera test & person detection check</Text>
            </View>
            <Icon name="videocam" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Step 4 */}
          <TouchableOpacity
            onPress={() => setSelectedStep(4)}
            style={styles.stepPendingRow}
            activeOpacity={0.8}
          >
            <View style={styles.stepPendingCircle}>
              <Text style={styles.stepPendingNum}>4</Text>
            </View>
            <View style={styles.colFlex}>
              <View style={styles.rowAlignCompact}>
                <Text style={styles.stepPendingTitle}>4. Check Connected Devices</Text>
                <View style={styles.nextPill}>
                  <Text style={styles.nextPillText}>Pending</Text>
                </View>
              </View>
              <Text style={styles.stepPendingSub}>2 Fans & 4 Lights ready to test</Text>
            </View>
            <Icon name="devices" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Primary Actions */}
      <View style={styles.actionBlock}>
        <TouchableOpacity
          onPress={handleContinue}
          style={styles.continueBtn}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>Continue to Setup Room</Text>
          <Icon name="arrow_forward" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleExploreDemo}
          style={styles.skipBtn}
          activeOpacity={0.85}
        >
          <Icon name="explore" size={18} color={colors.primary} />
          <Text style={styles.skipBtnText}>Skip setup for now — explore demo mode</Text>
        </TouchableOpacity>
      </View>

      {/* Need Help Footer */}
      <View style={styles.helpFooter}>
        <View style={styles.helpIconCircle}>
          <Icon name="lightbulb" size={20} color={colors.tertiary} fill />
        </View>
        <View style={styles.colFlex}>
          <Text style={styles.helpTitle}>Need help?</Text>
          <Text style={styles.helpBody}>
            S.E.R.O.S. can read instructions out loud anytime. Tap the audio guide button above whenever you want assistance.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingBottom: 24,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  heroBox: {
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  plantCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  sunBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceYellow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(159, 104, 0, 0.2)',
  },
  systemOnlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  systemOnlineText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.7)',
    gap: 14,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  langHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  langSub: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  langBtn: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  langBtnActive: {
    backgroundColor: colors.primary,
  },
  listenBtn: {
    backgroundColor: colors.surfacePeach,
    borderWidth: 1,
    borderColor: 'rgba(255, 221, 180, 0.9)',
  },
  langBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  langBtnTextActive: {
    color: '#FFFFFF',
  },
  audioBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfacePeach,
    padding: 12,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 221, 180, 0.9)',
  },
  audioBannerText: {
    fontSize: 12,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 16,
  },
  audioDismiss: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.tertiary,
    padding: 4,
  },
  checklistTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  checklistSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stepBadge: {
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  stepList: {
    gap: 10,
  },
  stepDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGreen,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  stepDoneCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDoneTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  donePill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  donePillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  stepDoneSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stepActiveRow: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  stepActiveCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepActiveNum: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  stepActiveTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  stepActiveStatus: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  selectedPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  selectedPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  selectedRoomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  selectedRoomIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCardName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  roomCardSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  changeBtn: {
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  stepPendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    opacity: 0.85,
  },
  stepPendingCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPendingNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3f4940',
  },
  stepPendingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  nextPill: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  nextPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3f4940',
  },
  stepPendingSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionBlock: {
    gap: 10,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    minHeight: 56,
    gap: 8,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.3)',
    borderRadius: 999,
    minHeight: 48,
    gap: 8,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  helpFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surfacePeach,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 221, 180, 0.9)',
  },
  helpIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceYellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  helpBody: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
    marginTop: 2,
  },
});
