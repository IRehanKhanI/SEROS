import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { colors } from '../theme/colors';
import { Device } from '../types';

const QUADRANTS = [
  { id: '1', num: 1, name: 'Quadrant 1', position: 'Top-Left', relay: 1 },
  { id: '2', num: 2, name: 'Quadrant 2', position: 'Top-Right', relay: 2 },
  { id: '3', num: 3, name: 'Quadrant 3', position: 'Bottom-Left', relay: 3 },
  { id: '4', num: 4, name: 'Quadrant 4', position: 'Bottom-Right', relay: 4 },
];

const getDeviceQuadrantNum = (device: Device): number => {
  if (device.quadrantNum && device.quadrantNum >= 1 && device.quadrantNum <= 4) return device.quadrantNum;
  if (device.relay && device.relay >= 1 && device.relay <= 4) return device.relay;
  const match = (device.quadrant || device.room || '').match(/quadrant\s*(\d)/i);
  if (match) return parseInt(match[1], 10);
  return 1;
};

export const getDeviceQuadrants = (device: Device): number[] => {
  if (device.quadrants && Array.isArray(device.quadrants) && device.quadrants.length > 0) {
    return [...device.quadrants].sort((a, b) => a - b);
  }
  return [getDeviceQuadrantNum(device)];
};

export const formatDeviceQuadrants = (device: Device): string => {
  const quads = getDeviceQuadrants(device);
  if (quads.length === 4) return 'All Quadrants (Room AC)';
  if (quads.length > 1) return `Quadrants: ${quads.map(q => `Q${q}`).join(', ')}`;
  const qObj = QUADRANTS.find(q => q.num === quads[0]);
  return qObj ? `${qObj.name} (${qObj.position})` : `Quadrant ${quads[0]}`;
};

