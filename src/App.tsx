import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Download, 
  RotateCw, 
  Trash2, 
  Maximize2, 
  Zap, 
  Sparkles, 
  ShieldCheck, 
  History as HistoryIcon, 
  ExternalLink,
  Share2,
  X,
  Check,
  Loader2,
  AlertCircle,
  Wallet,
  ArrowRight,
  Copy,
  Layers,
  Smartphone,
  MessageCircle,
  Send,
  Twitter,
  Menu,
  Lock,
  Trophy,
  Coins,
  LogOut,
  User as UserIcon,
  Star,
  Info,
  Gift
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import confetti from 'canvas-confetti';
import { removeBackground, upscaleImage, verifyTransaction } from './services/gemini';
import { cn } from './lib/utils';
import { LuckyWheel } from './components/LuckyWheel';
import { AdBanner } from './components/AdBanner';
import { QRCodeSVG } from 'qrcode.react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db, User } from './lib/firebase';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { Language, translations } from './translations';

interface ProcessedImage {
  original: string;
  processed: string;
  type: 'bg-removed' | 'upscaled';
}

interface HistoryItem {
  id: string;
  original: string;
  processed: string;
  type: 'bg-removed' | 'upscaled';
  timestamp: number;
}

interface Transaction {
  id: string;
  txId: string;
  amount: number;
  level: string;
  timestamp: number;
}

const USDT_WALLET_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const BG_REMOVER_PRICE = 1;
const UPSCALE_PRICES = {
  '2x': { amount: 1, label: '2X HD' },
  '4x': { amount: 2, label: '4X ULTRA' },
  '8x': { amount: 3, label: '8X MAX' },
  '16x': { amount: 4, label: '16X PRO' }
};

class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-6">
            <AlertCircle className="w-20 h-20 text-red-500 mx-auto" />
            <h1 className="text-3xl font-bold text-white">{translations[localStorage.getItem('visionpro_lang') as Language || 'tr'].errorTitle}</h1>
            <button onClick={() => window.location.reload()} className="px-8 py-3 bg-brand-500 text-white font-bold rounded-xl">{translations[localStorage.getItem('visionpro_lang') as Language || 'tr'].refresh}</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Reward {
  id: string;
  amount: number;
  expiresAt: number;
  isFromFreeSpin?: boolean;
}

