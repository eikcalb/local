import React from 'react';
import { StyleSheet, Text, View, Geolocation, StatusBar, Alert } from 'react-native';
import { createStackNavigator } from 'react-navigation';
import { Root, Toast } from 'native-base';
import Expo, { MapView, AppLoading } from 'expo';
import Omnibar from './components/Omnibar';
import Local from './src/Local'
import Route, { Location } from './src/Route';
import Home from './home';
import SplashScreen from './SplashScreen';


const RootComponent = createStackNavigator({ Home: { screen: Home }, Splash: { screen: SplashScreen } }, { initialRouteName: "Splash" });

export default class App extends React.Component {
    
    render() {
        return (
            <RootComponent navigationOptions={{ header: null }} />
        );
    }
}
