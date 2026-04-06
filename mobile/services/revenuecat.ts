import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import Constants from 'expo-constants';

export const initRevenueCat = (userId: string) => {
  Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
  Purchases.configure({
    apiKey: Constants.expoConfig?.extra?.revenueCatApiKey ?? '',
    appUserID: userId,
  });
};

export const purchaseVerification = async (): Promise<boolean> => {
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages[0];
    if (!pkg) throw new Error('No packages available');
    await Purchases.purchasePackage(pkg);
    return true;
  } catch (e: any) {
    if (e.userCancelled) return false;
    throw e;
  }
};