export const DevicesView: React.FC = () => {
  const {
    devices,
    toggleDevice,
    setDeviceSpeed,
    addDevice,
    updateDevice,
    deleteDevice,
    rules,
    toggleRule,
    backendVerifiedNotice,
    setBackendVerifiedNotice,
    setIsRuleWizardOpen,
    sensorData,
    activeLayoutId,
    layouts,
  } = useApp();

  const [selectedQuadrant, setSelectedQuadrant] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'lights' | 'fans' | 'ac'>('all');
  const [selectedAddLayoutId, setSelectedAddLayoutId] = useState<string>(activeLayoutId || 'layout-1');

  // Edit Device Modal State
  const [deviceToEdit, setDeviceToEdit] = useState<Device | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editQuadrants, setEditQuadrants] = useState<number[]>([1]);
  const [editCategory, setEditCategory] = useState<'lights' | 'fans' | 'ac'>('lights');
  const [editName, setEditName] = useState<string>('');
  const [editRelay, setEditRelay] = useState<string>('1');
  const [editWatts, setEditWatts] = useState<string>('44');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Add Device Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newQuadrants, setNewQuadrants] = useState<number[]>([1]);
  const [newCategory, setNewCategory] = useState<'lights' | 'fans' | 'ac'>('lights');
  const [newName, setNewName] = useState<string>('');
  const [newRelay, setNewRelay] = useState<string>('1');
  const [newWatts, setNewWatts] = useState<string>('44');
  const [isSubmittingNew, setIsSubmittingNew] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);


  // Delete Confirmation Modal State
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Filter by selected quadrant: show devices that cover this quadrant
  const quadrantDevices = devices.filter((d) => {
    if (selectedQuadrant === 'all') return true;
    const targetQ = parseInt(selectedQuadrant, 10);
    return getDeviceQuadrants(d).includes(targetQ);
  });

  // Filter by category
  const filteredDevices = quadrantDevices.filter((d) => {
    if (activeFilter === 'all') return true;
    return d.category === activeFilter;
  });

  const lightsCount = quadrantDevices.filter((d) => d.category === 'lights').length;
  const fansCount = quadrantDevices.filter((d) => d.category === 'fans').length;
  const acCount = quadrantDevices.filter((d) => d.category === 'ac').length;

  const totalLiveWatts = devices.reduce((sum, device) => {
    if (device.status === 'ON') {
      const w = device.powerWatts || device.ratedWatts || (device.category === 'ac' ? 1450 : device.category === 'fans' ? 65 : 24);
      return sum + w;
    }
    return sum;
  }, 0);
  const activeCount = devices.filter(d => d.status === 'ON').length;

  const activeLayout = layouts.find(l => l.id === activeLayoutId) || layouts[0];
  const currentQuadrants = (activeLayout && activeLayout.zones && activeLayout.zones.length > 0)
    ? activeLayout.zones.map(z => ({
        id: String(z.num || z.id),
        num: z.num,
        name: z.name,
        position: z.name,
        relay: z.num,
      }))
    : QUADRANTS;

  const currentQuadObj = currentQuadrants.find((q) => q.id === selectedQuadrant);
  const currentQuadName = selectedQuadrant === 'all'
    ? 'All Quadrants'
    : (currentQuadObj ? `${currentQuadObj.name}` : `Quadrant ${selectedQuadrant}`);


  const handleOpenEditModal = (device: Device) => {
    const quads = getDeviceQuadrants(device);
    setDeviceToEdit(device);
    setEditQuadrants(quads);
    setEditCategory(device.category);
    setEditName(device.name);
    setEditRelay(String(device.relay || quads[0] || 1));
    setEditWatts(String(device.powerWatts || (device.category === 'lights' ? 44 : device.category === 'fans' ? 38 : 1200)));
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleEditCategoryChange = (cat: 'lights' | 'fans' | 'ac') => {
    setEditCategory(cat);
    if (cat === 'ac' && editQuadrants.length === 1) {
      setEditQuadrants([1, 2, 3, 4]); // Auto-suggest all quadrants for AC
    }
    if (cat === 'lights') setEditWatts('44');
    else if (cat === 'fans') setEditWatts('38');
    else setEditWatts('1200');
  };

  const toggleEditQuadrant = (quadNum: number) => {
    setEditQuadrants((prev) => {
      if (prev.includes(quadNum)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter((q) => q !== quadNum);
      }
      return [...prev, quadNum].sort((a, b) => a - b);
    });
  };

  const selectAllEditQuadrants = () => {
    setEditQuadrants([1, 2, 3, 4]);
  };

  const handleSaveEditDevice = async () => {
    if (!deviceToEdit) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError('Please enter a name for the device.');
      return;
    }
    if (editQuadrants.length === 0) {
      setEditError('Please select at least one quadrant.');
      return;
    }
    setIsSubmittingEdit(true);
    setEditError(null);
    try {
      await updateDevice(deviceToEdit.id, {
        name: trimmed,
        category: editCategory,
        quadrant: editQuadrants[0],
        quadrants: editQuadrants,
        relay: editRelay && !isNaN(parseInt(editRelay, 10)) ? parseInt(editRelay, 10) : editQuadrants[0],
        power_watts: editWatts && !isNaN(parseFloat(editWatts)) ? parseFloat(editWatts) : undefined,
      });
      setIsEditModalOpen(false);
      setDeviceToEdit(null);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update device.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleOpenAddModal = (quadNum?: number) => {
    const targetQuad = quadNum || (selectedQuadrant !== 'all' ? parseInt(selectedQuadrant, 10) : 1);
    const validQuad = targetQuad >= 1 && targetQuad <= 4 ? targetQuad : 1;
    const defaultTypeName = 'Light';

    setNewQuadrants([validQuad]);
    setNewCategory('lights');
    setNewName(`Quadrant ${validQuad} ${defaultTypeName}`);
    setNewRelay(String(validQuad));
    setNewWatts('44');
    setAddError(null);
    setIsAddModalOpen(true);
  };

  const handleCategoryChange = (cat: 'lights' | 'fans' | 'ac') => {
    setNewCategory(cat);
    if (cat === 'ac') {
      setNewQuadrants([1, 2, 3, 4]); // Realistic Room AC: defaults to all quadrants
      setNewName('Room AC Unit');
      setNewWatts('1200');
    } else {
      const q = newQuadrants[0] || 1;
      setNewQuadrants([q]);
      const defaultTypeName = cat === 'lights' ? 'Light' : 'Fan';
      setNewName(`Quadrant ${q} ${defaultTypeName}`);
      setNewWatts(cat === 'lights' ? '44' : '38');
    }
  };

  const toggleNewQuadrant = (quadNum: number) => {
    setNewQuadrants((prev) => {
      let updated: number[];
      if (prev.includes(quadNum)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        updated = prev.filter((q) => q !== quadNum);
      } else {
        updated = [...prev, quadNum].sort((a, b) => a - b);
      }
      // Update default name if user hasn't heavily customized it
      const typeName = newCategory === 'lights' ? 'Light' : newCategory === 'fans' ? 'Fan' : 'AC Unit';
      if (updated.length === 4) {
        setNewName(`Room ${typeName}`);
      } else if (updated.length > 1) {
        setNewName(`Q${updated.join('+Q')} ${typeName}`);
      } else {
        setNewName(`Quadrant ${updated[0]} ${typeName}`);
      }
      setNewRelay(String(updated[0]));
      return updated;
    });
  };

  const selectAllNewQuadrants = () => {
    setNewQuadrants([1, 2, 3, 4]);
    const typeName = newCategory === 'lights' ? 'Light' : newCategory === 'fans' ? 'Fan' : 'AC Unit';
    setNewName(`Room ${typeName}`);
    setNewRelay('1');
  };

  const handleCreateDevice = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setAddError('Please enter a name for the device.');
      return;
    }
    if (newQuadrants.length === 0) {
      setAddError('Please select at least one quadrant.');
      return;
    }
    setIsSubmittingNew(true);
    setAddError(null);
    try {
      await addDevice({
        quadrant: newQuadrants[0],
        quadrants: newQuadrants,
        name: trimmed,
        category: newCategory,
        relay: newRelay && !isNaN(parseInt(newRelay, 10)) ? parseInt(newRelay, 10) : newQuadrants[0],
        power_watts: newWatts && !isNaN(parseFloat(newWatts)) ? parseFloat(newWatts) : undefined,
      });
      setIsAddModalOpen(false);
    } catch (err: any) {
      setAddError(err?.message || 'Failed to add device.');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deviceToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDevice(deviceToDelete.id);
      setDeviceToDelete(null);
    } catch (err) {
      // Notification handled in context
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Backend Confirmation Banner */}
      {backendVerifiedNotice && (
        <View style={styles.confirmationBanner}>
          <View style={styles.rowAlign}>
            <Icon name="verified" size={20} color={colors.primary} fill />
            <Text style={styles.confirmationText}>{backendVerifiedNotice}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setBackendVerifiedNotice(null)}
            style={styles.closeBtn}
            accessibilityLabel="Close notification"
          >
            <Icon name="close" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Intro Header */}
      <View style={styles.headerBox}>
        <View style={styles.rowBetween}>
          <Text style={styles.pageTitle}>Device Controls</Text>
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              onPress={() => handleOpenAddModal()}
              style={styles.addDeviceHeaderBtn}
              activeOpacity={0.85}
              accessibilityLabel="Add device"
            >
              <Icon name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addDeviceHeaderBtnText}>Add Device</Text>
            </TouchableOpacity>
            <View style={styles.ecoSaverBadge}>
              <Icon name="bolt" size={16} color={colors.tertiary} />
              <Text style={styles.ecoSaverText}>Eco-Saver</Text>
            </View>
          </View>
        </View>
        <Text style={styles.pageSubtitle}>
          Manage lights and fans across 4 camera quadrants. S.E.R.O.S. adjusts power safely in real-time.
        </Text>
      </View>

      {/* Live Telemetry & Environmental Status Banner */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          justifyContent: 'space-around',

          alignItems: 'center',
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>
            Live Power
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>
            {totalLiveWatts} W
          </Text>
          <Text style={{ fontSize: 10, color: colors.textSecondary }}>
            {activeCount} of {devices.length} ON
          </Text>
        </View>
        <View style={{ width: 1, height: 32, backgroundColor: colors.borderSubtle }} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>
            Room Temp
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.secondary }}>
            {sensorData.temperature.toFixed(1)}°C
          </Text>
          <Text style={{ fontSize: 10, color: colors.secondary }}>
            HTU21DF Live
          </Text>
        </View>
        <View style={{ width: 1, height: 32, backgroundColor: colors.borderSubtle }} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>
            Humidity
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.tertiary }}>
            {sensorData.humidity.toFixed(0)}%
          </Text>
          <Text style={{ fontSize: 10, color: colors.tertiary }}>
            Relative
          </Text>
        </View>
      </View>


      {/* Quadrant Selector */}
      <View style={styles.sectionFilterContainer}>
        <Text style={styles.filterSectionLabel}>Filter by Quadrant</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionScrollContent}
        >
          <TouchableOpacity
            onPress={() => setSelectedQuadrant('all')}
            style={[
              styles.sectionPill,
              selectedQuadrant === 'all' && styles.sectionPillActive,
            ]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.sectionPillText,
                selectedQuadrant === 'all' && styles.sectionPillTextActive,
              ]}
            >
              All Quadrants ({devices.length})
            </Text>
          </TouchableOpacity>

          {currentQuadrants.map((quad) => {
            const count = devices.filter((d) => getDeviceQuadrants(d).includes(quad.num)).length;
            const isSelected = selectedQuadrant === quad.id;
            return (
              <TouchableOpacity
                key={quad.id}
                onPress={() => setSelectedQuadrant(quad.id)}
                style={[
                  styles.sectionPill,
                  isSelected && styles.sectionPillActive,
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.sectionPillText,
                    isSelected && styles.sectionPillTextActive,
                  ]}
                >
                  {quad.name} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          onPress={() => setActiveFilter('all')}
          style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
          activeOpacity={0.8}
        >
          <Icon
            name="apps"
            size={18}
            color={activeFilter === 'all' ? '#FFFFFF' : colors.textPrimary}
          />
          <Text
            style={[
              styles.filterPillText,
              activeFilter === 'all' && styles.filterPillTextActive,
            ]}
          >
            All ({quadrantDevices.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveFilter('lights')}
          style={[styles.filterPill, activeFilter === 'lights' && styles.filterPillActive]}
          activeOpacity={0.8}
        >
          <Icon
            name="lightbulb"
            size={18}
            color={activeFilter === 'lights' ? '#FFFFFF' : colors.textPrimary}
          />
          <Text
            style={[
              styles.filterPillText,
              activeFilter === 'lights' && styles.filterPillTextActive,
            ]}
          >
            Lights ({lightsCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveFilter('fans')}
          style={[styles.filterPill, activeFilter === 'fans' && styles.filterPillActive]}
          activeOpacity={0.8}
        >
          <Icon
            name="mode_fan"
            size={18}
            color={activeFilter === 'fans' ? '#FFFFFF' : colors.textPrimary}
          />
          <Text
            style={[
              styles.filterPillText,
              activeFilter === 'fans' && styles.filterPillTextActive,
            ]}
          >
            Fans ({fansCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveFilter('ac')}
          style={[styles.filterPill, activeFilter === 'ac' && styles.filterPillActive]}
          activeOpacity={0.8}
        >
          <Icon
            name="ac_unit"
            size={18}
            color={activeFilter === 'ac' ? '#FFFFFF' : colors.textPrimary}
          />
          <Text
            style={[
              styles.filterPillText,
              activeFilter === 'ac' && styles.filterPillTextActive,
            ]}
          >
            AC & HVAC ({acCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Device Cards List */}
      <View style={styles.deviceList}>
        {filteredDevices.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Icon
                name={
                  activeFilter === 'fans'
                    ? 'mode_fan'
                    : activeFilter === 'lights'
                    ? 'lightbulb'
                    : 'apps'
                }
                size={32}
                color={colors.textSecondary}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {selectedQuadrant === 'all'
                ? activeFilter === 'all'
                  ? 'No devices configured yet'
                  : `No ${activeFilter} configured yet`
                : `No ${activeFilter === 'all' ? 'devices' : activeFilter} in ${currentQuadName}`}
            </Text>
            <Text style={styles.emptySubtitle}>
              {selectedQuadrant === 'all'
                ? 'Add lights and fans to camera quadrants to enable smart occupancy automation.'
                : `Configure lights and fans in ${currentQuadName} to control fixtures and optimize power.`}
            </Text>
            <TouchableOpacity
              onPress={() => handleOpenAddModal(selectedQuadrant !== 'all' ? parseInt(selectedQuadrant, 10) : undefined)}
              style={styles.emptyAddBtn}
              activeOpacity={0.85}
            >
              <Icon name="add" size={18} color="#FFFFFF" />
              <Text style={styles.emptyAddBtnText}>
                {selectedQuadrant === 'all' ? 'Add Device' : `Add Device to ${currentQuadName}`}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredDevices.map((device) => {
            const isFan = device.category === 'fans';
            const isAC = device.category === 'ac';
            const isLight = device.category === 'lights';
            const isOn = device.status === 'ON';

            return (
              <View key={device.id} style={styles.deviceCard}>
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
                            ? isOn
                              ? 'mode_fan'
                              : 'mode_fan_off'
                            : isLight
                            ? isOn
                              ? 'lightbulb'
                              : 'light_off'
                            : 'ac_unit'
                        }
                        size={26}
                        color={
                          isOn
                            ? isFan
                              ? colors.primary
                              : isLight
                              ? colors.tertiary
                              : colors.secondary
                            : colors.textSecondary
                        }
                      />
                    </View>

                    <View style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                      <Text style={styles.deviceName} numberOfLines={1}>{device.name}</Text>
                      <Text style={styles.deviceSub} numberOfLines={1}>
                        {formatDeviceQuadrants(device)} • Relay {device.relay || getDeviceQuadrantNum(device)} •{' '}
                        {isFan && `Smart Fan • ${isOn ? (device.powerWatts || device.ratedWatts || 65) : 0}W Live`}
                        {isLight && `LED Fixture • ${isOn ? (device.powerWatts || device.ratedWatts || 24) : 0}W Live`}
                        {isAC && `Universal IR AC • ${isOn ? (device.powerWatts || device.ratedWatts || 1450) : 0}W Live`}
                      </Text>

                      {/* Quadrant Coverage Pills for Multi-Quadrant Devices */}
                      {getDeviceQuadrants(device).length > 1 && (
                        <View style={styles.cardQuadrantBadgesRow}>
                          {getDeviceQuadrants(device).map((q) => (
                            <View key={q} style={styles.cardQuadrantPill}>
                              <Text style={styles.cardQuadrantPillText}>Q{q}</Text>
                            </View>
                          ))}
                          <Text style={styles.cardQuadrantSummaryText}>
                            {getDeviceQuadrants(device).length === 4 ? 'Entire Room Coverage' : 'Multi-Zone'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.deviceCardRightHeader}>
                    <View
                      style={[
                        styles.deviceStatusBadge,
                        {
                          backgroundColor: isOn
                            ? colors.surfaceGreen
                            : colors.surfaceContainerHigh,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusBullet,
                          { backgroundColor: isOn ? colors.primaryContainer : '#6f7a6f' },
                        ]}
                      />
                      <Text
                        style={[
                          styles.deviceStatusText,
                          { color: isOn ? colors.primary : '#3f4940' },
                        ]}
                        numberOfLines={1}
                      >
                        {isOn
                          ? 'Auto ON'
                          : device.status === 'Standby'
                          ? 'Standby'
                          : 'OFF'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleOpenEditModal(device)}
                      style={styles.editCardBtn}
                      activeOpacity={0.7}
                      accessibilityLabel={`Edit ${device.name}`}
                    >
                      <Icon name="edit" size={16} color={colors.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setDeviceToDelete(device)}
                      style={styles.deleteCardBtn}
                      activeOpacity={0.7}
                      accessibilityLabel={`Delete ${device.name}`}
                    >
                      <Icon name="delete" size={17} color="#BA1A1A" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Fan Speed Segment */}
                {isFan && (
                  <View style={styles.speedSection}>
                    <Text style={styles.speedLabel}>Fan Speed Level</Text>
                    <View style={styles.speedRow}>
                      {[0, 1, 2, 3].map((speed) => {
                        const isActive = (device.speedLevel ?? 0) === speed;
                        return (
                          <TouchableOpacity
                            key={speed}
                            onPress={() => setDeviceSpeed(device.id, speed)}
                            style={[styles.speedBtn, isActive && styles.speedBtnActive]}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.speedBtnText,
                                isActive && styles.speedBtnTextActive,
                              ]}
                            >
                              {speed === 0
                                ? 'Off'
                                : speed === 2 && isActive
                                ? '2 • Active'
                                : speed}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Light Daylight Compensation Box */}
                {isLight && (
                  <View style={styles.daylightBox}>
                    <View style={styles.rowAlign}>
                      <Icon name="wb_sunny" size={18} color={colors.textSecondary} />
                      <Text style={styles.daylightText}>Daylight Compensation at 60%</Text>
                    </View>
                    <Text style={styles.automatedBadge}>Automated</Text>
                  </View>
                )}

                {/* AC Thermostat & Universal IR Remote Controller Box */}
                {isAC && (
                  <View style={styles.acCardBox}>
                    <View style={styles.rowBetween}>
                      <View style={styles.rowAlign}>
                        <Icon name="thermostat" size={24} color={colors.secondary} />
                        <View style={{ marginLeft: 6 }}>
                          <Text style={styles.thermoLabel}>Climate Control</Text>
                          <Text style={styles.thermoTemp}>
                            Room: {sensorData.temperature.toFixed(1)}°C • Target: {device.targetTemperature || 24}°C
                          </Text>
                        </View>

                      </View>
                      <View style={styles.targetPill}>
                        <Icon name="sensors" size={14} color={colors.primary} />
                        <Text style={styles.targetText}>
                          IR Remote (GPIO 4/14)
                        </Text>
                      </View>
                    </View>
                    <View style={styles.acRuleBanner}>
                      <Icon name="info" size={14} color={colors.secondary} />
                      <Text style={styles.acRuleBannerText}>
                        {getDeviceQuadrants(device).length > 1
                          ? `Stays ON if someone is in ${getDeviceQuadrants(device).map(q => `Q${q}`).join(', ')}`
                          : `Stays ON if someone is in Quadrant ${getDeviceQuadrants(device)[0]}`}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Big Action Switch */}
                <TouchableOpacity
                  onPress={() => toggleDevice(device.id)}
                  style={[
                    styles.toggleBtn,
                    isOn ? styles.toggleBtnOn : styles.toggleBtnOff,
                  ]}
                  activeOpacity={0.85}
                >
                  <Icon
                    name="power_settings_new"
                    size={22}
                    color={isOn ? colors.tertiaryContainer : '#FFFFFF'}
                  />
                  <Text
                    style={[
                      styles.toggleBtnText,
                      isOn ? styles.toggleBtnTextOn : styles.toggleBtnTextOff,
                    ]}
                  >
                    {isOn
                      ? isFan
                        ? 'TURN OFF FAN'
                        : isLight
                        ? 'TURN OFF LIGHTS'
                        : 'TURN OFF AC'
                      : isFan
                      ? 'TURN ON FAN'
                      : isLight
                      ? 'TURN ON LIGHTS'
                      : 'TURN ON AC'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      {/* Automatic Rules Section */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Automatic Rules</Text>
          <Text style={styles.sectionSubtitle}>
            Intelligent actions powered by presence sensors
          </Text>
        </View>
        <View style={styles.robotCircle}>
          <Icon name="smart_toy" size={22} color={colors.primary} />
        </View>
      </View>

      <View style={styles.deviceList}>
        {rules.map((rule) => (
          <View key={rule.id} style={styles.ruleCard}>
            <View style={styles.rowBetween}>
              <View
                style={[
                  styles.ruleBadge,
                  {
                    backgroundColor: rule.isActive
                      ? colors.surfaceGreen
                      : colors.surfaceContainerHigh,
                  },
                ]}
              >
                <Icon
                  name={rule.isActive ? 'check_circle' : 'pause_circle'}
                  size={16}
                  color={rule.isActive ? colors.primary : colors.textSecondary}
                  fill
                />
                <Text
                  style={[
                    styles.ruleBadgeText,
                    { color: rule.isActive ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {rule.isActive ? 'Active Rule' : 'Paused Rule'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => toggleRule(rule.id)}
                style={styles.pauseBtn}
                activeOpacity={0.8}
              >
                <Icon
                  name={rule.isActive ? 'pause' : 'play_arrow'}
                  size={16}
                  color={colors.textPrimary}
                />
                <Text style={styles.pauseBtnText}>
                  {rule.isActive ? 'Pause' : 'Resume'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Logic Stack */}
            <View style={styles.logicStack}>
              <View style={styles.logicRowWhen}>
                <View style={styles.whenTag}>
                  <Text style={styles.whenTagText}>WHEN</Text>
                </View>
                <Text style={styles.logicText}>{rule.whenText}</Text>
              </View>

              <View style={styles.logicRowThen}>
                <View style={styles.thenTag}>
                  <Text style={styles.thenTagText}>THEN</Text>
                </View>
                <Text style={[styles.logicText, { color: colors.primary }]}>
                  {rule.thenText}
                </Text>
              </View>
            </View>

            <View style={styles.rowBetween}>
              <View style={styles.rowAlign}>
                <Icon name="schedule" size={16} color={colors.textSecondary} />
                <Text style={styles.ruleTriggerText}>
                  Triggered {rule.triggerCount} times today
                </Text>
              </View>
              <Text style={styles.ruleKwhText}>{rule.tag}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          onPress={() => setIsRuleWizardOpen(true)}
          style={styles.createRuleBtn}
          activeOpacity={0.85}
        >
          <Icon name="add_circle" size={24} color={colors.primary} />
          <Text style={styles.createRuleText}>Create New Rule (Guided Wizard)</Text>
        </TouchableOpacity>
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
                <Text style={styles.modalSubtitle}>Edit quadrant, relay, category or name</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditModalOpen(false)}
                style={styles.modalCloseBtn}
                disabled={isSubmittingEdit}
              >
                <Icon name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              {/* Target Quadrants (Multi-Select) */}
              <View style={styles.inputGroup}>
                <View style={styles.rowBetween}>
                  <Text style={styles.inputLabel}>ASSIGNED CAMERA QUADRANTS</Text>
                  <TouchableOpacity
                    onPress={selectAllEditQuadrants}
                    style={styles.quickSelectBtn}
                    activeOpacity={0.8}
                  >
                    <Icon name="select_all" size={14} color={colors.primary} />
                    <Text style={styles.quickSelectBtnText}>Select All (Room AC)</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.quadrantGridRow}>
                  {QUADRANTS.map((quad) => {
                    const isSelected = editQuadrants.includes(quad.num);
                    return (
                      <TouchableOpacity
                        key={quad.id}
                        onPress={() => toggleEditQuadrant(quad.num)}
                        style={[styles.quadrantSelectorCard, isSelected && styles.quadrantSelectorCardActive]}
                        activeOpacity={0.8}
                      >
                        <View style={styles.rowBetween}>
                          <View style={styles.rowAlign}>
                            <View style={[styles.quadrantBadgeDot, isSelected && styles.quadrantBadgeDotActive]} />
                            <Text style={[styles.quadrantCardTitle, isSelected && styles.quadrantCardTitleActive]}>
                              {quad.name}
                            </Text>
                          </View>
                          {isSelected && <Icon name="check" size={16} color={colors.primary} />}
                        </View>
                        <Text style={[styles.quadrantCardSub, isSelected && styles.quadrantCardSubActive]}>
                          {quad.position} • Relay {quad.relay}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {/* Quick Presets */}
                <View style={styles.presetRow}>
                  <TouchableOpacity
                    onPress={() => setEditQuadrants([1, 2])}
                    style={[styles.presetChip, editQuadrants.length === 2 && editQuadrants.includes(1) && editQuadrants.includes(2) && styles.presetChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetChipText, editQuadrants.length === 2 && editQuadrants.includes(1) && editQuadrants.includes(2) && styles.presetChipTextActive]}>
                      Front Half (Q1+Q2)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEditQuadrants([3, 4])}
                    style={[styles.presetChip, editQuadrants.length === 2 && editQuadrants.includes(3) && editQuadrants.includes(4) && styles.presetChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetChipText, editQuadrants.length === 2 && editQuadrants.includes(3) && editQuadrants.includes(4) && styles.presetChipTextActive]}>
                      Back Half (Q3+Q4)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={selectAllEditQuadrants}
                    style={[styles.presetChip, editQuadrants.length === 4 && styles.presetChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetChipText, editQuadrants.length === 4 && styles.presetChipTextActive]}>
                      Entire Room (All 4)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Device Category */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DEVICE TYPE</Text>
                <View style={styles.categoryChoiceRow}>
                  <TouchableOpacity
                    onPress={() => handleEditCategoryChange('lights')}
                    style={[
                      styles.categoryChoiceCard,
                      editCategory === 'lights' && styles.categoryChoiceCardActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Icon
                      name="lightbulb"
                      size={22}
                      color={editCategory === 'lights' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.categoryChoiceTitle,
                        editCategory === 'lights' && styles.categoryChoiceTitleActive,
                      ]}
                    >
                      Light
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleEditCategoryChange('fans')}
                    style={[
                      styles.categoryChoiceCard,
                      editCategory === 'fans' && styles.categoryChoiceCardActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Icon
                      name="mode_fan"
                      size={22}
                      color={editCategory === 'fans' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.categoryChoiceTitle,
                        editCategory === 'fans' && styles.categoryChoiceTitleActive,
                      ]}
                    >
                      Fan
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleEditCategoryChange('ac')}
                    style={[
                      styles.categoryChoiceCard,
                      editCategory === 'ac' && styles.categoryChoiceCardActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Icon
                      name="ac_unit"
                      size={22}
                      color={editCategory === 'ac' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.categoryChoiceTitle,
                        editCategory === 'ac' && styles.categoryChoiceTitleActive,
                      ]}
                    >
                      AC
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Device Name */}
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

              {/* Hardware Relay & Power Row */}
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>RELAY PIN #</Text>
                  <TextInput
                    value={editRelay}
                    onChangeText={setEditRelay}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.textInput}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>WATTS (POWER)</Text>
                  <TextInput
                    value={editWatts}
                    onChangeText={setEditWatts}
                    keyboardType="numeric"
                    placeholder="44"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.textInput}
                  />
                </View>
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
                activeOpacity={0.8}
                disabled={isSubmittingEdit}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveEditDevice}
                style={styles.modalSubmitBtn}
                activeOpacity={0.85}
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
        onRequestClose={() => !isSubmittingNew && setIsAddModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Quadrant Device</Text>
                <Text style={styles.modalSubtitle}>Assign light or fan to an automated camera quadrant</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAddModalOpen(false)}
                style={styles.modalCloseBtn}
                disabled={isSubmittingNew}
              >
                <Icon name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              {/* Step 1: Select Layout First */}
              <View style={styles.inputGroup}>
                <View style={styles.rowBetween}>
                  <Text style={styles.inputLabel}>STEP 1: SELECT ROOM LAYOUT FIRST</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                    {layouts.find(l => l.id === selectedAddLayoutId)?.name || 'Layout 1'}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingVertical: 4 }}>
                  {layouts.map((l) => {
                    const isSelected = selectedAddLayoutId === l.id;
                    return (
                      <TouchableOpacity
                        key={l.id}
                        onPress={() => setSelectedAddLayoutId(l.id)}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 999,
                          backgroundColor: isSelected ? colors.surfaceGreen : colors.surface,
                          borderWidth: 1.5,
                          borderColor: isSelected ? colors.primary : colors.borderSubtle,
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: isSelected ? colors.primary : colors.textPrimary }}>
                          {isSelected ? `✓ ${l.name}` : l.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Step 2: Target Quadrants (Multi-Select) */}
              <View style={styles.inputGroup}>
                <View style={styles.rowBetween}>
                  <Text style={styles.inputLabel}>
                    STEP 2: ASSIGNED ZONES ({layouts.find(l => l.id === selectedAddLayoutId)?.name || 'Layout 1'})
                  </Text>
                  <TouchableOpacity
                    onPress={selectAllNewQuadrants}
                    style={styles.quickSelectBtn}
                    activeOpacity={0.8}
                  >
                    <Icon name="select_all" size={14} color={colors.primary} />
                    <Text style={styles.quickSelectBtnText}>Select All (Room AC)</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.quadrantGridRow}>
                  {QUADRANTS.map((quad) => {
                    const isSelected = newQuadrants.includes(quad.num);
                    return (
                      <TouchableOpacity
                        key={quad.id}
                        onPress={() => toggleNewQuadrant(quad.num)}
                        style={[styles.quadrantSelectorCard, isSelected && styles.quadrantSelectorCardActive]}
                        activeOpacity={0.8}
                      >
                        <View style={styles.rowBetween}>
                          <View style={styles.rowAlign}>
                            <View style={[styles.quadrantBadgeDot, isSelected && styles.quadrantBadgeDotActive]} />
                            <Text style={[styles.quadrantCardTitle, isSelected && styles.quadrantCardTitleActive]}>
                              {quad.name}
                            </Text>
                          </View>
                          {isSelected && <Icon name="check" size={16} color={colors.primary} />}
                        </View>
                        <Text style={[styles.quadrantCardSub, isSelected && styles.quadrantCardSubActive]}>
                          {quad.position} • Relay {quad.relay}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {/* Quick Presets */}
                <View style={styles.presetRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setNewQuadrants([1, 2]);
                      setNewRelay('1');
                      const typeName = newCategory === 'lights' ? 'Light' : newCategory === 'fans' ? 'Fan' : 'AC Unit';
                      setNewName(`Q1+Q2 ${typeName}`);
                    }}
                    style={[styles.presetChip, newQuadrants.length === 2 && newQuadrants.includes(1) && newQuadrants.includes(2) && styles.presetChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetChipText, newQuadrants.length === 2 && newQuadrants.includes(1) && newQuadrants.includes(2) && styles.presetChipTextActive]}>
                      Front Half (Q1+Q2)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setNewQuadrants([3, 4]);
                      setNewRelay('3');
                      const typeName = newCategory === 'lights' ? 'Light' : newCategory === 'fans' ? 'Fan' : 'AC Unit';
                      setNewName(`Q3+Q4 ${typeName}`);
                    }}
                    style={[styles.presetChip, newQuadrants.length === 2 && newQuadrants.includes(3) && newQuadrants.includes(4) && styles.presetChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetChipText, newQuadrants.length === 2 && newQuadrants.includes(3) && newQuadrants.includes(4) && styles.presetChipTextActive]}>
                      Back Half (Q3+Q4)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={selectAllNewQuadrants}
                    style={[styles.presetChip, newQuadrants.length === 4 && styles.presetChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetChipText, newQuadrants.length === 4 && styles.presetChipTextActive]}>
                      Entire Room (All 4)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Device Category */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DEVICE TYPE</Text>
                <View style={styles.categoryChoiceRow}>
                  <TouchableOpacity
                    onPress={() => handleCategoryChange('lights')}
                    style={[
                      styles.categoryChoiceCard,
                      newCategory === 'lights' && styles.categoryChoiceCardActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Icon
                      name="lightbulb"
                      size={22}
                      color={newCategory === 'lights' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.categoryChoiceTitle,
                        newCategory === 'lights' && styles.categoryChoiceTitleActive,
                      ]}
                    >
                      Light
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleCategoryChange('fans')}
                    style={[
                      styles.categoryChoiceCard,
                      newCategory === 'fans' && styles.categoryChoiceCardActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Icon
                      name="mode_fan"
                      size={22}
                      color={newCategory === 'fans' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.categoryChoiceTitle,
                        newCategory === 'fans' && styles.categoryChoiceTitleActive,
                      ]}
                    >
                      Fan
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleCategoryChange('ac')}
                    style={[
                      styles.categoryChoiceCard,
                      newCategory === 'ac' && styles.categoryChoiceCardActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Icon
                      name="ac_unit"
                      size={22}
                      color={newCategory === 'ac' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.categoryChoiceTitle,
                        newCategory === 'ac' && styles.categoryChoiceTitleActive,
                      ]}
                    >
                      AC
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Device Name */}
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

              {/* Hardware Relay & Power Row */}
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>RELAY PIN #</Text>
                  <TextInput
                    value={newRelay}
                    onChangeText={setNewRelay}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.textInput}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>WATTS (POWER)</Text>
                  <TextInput
                    value={newWatts}
                    onChangeText={setNewWatts}
                    keyboardType="numeric"
                    placeholder="44"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.textInput}
                  />
                </View>
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
                activeOpacity={0.8}
                disabled={isSubmittingNew}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreateDevice}
                style={styles.modalSubmitBtn}
                activeOpacity={0.85}
                disabled={isSubmittingNew}
              >
                {isSubmittingNew ? (
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

      {/* Delete Confirmation Modal */}
      <Modal
        visible={!!deviceToDelete}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeleting && setDeviceToDelete(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalIconCircle}>
              <Icon name="delete_forever" size={32} color="#BA1A1A" />
            </View>

            <Text style={styles.deleteModalTitle}>Delete Device?</Text>
            <Text style={styles.deleteModalDesc}>
              Are you sure you want to delete <Text style={{ fontWeight: '800' }}>{deviceToDelete?.name}</Text> from{' '}
              <Text style={{ fontWeight: '800' }}>{deviceToDelete ? `Quadrant ${getDeviceQuadrantNum(deviceToDelete)}` : 'Quadrant'}</Text>?
              {'\n'}This will also detach it from camera detection automation.
            </Text>

            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                onPress={() => setDeviceToDelete(null)}
                style={styles.modalCancelBtn}
                activeOpacity={0.8}
                disabled={isDeleting}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmDelete}
                style={styles.deleteConfirmBtn}
                activeOpacity={0.85}
                disabled={isDeleting}
              >
                {isDeleting ? (
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
  confirmationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceGreen,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.3)',
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmationText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  closeBtn: {
    padding: 4,
  },
  headerBox: {
    gap: 4,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  addDeviceHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 5,
  },
  addDeviceHeaderBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ecoSaverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceYellow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(159, 104, 0, 0.2)',
  },
  ecoSaverText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  sectionFilterContainer: {
    gap: 6,
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 2,
  },
  sectionScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  sectionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sectionPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sectionPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    minHeight: 48,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  deviceList: {
    gap: 14,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.7)',
    gap: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    gap: 8,
    marginTop: 6,
  },
  emptyAddBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  deviceCard: {
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
  deviceIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  deviceSub: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  deviceCardRightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  deviceStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
    maxWidth: 95,
  },
  editCardBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  deleteCardBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFECEC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD4D4',
  },
  statusBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deviceStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  speedSection: {
    gap: 6,
  },
  speedLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  speedRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 16,
    padding: 6,
    gap: 6,
  },
  speedBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedBtnActive: {
    backgroundColor: colors.primary,
  },
  speedBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3f4940',
  },
  speedBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  daylightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLow,
    padding: 12,
    borderRadius: 16,
  },
  daylightText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  automatedBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  thermoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  thermoTemp: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  targetPill: {
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  targetText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.secondary,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 999,
    gap: 8,
  },
  toggleBtnOn: {
    backgroundColor: colors.surfacePeach,
    borderWidth: 1,
    borderColor: 'rgba(255, 221, 180, 0.8)',
  },
  toggleBtnOff: {
    backgroundColor: colors.primary,
  },
  toggleBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  toggleBtnTextOn: {
    color: colors.tertiaryContainer,
  },
  toggleBtnTextOff: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  robotCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.7)',
    gap: 12,
  },
  ruleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  ruleBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  pauseBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  logicStack: {
    gap: 8,
  },
  logicRowWhen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    padding: 10,
    borderRadius: 14,
    gap: 10,
  },
  whenTag: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  whenTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
  },
  logicRowThen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGreen,
    padding: 10,
    borderRadius: 14,
    gap: 10,
  },
  thenTag: {
    backgroundColor: '#9bf6b1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  thenTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
  },
  logicText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  ruleTriggerText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  ruleKwhText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  createRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.3)',
    borderRadius: 999,
    minHeight: 56,
    gap: 8,
  },
  createRuleText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
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
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 22,
    gap: 16,
    maxHeight: '90%',
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
  modalScrollContent: {
    gap: 16,
    paddingBottom: 4,
  },
  inputGroup: {
    gap: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
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
  pillSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quadrantGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quadrantSelectorCard: {
    width: '48%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    gap: 4,
  },
  quadrantSelectorCardActive: {
    backgroundColor: colors.surfaceGreen,
    borderColor: colors.primary,
  },
  quadrantBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
    marginRight: 6,
  },
  quadrantBadgeDotActive: {
    backgroundColor: colors.primary,
  },
  quadrantCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  quadrantCardTitleActive: {
    color: colors.primary,
  },
  quadrantCardSub: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  quadrantCardSubActive: {
    color: '#1b5e35',
  },
  selectorChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  selectorChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectorChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  selectorChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  categoryChoiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  categoryChoiceCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6,
  },
  categoryChoiceCardActive: {
    backgroundColor: colors.surfaceGreen,
    borderColor: colors.primary,
  },
  categoryChoiceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  categoryChoiceTitleActive: {
    color: colors.primary,
    fontWeight: '800',
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
  cardQuadrantBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  cardQuadrantPill: {
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 110, 50, 0.25)',
  },
  cardQuadrantPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  cardQuadrantSummaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  acCardBox: {
    backgroundColor: colors.surfaceContainerLow,
    padding: 12,
    borderRadius: 16,
    gap: 8,
  },
  acRuleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 110, 50, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  acRuleBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    flex: 1,
  },
  quickSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.surfaceGreen,
  },
  quickSelectBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  presetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
