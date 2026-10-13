import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { colors } from '../theme/colors';

export const AssistantView: React.FC = () => {
  const {
    chatMessages,
    sendChatMessage,
    settings,
    updateSettings,
    speakText,
    stopSpeaking,
    isSpeaking,
    navigateToTab
  } = useApp();

  const [inputQuery, setInputQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(75);

  const handleSend = () => {
    if (!inputQuery.trim()) return;
    sendChatMessage(inputQuery.trim());
    setInputQuery('');
  };

  const handleQuickPrompt = (prompt: string) => {
    sendChatMessage(prompt);
  };

  const handleMicPressIn = () => {
    setIsListening(true);
    // Simulation / speech recognition
    setTimeout(() => {
      setIsListening(false);
      sendChatMessage('How much electricity are we using right now?');
    }, 1500);
  };

  return (
    <View style={styles.container}>
      {/* Assistant Context Badge */}
      <View style={styles.rowBetween}>
        <View style={styles.rowAlign}>
          <View style={styles.pulseContainer}>
            <View style={styles.pulseRing} />
            <View style={styles.pulseCore} />
          </View>
          <Text style={styles.intelText}>Conversational Intelligence</Text>
        </View>

        <View style={styles.modelBadge}>
          <Icon name="auto_awesome" size={16} color={colors.primary} fill />
          <Text style={styles.modelBadgeText}>Gemma 4B • Energy AI</Text>
        </View>
      </View>

      {/* Audio Accessibility Bar */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowAlign}>
            <View style={styles.volumeIconBox}>
              <Icon name="volume_up" size={24} color={colors.primary} />
            </View>
            <View>
              <View style={styles.rowAlignCompact}>
                <Text style={styles.voiceTitle}>
                  {settings.voiceGuidance ? 'Voice Mode Active' : 'Voice Mode Paused'}
                </Text>
                <View style={styles.clarityPill}>
                  <Text style={styles.clarityText}>High Clarity</Text>
                </View>
              </View>
              <Text style={styles.voiceSub}>
                {settings.voiceGuidance
                  ? 'Speaks every response clearly'
                  : 'Tap switch to enable voice speech'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => updateSettings({ voiceGuidance: !settings.voiceGuidance })}
            style={[
              styles.switchTrack,
              { backgroundColor: settings.voiceGuidance ? colors.primary : '#becabd' },
            ]}
          >
            <View
              style={[
                styles.switchThumb,
                settings.voiceGuidance && styles.switchThumbActive,
              ]}
            />
          </TouchableOpacity>
        </View>

        {/* Volume Level Segment */}
        <View style={styles.volumeControlRow}>
          <Icon name="volume_down" size={18} color={colors.textSecondary} />
          <View style={styles.volumeBar}>
            <View style={[styles.volumeFill, { width: `${volume}%` }]} />
          </View>
          <Icon name="volume_up" size={18} color={colors.textSecondary} />
        </View>
      </View>

      {/* Chat Messages */}
      <View style={styles.chatList}>
        {chatMessages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <View
              key={msg.id}
              style={[
                styles.messageWrapper,
                isUser ? styles.messageWrapperUser : styles.messageWrapperBot,
              ]}
            >
              {!isUser && (
                <View style={styles.botHeader}>
                  <View style={styles.botIconCircle}>
                    <Icon name="smart_toy" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.botName}>Gemma AI</Text>
                  <Text style={styles.botTime}>{msg.timestamp}</Text>
                </View>
              )}

              {isUser ? (
                <View style={styles.userBubble}>
                  <Text style={styles.userBubbleText}>{msg.text}</Text>
                  <View style={styles.userTimeRow}>
                    <Text style={styles.userTimeText}>{msg.timestamp}</Text>
                    <Icon name="done_all" size={16} color="#FFFFFF" />
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    styles.botBubble,
                    msg.chipData && styles.botBubbleInsight,
                  ]}
                >
                  <Text style={styles.botBubbleText}>{msg.text}</Text>

                  {/* Metric chip if present */}
                  {msg.chipData && (
                    <View style={styles.chipRow}>
                      <View style={styles.spentPill}>
                        <Icon name="bolt" size={18} color={colors.tertiary} />
                        <Text style={styles.spentText}>₹{msg.chipData.spentRupees} spent</Text>
                        <Text style={styles.spentSub}>• {msg.chipData.devicesText}</Text>
                      </View>
                      {msg.chipData.emptyTime && (
                        <View style={styles.emptyPill}>
                          <Icon name="person_off" size={16} color={colors.danger} />
                          <Text style={styles.emptyText}>{msg.chipData.emptyTime}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.botActionRow}>
                    <TouchableOpacity
                      onPress={() => speakText(msg.text)}
                      style={styles.listenPill}
                      activeOpacity={0.8}
                    >
                      <Icon name="volume_up" size={18} color={colors.primary} fill />
                      <Text style={styles.listenPillText}>
                        Listen to message {msg.audioDuration ? `(${msg.audioDuration})` : ''}
                      </Text>
                    </TouchableOpacity>

                    {isSpeaking && (
                      <TouchableOpacity onPress={stopSpeaking} style={styles.stopBtn}>
                        <Text style={styles.stopBtnText}>Stop</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {msg.actionBtn && (
                    <TouchableOpacity
                      onPress={() => {
                        if (msg.actionBtn?.targetTab) {
                          navigateToTab(msg.actionBtn.targetTab);
                        }
                      }}
                      style={styles.inspectBtn}
                      activeOpacity={0.85}
                    >
                      <Icon name="tune" size={20} color="#FFFFFF" />
                      <Text style={styles.inspectBtnText}>{msg.actionBtn.text}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Suggested Quick Prompts */}
      <View style={styles.suggestSection}>
        <View style={styles.rowBetween}>
          <Text style={styles.suggestHeader}>Tap to ask Gemma directly</Text>
          <Text style={styles.suggestBadge}>One-Touch Prompts</Text>
        </View>

        <View style={styles.promptList}>
          <TouchableOpacity
            onPress={() => handleQuickPrompt('How much did we save today?')}
            style={styles.quickPromptBtn}
            activeOpacity={0.8}
          >
            <View style={styles.rowAlign}>
              <Text style={styles.emojiIcon}>📊</Text>
              <Text style={styles.quickPromptText}>How much did we save today?</Text>
            </View>
            <Icon name="arrow_forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleQuickPrompt('Are any empty rooms currently powered on?')}
            style={styles.quickPromptBtn}
            activeOpacity={0.8}
          >
            <View style={styles.rowAlign}>
              <Text style={styles.emojiIcon}>👥</Text>
              <Text style={styles.quickPromptText}>Are any empty rooms currently powered on?</Text>
            </View>
            <Icon name="arrow_forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleQuickPrompt('Predict our monthly electricity bill')}
            style={styles.quickPromptBtn}
            activeOpacity={0.8}
          >
            <View style={styles.rowAlign}>
              <Text style={styles.emojiIcon}>🔮</Text>
              <Text style={styles.quickPromptText}>Predict our monthly electricity bill</Text>
            </View>
            <Icon name="arrow_forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Dedicated Large Mic Action */}
      <View style={styles.micCard}>
        <TouchableOpacity
          onPressIn={handleMicPressIn}
          style={[styles.bigMicBtn, isListening && styles.bigMicBtnActive]}
          activeOpacity={0.9}
        >
          <Icon name={isListening ? 'mic' : 'mic_none'} size={34} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.micTitle}>
          {isListening ? 'Listening... Speak now 🎙️' : 'Hold to Speak 🎙️'}
        </Text>
        <Text style={styles.micSub}>Speak in Hindi, English, or regional language</Text>
      </View>

      {/* Input Dock */}
      <View style={styles.inputDock}>
        <TextInput
          value={inputQuery}
          onChangeText={setInputQuery}
          onSubmitEditing={handleSend}
          placeholder="Ask anything about your campus..."
          placeholderTextColor={colors.textSecondary}
          style={styles.textInput}
        />
        <TouchableOpacity onPress={handleSend} style={styles.sendBtn} activeOpacity={0.85}>
          <Icon name="send" size={22} color="#FFFFFF" />
        </TouchableOpacity>
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
  pulseContainer: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#80d997',
    opacity: 0.6,
  },
  pulseCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  intelText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  modelBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.7)',
    gap: 12,
  },
  volumeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentLime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  clarityPill: {
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  clarityText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  voiceSub: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  switchTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  switchThumbActive: {
    transform: [{ translateX: 22 }],
  },
  volumeControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  volumeBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceContainer,
    overflow: 'hidden',
  },
  volumeFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  chatList: {
    gap: 14,
  },
  messageWrapper: {
    gap: 6,
  },
  messageWrapperUser: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  messageWrapperBot: {
    alignSelf: 'flex-start',
    width: '100%',
  },
  botHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  botIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  botTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  userBubble: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 22,
    borderTopRightRadius: 4,
  },
  userBubbleText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  userTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  userTimeText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  botBubble: {
    backgroundColor: colors.surfaceGreen,
    padding: 16,
    borderRadius: 24,
    borderTopLeftRadius: 4,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(39, 131, 74, 0.2)',
  },
  botBubbleInsight: {
    backgroundColor: colors.surfacePeach,
    borderColor: 'rgba(255, 221, 180, 0.9)',
  },
  botBubbleText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  spentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  spentText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  spentSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.danger,
  },
  botActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  listenPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  stopBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  stopBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.danger,
  },
  inspectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    minHeight: 48,
    gap: 8,
  },
  inspectBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  suggestSection: {
    gap: 8,
    marginTop: 4,
  },
  suggestHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  suggestBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  promptList: {
    gap: 8,
  },
  quickPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  emojiIcon: {
    fontSize: 18,
  },
  quickPromptText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  micCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(227, 229, 216, 0.7)',
    gap: 8,
  },
  bigMicBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bigMicBtnActive: {
    backgroundColor: colors.danger,
  },
  micTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  micSub: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  inputDock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    padding: 6,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
