import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { serosApi } from '../api/serosApi';
import { useApp } from '../context/AppContext';
import { colors } from '../theme/colors';

export const AC_VENDOR_PROTOCOLS = [
  'COOLIX', 'DAIKIN', 'DAIKIN2', 'MITSUBISHI_AC', 'MITSUBISHI_HEAVY_152',
  'MITSUBISHI_HEAVY_88', 'VOLTAS', 'LG', 'LG2', 'SAMSUNG_AC', 'HITACHI_AC',
  'CARRIER_AC', 'GREE', 'PANASONIC_AC', 'HAIER_AC', 'MIDEA', 'FUJITSU_AC',
  'ELECTRA_AC', 'WHIRLPOOL_AC', 'TCL112AC', 'KELVINATOR', 'TOSHIBA_AC',
  'SHARP_AC', 'TECO', 'SANYO_AC', 'AMCOR', 'ARGO', 'CORONA_AC'
];

interface UniversalAcRemoteProps {
  initialProtocol?: string;
  showBrandSelector?: boolean;
  onStateChange?: (state: { power: boolean; temperature: number; mode: string; fan: string; protocol: string }) => void;
}

export const UniversalAcRemote: React.FC<UniversalAcRemoteProps> = ({
  initialProtocol = 'MITSUBISHI_AC',
  showBrandSelector = false,
  onStateChange,
}) => {
  const { backendUrl, setBackendVerifiedNotice } = useApp();
  const [protocol, setProtocol] = useState<string>(initialProtocol);
  const [power, setPower] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<number>(24);
  const [mode, setMode] = useState<string>('cool');
  const [fan, setFan] = useState<string>('auto');
  const [isLearning, setIsLearning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready. Point remote to learn or pick a vendor.');
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Sync state from backend or ESP32
  const syncStatus = async () => {
    try {
      const data = await serosApi.getAcStatus(backendUrl);
      if (data) {
        if (data.protocol) setProtocol(data.protocol);
        if (typeof data.power === 'boolean') setPower(data.power);
        if (data.temperature) setTemperature(Number(data.temperature));
        if (data.mode) setMode(data.mode);
        if (data.fan) setFan(data.fan);
        if (typeof data.learning === 'boolean') setIsLearning(data.learning);
        if (data.message) setStatusMessage(data.message);
      }
    } catch {
      // offline
    }
  };

  useEffect(() => {
    void syncStatus();
    const interval = setInterval(() => {
      void syncStatus();
    }, 6000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  const handleToggleLearn = async () => {
    setIsBusy(true);
    try {
      if (isLearning) {
        setIsLearning(false);
        setStatusMessage('Learning cancelled.');
        await serosApi.cancelAcLearn(backendUrl);
        setBackendVerifiedNotice?.('AC remote learning cancelled');
      } else {
        setIsLearning(true);
        setStatusMessage('Listening for remote... point remote at receiver and press a button.');
        await serosApi.learnAc(backendUrl);
        setBackendVerifiedNotice?.('Listening for remote signal on GPIO 14...');
      }
    } catch {
      // Offline fallback
      setIsLearning(!isLearning);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSelectVendor = async (vnd: string) => {
    setProtocol(vnd);
    setIsModalVisible(false);
    setStatusMessage(`Protocol set: ${vnd}. Test with POWER ON or Temp.`);
    try {
      await serosApi.setAcVendor(backendUrl, vnd);
      setBackendVerifiedNotice?.(`Active AC Protocol set to ${vnd}`);
    } catch {
      // Offline simulated
    }
    onStateChange?.({ power, temperature, mode, fan, protocol: vnd });
  };

  const handleTempAdjust = async (delta: number) => {
    const next = Math.max(16, Math.min(30, temperature + delta));
    setTemperature(next);
    setPower(true);
    setStatusMessage(`AC Command Sent: ${protocol}, Power: ON, Temp: ${next}°C, Mode: ${mode}`);
    try {
      await serosApi.setAcTemp(backendUrl, next);
      setBackendVerifiedNotice?.(`AC set to ${next}°C`);
    } catch {
      // Offline
    }
    onStateChange?.({ power: true, temperature: next, mode, fan, protocol });
  };

  const handleSetPower = async (on: boolean) => {
    setPower(on);
    setStatusMessage(`AC Command Sent: ${protocol}, Power: ${on ? 'ON' : 'OFF'}, Temp: ${temperature}°C, Mode: ${mode}`);
    try {
      await serosApi.setAcPower(backendUrl, on);
      setBackendVerifiedNotice?.(`AC Powered ${on ? 'ON' : 'OFF'}`);
    } catch {
      // Offline
    }
    onStateChange?.({ power: on, temperature, mode, fan, protocol });
  };

  const handleSelectMode = async (m: string) => {
    setMode(m);
    setPower(true);
    setStatusMessage(`AC Command Sent: ${protocol}, Power: ON, Temp: ${temperature}°C, Mode: ${m}`);
    try {
      await serosApi.setAcMode(backendUrl, m);
      setBackendVerifiedNotice?.(`AC Mode: ${m.toUpperCase()}`);
    } catch {
      // Offline
    }
    onStateChange?.({ power: true, temperature, mode: m, fan, protocol });
  };

  const handleSelectFan = async (f: string) => {
    setFan(f);
    setStatusMessage(`AC Command Sent: ${protocol}, Fan: ${f}`);
    try {
      await serosApi.setAcFan(backendUrl, f);
      setBackendVerifiedNotice?.(`AC Fan: ${f.toUpperCase()}`);
    } catch {
      // Offline
    }
    onStateChange?.({ power, temperature, mode, fan: f, protocol });
  };

  const handleResend = async () => {
    setIsBusy(true);
    setStatusMessage(`Resending current state (${protocol}, ${temperature}°C, ${mode}, ${fan})...`);
    try {
      await serosApi.sendAcState(backendUrl);
      setBackendVerifiedNotice?.('AC state resent via IR transmitter');
    } catch {
      // Offline
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View style={styles.cardContainer}>
      {/* Title */}
      <Text style={styles.title}>UNIVERSAL AC REMOTE</Text>

      {showBrandSelector && (
        <>
          {/* RE-LEARN REMOTE button */}
          <TouchableOpacity
            style={[styles.btnAmber, isLearning && styles.btnAmberActive]}
            onPress={handleToggleLearn}
            activeOpacity={0.8}
            disabled={isBusy}
          >
            <Text style={styles.btnAmberText}>
              {isLearning ? 'CANCEL LEARNING' : 'RE-LEARN REMOTE'}
            </Text>
          </TouchableOpacity>

          {isLearning && (
            <View style={styles.listeningNotice}>
              <Text style={styles.listeningText}>
                LISTENING FOR AC REMOTE (Press any button)...
              </Text>
            </View>
          )}

          {/* Protocol Selector Dropdown Header */}
          <Text style={styles.vendorLabel}>Or Select Vendor Protocol Manually:</Text>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => setIsModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownBtnText}>{protocol || 'MITSUBISHI_AC'}</Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Active Protocol Badge */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.surfaceGreen,
        borderColor: '#C2E2A8',
        borderWidth: 1,
        borderRadius: 20,
        paddingVertical: 5,
        paddingHorizontal: 12,
        marginBottom: 8,
      }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.primary }} />
        <Text style={{ fontSize: 12.5, color: colors.primary, fontWeight: '700' }}>
          Brand: <Text style={{ fontWeight: '900' }}>{protocol || 'MITSUBISHI_AC'}</Text>
        </Text>
      </View>

      {/* Big Yellow 24°C Display */}
      <Text style={styles.tempDisplay}>{temperature}°C</Text>

      {/* Temp Stepper Buttons */}
      <View style={styles.rowCentered}>
        <TouchableOpacity
          style={styles.btnBlue}
          onPress={() => handleTempAdjust(-1)}
          activeOpacity={0.8}
          disabled={temperature <= 16}
        >
          <Text style={styles.btnBlueText}>− 1°C</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnBlue}
          onPress={() => handleTempAdjust(1)}
          activeOpacity={0.8}
          disabled={temperature >= 30}
        >
          <Text style={styles.btnBlueText}>+ 1°C</Text>
        </TouchableOpacity>
      </View>

      {/* Power Buttons */}
      <View style={styles.rowCentered}>
        <TouchableOpacity
          style={[styles.btnGreen, power && styles.btnGreenActive]}
          onPress={() => handleSetPower(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnPowerText}>POWER ON</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnRed, !power && styles.btnRedActive]}
          onPress={() => handleSetPower(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnPowerText}>POWER OFF</Text>
        </TouchableOpacity>
      </View>

      {/* Mode & Fan Status Summary */}
      <Text style={styles.summaryText}>
        Mode: <Text style={styles.summaryBold}>{mode}</Text> • Fan:{' '}
        <Text style={styles.summaryBold}>{fan}</Text> • Power:{' '}
        <Text style={styles.summaryBold}>{power ? 'ON' : 'OFF'}</Text>
      </Text>

      {/* Mode Buttons */}
      <View style={styles.rowWrap}>
        {['cool', 'heat', 'dry', 'fan', 'auto'].map((m) => {
          const isActive = mode === m;
          return (
            <TouchableOpacity
              key={m}
              style={[styles.btnSlate, isActive && styles.btnSlateActive]}
              onPress={() => handleSelectMode(m)}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnSlateText, isActive && styles.btnSlateTextActive]}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Fan Speed Buttons */}
      <View style={styles.rowWrap}>
        {[
          { id: 'auto', label: 'Fan Auto' },
          { id: 'low', label: 'Low' },
          { id: 'medium', label: 'Med' },
          { id: 'high', label: 'High' },
        ].map((item) => {
          const isActive = fan === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.btnSlate, isActive && styles.btnSlateActive]}
              onPress={() => handleSelectFan(item.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnSlateText, isActive && styles.btnSlateTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* RESEND CURRENT STATE */}
      <TouchableOpacity
        style={styles.btnCyan}
        onPress={handleResend}
        activeOpacity={0.85}
        disabled={isBusy}
      >
        {isBusy ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.btnCyanText}>RESEND CURRENT STATE</Text>
        )}
      </TouchableOpacity>

      {/* Status Bar */}
      {statusMessage ? (
        <View style={styles.statusBar}>
          <Text style={styles.statusMessageText} numberOfLines={2}>
            {statusMessage}
          </Text>
        </View>
      ) : null}

      {/* Vendor Selection Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select AC Vendor Protocol</Text>
            <FlatList
              data={AC_VENDOR_PROTOCOLS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = item === protocol;
                return (
                  <TouchableOpacity
                    style={[styles.vendorRow, isSelected && styles.vendorRowSelected]}
                    onPress={() => handleSelectVendor(item)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.vendorRowText,
                        isSelected && styles.vendorRowTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {isSelected && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 380 }}
            />
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    padding: 18,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginVertical: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  btnAmber: {
    backgroundColor: '#D97706',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 22,
    marginBottom: 10,
  },
  btnAmberActive: {
    backgroundColor: '#DC2626',
  },
  btnAmberText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13.5,
    letterSpacing: 0.5,
  },
  listeningNotice: {
    backgroundColor: colors.surfaceYellow || '#FFF4CC',
    borderWidth: 1.5,
    borderColor: '#D97706',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 9,
    marginBottom: 10,
    width: '100%',
  },
  listeningText: {
    color: '#7E5200',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  vendorLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.canvas,
    borderColor: colors.borderSubtle,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '88%',
    marginBottom: 6,
  },
  dropdownBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownArrow: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  activeProtocolText: {
    fontSize: 13.5,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  activeProtocolHighlight: {
    color: colors.primary,
    fontWeight: '800',
  },
  tempDisplay: {
    fontSize: 50,
    fontWeight: '900',
    color: colors.primary,
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  rowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
    width: '100%',
  },
  btnBlue: {
    backgroundColor: colors.surfaceGreen,
    borderColor: '#C2E2A8',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 22,
    minWidth: 90,
    alignItems: 'center',
  },
  btnBlueText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  btnGreen: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 22,
    minWidth: 120,
    alignItems: 'center',
  },
  btnGreenActive: {
    borderWidth: 2,
    borderColor: '#27834A',
  },
  btnRed: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 22,
    minWidth: 120,
    alignItems: 'center',
  },
  btnRedActive: {
    borderWidth: 2,
    borderColor: '#B91C1C',
  },
  btnPowerText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginVertical: 8,
  },
  summaryBold: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
    width: '100%',
  },
  btnSlate: {
    backgroundColor: colors.canvas,
    borderColor: colors.borderSubtle,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  btnSlateActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  btnSlateText: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '600',
  },
  btnSlateTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  btnCyan: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '88%',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  btnCyanText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13.5,
    letterSpacing: 0.5,
  },
  statusBar: {
    backgroundColor: colors.canvas,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 8,
    padding: 9,
    marginTop: 10,
    width: '100%',
  },
  statusMessageText: {
    color: colors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    width: '100%',
    maxWidth: 360,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  vendorRowSelected: {
    backgroundColor: colors.surfaceGreen,
  },
  vendorRowText: {
    color: colors.textPrimary,
    fontSize: 13.5,
    fontWeight: '600',
  },
  vendorRowTextSelected: {
    color: colors.primary,
    fontWeight: '800',
  },
  checkMark: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  modalCloseBtn: {
    backgroundColor: colors.surfaceGreen,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  modalCloseBtnText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13.5,
  },
});

export default UniversalAcRemote;
