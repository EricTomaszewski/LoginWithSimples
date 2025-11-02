"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";
import {
  type AuthCredential,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  linkWithCredential,
  type User,
} from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type InterestedOption = "Yes" | "No" | "";

type EventRecord = {
  id: string;
  eventType: "signup" | "login";
  provider: string;
  timestamp?: Timestamp;
};

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

export default function HomePage() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | "info">("info");
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileText, setProfileText] = useState("");
  const [savedProfileText, setSavedProfileText] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [interested, setInterested] = useState<InterestedOption>("");
  const [savedInterested, setSavedInterested] = useState<InterestedOption>("");
  const [interestedSaving, setInterestedSaving] = useState(false);
  const [pendingCredential, setPendingCredential] = useState<AuthCredential | null>(null);

  const providerColor = useMemo(() => {
    if (!firebaseUser) {
      return undefined;
    }
    const providerId = firebaseUser.providerData[0]?.providerId;
    if (providerId === "google.com") {
      return "#2563eb";
    }
    if (providerId === "password") {
      return "#dc2626";
    }
    return "#0f172a";
  }, [firebaseUser]);

  const providerLabel = useMemo(() => {
    if (!firebaseUser) {
      return "";
    }
    const providerId = firebaseUser.providerData[0]?.providerId;
    if (providerId === "google.com") {
      return "Google";
    }
    if (providerId === "password") {
      return "Email & Password";
    }
    return providerId ?? "Unknown";
  }, [firebaseUser]);

  const resetFormState = useCallback(() => {
    setEmail("");
    setPassword("");
    setStatus(null);
    setEvents([]);
    setProfileLoaded(false);
    setProfileText("");
    setSavedProfileText("");
    setProfileSaving(false);
    setInterested("");
    setSavedInterested("");
    setInterestedSaving(false);
    setPendingCredential(null);
  }, []);

  const recordAuthEvent = useCallback(async (user: User, eventType: "signup" | "login") => {
    await addDoc(collection(db, "userEvents"), {
      uid: user.uid,
      email: user.email,
      provider: user.providerData[0]?.providerId ?? "unknown",
      eventType,
      timestamp: serverTimestamp(),
    });
  }, []);

  const ensureProfileDocument = useCallback(
    async (user: User, isNewUser: boolean) => {
      const userDoc = doc(db, "users", user.uid);
      const payload: Record<string, unknown> = {
        email: user.email,
        displayName: user.displayName,
        provider: user.providerData[0]?.providerId ?? "unknown",
        lastLoginAt: serverTimestamp(),
      };
      if (isNewUser) {
        payload.createdAt = serverTimestamp();
      }
      await setDoc(userDoc, payload, { merge: true });
    },
    []
  );

  const refreshEvents = useCallback(
    async (uid: string) => {
      try {
        const eventsQuery = query(collection(db, "userEvents"), where("uid", "==", uid));
        const snapshot = await getDocs(eventsQuery);
        const data: EventRecord[] = snapshot.docs
          .map((docSnapshot) => {
            const raw = docSnapshot.data() as {
              eventType: "signup" | "login";
              provider: string;
              timestamp?: Timestamp;
            };
            return {
              id: docSnapshot.id,
              eventType: raw.eventType,
              provider: raw.provider,
              timestamp: raw.timestamp,
            };
          })
          .sort((a, b) => {
            const aTime = a.timestamp ? a.timestamp.toMillis() : 0;
            const bTime = b.timestamp ? b.timestamp.toMillis() : 0;
            return bTime - aTime;
          })
          .slice(0, 20);
        setEvents(data);
      } catch (error) {
        console.error("Failed to load recent events", error);
        setEvents([]);
        setStatus("Unable to load your recent activity right now.");
        setStatusType("error");
      }
    },
    [setStatus, setStatusType]
  );

  const loadProfile = useCallback(
    async (user: User) => {
      const userDoc = doc(db, "users", user.uid);
      const snap = await getDoc(userDoc);
      if (snap.exists()) {
        const data = snap.data() as {
          profileText?: string;
          interested?: InterestedOption;
        };
        if (typeof data.profileText === "string") {
          setProfileText(data.profileText);
          setSavedProfileText(data.profileText);
        } else {
          setProfileText("");
          setSavedProfileText("");
        }
        if (data.interested === "Yes" || data.interested === "No") {
          setInterested(data.interested);
          setSavedInterested(data.interested);
        } else {
          setInterested("");
          setSavedInterested("");
        }
      } else {
        setProfileText("");
        setSavedProfileText("");
        setInterested("");
        setSavedInterested("");
      }
      setProfileLoaded(true);
    },
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setInitializing(false);
      if (user) {
        await ensureProfileDocument(user, false);
        await loadProfile(user);
        await refreshEvents(user.uid);
      } else {
        resetFormState();
      }
    });

    return () => unsubscribe();
  }, [ensureProfileDocument, loadProfile, refreshEvents, resetFormState]);

  useEffect(() => {
    if (!firebaseUser || !profileLoaded) {
      return;
    }
    if (profileText === savedProfileText) {
      return;
    }
    setProfileSaving(true);
    const timeout = setTimeout(async () => {
      try {
        await setDoc(
          doc(db, "users", firebaseUser.uid),
          {
            profileText,
            profileTextUpdatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setSavedProfileText(profileText);
      } catch (error) {
        console.error("Failed to save profile text", error);
        setStatus("Failed to save profile text. Please try again.");
        setStatusType("error");
      } finally {
        setProfileSaving(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [firebaseUser, profileLoaded, profileText, savedProfileText]);

  useEffect(() => {
    if (!firebaseUser || !profileLoaded) {
      return;
    }
    if (interested === savedInterested) {
      return;
    }
    setInterestedSaving(true);
    const timeout = setTimeout(async () => {
      try {
        await setDoc(
          doc(db, "users", firebaseUser.uid),
          {
            interested: interested === "Yes" || interested === "No" ? interested : null,
            interestedUpdatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setSavedInterested(interested);
      } catch (error) {
        console.error("Failed to save interested flag", error);
        setStatus("Failed to save interested value. Please try again.");
        setStatusType("error");
      } finally {
        setInterestedSaving(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [firebaseUser, interested, profileLoaded, savedInterested]);

  const handleEmailSignUp = async () => {
    setStatus(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await ensureProfileDocument(credential.user, true);
      await recordAuthEvent(credential.user, "signup");
      await loadProfile(credential.user);
      await refreshEvents(credential.user.uid);
      setStatus("Account created successfully.");
      setStatusType("success");
    } catch (error: unknown) {
      console.error(error);
      setStatus(
        error instanceof Error ? error.message : "Unable to sign up with email and password."
      );
      setStatusType("error");
    }
  };

  const handleEmailLogin = async () => {
    setStatus(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await ensureProfileDocument(credential.user, false);
      await recordAuthEvent(credential.user, "login");
      await loadProfile(credential.user);
      await refreshEvents(credential.user.uid);
      if (pendingCredential && auth.currentUser) {
        try {
          await linkWithCredential(auth.currentUser, pendingCredential);
          setPendingCredential(null);
          setStatus(
            "Logged in successfully and linked your Google account. You can now sign in with both methods."
          );
          setStatusType("success");
        } catch (linkError) {
          console.error("Failed to link credential", linkError);
          setStatus(
            linkError instanceof Error
              ? `Logged in, but failed to link Google: ${linkError.message}`
              : "Logged in, but failed to link Google credentials."
          );
          setStatusType("error");
        }
      } else {
        setStatus("Logged in successfully.");
        setStatusType("success");
      }
    } catch (error: unknown) {
      console.error(error);
      setStatus(
        error instanceof Error ? error.message : "Unable to log in with email and password."
      );
      setStatusType("error");
    }
  };

  const handleGoogleAuth = async () => {
    setStatus(null);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const additionalInfo = getAdditionalUserInfo(credential);
      await ensureProfileDocument(credential.user, Boolean(additionalInfo?.isNewUser));
      await recordAuthEvent(credential.user, additionalInfo?.isNewUser ? "signup" : "login");
      await loadProfile(credential.user);
      await refreshEvents(credential.user.uid);
      setStatus("Authenticated with Google.");
      setStatusType("success");
      setPendingCredential(null);
    } catch (error: unknown) {
      console.error(error);
      if (error instanceof FirebaseError && error.code === "auth/account-exists-with-different-credential") {
        const credential = GoogleAuthProvider.credentialFromError(error);
        const emailFromError = typeof error.customData?.email === "string" ? error.customData.email : null;
        if (credential && emailFromError) {
          setPendingCredential(credential);
          setEmail(emailFromError);
          setStatus(
            "This email is already linked to another sign-in method. Please log in with your email and password to finish linking Google."
          );
          setStatusType("info");
          return;
        }
      }
      setStatus(error instanceof Error ? error.message : "Google authentication failed.");
      setStatusType("error");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    resetFormState();
  };

  const formattedEvents = useMemo(() => {
    return events.map((event) => {
      const time = event.timestamp?.toDate().toLocaleString() ?? "Pending timestamp";
      return {
        id: event.id,
        text: `${event.eventType.toUpperCase()} via ${event.provider} on ${time}`,
      };
    });
  }, [events]);

  return (
    <main>
      <div className="card">
        <h1>Login With Simples</h1>
        {!initializing && !firebaseUser && (
          <>
            <div>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="jane.doe@example.com"
              />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="auth-buttons">
              <button type="button" onClick={handleEmailSignUp}>
                Sign up with email
              </button>
              <button type="button" className="secondary" onClick={handleEmailLogin}>
                Log in with email
              </button>
              <button type="button" className="google" onClick={handleGoogleAuth}>
                Continue with Google
              </button>
            </div>
          </>
        )}

        {firebaseUser && (
          <div className="profile">
            <h2>Welcome back!</h2>
            <div className="profile-data">
              <span>
                <strong>User</strong>
                <span style={{ color: providerColor }}>{firebaseUser.email}</span>
              </span>
              <span>
                <strong>Signed in via</strong>
                {providerLabel}
              </span>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <label htmlFor="profileText">Personal note</label>
              <input
                id="profileText"
                type="text"
                value={profileText}
                onChange={(event) => setProfileText(event.target.value)}
                placeholder="This will be here next time you log in"
              />
              {profileSaving && <div className="status">Saving personal note…</div>}
            </div>
            <div style={{ marginTop: "1rem" }}>
              <label htmlFor="interested">Interested?</label>
              <select
                id="interested"
                value={interested}
                onChange={(event) => setInterested(event.target.value as InterestedOption)}
              >
                <option value="">Select an option</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              {interestedSaving && <div className="status">Saving interest…</div>}
            </div>
            <button type="button" className="logout-button" onClick={handleLogout}>
              Log out
            </button>

            <div className="events">
              <h3>Recent activity</h3>
              {formattedEvents.length === 0 ? (
                <p>No activity recorded yet.</p>
              ) : (
                <ul>
                  {formattedEvents.map((item) => (
                    <li key={item.id}>{item.text}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {initializing && <div className="status">Preparing authentication…</div>}
        {status && (
          <div
            className="status"
            style={{
              color:
                statusType === "success" ? "#16a34a" : statusType === "error" ? "#dc2626" : "#475569",
            }}
          >
            {status}
          </div>
        )}
      </div>
    </main>
  );
}
