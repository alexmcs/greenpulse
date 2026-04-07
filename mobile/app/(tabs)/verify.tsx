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
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVerificationStore } from '../../store/verificationStore';
import { track } from '../../services/analytics';
import { authService, supabase } from '../../services/auth';
import { apiClient } from '../../services/api';

type VerifyStep = 'camera' | 'loading' | 'result' | 'lowConfidence' | 'payment' | 'success';

/** Persistent device ID — generated once, stored in AsyncStorage */
async function getDeviceId(): Promise<string> {
  const KEY = '@gp_device_id';
  let id = await AsyncStorage.getItem(KEY);
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    await AsyncStorage.setItem(KEY, id);
  }
  return id;
}

/** Decode base64 string to Uint8Array for Supabase Storage upload in React Native */
function decodeBase64(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleaned = base64.replace(/=/g, '');
  const len = cleaned.length;
  const buf = new Uint8Array(Math.floor((len * 3) / 4));
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = chars.indexOf(cleaned[i]);
    const b = chars.indexOf(cleaned[i + 1]);
    const c2 = chars.indexOf(cleaned[i + 2]);
    const d = chars.indexOf(cleaned[i + 3]);
    buf[p++] = (a << 2) | (b >> 4);
    if (i + 2 < len) buf[p++] = ((b & 15) << 4) | (c2 >> 2);
    if (i + 3 < len) buf[p++] = ((c2 & 3) << 6) | d;
  }
  return buf.slice(0, p);
}

