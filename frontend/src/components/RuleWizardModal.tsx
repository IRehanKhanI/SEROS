import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { colors } from '../theme/colors';

export const RuleWizardModal: React.FC = () => {
  const { isRuleWizardOpen, setIsRuleWizardOpen, addRule } = useApp();

  const [step, setStep] = useState<number>(1);
  const [triggerType, setTriggerType] = useState<string>('vacant');
  const [vacantMinutes, setVacantMinutes] = useState<number>(10);
  const [tempThreshold, setTempThreshold] = useState<number>(30);
  const [actionType, setActionType] = useState<string>('turnoff');

  if (!isRuleWizardOpen) return null;

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      let whenText = '';
      if (triggerType === 'vacant') {
        whenText = `Room is empty for ${vacantMinutes} minutes`;
      } else if (triggerType === 'temp') {
        whenText = `Temperature exceeds ${tempThreshold}°C and 1+ person inside`;
      } else {
        whenText = `Daily Schedule: After 6:00 PM`;
      }

      let thenText = '';
      let title = '';
      if (actionType === 'turnoff') {
        thenText = 'Turn off all lights and fans automatically';
        title = 'Automated Power Cutoff';
      } else if (actionType === 'fans') {
        thenText = 'Set fans to Speed 3 for cooling comfort';
        title = 'Climate Comfort Automation';
      } else {
        thenText = 'Send alert notification to facility manager';
        title = 'Energy Alert Protocol';
      }

      addRule({ title, whenText, thenText });
      setIsRuleWizardOpen(false);
      setStep(1);
    }
  };

  const handleClose = () => {
    setIsRuleWizardOpen(false);
    setStep(1);
  };

  return (
    <Modal visible={isRuleWizardOpen} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.rowAlign}>
              <View style={styles.wizardIconCircle}>
                <Icon name="auto_fix_high" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Rule Creator</Text>
                <Text style={styles.modalSub}>
                  {step === 1 ? 'Step 1 of 2: Trigger Condition' : 'Step 2 of 2: Action Result'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Icon name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Progress bar */}
          <View style={styles.progressRow}>
            <View style={[styles.progressSegment, styles.progressActive]} />
            <View
              style={[
                styles.progressSegment,
                step >= 2 ? styles.progressActive : styles.progressInactive,
              ]}
            />
          </View>

          <ScrollView style={styles.scrollArea}>
            {step === 1 ? (
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>1. Choose a Trigger Condition (WHEN):</Text>

                <TouchableOpacity
                  onPress={() => setTriggerType('vacant')}
                  style={[
                    styles.triggerOption,
                    triggerType === 'vacant' && styles.triggerOptionActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.rowAlign}>
                    <Icon name="person_off" size={20} color={colors.textPrimary} />
                    <Text style={styles.optionText}>Room Vacant for X Minutes</Text>
                  </View>
                  <Icon
                    name={triggerType === 'vacant' ? 'check_circle' : 'radio_button_unchecked'}
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setTriggerType('temp')}
                  style={[
                    styles.triggerOption,
                    triggerType === 'temp' && styles.triggerOptionActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.rowAlign}>
                    <Icon name="thermostat" size={20} color={colors.textPrimary} />
                    <Text style={styles.optionText}>Temperature Sensor Level</Text>
                  </View>
                  <Icon
                    name={triggerType === 'temp' ? 'check_circle' : 'radio_button_unchecked'}
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setTriggerType('time')}
                  style={[
                    styles.triggerOption,
                    triggerType === 'time' && styles.triggerOptionActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.rowAlign}>
                    <Icon name="schedule" size={20} color={colors.textPrimary} />
                    <Text style={styles.optionText}>Daily Bell / Time Schedule</Text>
                  </View>
                  <Icon
                    name={triggerType === 'time' ? 'check_circle' : 'radio_button_unchecked'}
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>

                {triggerType === 'vacant' && (
                  <View style={styles.subConfigBox}>
                    <Text style={styles.subConfigLabel}>Vacant Time Window (Minutes):</Text>
                    <View style={styles.minutesRow}>
                      {[5, 10, 20].map((mins) => (
                        <TouchableOpacity
                          key={mins}
                          onPress={() => setVacantMinutes(mins)}
                          style={[
                            styles.minuteBtn,
                            vacantMinutes === mins && styles.minuteBtnActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.minuteBtnText,
                              vacantMinutes === mins && styles.minuteBtnTextActive,
                            ]}
                          >
                            {mins} mins
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>2. Choose Automated Action (THEN):</Text>

                <TouchableOpacity
                  onPress={() => setActionType('turnoff')}
                  style={[
                    styles.triggerOption,
                    actionType === 'turnoff' && styles.triggerOptionActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.rowAlign}>
                    <Icon name="light_off" size={20} color={colors.textPrimary} />
                    <Text style={styles.optionText}>Turn off all lights & fans</Text>
                  </View>
                  <Icon
                    name={actionType === 'turnoff' ? 'check_circle' : 'radio_button_unchecked'}
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActionType('fans')}
                  style={[
                    styles.triggerOption,
                    actionType === 'fans' && styles.triggerOptionActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.rowAlign}>
                    <Icon name="mode_fan" size={20} color={colors.textPrimary} />
                    <Text style={styles.optionText}>Set fans to Speed 3 (Comfort Cool)</Text>
                  </View>
                  <Icon
                    name={actionType === 'fans' ? 'check_circle' : 'radio_button_unchecked'}
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActionType('notify')}
                  style={[
                    styles.triggerOption,
                    actionType === 'notify' && styles.triggerOptionActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.rowAlign}>
                    <Icon name="notifications_active" size={20} color={colors.textPrimary} />
                    <Text style={styles.optionText}>Send alert notification to staff</Text>
                  </View>
                  <Icon
                    name={actionType === 'notify' ? 'check_circle' : 'radio_button_unchecked'}
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              onPress={() => {
                if (step > 1) setStep(step - 1);
                else handleClose();
              }}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>{step === 1 ? 'Cancel' : 'Back'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleNext} style={styles.nextBtn}>
              <Text style={styles.nextBtnText}>
                {step === 1 ? 'Next: Action' : 'Activate Rule'}
              </Text>
              <Icon
                name={step === 1 ? 'arrow_forward' : 'check'}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(35, 52, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '85%',
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(227, 229, 216, 0.6)',
    paddingBottom: 12,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wizardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSub: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  closeBtn: {
    padding: 4,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  progressActive: {
    backgroundColor: colors.primary,
  },
  progressInactive: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  scrollArea: {
    maxHeight: 380,
  },
  formCol: {
    gap: 12,
    paddingVertical: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  triggerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 18,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  triggerOptionActive: {
    backgroundColor: colors.surfaceGreen,
    borderColor: colors.primaryContainer,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subConfigBox: {
    gap: 8,
    marginTop: 6,
  },
  subConfigLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  minutesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  minuteBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minuteBtnActive: {
    backgroundColor: colors.primary,
  },
  minuteBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  minuteBtnTextActive: {
    color: '#FFFFFF',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  nextBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
