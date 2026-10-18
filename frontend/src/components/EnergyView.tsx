import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { colors } from '../theme/colors';

export const EnergyView: React.FC = () => {
  const { setBackendVerifiedNotice, speakText, sensorData, devices } = useApp();
  const currentLiveWatts = devices.reduce((sum, d) => sum + (d.status === 'ON' ? (d.powerWatts || d.ratedWatts || (d.category === 'ac' ? 1450 : d.category === 'fans' ? 65 : 24)) : 0), 0);

  const [activeTab, setActiveTab] = useState<'today' | '7days' | 'month'>('today');
  const [selectedDayDetail, setSelectedDayDetail] = useState<{
    day: string;
    cost: string;
    note: string;
    isPeak?: boolean;
  }>({
    day: 'Wed',
    cost: '₹64',
    note: 'Wed: Highest use (₹64) — ACs ran past 4 PM',
    isPeak: true
  });

  const [projectedUnits, setProjectedUnits] = useState<number>(250);
  const [showStatementModal, setShowStatementModal] = useState<boolean>(false);

  const energyUseCost = Math.round(projectedUnits * 4.4);
  const standardCharges = 1350;
  const govtDuty = Math.round(energyUseCost * 0.08);
  const totalEstimatedBill = energyUseCost + standardCharges + govtDuty;

  const weeklyBars = [
    { day: 'M', cost: '₹42', heightPct: 60, color: colors.tertiaryFixed, note: 'Moderate energy usage with 4 fans active', isPeak: false },
    { day: 'T', cost: '₹32', heightPct: 40, color: colors.primaryContainer, note: 'Low use — eco champion! 🌿', isPeak: false },
    { day: 'W', cost: '₹64', heightPct: 95, color: colors.danger, note: 'Wed: Highest use (₹64) — ACs ran past 4 PM', isPeak: true },
    { day: 'T', cost: '₹38', heightPct: 50, color: colors.primaryContainer, note: 'Low normal usage', isPeak: false },
    { day: 'F', cost: '₹50', heightPct: 70, color: colors.tertiaryFixed, note: 'Medium lab session usage', isPeak: false },
    { day: 'S', cost: '₹18', heightPct: 25, color: colors.primaryContainer, note: 'Weekend shutdown effective', isPeak: false },
    { day: 'S', cost: '₹48', heightPct: 62, color: colors.primaryContainer, note: 'Sun (Today): 18% lower than average!', isPeak: false }
  ];

  const handleDownloadStatement = () => {
    setShowStatementModal(true);
    setBackendVerifiedNotice('Plain-Language Bill Statement generated!');
    speakText(`Your estimated monthly bill is ₹${totalEstimatedBill.toLocaleString()} for ${projectedUnits} units.`);
  };

  return (
    <View style={styles.container}>
      {/* Plain-Language Summary Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.headlineCol}>
          <Text style={styles.headlineTitle}>
            You used {sensorData.energy_saving_percent}% less electricity today! 🎉
          </Text>
          <Text style={styles.headlineSubtitle}>
            Live Load: {currentLiveWatts} W • Room: {sensorData.temperature.toFixed(1)}°C • {sensorData.humidity.toFixed(0)}% RH
          </Text>
        </View>


        <View style={styles.costCallout}>
          <View style={styles.rowAlign}>
            <View style={styles.costIconBox}>
              <Icon name="monetization_on" size={26} color="#FFFFFF" fill />
            </View>
            <View>
              <Text style={styles.costLabel}>Estimated Cost Today</Text>
              <Text style={styles.costBig}>₹48</Text>
            </View>
          </View>
          <View style={styles.colEnd}>
            <View style={styles.savedPill}>
              <Text style={styles.savedText}>↓ ₹11 saved</Text>
            </View>
            <Text style={styles.vsYesterday}>vs yesterday</Text>
          </View>
        </View>
      </View>

      {/* Pill Filter Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          onPress={() => setActiveTab('today')}
          style={[styles.tabPill, activeTab === 'today' && styles.tabPillActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabPillText, activeTab === 'today' && styles.tabPillTextActive]}>
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('7days')}
          style={[styles.tabPill, activeTab === '7days' && styles.tabPillActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabPillText, activeTab === '7days' && styles.tabPillTextActive]}>
            Last 7 Days
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('month')}
          style={[styles.tabPill, activeTab === 'month' && styles.tabPillActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabPillText, activeTab === 'month' && styles.tabPillTextActive]}>
            This Month
          </Text>
        </TouchableOpacity>
      </View>

      {/* Weekly Consumption Bar Chart Card */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.cardTitle}>Weekly Daily Power</Text>
            <Text style={styles.cardSubtitle}>Touch any day to inspect cost</Text>
          </View>
          <View style={styles.chartIconCircle}>
            <Icon name="bar_chart" size={22} color={colors.primary} />
          </View>
        </View>

        {/* Bars Container */}
        <View style={styles.barsArea}>
          {weeklyBars.map((bar, i) => {
            const isSelected = selectedDayDetail.day === bar.day;
            return (
              <TouchableOpacity
                key={i}
                onPress={() =>
                  setSelectedDayDetail({
                    day: bar.day,
                    cost: bar.cost,
                    note: `${bar.day}: ${bar.cost} — ${bar.note}`,
                    isPeak: bar.isPeak
                  })
                }
                style={styles.barCol}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.barCostLabel,
                    bar.isPeak && { color: colors.danger, fontWeight: '800' },
                    bar.day === 'S' && i === 6 && { color: colors.primary, fontWeight: '800' },
                  ]}
                >
                  {bar.cost}
                </Text>
                <View
                  style={[
                    styles.barPill,
                    { height: `${bar.heightPct}%`, backgroundColor: bar.color },
                    isSelected && styles.barPillSelected,
                  ]}
                />
                <Text
                  style={[
                    styles.barDayLabel,
                    bar.isPeak && { color: colors.danger, fontWeight: '900' },
                    isSelected && { color: colors.primary, fontWeight: '900' },
                  ]}
                >
                  {bar.day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Day Details Box */}
        <View style={styles.barDetailBox}>
          <View style={styles.rowAlign}>
            <View
              style={[
                styles.detailBullet,
                { backgroundColor: selectedDayDetail.isPeak ? colors.danger : colors.primary },
              ]}
            />
            <Text style={styles.detailText} numberOfLines={1}>
              {selectedDayDetail.note}
            </Text>
          </View>
          <Text style={styles.detailLink}>Details</Text>
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primaryContainer }]} />
            <Text style={styles.legendLabel}>Low use (₹32)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.tertiaryFixed }]} />
            <Text style={styles.legendLabel}>Medium</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
            <Text style={[styles.legendLabel, { color: colors.danger, fontWeight: '800' }]}>
              Peak (₹64)
            </Text>
          </View>
        </View>
      </View>

      {/* Usage Heatmap Card */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.cardTitle}>When is power used most?</Text>
            <Text style={styles.cardSubtitle}>Daily schedule energy intensity</Text>
          </View>
          <Icon name="grid_view" size={24} color={colors.primary} />
        </View>

        {/* Heatmap Grid */}
        <View style={styles.heatmapTable}>
          {/* Header Row */}
          <View style={styles.heatmapRow}>
            <Text style={styles.heatmapColHeader}>Day</Text>
            <Text style={styles.heatmapColHeader}>8 AM{'\n'}Morn</Text>
            <Text style={styles.heatmapColHeader}>12 PM{'\n'}Noon</Text>
            <Text style={styles.heatmapColHeader}>4 PM{'\n'}Eve</Text>
            <Text style={styles.heatmapColHeader}>8 PM{'\n'}Night</Text>
          </View>

          {/* Mon */}
          <View style={styles.heatmapRow}>
            <Text style={styles.dayCell}>Mon</Text>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceYellow }]}><Text style={styles.heatCellText}>Mid</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.danger }]}><Text style={[styles.heatCellText, { color: '#FFF' }]}>Peak</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceYellow }]}><Text style={styles.heatCellText}>Mid</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceGreen }]}><Text style={[styles.heatCellText, { color: colors.primary }]}>Off</Text></View>
          </View>

          {/* Tue */}
          <View style={styles.heatmapRow}>
            <Text style={styles.dayCell}>Tue</Text>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceGreen }]}><Text style={[styles.heatCellText, { color: colors.primary }]}>Low</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceYellow }]}><Text style={styles.heatCellText}>Mid</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceGreen }]}><Text style={[styles.heatCellText, { color: colors.primary }]}>Low</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceGreen }]}><Text style={[styles.heatCellText, { color: colors.primary }]}>Off</Text></View>
          </View>

          {/* Wed */}
          <View style={styles.heatmapRow}>
            <Text style={styles.dayCell}>Wed</Text>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceYellow }]}><Text style={styles.heatCellText}>Mid</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.danger }]}><Text style={[styles.heatCellText, { color: '#FFF' }]}>Peak</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.danger }]}><Text style={[styles.heatCellText, { color: '#FFF' }]}>Peak</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceGreen }]}><Text style={[styles.heatCellText, { color: colors.primary }]}>Off</Text></View>
          </View>

          {/* Thu */}
          <View style={styles.heatmapRow}>
            <Text style={styles.dayCell}>Thu</Text>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceGreen }]}><Text style={[styles.heatCellText, { color: colors.primary }]}>Low</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceYellow }]}><Text style={styles.heatCellText}>Mid</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceYellow }]}><Text style={styles.heatCellText}>Mid</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceGreen }]}><Text style={[styles.heatCellText, { color: colors.primary }]}>Off</Text></View>
          </View>

          {/* Fri */}
          <View style={styles.heatmapRow}>
            <Text style={styles.dayCell}>Fri</Text>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceYellow }]}><Text style={styles.heatCellText}>Mid</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceYellow }]}><Text style={styles.heatCellText}>Mid</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceGreen }]}><Text style={[styles.heatCellText, { color: colors.primary }]}>Low</Text></View>
            <View style={[styles.heatCell, { backgroundColor: colors.surfaceGreen }]}><Text style={[styles.heatCellText, { color: colors.primary }]}>Off</Text></View>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.friendlyLegend}>
          <Text style={styles.legendChip}>🟢 Low / Off</Text>
          <Text style={styles.legendChip}>🟡 Medium</Text>
          <Text style={[styles.legendChip, { color: colors.danger }]}>🔴 Busy / High</Text>
        </View>

        <View style={styles.schoolNoticeBox}>
          <Icon name="school" size={22} color={colors.tertiary} />
          <Text style={styles.schoolNoticeText}>
            Classrooms use most energy between <Text style={styles.boldText}>10 AM and 2 PM</Text> when projectors and multiple fans are running.
          </Text>
        </View>
      </View>

      {/* Bill Estimator & Predictor Card */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.cardTitle}>Bill Estimator</Text>
            <Text style={styles.cardSubtitle}>Expected total for this cycle</Text>
          </View>
          <View style={[styles.chartIconCircle, { backgroundColor: colors.surfaceGreen }]}>
            <Icon name="receipt_long" size={22} color={colors.primary} />
          </View>
        </View>

        {/* Estimated Monthly Bill Banner */}
        <View style={styles.billTotalBanner}>
          <Text style={styles.billTotalLabel}>Estimated Monthly Bill</Text>
          <Text style={styles.billTotalBig}>₹{totalEstimatedBill.toLocaleString()}</Text>
          <Text style={styles.billTotalSub}>Next bill arrives in 12 days</Text>
        </View>

        {/* Unit Selector Buttons */}
        <View style={styles.unitSelector}>
          <View style={styles.rowBetween}>
            <Text style={styles.unitsLabel}>Projected Units</Text>
            <View style={styles.unitPill}>
              <Text style={styles.unitPillText}>{projectedUnits} kWh</Text>
            </View>
          </View>

          <View style={styles.quickUnitRow}>
            {[180, 250, 320, 400].map((val) => (
              <TouchableOpacity
                key={val}
                onPress={() => setProjectedUnits(val)}
                style={[
                  styles.quickUnitBtn,
                  projectedUnits === val && styles.quickUnitBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.quickUnitBtnText,
                    projectedUnits === val && styles.quickUnitBtnTextActive,
                  ]}
                >
                  {val} kWh
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Simple Breakdown Box */}
        <View style={styles.breakdownBox}>
          <Text style={styles.breakdownTitle}>Simple Breakdown</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Energy use:</Text>
            <Text style={styles.breakdownValue}>₹{energyUseCost.toLocaleString()}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Standard charges:</Text>
            <Text style={styles.breakdownValue}>₹{standardCharges.toLocaleString()}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Government duty:</Text>
            <Text style={styles.breakdownValue}>₹{govtDuty.toLocaleString()}</Text>
          </View>
        </View>

        {/* Quick Advice */}
        <View style={styles.quickTipBox}>
          <Icon name="tips_and_updates" size={24} color={colors.primary} />
          <Text style={styles.quickTipText}>
            💡 <Text style={styles.boldText}>Quick Tip:</Text> Turning off ACs 15 mins before leaving saves approximately <Text style={[styles.boldText, { color: colors.primary }]}>~₹320/month</Text> without warming up rooms!
          </Text>
        </View>

        {/* Download Statement Button */}
        <TouchableOpacity
          onPress={handleDownloadStatement}
          style={styles.downloadBtn}
          activeOpacity={0.85}
        >
          <Icon name="file_download" size={20} color="#FFFFFF" />
          <Text style={styles.downloadBtnText}>Download Plain-Language Bill Statement</Text>
        </TouchableOpacity>
      </View>

      {/* Bill Statement Modal */}
      <Modal visible={showStatementModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.rowAlign}>
                <Icon name="verified" size={24} color={colors.primary} fill />
                <Text style={styles.modalTitle}>Bill Statement</Text>
              </View>
              <TouchableOpacity onPress={() => setShowStatementModal(false)}>
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalHero}>
              <Text style={styles.modalCampus}>Smart Campus • Cycle 10</Text>
              <Text style={styles.modalAmount}>₹{totalEstimatedBill.toLocaleString()}</Text>
              <Text style={styles.modalCycleSub}>
                Projected {projectedUnits} kWh • Due in 12 days
              </Text>
            </View>

            <View style={styles.modalBreakdown}>
              <View style={styles.modalBreakdownRow}>
                <Text style={styles.modalRowText}>Energy charges ({projectedUnits} kWh @ ₹4.4):</Text>
                <Text style={styles.modalRowVal}>₹{energyUseCost}</Text>
              </View>
              <View style={styles.modalBreakdownRow}>
                <Text style={styles.modalRowText}>Fixed institutional connection:</Text>
                <Text style={styles.modalRowVal}>₹{standardCharges}</Text>
              </View>
              <View style={styles.modalBreakdownRow}>
                <Text style={styles.modalRowText}>Municipal & electricity duty (8%):</Text>
                <Text style={styles.modalRowVal}>₹{govtDuty}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                setShowStatementModal(false);
                setBackendVerifiedNotice('Statement downloaded to mobile storage.');
              }}
              style={styles.modalActionBtn}
            >
              <Icon name="download" size={20} color="#FFFFFF" />
              <Text style={styles.modalActionText}>Save Statement as PDF</Text>
            </TouchableOpacity>
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
  heroCard: {
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
  meterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  meterChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  headlineCol: {
    gap: 4,
  },
  headlineTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  headlineSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  costCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceGreen,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  costIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  costLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  costBig: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.primary,
    lineHeight: 36,
  },
  colEnd: {
    alignItems: 'flex-end',
  },
  savedPill: {
    backgroundColor: 'rgba(0, 105, 52, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  savedText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  vsYesterday: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 999,
    padding: 6,
    gap: 6,
  },
  tabPill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    backgroundColor: colors.primary,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3f4940',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chartIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barsArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    paddingVertical: 8,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    gap: 6,
  },
  barCostLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  barPill: {
    width: 28,
    borderRadius: 14,
  },
  barPillSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  barDayLabel: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  barDetailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceGreen,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  detailBullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  detailLink: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(227, 229, 216, 0.6)',
    paddingTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  heatmapTable: {
    gap: 8,
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heatmapColHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    lineHeight: 14,
  },
  dayCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  heatCell: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatCellText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  friendlyLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceContainer,
    borderRadius: 16,
    padding: 12,
  },
  legendChip: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  schoolNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfacePeach,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 221, 180, 0.8)',
  },
  schoolNoticeText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
    flex: 1,
  },
  boldText: {
    fontWeight: '900',
  },
  billTotalBanner: {
    backgroundColor: colors.surfaceGreen,
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  billTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  billTotalBig: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.primary,
  },
  billTotalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  unitSelector: {
    gap: 8,
  },
  unitsLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  unitPill: {
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  unitPillText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
  },
  quickUnitRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickUnitBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickUnitBtnActive: {
    backgroundColor: colors.primary,
  },
  quickUnitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  quickUnitBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  breakdownBox: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  breakdownTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  breakdownLabel: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  quickTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(223, 243, 163, 0.4)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  quickTipText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
    flex: 1,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    minHeight: 52,
    paddingHorizontal: 16,
    width: '100%',
    gap: 8,
  },
  downloadBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    flexShrink: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalHero: {
    backgroundColor: colors.surfaceGreen,
    borderRadius: 20,
    padding: 16,
    gap: 4,
  },
  modalCampus: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  modalAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
  },
  modalCycleSub: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalBreakdown: {
    gap: 8,
  },
  modalBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(227, 229, 216, 0.6)',
    paddingVertical: 4,
  },
  modalRowText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  modalRowVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    minHeight: 48,
    gap: 6,
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
