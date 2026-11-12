import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, StatusBar, ActivityIndicator, Alert
} from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export default function SquadlyMobileApp() {
  const [token, setToken] = useState<string>('');
  const [mobile, setMobile] = useState('01055551234');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'feed'>('phone');
  const [user, setUser] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, mode: 'login' })
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('OTP Error', data.code || 'Failed to send OTP');
      } else {
        if (data.otpGenerated) setOtp(data.otpGenerated);
        setStep('otp');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp, mode: 'login' })
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Verification Failed', data.code || 'Invalid OTP');
      } else {
        setToken(data.token);
        setUser(data.user);
        setStep('feed');
        loadFeed(data.token);
      }
    } catch (e: any) {
      Alert.alert('Network Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFeed = async (jwt = token) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/bootstrap`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      const data = await res.json();
      setActivities(data.activities || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2E1A6E" />
      <View style={styles.header}>
        <Text style={styles.brand}>Squadly<Text style={{ color: '#F5A524' }}>.</Text></Text>
        {user && (
          <Text style={styles.userBadge}>{user.display_name || user.full_name} • {user.subscription_status}</Text>
        )}
      </View>

      {step === 'phone' && (
        <View style={styles.card}>
          <Text style={styles.title}>Sign In with Egyptian Mobile</Text>
          <TextInput
            style={styles.input}
            value={mobile}
            onChangeText={setMobile}
            placeholder="01055551234"
            keyboardType="phone-pad"
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={sendOtp} disabled={loading}>
            <Text style={styles.primaryBtnText}>{loading ? 'Sending OTP...' : 'Send 6-Digit OTP'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'otp' && (
        <View style={styles.card}>
          <Text style={styles.title}>Enter 6-Digit OTP</Text>
          <TextInput
            style={styles.input}
            value={otp}
            onChangeText={setOtp}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={verifyOtp} disabled={loading}>
            <Text style={styles.primaryBtnText}>{loading ? 'Verifying...' : 'Verify & Issue JWT'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'feed' && (
        <View style={{ flex: 1, padding: 16 }}>
          {loading ? (
            <ActivityIndicator size="large" color="#6B2FA0" />
          ) : (
            <FlatList
              data={activities}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.activityCard}>
                  <Text style={styles.hobbyLabel}>{item.hobby?.icon} {item.hobby?.name_en}</Text>
                  <Text style={styles.actTitle}>{item.title}</Text>
                  <Text style={styles.actMeta}>{item.date} • {item.start_time} • {item.venue?.name_en}</Text>
                  <View style={styles.actFooter}>
                    <Text style={styles.feeBadge}>{!item.fee_required ? 'Free' : `${item.fee_amount} EGP`}</Text>
                    <Text style={styles.spotsBadge}>{item.confirmedCount}/{item.total_slots} spots</Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCF7F3' },
  header: {
    backgroundColor: '#2E1A6E',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  brand: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  userBadge: { color: '#F5A524', fontSize: 12, fontWeight: '700' },
  card: { margin: 20, padding: 20, backgroundColor: '#FFFFFF', borderRadius: 20 },
  title: { fontSize: 18, fontWeight: '800', color: '#1A1033', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#D6D1DE',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16
  },
  primaryBtn: {
    backgroundColor: '#2E1A6E',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center'
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  activityCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EFEAF6'
  },
  hobbyLabel: { fontSize: 11, fontWeight: '800', color: '#A42A9B', textTransform: 'uppercase' },
  actTitle: { fontSize: 16, fontWeight: '800', color: '#1A1033', marginTop: 4 },
  actMeta: { fontSize: 12, color: '#6E6878', marginTop: 6 },
  actFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  feeBadge: { fontSize: 12, fontWeight: '800', color: '#2E1A6E' },
  spotsBadge: { fontSize: 12, fontWeight: '700', color: '#2E9E6A' }
});
