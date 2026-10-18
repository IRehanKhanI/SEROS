import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { colors } from '../theme/colors';
import { Device } from '../types';

const QUADRANTS = [
  { id: '1', num: 1, name: 'Quadrant 1', pos: 'Top-Left', relay: 1, pin: 16 },
  { id: '2', num: 2, name: 'Quadrant 2', pos: 'Top-Right', relay: 2, pin: 17 },
  { id: '3', num: 3, name: 'Quadrant 3', pos: 'Bottom-Left', relay: 3, pin: 18 },
  { id: '4', num: 4, name: 'Quadrant 4', pos: 'Bottom-Right', relay: 4, pin: 19 },
];

const QUADRANT_MAP: Record<number, { pos: string; pin: number }> = {
  1: { pos: 'Top-Left', pin: 16 },
  2: { pos: 'Top-Right', pin: 17 },
  3: { pos: 'Bottom-Left', pin: 18 },
  4: { pos: 'Bottom-Right', pin: 19 },
};

const getDeviceQuadrantNum = (device: Device): number => {
  if (device.quadrantNum && device.quadrantNum >= 1 && device.quadrantNum <= 4) return device.quadrantNum;
  if (device.relay && device.relay >= 1 && device.relay <= 4) return device.relay;
  const match = (device.name || '').match(/quadrant\s*([1-4])/i) || (device.name || '').match(/q([1-4])/i);
  if (match) return parseInt(match[1], 10);
  const quadMatch = (device.quadrant || device.room || '').match(/quadrant\s*([1-4])/i) || (device.quadrant || device.room || '').match(/q([1-4])/i);
  if (quadMatch) return parseInt(quadMatch[1], 10);
  return 1;
};

const getDeviceQuadrants = (device: Device): number[] => {
  if (device.quadrants && Array.isArray(device.quadrants) && device.quadrants.length > 0) {
    return [...device.quadrants].sort((a, b) => a - b);
  }
  return [getDeviceQuadrantNum(device)];
};

const formatDeviceQuadrants = (device: Device): string => {
  const quads = getDeviceQuadrants(device);
  if (quads.length === 4) return 'All Quadrants (Room AC)';
  if (quads.length > 1) return `Quadrants: ${quads.map(q => `Q${q}`).join(', ')}`;
  const qMeta = QUADRANT_MAP[quads[0]] || { pos: 'Area', pin: 15 + quads[0] };
  return `Q${quads[0]} (${qMeta.pos}) • Relay ${device.relay || quads[0]}`;
};