function App() {
  const [activeTab, setActiveTab] = useState<'bg-remover' | 'upscaler' | 'lucky-wheel'>('bg-remover');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [compareMode, setCompareMode] = useState<'slider' | 'side-by-side'>('slider');
  const [processedHistory, setProcessedHistory] = useState<HistoryItem[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'selection' | 'transfer' | 'processing' | 'success'>('selection');
  const [selectedUpscale, setSelectedUpscale] = useState<'2x' | '4x' | '8x' | '16x'>('2x');
  const [txId, setTxId] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [triggerWheelSpin, setTriggerWheelSpin] = useState(0);
  const [pendingSpinType, setPendingSpinType] = useState<'free' | 'paid' | 'wallet'>('paid');
  const [paymentType, setPaymentType] = useState<'upscale' | 'wheel' | 'bg-remover'>('upscale');
  const [hasUsedFreeSpin, setHasUsedFreeSpin] = useState(false);
  const [userIp, setUserIp] = useState<string>('unknown');
  const [usageCount, setUsageCount] = useState(0);
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('visionpro_lang');
    return (saved as Language) || 'tr';
  });
  const [hasApiKey, setHasApiKey] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [user, setUser] = useState<User | null>(null);
  const [dailySpins, setDailySpins] = useState(0);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('visionpro_lang', lang);
  }, [lang]);

  useEffect(() => {
    const fetchIp = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setUserIp(data.ip);
        
        // Try to get from cookie first
        const cookieName = `visionpro_usage_${data.ip}`;
        const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
        if (match) {
          setUsageCount(parseInt(match[2], 10));
        } else {
          // Fallback to localStorage
          const saved = localStorage.getItem(cookieName);
          if (saved) setUsageCount(parseInt(saved, 10));
        }
      } catch (error) {
        console.error('IP fetching error:', error);
        const saved = localStorage.getItem('visionpro_usage_unknown');
        if (saved) setUsageCount(parseInt(saved, 10));
      }
    };
    fetchIp();
  }, []);

  useEffect(() => {
    if (userIp !== 'unknown') {
      const cookieName = `visionpro_usage_${userIp}`;
      // Set cookie for 30 days
      const date = new Date();
      date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
      document.cookie = `${cookieName}=${usageCount}; expires=${date.toUTCString()}; path=/`;
      localStorage.setItem(cookieName, usageCount.toString());
    } else {
      localStorage.setItem('visionpro_usage_unknown', usageCount.toString());
    }
  }, [usageCount, userIp]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const lastReset = data.lastDailySpinReset || 0;
          const now = Date.now();
          if (now - lastReset > 86400000) {
            await updateDoc(doc(db, 'users', currentUser.uid), {
              dailySpinsRemaining: 2,
              lastDailySpinReset: now
            });
            setDailySpins(2);
          } else {
            setDailySpins(data.dailySpinsRemaining || 0);
          }
        } else {
          await setDoc(doc(db, 'users', currentUser.uid), {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            dailySpinsRemaining: 2,
            lastDailySpinReset: Date.now()
          });
          setDailySpins(2);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const useDailySpin = async () => {
    if (!user || dailySpins <= 0) return false;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        dailySpinsRemaining: increment(-1)
      });
      setDailySpins(prev => prev - 1);
      return true;
    } catch (error) {
      console.error("Failed to use daily spin", error);
      return false;
    }
  };

  const handleShare = async (imageUrl: string, title: string) => {
    try {
      if (navigator.share) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'visionpro-ai.png', { type: 'image/png' });
        
        await navigator.share({
          title: 'VisionPro AI',
          text: t.shareSubject,
          files: [file],
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert(t.linkCopied);
      }
    } catch (error) {
      console.error('Sharing failed', error);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const savedHistory = localStorage.getItem('visionpro_history');
    if (savedHistory) {
      const parsed = JSON.parse(savedHistory);
      const filtered = parsed.filter((item: HistoryItem) => Date.now() - item.timestamp < 3600000);
      setProcessedHistory(filtered);
    }
    const savedTxs = localStorage.getItem('visionpro_txs');
    if (savedTxs) {
      const parsed = JSON.parse(savedTxs);
      const filtered = parsed.filter((tx: Transaction) => Date.now() - tx.timestamp < 3600000);
      setTransactions(filtered);
    }
    const savedRewards = localStorage.getItem('visionpro_rewards_list');
    if (savedRewards) {
      const parsed = JSON.parse(savedRewards);
      const filtered = parsed.filter((r: Reward) => r.expiresAt > Date.now());
      setRewards(filtered);
    }
    const freeSpinUsed = localStorage.getItem('visionpro_freespin_used');
    if (freeSpinUsed === 'true') {
      setHasUsedFreeSpin(true);
    }
  }, []);

  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setProcessedHistory(prev => prev.filter(item => now - item.timestamp < 3600000));
      setTransactions(prev => prev.filter(tx => now - tx.timestamp < 3600000));
      setRewards(prev => prev.filter(r => r.expiresAt > now));
    }, 60000); // Check every minute
    return () => clearInterval(cleanup);
  }, []);

  useEffect(() => {
    localStorage.setItem('visionpro_history', JSON.stringify(processedHistory));
    localStorage.setItem('visionpro_txs', JSON.stringify(transactions));
    localStorage.setItem('visionpro_rewards_list', JSON.stringify(rewards));
    localStorage.setItem('visionpro_freespin_used', hasUsedFreeSpin.toString());
  }, [processedHistory, transactions, rewards, hasUsedFreeSpin]);

  // Cleanup expired rewards and history
  useEffect(() => {
    const hasExpiredRewards = rewards.some(r => r.expiresAt <= currentTime);
    if (hasExpiredRewards) {
      setRewards(prev => prev.filter(r => r.expiresAt > currentTime));
    }

    const hasExpiredHistory = processedHistory.some(h => currentTime - h.timestamp >= 3600000);
    if (hasExpiredHistory) {
      setProcessedHistory(prev => prev.filter(h => currentTime - h.timestamp < 3600000));
    }
  }, [currentTime, rewards, processedHistory]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'IMG' || (e.target as HTMLElement).closest('.compare-slider-container')) {
        e.preventDefault();
      }
    };
    const handleDragStart = (e: DragEvent) => {
      if ((e.target as HTMLElement).tagName === 'IMG') {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  const totalRewardBalance = rewards.reduce((sum, r) => sum + r.amount, 0);

  const triggerSuccessConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 200 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setOriginalImage(event.target?.result as string);
        setProcessedImage(null);
        setRotation(0);
      };
      reader.readAsDataURL(file);
    }
  };

  const deductFromWallet = (amount: number, allowFreeRewards: boolean = true) => {
    const availableRewards = allowFreeRewards ? rewards : rewards.filter(r => !r.isFromFreeSpin);
    const balance = availableRewards.reduce((sum, r) => sum + r.amount, 0);
    
    if (balance < amount) return false;

    let remainingToDeduct = amount;
    const sortedAvailable = [...availableRewards].sort((a, b) => a.expiresAt - b.expiresAt);
    const otherRewards = allowFreeRewards ? [] : rewards.filter(r => r.isFromFreeSpin);
    
    const updatedAvailable = [];
    for (const reward of sortedAvailable) {
      if (remainingToDeduct <= 0) {
        updatedAvailable.push(reward);
        continue;
      }
      if (reward.amount <= remainingToDeduct) {
        remainingToDeduct -= reward.amount;
      } else {
        updatedAvailable.push({ ...reward, amount: reward.amount - remainingToDeduct });
        remainingToDeduct = 0;
      }
    }

    setRewards([...otherRewards, ...updatedAvailable]);
    return true;
  };

  const handleWalletSpin = () => {
    if (deductFromWallet(1, false)) {
      setPendingSpinType('wallet');
      setTriggerWheelSpin(prev => prev + 1);
    }
  };

  const handleProcess = async () => {
    if (!originalImage) return;
    
    // Check usage limit (25 free images)
    if (usageCount >= 25) {
      if (activeTab === 'bg-remover') {
        setPaymentType('bg-remover');
        setShowPaymentModal(true);
        setPaymentStep('transfer');
        return;
      }
    }

    if (activeTab === 'upscaler') {
      setPaymentType('upscale');
      setShowPaymentModal(true);
      setPaymentStep('transfer'); // Skip selection since it's done in main UI
      return;
    }
    setIsProcessing(true);
    try {
      const result = await removeBackground(originalImage);
      setProcessedImage({ original: originalImage, processed: result, type: 'bg-removed' });
      setProcessedHistory(prev => [{ id: Math.random().toString(36).substr(2, 9), original: originalImage, processed: result, type: 'bg-removed' as const, timestamp: Date.now() }, ...prev].slice(0, 12));
      setUsageCount(prev => prev + 1);
      
      triggerSuccessConfetti();
    } catch (error) {
      alert(t.errorOccurred);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWalletPayment = async (type: 'upscale' | 'wheel' | 'bg-remover', amount: number, level?: string) => {
    const allowFree = type !== 'wheel';
    if (deductFromWallet(amount, allowFree)) {
      setPaymentStep('processing');
      setTimeout(async () => {
        setPaymentStep('success');
        if (type === 'upscale' && level) {
          const result = await upscaleImage(originalImage!, level);
          setProcessedImage({ original: originalImage!, processed: result, type: 'upscaled' });
          setProcessedHistory(prev => [{ id: Math.random().toString(36).substr(2, 9), original: originalImage!, processed: result, type: 'upscaled' as const, timestamp: Date.now() }, ...prev].slice(0, 12));
          setUsageCount(prev => prev + 1);
          triggerSuccessConfetti();
          setTimeout(() => setShowPaymentModal(false), 2000);
        } else if (type === 'bg-remover') {
          const result = await removeBackground(originalImage!);
          setProcessedImage({ original: originalImage!, processed: result, type: 'bg-removed' });
          setProcessedHistory(prev => [{ id: Math.random().toString(36).substr(2, 9), original: originalImage!, processed: result, type: 'bg-removed' as const, timestamp: Date.now() }, ...prev].slice(0, 12));
          setUsageCount(prev => prev + 1);
          triggerSuccessConfetti();
          setTimeout(() => setShowPaymentModal(false), 2000);
        } else {
          setPendingSpinType('wallet');
          setTimeout(() => { setTriggerWheelSpin(prev => prev + 1); setShowPaymentModal(false); }, 1500);
        }
      }, 1000);
    } else {
      alert(t.insufficientBalance);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!txId.trim()) return;
    setPaymentStep('processing');
    
    let amount = 1;
    if (paymentType === 'upscale') {
      amount = UPSCALE_PRICES[selectedUpscale as keyof typeof UPSCALE_PRICES].amount;
    } else if (paymentType === 'bg-remover') {
      amount = BG_REMOVER_PRICE;
    } else if (paymentType === 'wheel') {
      amount = 1;
    }

    const isValid = await verifyTransaction(txId, amount);
    if (isValid) {
      setPaymentStep('success');
      if (paymentType === 'upscale') {
        const result = await upscaleImage(originalImage!, selectedUpscale);
        setProcessedImage({ original: originalImage!, processed: result, type: 'upscaled' });
        setProcessedHistory(prev => [{ id: Math.random().toString(36).substr(2, 9), original: originalImage!, processed: result, type: 'upscaled' as const, timestamp: Date.now() }, ...prev].slice(0, 12));
        setTransactions(prev => [{ id: Math.random().toString(36).substr(2, 9), txId, amount: UPSCALE_PRICES[selectedUpscale as keyof typeof UPSCALE_PRICES].amount, level: selectedUpscale, timestamp: Date.now() }, ...prev]);
        setUsageCount(prev => prev + 1);
        
        triggerSuccessConfetti();

        setTimeout(() => setShowPaymentModal(false), 2000);
      } else if (paymentType === 'bg-remover') {
        const result = await removeBackground(originalImage!);
        setProcessedImage({ original: originalImage!, processed: result, type: 'bg-removed' });
        setProcessedHistory(prev => [{ id: Math.random().toString(36).substr(2, 9), original: originalImage!, processed: result, type: 'bg-removed' as const, timestamp: Date.now() }, ...prev].slice(0, 12));
        setUsageCount(prev => prev + 1);
        
        triggerSuccessConfetti();

        setTimeout(() => setShowPaymentModal(false), 2000);
      } else {
        setPendingSpinType('paid');
        setTimeout(() => { setTriggerWheelSpin(prev => prev + 1); setShowPaymentModal(false); }, 1500);
      }
    } else {
      alert("Ödeme doğrulanamadı.");
      setPaymentStep('transfer');
    }
  };

  const triggerDownload = () => {
    if (!processedImage) return;
    const link = document.createElement('a');
    link.href = processedImage.processed;
    link.download = `visionpro-${Date.now()}.png`;
    link.click();
  };

  const removeHistoryItem = (id: string) => {
    setProcessedHistory(prev => prev.filter(item => item.id !== id));
  };

  const formatTime = (ms: number) => {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const t = translations[lang];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-brand-500 selection:text-white">
      <header className="sticky top-0 z-[100] w-full bg-black/40 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.reload()}>
              <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:rotate-12 transition-transform">
                <Zap className="w-6 h-6 text-white fill-white" />
              </div>
              <span className="text-2xl font-black tracking-tighter italic uppercase">Vision<span className="text-brand-500">Pro</span> AI</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {['bg-remover', 'upscaler', 'lucky-wheel'].map((tab) => (
                <button key={tab} onClick={() => { setActiveTab(tab as any); setOriginalImage(null); setProcessedImage(null); }} className={cn("px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all", activeTab === tab ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5")}>
                  {tab === 'bg-remover' ? t.bgRemover : tab === 'upscaler' ? t.upscaler : t.luckyWheel}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {/* Language Switcher - Alt Alta */}
            <div className="flex flex-col gap-1 mr-2">
              {(['tr', 'en'] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded transition-all border",
                    lang === l 
                      ? "bg-brand-500 border-brand-500 text-white" 
                      : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>

            {isAuthLoading ? (
              <div className="w-8 h-8 bg-white/5 rounded-full animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-[10px] font-black uppercase text-white/40">{t.welcome}</span>
                  <span className="text-xs font-bold">{user.displayName?.split(' ')[0]}</span>
                </div>
                <div className="relative group">
                  <button onClick={handleLogout} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/10 hover:border-red-500/20 transition-all group">
                    <LogOut className="w-4 h-4 text-white/40 group-hover:text-red-500" />
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={handleGoogleLogin} className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl font-bold text-xs hover:bg-white/90 transition-all">
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{t.login}</span>
              </button>
            )}
            <div className="relative group">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 cursor-help">
                <Wallet className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-black tracking-tight">{totalRewardBalance.toFixed(2)} $</span>
              </div>
              
              <div className="absolute top-full right-0 mt-2 w-72 glass-panel p-4 rounded-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t.rewardWallet}</span>
                  <Coins className="w-3 h-3 text-brand-400" />
                </div>
                
                {rewards.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {rewards.map(reward => (
                      <div key={reward.id} className="flex items-center justify-between p-2 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-xs font-bold">{reward.amount} $</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-brand-400 font-mono">
                          <HistoryIcon className="w-3 h-3" />
                          {formatTime(reward.expiresAt - currentTime)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-center text-white/20 py-4 uppercase tracking-widest">{t.activeRewardsNone}</p>
                )}

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3 h-3 text-brand-400 shrink-0 mt-0.5" />
                    <p className="text-[8px] text-white/40 leading-tight uppercase font-bold">{t.rewardsExpire}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Lock className="w-3 h-3 text-brand-400 shrink-0 mt-0.5" />
                    <p className="text-[8px] text-white/40 leading-tight uppercase font-bold">{t.rewardsLocked}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-20">
        <section className="text-center space-y-8 max-w-3xl mx-auto pt-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-500/10 border border-brand-500/20 rounded-full text-brand-400 text-[10px] font-bold uppercase tracking-[0.2em]">
            <Sparkles className="w-3 h-3" /> {t.aiTech}
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.1 }} 
            className="text-5xl md:text-7xl font-black tracking-tighter italic uppercase leading-[0.9] cursor-pointer hover:scale-[1.02] transition-transform active:scale-95"
            onClick={() => {
              const tabs: ('bg-remover' | 'upscaler' | 'lucky-wheel')[] = ['bg-remover', 'upscaler', 'lucky-wheel'];
              const currentIndex = tabs.indexOf(activeTab);
              const nextIndex = (currentIndex + 1) % tabs.length;
              setActiveTab(tabs[nextIndex]);
              setOriginalImage(null);
              setProcessedImage(null);
            }}
          >
            {activeTab === 'bg-remover' ? <>{t.heroTitleBg.split('Saniyeler')[0]} <span className="text-brand-500">Saniyeler</span> {t.heroTitleBg.split('Saniyeler')[1]}</> : activeTab === 'upscaler' ? <>{t.heroTitleUpscale.split('HD Kaliteye')[0]} <span className="text-brand-500">HD Kaliteye</span> {t.heroTitleUpscale.split('HD Kaliteye')[1]}</> : <>{t.heroTitleWheel.split('Büyük Ödülü')[0]} <span className="text-brand-500">Büyük Ödülü</span> {t.heroTitleWheel.split('Büyük Ödülü')[1]}</>}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }} 
            className="text-lg md:text-xl text-white/60 font-medium max-w-2xl mx-auto leading-relaxed cursor-pointer hover:text-white transition-colors"
            onClick={() => {
              const tabs: ('bg-remover' | 'upscaler' | 'lucky-wheel')[] = ['bg-remover', 'upscaler', 'lucky-wheel'];
              const currentIndex = tabs.indexOf(activeTab);
              const nextIndex = (currentIndex + 1) % tabs.length;
              setActiveTab(tabs[nextIndex]);
              setOriginalImage(null);
              setProcessedImage(null);
            }}
          >
            {activeTab === 'bg-remover' ? t.heroDescBg : activeTab === 'upscaler' ? t.heroDescUpscale : t.heroDescWheel}
          </motion.p>
        </section>

        {!user && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto p-8 glass-panel rounded-[2.5rem] border border-brand-500/20 bg-brand-500/5 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-brand-500/10"
          >
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-brand-500 rounded-3xl flex items-center justify-center shadow-xl shadow-brand-500/30 shrink-0">
                <Star className="w-8 h-8 text-white fill-white animate-pulse" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-black uppercase tracking-tight text-white mb-1">{t.loginBenefitTitle}</h3>
                <p className="text-sm text-white/60 font-medium leading-relaxed">{t.loginBenefitDesc}</p>
              </div>
            </div>
            <button onClick={handleGoogleLogin} className="px-10 py-4 bg-white text-black rounded-2xl font-black text-sm hover:bg-brand-500 hover:text-white transition-all shrink-0 shadow-lg active:scale-95">
              {t.loginWithGmail}
            </button>
          </motion.div>
        )}

        <section>
          {activeTab === 'lucky-wheel' ? (
            <LuckyWheel lang={lang}
              onSpinRequest={() => { setPaymentType('wheel'); setShowPaymentModal(true); setPaymentStep('selection'); }} 
              onFreeSpin={() => { setHasUsedFreeSpin(true); setPendingSpinType('free'); setTriggerWheelSpin(prev => prev + 1); }}
              onWalletSpin={handleWalletSpin}
              onWin={(amount) => setRewards(prev => [...prev, { 
                id: Math.random().toString(36).substr(2, 9), 
                amount, 
                expiresAt: Date.now() + 3600000,
                isFromFreeSpin: pendingSpinType === 'free'
              }])} 
              isProcessing={isProcessing} 
              hasUsedFreeSpin={hasUsedFreeSpin}
              walletBalance={rewards.filter(r => !r.isFromFreeSpin).reduce((sum, r) => sum + r.amount, 0)}
              triggerWheelSpin={triggerWheelSpin}
              user={user}
              dailySpins={dailySpins}
              onDailySpin={async () => {
                const success = await useDailySpin();
                if (success) {
                  setPendingSpinType('free');
                  setTriggerWheelSpin(prev => prev + 1);
                }
              }}
            />
          ) : (
            originalImage ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 glass-panel rounded-[2.5rem] overflow-hidden aspect-square md:aspect-[4/3] relative">
                  {processedImage ? (
                    <div className="w-full h-full relative group compare-slider-container">
                      <ReactCompareSlider 
                        itemOne={
                          <div className="relative w-full h-full" onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
                            <ReactCompareSliderImage src={processedImage.original} style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
                            <div className="absolute top-6 left-6 px-4 py-2 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/80">{t.before}</div>
                          </div>
                        } 
                        itemTwo={
                          <div className="relative w-full h-full" onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
                            <ReactCompareSliderImage src={processedImage.processed} style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
                            <div className="absolute top-6 right-6 px-4 py-2 bg-brand-500/80 backdrop-blur-xl rounded-full border border-brand-400/20 text-[10px] font-black uppercase tracking-widest text-white">{t.after}</div>
                          </div>
                        } 
                        className="w-full h-full" 
                      />
                    </div>
                  ) : activeTab === 'upscaler' ? (
                    <div className="w-full h-full relative group compare-slider-container">
                      <ReactCompareSlider 
                        itemOne={
                          <div className="relative w-full h-full" onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
                            <ReactCompareSliderImage src={originalImage} style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
                            <div className="absolute top-6 left-6 px-4 py-2 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/80">{t.original}</div>
                          </div>
                        } 
                        itemTwo={
                          <div className="relative w-full h-full" onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
                            <ReactCompareSliderImage 
                              src={originalImage} 
                              style={{ 
                                filter: 'contrast(1.1) brightness(1.05) saturate(1.05)',
                                objectFit: 'contain',
                                width: '100%',
                                height: '100%'
                              }} 
                            />
                            <div className="absolute top-6 right-6 px-4 py-2 bg-brand-500/80 backdrop-blur-xl rounded-full border border-brand-400/20 text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                              <Sparkles className="w-3 h-3" /> {t.preview} ({UPSCALE_PRICES[selectedUpscale].label})
                            </div>
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 text-[8px] font-bold uppercase tracking-widest text-white/60">
                              {t.paymentNotice}
                            </div>
                          </div>
                        } 
                        className="w-full h-full" 
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-4 bg-white/[0.02]">
                      <img 
                        src={originalImage} 
                        alt="Preview" 
                        className="max-w-full max-h-full object-contain select-none" 
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                      />
                      {isProcessing && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                          <Loader2 className="w-12 h-12 animate-spin text-brand-500" />
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">{t.processing}...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="lg:col-span-4 space-y-6">
                  <div className="glass-panel p-8 rounded-[2.5rem] space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h2 className="text-2xl font-bold">{t.processingCenter}</h2>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                            usageCount < 25 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                          )}>
                            {usageCount < 25 ? `${t.freeRights}: ${25 - usageCount}/25` : t.freeRightsExpired}
                          </div>
                          {userIp !== 'unknown' && (
                            <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">IP: {userIp}</span>
                          )}
                        </div>
                      </div>
                      <div className="w-8 h-8 bg-brand-500/10 rounded-lg flex items-center justify-center">
                        <Zap className="w-4 h-4 text-brand-500" />
                      </div>
                    </div>
                    
                    {!processedImage ? (
                      <div className="space-y-6">
                        {activeTab === 'upscaler' && (
                          <div className="space-y-3">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">{t.qualitySelection}</h3>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(UPSCALE_PRICES).map(([key, price]: any) => (
                                <button 
                                  key={key} 
                                  onClick={() => setSelectedUpscale(key as any)}
                                  className={cn(
                                    "p-3 rounded-xl border transition-all text-left group",
                                    selectedUpscale === key 
                                      ? "bg-brand-500/20 border-brand-500 text-brand-400" 
                                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                                  )}
                                >
                                  <div className="text-[10px] font-black uppercase tracking-tighter">{price.label}</div>
                                  <div className="text-[14px] font-black">{price.amount} $</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <button onClick={handleProcess} disabled={isProcessing} className="w-full py-5 bg-brand-500 text-white font-bold rounded-2xl hover:bg-brand-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand-500/20">
                          {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles className="w-5 h-5" />} 
                          {activeTab === 'bg-remover' ? t.removeBg : `${UPSCALE_PRICES[selectedUpscale].label} ${t.upscaleWith}`}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 mb-4">
                          <Check className="w-5 h-5 text-green-500" />
                          <span className="text-xs font-bold text-green-500 uppercase tracking-wider">{t.success}</span>
                        </div>
                        <button onClick={triggerDownload} className="w-full py-5 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-white/90 transition-all"><Download /> {t.download}</button>
                        
                        <div className="pt-4 border-t border-white/5 space-y-4">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{t.shareSocial}</h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <span className="text-[8px] font-bold uppercase text-white/20 ml-1">{t.before}</span>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleShare(processedImage.original, `VisionPro AI - ${t.originalImage}`)}
                                  className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all"
                                  title={t.share}
                                >
                                  <Share2 className="w-4 h-4 text-white/60" />
                                </button>
                                <button 
                                  onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t.shareText)}&url=${encodeURIComponent(window.location.href)}`, '_blank')}
                                  className="flex-1 py-3 bg-[#1DA1F2]/10 border border-[#1DA1F2]/20 rounded-xl flex items-center justify-center hover:bg-[#1DA1F2]/20 transition-all"
                                  title="Twitter"
                                >
                                  <Twitter className="w-4 h-4 text-[#1DA1F2]" />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <span className="text-[8px] font-bold uppercase text-brand-500/40 ml-1">{t.after}</span>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleShare(processedImage.processed, `VisionPro AI - ${t.processedImage}`)}
                                  className="flex-1 py-3 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center hover:bg-brand-500/20 transition-all"
                                  title={t.share}
                                >
                                  <Share2 className="w-4 h-4 text-brand-500" />
                                </button>
                                <button 
                                  onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(t.shareText)} ${encodeURIComponent(window.location.href)}`, '_blank')}
                                  className="flex-1 py-3 bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl flex items-center justify-center hover:bg-[#25D366]/20 transition-all"
                                  title="WhatsApp"
                                >
                                  <MessageCircle className="w-4 h-4 text-[#25D366]" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
 
                        <button onClick={() => { setOriginalImage(null); setProcessedImage(null); }} className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all">{t.newImage}</button>
                      </div>
                    )}
                  </div>
 
                  <div className="glass-panel p-6 rounded-[2.5rem] space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">{t.tip}</h3>
                    <p className="text-xs text-white/60 leading-relaxed">
                      {activeTab === 'bg-remover' ? t.tipBg : t.tipUpscale}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="max-w-4xl mx-auto aspect-[21/9] bg-white/[0.02] border-2 border-dashed border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer hover:bg-white/[0.04] hover:border-brand-500/40 transition-all group">
                <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-brand-500" />
                </div>
                <p className="text-xl font-bold mb-2">{t.dropImage}</p>
                <p className="text-xs text-white/40 uppercase tracking-widest font-medium">PNG, JPG, WEBP • MAX 10MB</p>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
              </div>
            )
          )}
        </section>

        <section className="space-y-12 py-12 border-t border-white/5">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-black uppercase tracking-tighter italic">{t.ecosystemTitle.split(' ')[0]} <span className="text-brand-500">{t.ecosystemTitle.split(' ').slice(1).join(' ')}</span></h2>
            <p className="text-white/40 text-sm max-w-2xl mx-auto uppercase tracking-widest font-bold">{t.ecosystemSubtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass-panel p-8 rounded-[2.5rem] space-y-4 border border-white/5 hover:border-brand-500/20 transition-all group">
              <div className="w-12 h-12 bg-brand-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Info className="w-6 h-6 text-brand-500" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">{t.whatIsWheel}</h3>
              <p className="text-sm text-white/60 leading-relaxed font-medium">
                {t.whatIsWheelDesc}
              </p>
            </div>

            <div className="glass-panel p-8 rounded-[2.5rem] space-y-4 border border-white/5 hover:border-brand-500/20 transition-all group">
              <div className="w-12 h-12 bg-brand-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Gift className="w-6 h-6 text-brand-500" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">{t.whySpin}</h3>
              <p className="text-sm text-white/60 leading-relaxed font-medium">
                {t.whySpinDesc}
              </p>
            </div>

            <div className="glass-panel p-8 rounded-[2.5rem] space-y-4 border border-brand-500/20 bg-brand-500/5 hover:border-brand-500/40 transition-all group">
              <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-brand-500/20">
                <Star className="w-6 h-6 text-white fill-white" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">{t.importanceLogin}</h3>
              <p className="text-sm text-white/60 leading-relaxed font-medium">
                {t.importanceLoginDesc}
              </p>
            </div>
          </div>
        </section>

        {processedHistory.length > 0 && (
          <section className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">{t.history.split(' ')[0]} <span className="text-brand-500">{t.history.split(' ').slice(1).join(' ')}</span></h2>
                <div className="flex items-center gap-2 text-white/40">
                  <AlertCircle className="w-3 h-3 text-brand-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">{t.historyAutoDelete}</p>
                </div>
              </div>
              <button 
                onClick={() => setProcessedHistory([])}
                className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 transition-all flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" /> {t.clearAll}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <AnimatePresence mode="popLayout">
                {processedHistory.map((item) => (
                  <motion.div 
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative aspect-square glass-panel rounded-3xl overflow-hidden border border-white/5 hover:border-brand-500/30 transition-all"
                  >
                    <img 
                      src={item.processed} 
                      alt={t.history} 
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity select-none" 
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleShare(item.processed, `VisionPro AI - ${t.historyImage}`)}
                        className="p-2 bg-black/60 backdrop-blur-xl rounded-xl text-white/60 hover:text-brand-500 transition-colors"
                        title={t.share}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => removeHistoryItem(item.id)}
                        className="p-2 bg-black/60 backdrop-blur-xl rounded-xl text-white/60 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
 
                    <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[8px] font-mono text-brand-400">
                          <HistoryIcon className="w-2.5 h-2.5" />
                          {formatTime(3600000 - (currentTime - item.timestamp))}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setOriginalImage(item.original);
                          setProcessedImage({ original: item.original, processed: item.processed, type: item.type });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full py-2 bg-white text-black text-[10px] font-bold uppercase rounded-xl hover:bg-brand-500 hover:text-white transition-all"
                      >
                        {t.view}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}
      </main>

      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPaymentModal(false)} className="fixed inset-0 bg-black/90 backdrop-blur-2xl" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-xl glass-panel rounded-[3rem] p-8 space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">{t.pay}</h2>
                <X className="cursor-pointer" onClick={() => setShowPaymentModal(false)} />
              </div>
              {paymentStep === 'selection' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    {paymentType === 'upscale' ? Object.entries(UPSCALE_PRICES).map(([key, price]: any) => (
                      <div key={key} className="space-y-2">
                        <button onClick={() => { setSelectedUpscale(key); setPaymentStep('transfer'); }} className="w-full p-6 bg-white/5 border border-white/10 rounded-3xl flex justify-between items-center hover:bg-white/10 transition-all">
                          <div className="text-left">
                            <span className="block font-bold">{price.label}</span>
                            <span className="text-[10px] text-white/40 uppercase font-bold">{t.usdtTransfer}</span>
                          </div>
                          <span className="text-brand-400 font-black">{price.amount} $</span>
                        </button>
                        {totalRewardBalance >= price.amount && (
                          <button onClick={() => handleWalletPayment('upscale', price.amount, key)} className="w-full p-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex justify-between items-center hover:bg-brand-500/20 transition-all">
                            <div className="flex items-center gap-2">
                              <Wallet className="w-4 h-4 text-brand-400" />
                              <span className="text-xs font-bold">{t.payWithWalletButton}</span>
                            </div>
                            <span className="text-xs font-black text-brand-400">{price.amount} $</span>
                          </button>
                        )}
                      </div>
                    )) : (
                      <div className="space-y-4">
                        <button onClick={() => setPaymentStep('transfer')} className="w-full p-6 bg-brand-500/10 border border-brand-500 rounded-3xl flex justify-between items-center hover:bg-brand-500/20 transition-all">
                          <div className="text-left">
                            <span className="block font-bold">1 {t.spinRight}</span>
                            <span className="text-[10px] text-white/40 uppercase font-bold">{t.usdtTransfer}</span>
                          </div>
                          <span className="text-brand-400 font-black">1 $</span>
                        </button>
                        {rewards.filter(r => !r.isFromFreeSpin).reduce((sum, r) => sum + r.amount, 0) >= 1 && (
                          <button onClick={() => handleWalletPayment('wheel', 1)} className="w-full p-6 bg-zinc-800 border border-brand-500/30 rounded-3xl flex justify-between items-center hover:bg-zinc-700 transition-all">
                            <div className="flex items-center gap-2">
                              <Wallet className="w-5 h-5 text-brand-400" />
                              <span className="font-bold text-brand-400">{t.payWithWalletButton}</span>
                            </div>
                            <span className="font-black text-brand-400">1 $</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {paymentType === 'bg-remover' && (
                    <div className="space-y-2">
                      <button onClick={() => setPaymentStep('transfer')} className="w-full p-6 bg-white/5 border border-white/10 rounded-3xl flex justify-between items-center hover:bg-white/10 transition-all">
                        <div className="text-left">
                          <span className="block font-bold">{t.bgRemoval}</span>
                          <span className="text-[10px] text-white/40 uppercase font-bold">{t.usdtTransfer}</span>
                        </div>
                        <span className="text-brand-400 font-black">{BG_REMOVER_PRICE} $</span>
                      </button>
                      {totalRewardBalance >= BG_REMOVER_PRICE && (
                        <button onClick={() => handleWalletPayment('bg-remover', BG_REMOVER_PRICE)} className="w-full p-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex justify-between items-center hover:bg-brand-500/20 transition-all">
                          <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-brand-400" />
                            <span className="text-xs font-bold">{t.payWithWalletButton}</span>
                          </div>
                          <span className="text-xs font-black text-brand-400">{BG_REMOVER_PRICE} $</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {paymentStep === 'transfer' && (
                <div className="space-y-6 text-center">
                  <div className="flex justify-center p-4 bg-white rounded-2xl w-fit mx-auto select-none" onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}><QRCodeSVG value={USDT_WALLET_ADDRESS} size={150} /></div>
                  <p className="text-xs font-mono text-white/40 break-all select-all cursor-copy">{USDT_WALLET_ADDRESS}</p>
                  <input type="text" value={txId} onChange={(e) => setTxId(e.target.value)} placeholder={t.txIdPlaceholder} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none" />
                  <button onClick={handlePaymentSubmit} className="w-full py-4 bg-brand-500 rounded-2xl font-bold">{t.verifyPayment}</button>
                </div>
              )}
              {paymentStep === 'processing' && <div className="py-10 text-center space-y-4"><Loader2 className="w-12 h-12 animate-spin mx-auto text-brand-500" /><p>{t.verifyingBlockchain}</p></div>}
              {paymentStep === 'success' && <div className="py-10 text-center space-y-4"><Check className="w-12 h-12 text-green-500 mx-auto" /><p>{t.paymentConfirmed}</p></div>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-12 border-t border-white/5 text-center text-white/20 text-[10px] font-bold uppercase tracking-widest">
        VisionPro AI • 2026
      </footer>
    </div>
  );
}

export default function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