export default function VerifyScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [step, setStep] = useState<VerifyStep>('camera');
  const [loadingText, setLoadingText] = useState('Загружаем фото...');
  const cameraRef = useRef(null);
  const {
    setCurrentPhoto,
    setGpsCoords,
    setVerificationResult,
    verificationResult,
    reset,
  } = useVerificationStore();

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
    const gps = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: Math.round(location.coords.accuracy ?? 999),
    };
    setGpsCoords(gps);

    if (!cameraRef.current) return;

    // @ts-ignore
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
    setCurrentPhoto(photo.uri);
    track('photo_taken');
    setStep('loading');

    try {
      // ── Step 1: Upload photo to Supabase Storage ──────────────────────────
      setLoadingText('Загружаем фото...');
      const user = await authService.getCurrentUser();
      const userId = user?.id ?? 'anon';
      const storagePath = `${userId}/${Date.now()}.jpg`;

      const base64 = await FileSystem.readAsStringAsync(photo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const photoBytes = decodeBase64(base64);

      const { error: storageError } = await supabase.storage
        .from('verification-photos')
        .upload(storagePath, photoBytes, { contentType: 'image/jpeg', upsert: false });

      if (storageError) throw new Error(`Ошибка загрузки фото: ${storageError.message}`);

      // ── Step 2: Analyze via backend ───────────────────────────────────────
      setLoadingText('Анализируем растение...');
      const deviceId = await getDeviceId();

      const response = await apiClient.post('/verify', {
        photo_token: storagePath,
        gps,
        device_id: deviceId,
      });

      const result = response.data;
      setVerificationResult(result);
      track('verification_response', { confidence: result.confidence });

      if (result.species_candidates && result.species_candidates.length > 0) {
        setStep('lowConfidence');
      } else {
        setStep('result');
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const code = typeof detail === 'object' ? detail?.code : undefined;
      let msg: string;
      if (code === 'GALLERY_PHOTO_DETECTED') {
        msg = 'Это фото не сделано только что. Используйте живую камеру.';
      } else if (code === 'PHOTO_NOT_FOUND') {
        msg = 'Фото не удалось загрузить. Попробуйте ещё раз.';
      } else {
        msg = e?.message ?? 'Неизвестная ошибка';
      }
      Alert.alert('Ошибка', msg, [{ text: 'OK' }]);
      setStep('camera');
    }
  };

  const handleSelectCandidate = (candidate: { species_id: number; name_latin: string; name_common_ru: string; confidence: number }) => {
    if (!verificationResult) return;
    setVerificationResult({
      ...verificationResult,
      species: candidate.name_latin,
      species_candidates: undefined,
    });
    setStep('result');
    track('species_manually_selected', { species: candidate.name_latin });
  };

  const handleReset = () => {
    reset();
    setStep('camera');
  };

  // ── Permission gates ────────────────────────────────────────────────────────
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

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1DB954" style={{ marginBottom: 16 }} />
        <Text style={styles.text}>{loadingText}</Text>
      </View>
    );
  }

  // ── Low confidence: manual species picker ────────────────────────────────────
  if (step === 'lowConfidence' && verificationResult?.species_candidates) {
    return (
      <View style={styles.container}>
        <Text style={[styles.text, { marginBottom: 8 }]}>Уточните вид растения</Text>
        <Text style={styles.subtext}>
          Мы не уверены на 100%. Выберите подходящий вид:
        </Text>
        <ScrollView style={styles.scroll}>
          {verificationResult.species_candidates.map((c) => (
            <TouchableOpacity
              key={c.species_id}
              style={styles.candidateCard}
              onPress={() => handleSelectCandidate(c)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.candidateName}>{c.name_common_ru}</Text>
                <Text style={styles.candidateLatin}>{c.name_latin}</Text>
              </View>
              <Text style={styles.candidateConf}>{Math.round(c.confidence * 100)}%</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
          <Text style={styles.secondaryButtonText}>Переснять</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Result: show species + CO2 ───────────────────────────────────────────────
  if (step === 'result' && verificationResult) {
    return (
      <ScrollView contentContainerStyle={styles.resultContainer}>
        <Text style={styles.resultTitle}>Растение определено!</Text>

        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>ВИД</Text>
          <Text style={styles.resultValue}>{verificationResult.species}</Text>
        </View>
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>ПОГЛОЩЕНИЕ CO₂</Text>
          <Text style={styles.resultValue}>
            {verificationResult.co2_kg_year.toFixed(1)} кг/год
          </Text>
        </View>
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>ТОЧНОСТЬ</Text>
          <Text style={styles.resultValue}>
            {Math.round(verificationResult.confidence * 100)}%
          </Text>
        </View>

        {verificationResult.antifrod_flags.includes('POSSIBLE_DUPLICATE') && (
          <Text style={styles.warning}>
            ⚠️ Рядом уже было верифицировано дерево. Ваша запись получит дополнительную проверку.
          </Text>
        )}

        <TouchableOpacity style={styles.button} onPress={() => setStep('payment')}>
          <Text style={styles.buttonText}>Получить сертификат</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
          <Text style={styles.secondaryButtonText}>Верифицировать ещё</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Payment placeholder (RevenueCat integration pending) ────────────────────
  if (step === 'payment') {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Оплата сертификата</Text>
        <Text style={styles.subtext}>Интеграция с RevenueCat будет добавлена в следующей версии.</Text>
        <TouchableOpacity style={styles.button} onPress={() => setStep('success')}>
          <Text style={styles.buttonText}>Продолжить (тест)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
          <Text style={styles.secondaryButtonText}>Отмена</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <View style={styles.container}>
        <Text style={styles.resultTitle}>🌱 Сертификат выдан!</Text>
        {verificationResult?.qr_url ? (
          <Text style={styles.subtext}>QR-код: {verificationResult.qr_url}</Text>
        ) : null}
        <TouchableOpacity style={styles.button} onPress={handleReset}>
          <Text style={styles.buttonText}>Верифицировать ещё</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Camera (default) ─────────────────────────────────────────────────────────
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
  container: {
    flex: 1,
    backgroundColor: '#060E08',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resultContainer: {
    flexGrow: 1,
    backgroundColor: '#060E08',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingTop: 48,
  },
  camera: { flex: 1, width: '100%' },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 48,
  },
  hint: { color: '#F0FFF4', marginBottom: 20, fontSize: 16 },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'transparent',
    borderWidth: 4,
    borderColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1DB954',
  },
  text: {
    color: '#F0FFF4',
    fontSize: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtext: {
    color: '#A0B8A4',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1DB954',
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#1A3020',
    padding: 14,
    borderRadius: 10,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#060E08', fontWeight: 'bold', fontSize: 16 },
  secondaryButtonText: { color: '#F0FFF4', fontWeight: 'bold', fontSize: 16 },
  scroll: { width: '100%', maxHeight: 400 },
  candidateCard: {
    backgroundColor: '#0D1F10',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  candidateName: { color: '#F0FFF4', fontSize: 16 },
  candidateLatin: { color: '#A0B8A4', fontSize: 12 },
  candidateConf: { color: '#1DB954', fontWeight: 'bold', marginLeft: 8 },
  resultTitle: {
    color: '#1DB954',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  resultCard: {
    backgroundColor: '#0D1F10',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    width: '100%',
  },
  resultLabel: { color: '#A0B8A4', fontSize: 11, marginBottom: 4, letterSpacing: 1 },
  resultValue: { color: '#F0FFF4', fontSize: 18, fontWeight: '600' },
  warning: {
    color: '#FFA500',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
});

