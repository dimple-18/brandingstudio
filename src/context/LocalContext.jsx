import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import db from "../firebase/firebaseConfig";

const LocalContext = createContext();

/**
 * Small safe window getter (avoids SSR errors)
 */
const getWin = () => (typeof window !== "undefined" ? window : null);

/**
 * Basic mobile detection (for preferApp hint)
 */
const isLikelyMobile = () => {
  const w = getWin();
  if (!w) return false;
  const ua = w.navigator?.userAgent || "";
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua);
};

export const LocalProvider = ({ children }) => {
  const [currentTFN, setCurrentTFN] = useState({
    intlFormat: "",
    localFormat: "",
  });

  const [webinfo, setwebinfo] = useState({
    name: "Branding Studio",
    phone: "",
    phonecall: "",
    logo:
      "https://res.cloudinary.com/duv3inafo/image/upload/v1758302608/d066c4dc-02a3-4fd7-baf8-3e961c7f4854-removebg-preview_nsb2qs.png",
    email: "contact@digiborr.com",
    address: "19, Ashoka Rd, Janpath, Connaught Place, New Delhi, Delhi 110001, India",
    addressCity: "New Delhi",

    /**
     * 🔹 Default Telegram handle
     * You can override per-call, but this acts as the global default.
     * Examples: "darioharmon" (no leading @)
     */
    telegramHandle: "darioharmon",
  });

  // Fetch TFN from Firebase
  useEffect(() => {
    const fetchTFN = async () => {
      try {
        const docRef = doc(db, "siteNumbers", "weboku.com");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setCurrentTFN({
            intlFormat: data.numberIntl || "",
            localFormat: data.numberLocal || "",
          });
        } else {
          console.log("No such document!");
          setCurrentTFN({ intlFormat: "", localFormat: "" });
        }
      } catch (error) {
        console.error("Error fetching TFN: ", error);
      }
    };

    fetchTFN();
  }, []);

  // Map TFN to webinfo fields
  useEffect(() => {
    setwebinfo((prev) => ({
      ...prev,
      phone: currentTFN.localFormat,
      phonecall: currentTFN.intlFormat,
    }));
  }, [currentTFN]);

  /**
   * ============= Telegram helpers (centralized) =============
   */

  /**
   * getTelegramUrl
   * @param {Object} opts
   * @param {string} [opts.handle]  - Telegram handle without '@'. Falls back to webinfo.telegramHandle
   * @param {boolean} [opts.preferApp] - If true, use tg:// (on mobile opens app).
   * @returns {string} A deep link to open Telegram.
   */
  const getTelegramUrl = ({ handle, preferApp } = {}) => {
    const h = (handle || webinfo.telegramHandle || "").replace(/^@/, "").trim();
    if (!h) return ""; // no handle configured

    // Heuristic: if preferApp not provided, default to app link on mobile browsers.
    const useApp = typeof preferApp === "boolean" ? preferApp : isLikelyMobile();
    return useApp
      ? `tg://resolve?domain=${encodeURIComponent(h)}`
      : `https://t.me/${encodeURIComponent(h)}`;
  };

  /**
   * openTelegram
   * Attempts to open Telegram in a new tab; if blocked or protocol prevented,
   * falls back to same-tab navigation.
   *
   * @param {Object} opts
   * @param {string} [opts.handle]    - Override handle (no '@')
   * @param {boolean} [opts.preferApp]- try tg:// on mobile
   * @returns {boolean} success flag (best-effort)
   */
  const openTelegram = ({ handle, preferApp } = {}) => {
    const w = getWin();
    const url = getTelegramUrl({ handle, preferApp });
    if (!w || !url) return false;

    try {
      const popup = w.open(url, "_blank", "noopener,noreferrer");
      if (popup) return true;

      // If blocked, fallback same tab
      w.location.href = url;
      return true;
    } catch (e) {
      // Some browsers block tg:// in window.open; fallback to https
      if (url.startsWith("tg://")) {
        const httpsUrl = getTelegramUrl({ handle, preferApp: false });
        try {
          const popup2 = w.open(httpsUrl, "_blank", "noopener,noreferrer");
          if (popup2) return true;
          w.location.href = httpsUrl;
          return true;
        } catch {
          w.location.href = httpsUrl;
          return true;
        }
      }
      return false;
    }
  };

  /**
   * Optionally expose a convenience "getTelegramOnClick" that returns
   * a stable callback you can assign directly to onClick.
   */
  const getTelegramOnClick = ({ handle, preferApp } = {}) => {
    return (e) => {
      e?.preventDefault?.();
      openTelegram({ handle, preferApp });
    };
  };

  // Memoize helpers so consumers don't rerender unnecessarily
  const value = useMemo(
    () => ({
      webinfo,
      setwebinfo,
      // Telegram helpers:
      getTelegramUrl,
      openTelegram,
      getTelegramOnClick,
    }),
    [webinfo] // functions close over webinfo.telegramHandle
  );

  return (
    <LocalContext.Provider value={value}>{children}</LocalContext.Provider>
  );
};

export const useLocalContext = () => useContext(LocalContext);
