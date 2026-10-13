import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { Shop, ShopMember, UserProfile, UserRole } from '@/src/types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  currentShop: Shop | null;
  currentMember: ShopMember | null;
  userRole: UserRole | null;
  loading: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  createShop: (shopData: {
    name: string;
    phone: string;
    address: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
    receiptNote: string;
  }) => Promise<string>;
  reloadShopData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [currentMember, setCurrentMember] = useState<ShopMember | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchShopAndMembership = async (userId: string, shopId: string) => {
    try {
      const shopRef = doc(db, 'shops', shopId);
      const memberRef = doc(db, 'shops', shopId, 'members', userId);

      const [shopSnap, memberSnap] = await Promise.all([
        getDoc(shopRef),
        getDoc(memberRef),
      ]);

      if (shopSnap.exists()) {
        setCurrentShop({ id: shopSnap.id, ...(shopSnap.data() as Omit<Shop, 'id'>) });
      } else {
        setCurrentShop(null);
      }

      if (memberSnap.exists()) {
        setCurrentMember({ id: memberSnap.id, ...(memberSnap.data() as Omit<ShopMember, 'id'>) });
      } else {
        setCurrentMember(null);
      }
    } catch (err) {
      console.error('Error fetching shop and membership:', err);
      setCurrentShop(null);
      setCurrentMember(null);
    }
  };

  const loadUserData = async (currentUser: User) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);

      let profile: UserProfile;
      if (!userSnap.exists()) {
        profile = {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || '',
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, profile);
      } else {
        profile = userSnap.data() as UserProfile;
      }
      setUserProfile(profile);

      if (profile.currentShopId) {
        await fetchShopAndMembership(currentUser.uid, profile.currentShopId);
      } else {
        setCurrentShop(null);
        setCurrentMember(null);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadUserData(currentUser);
      } else {
        setUserProfile(null);
        setCurrentShop(null);
        setCurrentMember(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    const profile: UserProfile = {
      uid: res.user.uid,
      email: res.user.email || email,
      displayName: name,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'users', res.user.uid), profile);
      setUserProfile(profile);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${res.user.uid}`);
    }
  };

  const signInGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    setCurrentShop(null);
    setCurrentMember(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const createShop = async (shopData: {
    name: string;
    phone: string;
    address: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
    receiptNote: string;
  }): Promise<string> => {
    if (!user) throw new Error('Chưa đăng nhập');

    const shopId = 'shop_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();

    const newShop: Omit<Shop, 'id'> = {
      ...shopData,
      ownerId: user.uid,
      currency: 'VND',
      createdAt: now,
    };

    const newMember: Omit<ShopMember, 'id'> = {
      userId: user.uid,
      email: user.email || '',
      role: 'owner',
      joinedAt: now,
    };

    try {
      // 1. Create shop document
      await setDoc(doc(db, 'shops', shopId), newShop);
      // 2. Add owner to shop members
      await setDoc(doc(db, 'shops', shopId, 'members', user.uid), newMember);
      // 3. Update current user's profile with active shop ID
      await updateDoc(doc(db, 'users', user.uid), {
        currentShopId: shopId,
        updatedAt: now,
      });

      // Reload local state
      setCurrentShop({ id: shopId, ...newShop });
      setCurrentMember({ id: user.uid, ...newMember });
      setUserProfile((prev) => (prev ? { ...prev, currentShopId: shopId } : null));

      return shopId;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `shops/${shopId}`);
    }
  };

  const reloadShopData = async () => {
    if (user && userProfile?.currentShopId) {
      await fetchShopAndMembership(user.uid, userProfile.currentShopId);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        currentShop,
        currentMember,
        userRole: currentMember?.role || null,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInGoogle,
        logout,
        resetPassword,
        createShop,
        reloadShopData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
