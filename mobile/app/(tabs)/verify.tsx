/**
 * verify.tsx — CRITICAL SCREEN
 *
 * Rules (enforced by product):
 *  - Only native camera. NO gallery picker.
 *  - GPS REQUIRED. Without it verification is blocked.
 *  - Confidence < 70% → user picks from top-5 species.
 *  - Payment via RevenueCat before certificate is issued.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useVerificationStore } from '../../store/verificationStore';
import { track } from '../../services/analytics';

type VerifyStep = 'camera' | 'loading' | 'result' | 'lowConfidence' | 'payment' | 'success';

export default function VerifyScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [step, setStep] = useState<VerifyStep>('camera');
  const cameraRef = useRef(null);
  const { setCurrentPhoto, setGpsCoords } = useVerificationStore();

  useEffect(() => {
    track('verification_started');
    requestLocationPermission();
  }, []);

  const handleTakePhoto = async () => {
    if (!locationPermission?.granted) {
      Alert.alert(
        'GPS обязателен',
        'Включите геолокацию — без неё сертификат не может быть выдан.',
        [{ text: 'OK' }],
      );
      return;
    }

    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setGpsCoords({
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: Math.round(location.coords.accuracy ?? 999),
    });

    if (cameraRef.current) {
      // @ts-ignore
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      setCurrentPhoto(photo.uri);
      track('photo_taken');
      setStep('loading');
      // TODO: upload photo and call /api/v1/verify
    }
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Нужен доступ к камере</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Разрешить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'loading') {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Анализируем растение...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* IMPORTANT: CameraView only — no ImagePicker, no gallery button */}
      <CameraView style={styles.camera} ref={cameraRef} facing="back">
        <View style={styles.overlay}>
          <Text style={styles.hint}>Наведите камеру на саженец</Text>
          <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060E08', alignItems: 'center', justifyContent: 'center' },
  camera: { flex: 1, width: '100%' },
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 48 },
  hint: { color: '#F0FFF4', marginBottom: 20, fontSize: 16 },
  captureButton: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'transparent', borderWidth: 4, borderColor: '#1DB954',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1DB954' },
  text: { color: '#F0FFF4', fontSize: 18, marginBottom: 20 },
  button: { backgroundColor: '#1DB954', padding: 14, borderRadius: 10 },
  buttonText: { color: '#060E08', fontWeight: 'bold' },
});
