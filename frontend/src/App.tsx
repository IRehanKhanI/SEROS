import React from 'react';
import {
  View,
  ScrollView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { RoomsView } from './components/RoomsView';
import { EnergyView } from './components/EnergyView';
import { DevicesView } from './components/DevicesView';
import { MoreView } from './components/MoreView';
import { AssistantView } from './components/AssistantView';
import { SettingsView } from './components/SettingsView';
import { OnboardingView } from './components/OnboardingView';
import { RuleWizardModal } from './components/RuleWizardModal';
import { colors } from './theme/colors';

const MainLayout: React.FC = () => {
  const { currentView } = useApp();

  const renderCurrentView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView />;
      case 'rooms':
        return <RoomsView />;
      case 'energy':
        return <EnergyView />;
      case 'devices':
        return <DevicesView />;
      case 'more':
        return <MoreView />;
      case 'assistant':
        return <AssistantView />;
      case 'settings':
        return <SettingsView />;
      case 'onboarding':
        return <OnboardingView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.appContainer}>
          {/* React Native Fixed Header */}
          <Header />

          {/* React Native Native ScrollView */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderCurrentView()}
          </ScrollView>

          {/* React Native Fixed Bottom Navigation Bar */}
          <BottomNav />

          {/* React Native Modal Dialogs */}
          <RuleWizardModal />
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
    minHeight: '100%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    backgroundColor: colors.canvas,
    position: 'relative',
    overflow: 'hidden',
  },
  scrollArea: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
    width: '100%',
    maxWidth: '100%',
  },
});