export const HomeView: React.FC = () => {
  const {
    navigateToTab,
    turnOffAllEmptyRooms,
    speakText,
    stopSpeaking,
    isSpeaking,
    setSelectedRoomId,
    rooms,
    devices,
    toggleDevice,
    addDevice,
    updateDevice,
    deleteDevice,
    sensorData,
    activeLayoutId,
    layouts,
    selectLayout,
  } = useApp();

  const activeRooms = rooms.filter(r => r.occupancyCount > 0).length;
  const peoplePresent = rooms.reduce((sum, room) => sum + room.occupancyCount, 0);
  const powerWatts = devices.reduce((sum, device) => {
    if (device.status === 'ON') {
      const w = device.powerWatts || device.ratedWatts || (device.category === 'ac' ? 1450 : device.category === 'fans' ? 65 : 24);
      return sum + w;
    }
    return sum;
  }, 0);
  const activeDevicesCount = devices.filter(d => d.status === 'ON').length;


  const [showAudioToast, setShowAudioToast] = useState(false);
  const [emptyRoomsTurnedOff, setEmptyRoomsTurnedOff] = useState(false);

  // Edit / Update Device Modal State
  const [deviceToEdit, setDeviceToEdit] = useState<Device | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editQuadrant, setEditQuadrant] = useState(1);
  const [editCategory, setEditCategory] = useState<'lights' | 'fans' | 'ac'>('lights');
  const [editWatts, setEditWatts] = useState('44');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Add Device Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQuadrant, setNewQuadrant] = useState(1);
  const [newCategory, setNewCategory] = useState<'lights' | 'fans' | 'ac'>('lights');
  const [newWatts, setNewWatts] = useState('44');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Delete Device Confirmation Modal State
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [isDeletingDevice, setIsDeletingDevice] = useState(false);

  const handleOpenEditModal = (device: Device) => {
    const qNum = getDeviceQuadrantNum(device);
    setDeviceToEdit(device);
    setEditName(device.name);
    setEditQuadrant(qNum);
    setEditCategory(device.category);
    setEditWatts(String(device.powerWatts || (device.category === 'lights' ? 44 : device.category === 'fans' ? 38 : 1200)));
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEditDevice = async () => {
    if (!deviceToEdit) return;
    const name = editName.trim();
    if (!name) {
      setEditError('Please enter a device name.');
      return;
    }
    setIsSubmittingEdit(true);
    setEditError(null);
    try {
      await updateDevice(deviceToEdit.id, {
        name,
        category: editCategory,
        quadrant: editQuadrant,
        relay: editQuadrant,
        power_watts: parseFloat(editWatts) || 44,
      });
      setIsEditModalOpen(false);
      setDeviceToEdit(null);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update device.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleOpenAddModal = (targetQuadrant = 1) => {
    setNewQuadrant(targetQuadrant);
    setNewCategory('lights');
    setNewName(`Quadrant ${targetQuadrant} Light`);
    setNewWatts('44');
    setAddError(null);
    setIsAddModalOpen(true);
  };

  const handleCategorySelectForAdd = (cat: 'lights' | 'fans' | 'ac') => {
    setNewCategory(cat);
    const catName = cat === 'lights' ? 'Light' : cat === 'fans' ? 'Fan' : 'AC';
    setNewName(`Quadrant ${newQuadrant} ${catName}`);
    setNewWatts(cat === 'lights' ? '44' : cat === 'fans' ? '38' : '1200');
  };

  const handleQuadrantSelectForAdd = (q: number) => {
    setNewQuadrant(q);
    const catName = newCategory === 'lights' ? 'Light' : newCategory === 'fans' ? 'Fan' : 'AC';
    setNewName(`Quadrant ${q} ${catName}`);
  };

  const handleCreateDevice = async () => {
    const name = newName.trim();
    if (!name) {
      setAddError('Please enter a device name.');
      return;
    }
    setIsSubmittingAdd(true);
    setAddError(null);
    try {
      await addDevice({
        quadrant: newQuadrant,
        relay: newQuadrant,
        name,
        category: newCategory,
        power_watts: parseFloat(newWatts) || 44,
      });
      setIsAddModalOpen(false);
    } catch (err: any) {
      setAddError(err?.message || 'Failed to add device.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleConfirmDeleteDevice = async () => {
    if (!deviceToDelete) return;
    setIsDeletingDevice(true);
    try {
      await deleteDevice(deviceToDelete.id);
      setDeviceToDelete(null);
    } catch {
      // notification handled in context
    } finally {
      setIsDeletingDevice(false);
    }
  };

  const handleListen = () => {
    setShowAudioToast(true);
    speakText(
      `S.E.R.O.S. is working normally. ${peoplePresent} people detected across campus. Current power usage is ${powerWatts} watts.`
    );
  };

  const handleTurnOffEmpty = () => {
    turnOffAllEmptyRooms();
    setEmptyRoomsTurnedOff(true);
    setTimeout(() => {
      setEmptyRoomsTurnedOff(false);
    }, 3500);
  };

  return (
    <View style={styles.container}>
      {/* Friendly Audio & Status Greeting Card */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowAlign}>
            <Text style={styles.sunEmoji}>☀️</Text>
            <View style={styles.col}>
              <Text style={styles.greetingTitle}>Good morning!</Text>
              <Text style={styles.greetingSubtitle}>Smart Campus • Classroom 101</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleListen}
            style={styles.listenButton}
            activeOpacity={0.8}
            accessibilityLabel="Listen to voice summary of this screen"
          >
            <Icon name="volume_up" size={24} color={colors.primary} />
            <Text style={styles.listenText}>Listen</Text>
          </TouchableOpacity>
        </View>

        {(showAudioToast || isSpeaking) && (
          <View style={styles.audioToast}>
            <View style={styles.rowAlign}>
              <Icon name="graphic_eq" size={20} color={colors.primary} />
              <Text style={styles.audioToastText}>
                Speaking: "All systems safe. 5 people present."
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setShowAudioToast(false);
                stopSpeaking();
              }}
              style={styles.closeAudioBtn}
            >
              <Icon name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* System Health Big Banner */}
      <View style={styles.healthBanner}>
        <View style={styles.healthIconCircle}>
          <Icon name="check_circle" size={32} color="#FFFFFF" fill />
        </View>
        <View style={styles.colFlex}>
          <Text style={styles.healthTitle}>System Working Normally</Text>
          <Text style={styles.healthSubtitle}>{activeRooms} of {rooms.length} Rooms Active • Live backend status</Text>
        </View>
      </View>

      {/* Big Visual Metrics */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Overview Right Now</Text>
        <Text style={styles.sectionSubtitle}>Updated 1m ago</Text>
      </View>

      <View style={styles.metricsGrid}>
        {/* Metric 1: People Present */}
        <View style={styles.metricCard}>
          <View style={styles.rowBetween}>
            <View style={[styles.metricIconBox, { backgroundColor: colors.surfaceYellow }]}>
              <Icon name="groups" size={26} color={colors.textPrimary} fill />
            </View>
            <View style={[styles.pillBadge, { backgroundColor: colors.surfaceYellow }]}>
              <Text style={styles.pillBadgeText}>Present</Text>
            </View>
          </View>
          <View>
            <Text style={styles.metricBigText}>{peoplePresent} People</Text>
            <Text style={styles.metricSmallText}>Across {activeRooms} rooms</Text>
          </View>
        </View>

        {/* Metric 2: Power Use */}
        <View style={styles.metricCard}>
          <View style={styles.rowBetween}>
            <View style={[styles.metricIconBox, { backgroundColor: colors.surfaceGreen }]}>
              <Icon name="bolt" size={26} color={colors.primary} fill />
            </View>
            <View style={[styles.pillBadge, { backgroundColor: colors.surfaceGreen }]}>
              <Text style={[styles.pillBadgeText, { color: colors.primary }]}>{activeDevicesCount} ON</Text>
            </View>
          </View>
          <View>
            <Text style={[styles.metricBigText, { color: colors.primary }]}>{powerWatts} W</Text>
            <Text style={styles.metricSmallText}>Live device draw</Text>
          </View>
        </View>

        {/* Metric 3: Live Climate Sensor (ESP32 HTU21DF) */}
        <View style={styles.metricCard}>
          <View style={styles.rowBetween}>
            <View style={[styles.metricIconBox, { backgroundColor: '#E5F2F8' }]}>
              <Icon name="thermostat" size={26} color={colors.secondary} fill />
            </View>
            <View style={[styles.pillBadge, { backgroundColor: '#E5F2F8' }]}>
              <Text style={[styles.pillBadgeText, { color: colors.secondary }]}>ESP32 Live</Text>
            </View>
          </View>
          <View>
            <Text style={[styles.metricBigText, { color: colors.secondary }]}>{sensorData.temperature.toFixed(1)}°C</Text>
            <Text style={styles.metricSmallText}>{sensorData.humidity.toFixed(0)}% Humidity • HTU21DF</Text>
          </View>
        </View>

        {/* Metric 4: Energy Saved & Layout */}
        <View style={styles.savedCard}>
          <View style={styles.rowAlign}>
            <View style={styles.piggyBox}>
              <Icon name="savings" size={32} color={colors.primary} fill />
            </View>
            <View>
              <Text style={styles.savedLabel}>Energy Saved</Text>
              <Text style={styles.savedAmount}>{sensorData.energy_saving_percent}% Less Draw</Text>
            </View>
          </View>
          <View style={styles.ecoPill}>
            <Icon name="eco" size={18} color={colors.primary} />
            <Text style={styles.ecoText}>{layouts.find(l => l.id === activeLayoutId)?.name || 'Layout 1'}</Text>
          </View>
        </View>
      </View>


      {/* Helpful Actions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Helpful Actions</Text>
        <Text style={styles.sectionSubtitle}>Tap any button</Text>
      </View>

      <View style={styles.actionsCol}>
        {/* Action 1: Live Camera */}
        <TouchableOpacity
          onPress={() => {
            setSelectedRoomId(rooms[0]?.id || '');
            navigateToTab('rooms');
          }}
          style={styles.primaryActionBtn}
          activeOpacity={0.85}
        >
          <View style={styles.rowAlign}>
            <View style={styles.actionIconCircle}>
              <Icon name="videocam" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.primaryActionText}>Check Live Camera</Text>
          </View>
          <Icon name="arrow_forward" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Action 2: Turn Off Empty Rooms */}
        <TouchableOpacity
          onPress={handleTurnOffEmpty}
          style={[
            styles.emptyRoomsBtn,
            emptyRoomsTurnedOff && styles.emptyRoomsBtnSuccess
          ]}
          activeOpacity={0.85}
        >
          <View style={styles.rowAlign}>
            <View style={styles.emptyIconCircle}>
              <Icon
                name={emptyRoomsTurnedOff ? 'done_all' : 'light_off'}
                size={24}
                color={emptyRoomsTurnedOff ? colors.primary : colors.danger}
              />
            </View>
            <View>
              <Text style={styles.emptyActionTitle}>
                {emptyRoomsTurnedOff ? 'All Empty Rooms Turned Off!' : 'Turn Off Empty Rooms'}
              </Text>
              <Text style={styles.emptyActionSub}>
                {emptyRoomsTurnedOff ? 'Saved 140W instantly' : 'Saves power instantly'}
              </Text>
            </View>
          </View>
          <Icon name="power_settings_new" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Action 3: View Energy Report */}
        <TouchableOpacity
          onPress={() => navigateToTab('energy')}
          style={styles.reportActionBtn}
          activeOpacity={0.85}
        >
          <View style={styles.rowAlign}>
            <View style={styles.reportIconCircle}>
              <Icon name="bar_chart" size={24} color={colors.secondary} />
            </View>
            <Text style={styles.reportActionText}>View Energy Report</Text>
          </View>
          <Icon name="chevron_right" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Quadrant Devices & Relays */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Quadrant Devices</Text>
          <Text style={styles.sectionSubtitle}>{devices.length} Fixtures • Relays 1-4</Text>
        </View>
        <View style={styles.roomHeaderActions}>
          <TouchableOpacity
            onPress={() => handleOpenAddModal(1)}
            style={styles.addDeviceBtnHeader}
            activeOpacity={0.85}
            accessibilityLabel="Add Quadrant Device"
          >
            <Icon name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addDeviceBtnHeaderText}>Add Device</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateToTab('devices')} style={styles.viewAllBtn}>
            <Text style={styles.viewAllRoomsText}>View All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {devices.length === 0 ? (
        <View style={styles.card}>
          <View style={{ alignItems: 'center', paddingVertical: 20, gap: 10 }}>
            <Icon name="apps" size={36} color={colors.textSecondary} />
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>
              No Devices Added
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', maxWidth: 280 }}>
              Add lights or fans to camera quadrants (1-4) to enable automated presence control and smart relays.
            </Text>
            <TouchableOpacity onPress={() => handleOpenAddModal(1)} style={styles.addDeviceBtnHeader}>
              <Icon name="add" size={16} color="#FFFFFF" />
              <Text style={styles.addDeviceBtnHeaderText}>Add Device</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        devices.map(device => {
          const qNum = getDeviceQuadrantNum(device);
          const qMeta = QUADRANT_MAP[qNum] || { pos: 'Area', pin: 15 + qNum };
          const isFan = device.category === 'fans';
          const isLight = device.category === 'lights';
          const isAC = device.category === 'ac';
          const isOn = device.status === 'ON';

          return (
            <View key={device.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={[styles.rowAlign, { flex: 1, minWidth: 0, marginRight: 8 }]}>
                  <View
                    style={[
                      styles.deviceIconCircle,
                      {
                        backgroundColor: isOn
                          ? isFan
                            ? colors.surfaceGreen
                            : isLight
                            ? colors.surfaceYellow
                            : colors.secondaryContainer
                          : colors.surfaceContainerHigh,
                      },
                    ]}
                  >
                    <Icon
                      name={
                        isFan
                          ? isOn ? 'mode_fan' : 'mode_fan_off'
                          : isLight
                          ? isOn ? 'lightbulb' : 'light_off'
                          : 'ac_unit'
                      }
                      size={24}
                      color={
                        isOn
                          ? isFan ? colors.primary : isLight ? colors.tertiary : colors.secondary
                          : colors.textSecondary
                      }
                    />
                  </View>

                  <View style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                    <Text style={styles.deviceName} numberOfLines={1}>{device.name}</Text>
                    <Text style={styles.deviceSub} numberOfLines={1}>
                      {formatDeviceQuadrants(device)}
                    </Text>
                    <View style={styles.deviceStatusRow}>
                      <View style={[styles.statusBullet, { backgroundColor: isOn ? colors.primary : '#6f7a6f' }]} />
                      <Text style={[styles.deviceStatusText, { color: isOn ? colors.primary : colors.textSecondary }]} numberOfLines={1}>
                        {isOn ? `Active (${device.powerWatts}W)` : 'Standby (OFF)'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.deviceRightActions}>
                  {/* ON / OFF Toggle Switch */}
                  <TouchableOpacity
                    onPress={() => toggleDevice(device.id)}
                    style={[styles.devicePowerBtn, isOn && styles.devicePowerBtnActive]}
                    activeOpacity={0.8}
                    accessibilityLabel={`Toggle ${device.name}`}
                  >
                    <Icon name="power_settings_new" size={16} color={isOn ? '#FFFFFF' : colors.textSecondary} />
                    <Text style={[styles.devicePowerBtnText, isOn && styles.devicePowerBtnTextActive]}>
                      {isOn ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>

                  {/* Edit / Update Device Button */}
                  <TouchableOpacity
                    onPress={() => handleOpenEditModal(device)}
                    style={styles.deviceIconBtn}
                    activeOpacity={0.7}
                    accessibilityLabel={`Update ${device.name}`}
                  >
                    <Icon name="edit" size={16} color={colors.primary} />
                  </TouchableOpacity>

                  {/* Delete Device Button */}
                  <TouchableOpacity
                    onPress={() => setDeviceToDelete(device)}
                    style={styles.deviceIconBtn}
                    activeOpacity={0.7}
                    accessibilityLabel={`Delete ${device.name}`}
                  >
                    <Icon name="delete" size={16} color="#BA1A1A" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}

      {/* Friendly Tip Footer Banner */}
      <View style={styles.tipBanner}>
        <Icon name="lightbulb" size={28} color={colors.primary} fill />
        <View style={styles.colFlex}>
          <Text style={styles.tipTitle}>Smart Presence Tip</Text>
          <Text style={styles.tipBody}>
            Lights automatically turn ON only in the camera quadrant where humans are detected, and shut OFF immediately in empty areas.
          </Text>
        </View>
      </View>

      {/* Edit / Update Device Modal */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !isSubmittingEdit && setIsEditModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Update Device</Text>
                <Text style={styles.modalSubtitle}>Edit fixture name, type & target quadrant</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditModalOpen(false)}
                style={styles.modalCloseBtn}
                disabled={isSubmittingEdit}
              >
                <Icon name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: 14 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DEVICE NAME</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="e.g. Quadrant 1 Light"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.textInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>TARGET CAMERA QUADRANT</Text>
                <View style={styles.quadrantGridRow}>
                  {QUADRANTS.map(q => {
                    const isSelected = editQuadrant === q.num;
                    return (
                      <TouchableOpacity
                        key={q.id}
                        onPress={() => setEditQuadrant(q.num)}
                        style={[styles.quadrantChip, isSelected && styles.quadrantChipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.quadrantChipTitle, isSelected && styles.quadrantChipTitleActive]}>
                          {q.name}
                        </Text>
                        <Text style={[styles.quadrantChipSub, isSelected && styles.quadrantChipSubActive]}>
                          {q.pos} • Relay {q.relay}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DEVICE TYPE</Text>
                <View style={styles.categoryRow}>
                  {(['lights', 'fans', 'ac'] as const).map(cat => {
                    const isSelected = editCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setEditCategory(cat)}
                        style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                        activeOpacity={0.8}
                      >
                        <Icon
                          name={cat === 'lights' ? 'lightbulb' : cat === 'fans' ? 'mode_fan' : 'ac_unit'}
                          size={16}
                          color={isSelected ? '#FFFFFF' : colors.textPrimary}
                        />
                        <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                          {cat === 'lights' ? 'Light' : cat === 'fans' ? 'Fan' : 'AC'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>POWER CONSUMPTION (WATTS)</Text>
                <TextInput
                  value={editWatts}
                  onChangeText={setEditWatts}
                  placeholder="44"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.textInput}
                />
              </View>

              {editError && (
                <View style={styles.errorNotice}>
                  <Text style={styles.errorNoticeText}>{editError}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setIsEditModalOpen(false)}
                style={styles.modalCancelBtn}
                disabled={isSubmittingEdit}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveEditDevice}
                style={styles.modalSubmitBtn}
                disabled={isSubmittingEdit}
              >
                {isSubmittingEdit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.modalSubmitBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Device Modal */}
      <Modal
        visible={isAddModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !isSubmittingAdd && setIsAddModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Quadrant Device</Text>
                <Text style={styles.modalSubtitle}>Assign fixture to camera quadrant (1-4)</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAddModalOpen(false)}
                style={styles.modalCloseBtn}
                disabled={isSubmittingAdd}
              >
                <Icon name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: 14 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>TARGET CAMERA QUADRANT</Text>
                <View style={styles.quadrantGridRow}>
                  {QUADRANTS.map(q => {
                    const isSelected = newQuadrant === q.num;
                    return (
                      <TouchableOpacity
                        key={q.id}
                        onPress={() => handleQuadrantSelectForAdd(q.num)}
                        style={[styles.quadrantChip, isSelected && styles.quadrantChipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.quadrantChipTitle, isSelected && styles.quadrantChipTitleActive]}>
                          {q.name}
                        </Text>
                        <Text style={[styles.quadrantChipSub, isSelected && styles.quadrantChipSubActive]}>
                          {q.pos} • Relay {q.relay}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DEVICE TYPE</Text>
                <View style={styles.categoryRow}>
                  {(['lights', 'fans', 'ac'] as const).map(cat => {
                    const isSelected = newCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => handleCategorySelectForAdd(cat)}
                        style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                        activeOpacity={0.8}
                      >
                        <Icon
                          name={cat === 'lights' ? 'lightbulb' : cat === 'fans' ? 'mode_fan' : 'ac_unit'}
                          size={16}
                          color={isSelected ? '#FFFFFF' : colors.textPrimary}
                        />
                        <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                          {cat === 'lights' ? 'Light' : cat === 'fans' ? 'Fan' : 'AC'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DEVICE NAME</Text>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="e.g. Quadrant 1 Light"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.textInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>POWER CONSUMPTION (WATTS)</Text>
                <TextInput
                  value={newWatts}
                  onChangeText={setNewWatts}
                  placeholder="44"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.textInput}
                />
              </View>

              {addError && (
                <View style={styles.errorNotice}>
                  <Text style={styles.errorNoticeText}>{addError}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setIsAddModalOpen(false)}
                style={styles.modalCancelBtn}
                disabled={isSubmittingAdd}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreateDevice}
                style={styles.modalSubmitBtn}
                disabled={isSubmittingAdd}
              >
                {isSubmittingAdd ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.modalSubmitBtnText}>Add Device</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Device Confirmation Modal */}
      <Modal
        visible={!!deviceToDelete}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeletingDevice && setDeviceToDelete(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalIconCircle}>
              <Icon name="delete_forever" size={32} color="#BA1A1A" />
            </View>

            <Text style={styles.deleteModalTitle}>Delete {deviceToDelete?.name}?</Text>
            <Text style={styles.deleteModalDesc}>
              This will permanently remove this device from Quadrant {deviceToDelete ? getDeviceQuadrantNum(deviceToDelete) : 1} and disconnect its automated relay control.
            </Text>

            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                onPress={() => setDeviceToDelete(null)}
                style={styles.modalCancelBtn}
                disabled={isDeletingDevice}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmDeleteDevice}
                style={styles.deleteConfirmBtn}
                disabled={isDeletingDevice}
              >
                {isDeletingDevice ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="delete" size={18} color="#FFFFFF" />
                    <Text style={styles.deleteConfirmBtnText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.7)',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 14,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  col: {
    justifyContent: 'center',
  },
  colFlex: {
    flex: 1,
    minWidth: 0,
  },
  sunEmoji: {
    fontSize: 32,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  listenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceYellow,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 6,
    minHeight: 48,
  },
  listenText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  audioToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainer,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.3)',
  },
  audioToastText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeAudioBtn: {
    padding: 4,
  },
  healthBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGreen,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
    gap: 16,
  },
  healthIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  healthSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3f4940',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.7)',
    minHeight: 148,
    justifyContent: 'space-between',
  },
  metricIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  metricBigText: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  metricSmallText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  savedCard: {
    width: '100%',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.7)',
    overflow: 'hidden',
  },
  piggyBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfacePeach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  savedAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  ecoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  ecoText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  actionsCol: {
    gap: 10,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 56,
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyRoomsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfacePeach,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 56,
  },
  emptyRoomsBtnSuccess: {
    backgroundColor: colors.surfaceGreen,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  emptyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyActionSub: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  reportActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.7)',
    minHeight: 56,
  },
  reportIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  viewAllRoomsText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  roomIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  roomSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  occupancyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceYellow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  occupancyPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.tertiaryContainer,
  },
  occupancyText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfacePeach,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  devicePreviewBox: {
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderRadius: 16,
    padding: 12,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.5)',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  deviceMiniIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  deviceValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  roomActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roomViewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    minHeight: 48,
    gap: 6,
  },
  roomViewText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  roomTuneBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 999,
    minHeight: 48,
    gap: 6,
  },
  roomSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  turnOffNowBtn: {
    paddingHorizontal: 16,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: colors.surfacePeach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnOffNowText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceYellow,
    borderRadius: 24,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(159, 104, 0, 0.2)',
    marginBottom: 8,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  tipBody: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
    marginTop: 2,
  },
  roomHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    gap: 4,
  },
  addSectionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  viewAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roomCardRightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteRoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFECEC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD4D4',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 22,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  errorNotice: {
    backgroundColor: '#FFECEC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD4D4',
  },
  errorNoticeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#BA1A1A',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubmitBtn: {
    flex: 1.5,
    minHeight: 48,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    gap: 6,
  },
  modalSubmitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  deleteModalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFECEC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  deleteModalDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  deleteConfirmBtn: {
    flex: 1.5,
    minHeight: 48,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BA1A1A',
    gap: 6,
  },
  deleteConfirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  addDeviceBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 6,
  },
  addDeviceBtnHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  deviceSub: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  deviceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusBullet: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  deviceStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deviceRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  devicePowerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerHigh,
    gap: 4,
  },
  devicePowerBtnActive: {
    backgroundColor: colors.primary,
  },
  devicePowerBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  devicePowerBtnTextActive: {
    color: '#FFFFFF',
  },
  deviceIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quadrantGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quadrantChip: {
    width: '48%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    gap: 2,
  },
  quadrantChipActive: {
    backgroundColor: colors.surfaceGreen,
    borderColor: colors.primary,
  },
  quadrantChipTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  quadrantChipTitleActive: {
    color: colors.primary,
  },
  quadrantChipSub: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  quadrantChipSubActive: {
    color: '#1b5e35',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
