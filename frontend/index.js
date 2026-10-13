import { registerRootComponent } from 'expo';
import App from './src/App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go, native builds, or web,
// the environment is properly registered.
registerRootComponent(App);

export default App;
